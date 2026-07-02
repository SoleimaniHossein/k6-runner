// lib/k6-runner.ts
import { spawn, ChildProcess } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';
import path from 'path';
import { EventEmitter } from 'events';
import { K6DashboardClient, DashboardMetrics } from './dashboard-client';

export interface TestConfig {
  request: {
    method: string;
    url: string;
    headers: Record<string, string>;
    body?: string;
  };
  options: {
    vus: number;
    duration: string;
    stages?: string;
    thresholds?: string;
  };
  env: Record<string, string>;
  args: string;
  output: string;
  useDashboard?: boolean;
  dashboardPort?: number;
}

export interface TestInfo {
  id: string;
  process: ChildProcess | null;
  scriptPath: string;
  resultsPath: string;
  stdout: string;
  stderr: string;
  status: 'running' | 'completed' | 'failed' | 'terminated' | 'error';
  progress: number;
  startTime: string;
  endTime?: string;
  exitCode?: number;
  results?: string;
  config: TestConfig;
  metrics: Record<string, any>;
  error?: string;
  stage?: string;
  currentVUs?: number;
  currentTime?: string;
  totalTime?: string;
  dashboardUrl?: string;
  dashboardClient?: K6DashboardClient;
}

const runningTests = new Map<string, TestInfo>();
const testEmitters = new Map<string, EventEmitter>();

/**
 * Generate K6 test script
 */
function generateScript(config: TestConfig): string {
  const { request, options = {}, env = {} } = config;

  let script = `import http from 'k6/http';\n`;
  script += `import { check, sleep } from 'k6';\n\n`;

  const cleanOptions: any = { ...options };
  if (cleanOptions.stages) {
    try { cleanOptions.stages = JSON.parse(cleanOptions.stages); } catch { delete cleanOptions.stages; }
  }
  if (cleanOptions.thresholds) {
    try { cleanOptions.thresholds = JSON.parse(cleanOptions.thresholds); } catch { delete cleanOptions.thresholds; }
  }

  Object.keys(cleanOptions).forEach(key => {
    if (cleanOptions[key] === '' || cleanOptions[key] === null || cleanOptions[key] === undefined) {
      delete cleanOptions[key];
    }
  });

  if (Object.keys(cleanOptions).length > 0) {
    script += `export const options = ${JSON.stringify(cleanOptions, null, 2)};\n\n`;
  }

  if (Object.keys(env).length > 0) {
    Object.entries(env).forEach(([key, value]) => {
      script += `const ${key} = __ENV.${key} || '${value}';\n`;
    });
    script += '\n';
  }

  script += `export default function() {\n`;
  script += `  const url = '${request.url}';\n`;

  if (request.body) {
    try {
      JSON.parse(request.body);
      script += `  const payload = ${request.body};\n`;
    } catch {
      script += `  const payload = '${request.body.replace(/'/g, "\\'")}';\n`;
    }
  } else {
    script += `  const payload = null;\n`;
  }

  if (request.headers && Object.keys(request.headers).length > 0) {
    script += `  const headers = ${JSON.stringify(request.headers)};\n`;
  } else {
    script += `  const headers = { 'Content-Type': 'application/json' };\n`;
  }

  const method = request.method.toUpperCase();
  switch (method) {
    case 'GET': script += `  const res = http.get(url, { headers });\n`; break;
    case 'POST': script += `  const res = http.post(url, JSON.stringify(payload), { headers });\n`; break;
    case 'PUT': script += `  const res = http.put(url, JSON.stringify(payload), { headers });\n`; break;
    case 'DELETE': script += `  const res = http.del(url, null, { headers });\n`; break;
    case 'PATCH': script += `  const res = http.patch(url, JSON.stringify(payload), { headers });\n`; break;
    default: script += `  const res = http.request('${method}', url, JSON.stringify(payload), { headers });\n`;
  }

  script += `\n  check(res, {\n`;
  script += `    'status is 200': (r) => r.status === 200,\n`;
  script += `    'response time < 500ms': (r) => r.timings.duration < 500,\n`;
  script += `  });\n\n`;
  script += `  sleep(1);\n`;
  script += `}\n`;

  return script;
}

