// lib/k6-runner.ts
import { spawn, ChildProcess } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';
import path from 'path';
import { EventEmitter } from 'events';

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
  restAPIPort?: number;
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
  dashboardUrl?: string;
  lastUpdate: number;
  restAPIPort: number;
  useDashboard: boolean;
  isCompleted: boolean;
  elapsedSeconds?: number;
  remainingSeconds?: number;
  totalDurationSeconds?: number;
}

const runningTests = new Map<string, TestInfo>();
const testEmitters = new Map<string, EventEmitter>();

function generateScript(config: TestConfig): string {
  const { request, options = {}, env = {} } = config;

  let script = `import http from 'k6/http';\n`;
  script += `import { check, sleep } from 'k6';\n`;
  script += `import exec from 'k6/execution';\n\n`;

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
  script += `  const progress = exec.scenario.progress;\n`;
  script += `  const percent = Math.round(progress * 100);\n`;
  script += `  console.log(\`PROGRESS: \${percent}\`);\n\n`;

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

function parseDurationToSeconds(duration: string): number {
  const match = duration.match(/^(\d+)(s|m|h)$/);
  if (!match) return 30;
  const value = parseInt(match[1]);
  const unit = match[2];
  switch (unit) {
    case 's': return value;
    case 'm': return value * 60;
    case 'h': return value * 3600;
    default: return value;
  }
}

function parseStdoutLine(line: string, info: TestInfo): boolean {
  let changed = false;

  const progressMatch = line.match(/PROGRESS:\s*(\d+)/);
  if (progressMatch) {
    const percent = parseInt(progressMatch[1]);
    if (percent !== info.progress) {
      info.progress = percent;
      changed = true;
      console.log(`📈 Progress updated: ${percent}%`);
    }
  }

  const stageMatch = line.match(/default\s*\[\s*\d+%\s*\]\s*(\d+)\s*VUs\s*([\d.]+s)\/([\d.]+s)/);
  if (stageMatch) {
    const vus = parseInt(stageMatch[1]);
    const current = stageMatch[2];
    const total = stageMatch[3];
    if (vus !== info.currentVUs) {
      info.currentVUs = vus;
      info.stage = `${vus} VUs - ${current}/${total}`;
      changed = true;
    }
  }

  const dashboardMatch = line.match(/web dashboard:\s*(http:\/\/[^\s]+)/i);
  if (dashboardMatch) {
    const url = dashboardMatch[1];
    if (url !== info.dashboardUrl) {
      info.dashboardUrl = url;
      changed = true;
      console.log(`📍 Dashboard URL: ${url}`);
    }
  }

  return changed;
}

async function fetchMetricsFromRESTAPI(port: number): Promise<any> {
  try {
    const response = await fetch(`http://localhost:${port}/v1/metrics`);
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    return null;
  }
}

function processMetricsFromRESTAPI(data: any, info: TestInfo): boolean {
  let changed = false;
  if (!data?.data || !Array.isArray(data.data)) return changed;

  for (const metric of data.data) {
    if (metric.type !== 'metrics' || !metric.attributes) continue;
    const attrs = metric.attributes;
    const id = metric.id;
    const sample = attrs.sample;
    if (!sample) continue;

    if (id === 'http_reqs') {
      if (sample.count !== undefined && info.metrics.http_reqs !== sample.count) {
        info.metrics.http_reqs = sample.count;
        changed = true;
      }
      if (sample.rate !== undefined && info.metrics.http_reqs_rate !== sample.rate) {
        info.metrics.http_reqs_rate = sample.rate;
        changed = true;
      }
    }

    if (id === 'iterations') {
      if (sample.count !== undefined && info.metrics.iterations !== sample.count) {
        info.metrics.iterations = sample.count;
        changed = true;
      }
      if (sample.rate !== undefined && info.metrics.iterations_rate !== sample.rate) {
        info.metrics.iterations_rate = sample.rate;
        changed = true;
      }
    }

    if (id === 'http_req_duration' && sample.avg !== undefined) {
      if (info.metrics.http_req_duration !== sample.avg) {
        info.metrics.http_req_duration = sample.avg;
        changed = true;
      }
    }

    if (id === 'http_req_failed' && sample.rate !== undefined) {
      if (info.metrics.http_req_failed !== sample.rate) {
        info.metrics.http_req_failed = sample.rate;
        changed = true;
      }
    }

    if (id === 'vus' && sample.value !== undefined) {
      if (info.currentVUs !== sample.value) {
        info.currentVUs = sample.value;
        info.metrics.vus = sample.value;
        changed = true;
      }
    }

    if (id === 'data_received' && sample.rate !== undefined) {
      if (info.metrics.data_received_rate !== sample.rate) {
        info.metrics.data_received_rate = sample.rate;
        changed = true;
      }
    }

    if (id === 'data_sent' && sample.rate !== undefined) {
      if (info.metrics.data_sent_rate !== sample.rate) {
        info.metrics.data_sent_rate = sample.rate;
        changed = true;
      }
    }
  }

  return changed;
}

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
      const restAPIPort = config.restAPIPort || 6565;

      const env = {
        ...process.env,
        ...config.env,
        K6_WEB_DASHBOARD: useDashboard ? 'true' : 'false',
        K6_WEB_DASHBOARD_PORT: String(dashboardPort),
        K6_ADDRESS: `localhost:${restAPIPort}`,
        K6_EXPERIMENTAL: 'true',
        FORCE_COLOR: '1',
      };

      if (config.output === 'json') {
        args.push('--out', `json=${resultsPath}`);
      }
      if (config.args) {
        args.push(...config.args.split(' '));
      }

      console.log(`🚀 Running test ${testId}`);

      const k6Process = spawn(k6Path, args, {
        env,
        shell: true,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      const emitter = new EventEmitter();
      testEmitters.set(testId, emitter);

      let stdout = '';
      let stderr = '';
      let lastEmittedProgress = -1;

      const totalDurationSeconds = parseDurationToSeconds(config.options.duration || '30s');

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
        dashboardUrl: useDashboard ? `http://localhost:${dashboardPort}/ui/` : undefined,
        lastUpdate: Date.now(),
        restAPIPort: restAPIPort,
        useDashboard: useDashboard,
        isCompleted: false,
        elapsedSeconds: 0,
        remainingSeconds: totalDurationSeconds,
        totalDurationSeconds: totalDurationSeconds,
      };

      runningTests.set(testId, info);

      /**
       * ⭐ CRITICAL: EMIT UPDATE - This sends data to the frontend
       * AND updates runningTests so getTestStatus returns fresh data
       */
      const emitUpdate = (force = false) => {
        const now = Date.now();
        if (!force && now - info.lastUpdate < 100) return;
        info.lastUpdate = now;

        const elapsed = (Date.now() - new Date(info.startTime).getTime()) / 1000;
        info.elapsedSeconds = Math.round(elapsed);
        info.remainingSeconds = Math.max(0, totalDurationSeconds - Math.round(elapsed));

        if (force || info.progress !== lastEmittedProgress) {
          lastEmittedProgress = info.progress;
          
          // ⭐ CRITICAL FIX: Update runningTests with latest info
          runningTests.set(testId, { ...info });
          
          const { process, ...clean } = info;
          emitter.emit('update', clean);
          console.log(`📤 Emitted: progress=${info.progress}%, status=${info.status}`);
        }
      };

      // EMIT INITIAL UPDATE
      setTimeout(() => {
        emitUpdate(true);
        console.log('📤 Initial update sent');
      }, 100);

      // REST API Polling for metrics
      const pollInterval = setInterval(async () => {
        try {
          const data = await fetchMetricsFromRESTAPI(restAPIPort);
          if (data) {
            const changed = processMetricsFromRESTAPI(data, info);
            if (changed) {
              // ⭐ Update runningTests when metrics change
              runningTests.set(testId, { ...info });
              emitUpdate();
            }
          }
        } catch (error) {
          // Silent fail
        }
      }, 500);

      // Process stdout - MAIN SOURCE OF PROGRESS
      let buffer = '';
      k6Process.stdout.on('data', (data) => {
        const chunk = data.toString();
        stdout += chunk;
        buffer += chunk;

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim()) {
            const changed = parseStdoutLine(line, info);
            if (changed) {
              // ⭐ CRITICAL FIX: Update runningTests when progress changes
              runningTests.set(testId, { ...info });
              emitUpdate();
              console.log(`📤 Emitted update after progress change`);
            }
            console.log(`[k6] ${line.trim()}`);
          }
        }
      });

      // Handle stderr
      k6Process.stderr.on('data', (data) => {
        const chunk = data.toString();
        stderr += chunk;
        console.error(`[k6] ${chunk.trim()}`);
      });

      // Safety interval - emit every second as fallback
      const safetyInterval = setInterval(() => {
        if (info.status === 'running') {
          // ⭐ Update runningTests on safety interval too
          runningTests.set(testId, { ...info });
          emitUpdate();
        } else {
          clearInterval(safetyInterval);
        }
      }, 1000);

      // Handle process exit
      k6Process.on('close', async (code) => {
        if (info.status === 'running') {
          info.status = code === 0 ? 'completed' : 'failed';
          info.exitCode = code;
          info.progress = 100;
          info.isCompleted = true;
          info.remainingSeconds = 0;

          clearInterval(pollInterval);
          clearInterval(safetyInterval);

          // ⭐ Final update
          runningTests.set(testId, { ...info });
          emitUpdate(true);
          const { process, ...clean } = info;
          emitter.emit('update', { ...clean, complete: true });
          emitter.emit('complete', info);
          console.log(`✅ Test completed: ${info.status}`);
        }

        info.endTime = new Date().toISOString();
        info.stdout = stdout;
        info.stderr = stderr;

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
        info.isCompleted = true;
        clearInterval(pollInterval);
        clearInterval(safetyInterval);
        runningTests.set(testId, { ...info });
        emitter.emit('error', err);
        reject(err);
      });

    } catch (error: any) {
      reject(error);
    }
  });
}

export function getTestStatus(testId: string): TestInfo | null {
  const test = runningTests.get(testId);
  if (!test) return null;
  const { process, ...clean } = test;
  return clean as TestInfo;
}

export function getTestEmitter(testId: string): EventEmitter | null {
  return testEmitters.get(testId) || null;
}

export async function terminateTest(testId: string): Promise<boolean> {
  const info = runningTests.get(testId);
  if (!info || !info.process) return false;

  const restAPIPort = info.restAPIPort || 6565;

  try {
    const response = await fetch(`http://localhost:${restAPIPort}/v1/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: {
          type: 'status',
          id: 'default',
          attributes: {
            stopped: true,
          },
        },
      }),
    });

    if (response.ok) {
      console.log(`✅ Test ${testId} terminated via REST API`);
      info.status = 'terminated';
      info.progress = 100;
      info.isCompleted = true;
      info.remainingSeconds = 0;

      runningTests.set(testId, { ...info });

      const emitter = testEmitters.get(testId);
      if (emitter) {
        const { process, ...clean } = info;
        emitter.emit('update', { ...clean, complete: true });
      }

      return true;
    }

    if (info.process) {
      info.process.kill('SIGTERM');
      info.status = 'terminated';
      info.progress = 100;
      info.isCompleted = true;
      info.remainingSeconds = 0;

      runningTests.set(testId, { ...info });

      const emitter = testEmitters.get(testId);
      if (emitter) {
        const { process, ...clean } = info;
        emitter.emit('update', { ...clean, complete: true });
      }

      return true;
    }

    return false;
  } catch (error) {
    if (info.process) {
      info.process.kill('SIGTERM');
      info.status = 'terminated';
      info.progress = 100;
      info.isCompleted = true;
      info.remainingSeconds = 0;

      runningTests.set(testId, { ...info });

      const emitter = testEmitters.get(testId);
      if (emitter) {
        const { process, ...clean } = info;
        emitter.emit('update', { ...clean, complete: true });
      }

      return true;
    }

    return false;
  }
}

export function listTests() {
  return Array.from(runningTests.values()).map(({
    id,
    status,
    progress,
    startTime,
    config,
    stage,
    dashboardUrl,
    isCompleted,
    elapsedSeconds,
    remainingSeconds,
    totalDurationSeconds,
  }) => ({
    id,
    status,
    progress,
    startTime,
    config: config.request.url,
    stage: stage || '',
    dashboardUrl,
    isCompleted: isCompleted || false,
    elapsedSeconds: elapsedSeconds || 0,
    remainingSeconds: remainingSeconds || 0,
    totalDurationSeconds: totalDurationSeconds || 0,
  }));
}