/**
 * Run K6 test with WebSocket Dashboard integration
 */
export async function runK6Test(config: TestConfig): Promise<TestInfo> {
  return new Promise(async (resolve, reject) => {
    const testId = uuidv4();
    const script = generateScript(config);
    const tempDir = path.join(process.cwd(), 'temp');
    const scriptPath = path.join(tempDir, `test-${testId}.js`);
    const resultsPath = path.join(tempDir, `results-${testId}.json`);

    try {
      await fs.mkdir(tempDir, { recursive: true });
      await fs.writeFile(scriptPath, script);

      const k6Path = process.env.K6_PATH || 'k6';
      const args = ['run', scriptPath];

      const useDashboard = config.useDashboard !== false;
      const dashboardPort = config.dashboardPort || 5665;

      const env = {
        ...process.env,
        ...config.env,
        K6_WEB_DASHBOARD: useDashboard ? 'true' : 'false',
        K6_WEB_DASHBOARD_PORT: String(dashboardPort),
        K6_EXPERIMENTAL: 'true',
        FORCE_COLOR: '1',
      };

      if (config.output === 'json') {
        args.push('--out', `json=${resultsPath}`);
      }
      if (config.args) {
        args.push(...config.args.split(' '));
      }

      console.log(`🚀 Running test ${testId}: ${k6Path} ${args.join(' ')}`);

      const k6Process = spawn(k6Path, args, {
        env,
        shell: true,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      const emitter = new EventEmitter();
      testEmitters.set(testId, emitter);

      let stdout = '';
      let stderr = '';

      const info: TestInfo = {
        id: testId,
        process: k6Process,
        scriptPath,
        resultsPath,
        stdout: '',
        stderr: '',
        status: 'running',
        progress: 0,
        startTime: new Date().toISOString(),
        config,
        metrics: {},
        stage: '',
        currentVUs: 0,
        currentTime: '',
        totalTime: '',
        dashboardUrl: undefined,
      };

      runningTests.set(testId, info);

      // If dashboard is enabled, connect to WebSocket
      if (useDashboard) {
        const dashboardClient = new K6DashboardClient(dashboardPort);
        info.dashboardClient = dashboardClient;

        // Listen for real-time metrics from dashboard
        dashboardClient.on('metrics', (metrics: DashboardMetrics) => {
          // Update test info with dashboard metrics
          info.progress = metrics.progress;
          info.currentVUs = metrics.vu;
          info.metrics = {
            ...info.metrics,
            http_req_duration: metrics.http_req_duration,
            http_reqs: metrics.http_reqs,
            http_req_failed: metrics.http_req_failed,
            vus: metrics.vu,
            iterations: metrics.iterations,
          };

          // Build stage string
          if (metrics.stage) {
            info.stage = metrics.stage;
          } else if (metrics.currentTime && metrics.totalTime) {
            info.stage = `${metrics.vu} VUs - ${metrics.currentTime}/${metrics.totalTime}`;
          }

          // Dashboard URL
          if (!info.dashboardUrl) {
            info.dashboardUrl = `http://localhost:${dashboardPort}/ui/`;
          }

          // Emit update
          const { process: _, dashboardClient: __, ...clean } = info;
          emitter.emit('update', clean);
        });

        dashboardClient.on('complete', (metrics: DashboardMetrics) => {
          info.status = metrics.status;
          info.progress = 100;
          const { process: _, dashboardClient: __, ...clean } = info;
          emitter.emit('update', { ...clean, complete: true });
          emitter.emit('complete', info);
        });

        dashboardClient.on('error', (error) => {
          console.error('Dashboard client error:', error);
          // Don't fail the test if dashboard fails - we still have stdout
        });

        // Connect to dashboard
        dashboardClient.connect();

        // Store dashboard URL
        setTimeout(() => {
          if (!info.dashboardUrl) {
            info.dashboardUrl = `http://localhost:${dashboardPort}/ui/`;
          }
        }, 1000);
      }

      // Still capture stdout for fallback and debugging
      let buffer = '';
      k6Process.stdout.on('data', (data) => {
        const chunk = data.toString();
        stdout += chunk;
        buffer += chunk;

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim()) {
            // Parse only dashboard URL from stdout
            const dashboardMatch = line.match(/Web dashboard is available at (http:\/\/[^\s]+)/);
            if (dashboardMatch && !info.dashboardUrl) {
              info.dashboardUrl = dashboardMatch[1];
              const { process: _, dashboardClient: __, ...clean } = info;
              emitter.emit('update', clean);
            }
            console.log(`[k6-${testId}] ${line.trim()}`);
          }
        }
      });

      k6Process.stderr.on('data', (data) => {
        const chunk = data.toString();
        stderr += chunk;
        console.error(`[k6-${testId}] ${chunk.trim()}`);
      });

      k6Process.on('close', async (code) => {
        // If dashboard didn't send complete event, we do it here
        if (info.status === 'running') {
          info.status = code === 0 ? 'completed' : 'failed';
          info.exitCode = code;
          info.progress = 100;
          const { process: _, dashboardClient: __, ...clean } = info;
          emitter.emit('update', { ...clean, complete: true });
          emitter.emit('complete', info);
        }

        info.endTime = new Date().toISOString();
        info.stdout = stdout;
        info.stderr = stderr;

        // Read JSON results if available
        if (config.output === 'json') {
          try {
            await fs.access(resultsPath);
            const results = await fs.readFile(resultsPath, 'utf-8');
            info.results = results;

            const lines = results.split('\n').filter(line => line.trim());
            for (const line of lines) {
              try {
                const data = JSON.parse(line);
                if (data.type === 'Metric' && data.data?.value !== undefined) {
                  info.metrics[data.metric] = data.data.value;
                }
              } catch {}
            }
          } catch (err) {
            console.warn('Could not read results file:', err);
          }
        }

        // Cleanup dashboard client
        if (info.dashboardClient) {
          info.dashboardClient.disconnect();
          info.dashboardClient = undefined;
        }

        // Cleanup temp files
        try {
          await fs.unlink(scriptPath).catch(() => {});
          await fs.unlink(resultsPath).catch(() => {});
        } catch (err) {
          console.error('Cleanup error:', err);
        }

        setTimeout(() => testEmitters.delete(testId), 60000);
        resolve(info);
      });

      k6Process.on('error', (err) => {
        info.status = 'error';
        info.error = err.message;

        if (info.dashboardClient) {
          info.dashboardClient.disconnect();
          info.dashboardClient = undefined;
        }

        emitter.emit('error', err);
        reject(err);
      });

      // Send initial update
      const { process: _, dashboardClient: __, ...clean } = info;
      emitter.emit('update', clean);

    } catch (error: any) {
      reject(error);
    }
  });
}

/**
 * Get current test status
 */
export function getTestStatus(testId: string): TestInfo | null {
  const test = runningTests.get(testId);
  if (!test) return null;
  const { process, dashboardClient, ...clean } = test;
  return clean;
}

/**
 * Get test event emitter
 */
export function getTestEmitter(testId: string): EventEmitter | null {
  return testEmitters.get(testId) || null;
}

/**
 * Terminate a running test
 */
export function terminateTest(testId: string): boolean {
  const info = runningTests.get(testId);
  if (info && info.process) {
    info.process.kill('SIGTERM');
    info.status = 'terminated';
    info.progress = 100;

    if (info.dashboardClient) {
      info.dashboardClient.disconnect();
      info.dashboardClient = undefined;
    }

    const emitter = testEmitters.get(testId);
    if (emitter) {
      const { process, dashboardClient, ...clean } = info;
      emitter.emit('update', { ...clean, complete: true });
    }
    return true;
  }
  return false;
}

/**
 * List all tests
 */
export function listTests() {
  return Array.from(runningTests.values()).map(({
    id, status, progress, startTime, config, stage, dashboardUrl
  }) => ({
    id,
    status,
    progress,
    startTime,
    config: config.request.url,
    stage: stage || '',
    dashboardUrl,
  }));
}
