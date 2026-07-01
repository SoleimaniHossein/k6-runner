import { spawn } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';
import path from 'path';

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
  };
  env: Record<string, string>;
  args: string;
  output: string;
}

export interface TestInfo {
  id: string;
  process: any;
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
}

const runningTests = new Map<string, TestInfo>();

export function generateTestScript(testConfig: TestConfig): string {
  const { request, options = {}, env = {} } = testConfig;

  let script = `import http from 'k6/http';\n`;
  script += `import { check, sleep } from 'k6';\n\n`;

  if (Object.keys(options).length > 0) {
    const cleanOptions = { ...options };
    if (cleanOptions.stages) {
      try {
        cleanOptions.stages = JSON.parse(cleanOptions.stages as string);
      } catch {
        delete cleanOptions.stages;
      }
    }
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
    case 'GET':
      script += `  const res = http.get(url, { headers });\n`;
      break;
    case 'POST':
      script += `  const res = http.post(url, JSON.stringify(payload), { headers });\n`;
      break;
    case 'PUT':
      script += `  const res = http.put(url, JSON.stringify(payload), { headers });\n`;
      break;
    case 'DELETE':
      script += `  const res = http.del(url, null, { headers });\n`;
      break;
    case 'PATCH':
      script += `  const res = http.patch(url, JSON.stringify(payload), { headers });\n`;
      break;
    default:
      script += `  const res = http.request('${method}', url, JSON.stringify(payload), { headers });\n`;
  }

  script += `\n  check(res, {\n`;
  script += `    'status is 200': (r) => r.status === 200,\n`;
  script += `    'response time < 500ms': (r) => r.timings.duration < 500,\n`;
  script += `  });\n\n`;
  script += `  sleep(1);\n`;
  script += `}\n`;

  return script;
}

export async function runK6Test(testConfig: TestConfig): Promise<TestInfo> {
  return new Promise(async (resolve, reject) => {
    const testId = uuidv4();
    const script = generateTestScript(testConfig);
    
    const tempDir = path.join(process.cwd(), 'temp');
    const scriptPath = path.join(tempDir, `test-${testId}.js`);
    const resultsPath = path.join(tempDir, `results-${testId}.json`);

    try {
      await fs.mkdir(tempDir, { recursive: true });
      await fs.writeFile(scriptPath, script);

      const k6Path = process.env.K6_PATH || 'k6';
      const args = ['run', scriptPath];
      
      if (testConfig.output === 'json') {
        args.push('--out', `json=${resultsPath}`);
      }
      
      if (testConfig.args) {
        args.push(...testConfig.args.split(' '));
      }

      const env = {
        ...process.env,
        ...testConfig.env
      };

      console.log(`🚀 Running k6 test ${testId}: ${k6Path} ${args.join(' ')}`);

      const k6Process = spawn(k6Path, args, {
        env,
        shell: true
      });

      let stdout = '';
      let stderr = '';
      let progress = 0;

      const testInfo: TestInfo = {
        id: testId,
        process: k6Process,
        scriptPath,
        resultsPath,
        stdout: '',
        stderr: '',
        status: 'running',
        progress: 0,
        startTime: new Date().toISOString(),
        config: testConfig,
        metrics: {}
      };

      runningTests.set(testId, testInfo);

      k6Process.stdout.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        
        const match = output.match(/(\d+)%/);
        if (match) {
          progress = parseInt(match[1]);
          testInfo.progress = progress;
        }

        console.log(`[k6-${testId}] ${output.trim()}`);
      });

      k6Process.stderr.on('data', (data) => {
        const output = data.toString();
        stderr += output;
        console.error(`[k6-${testId}] ${output}`);
      });

      k6Process.on('close', async (code) => {
        testInfo.status = code === 0 ? 'completed' : 'failed';
        testInfo.exitCode = code;
        testInfo.endTime = new Date().toISOString();
        testInfo.progress = 100;
        testInfo.stdout = stdout;
        testInfo.stderr = stderr;

        if (testConfig.output === 'json') {
          try {
            const results = await fs.readFile(resultsPath, 'utf-8');
            testInfo.results = results;
            
            const lines = results.split('\n').filter(line => line.trim());
            for (const line of lines) {
              if (line.includes('"type":"Metric"')) {
                try {
                  const data = JSON.parse(line);
                  if (data.data && data.data.value !== undefined) {
                    testInfo.metrics[data.metric] = data.data.value;
                  }
                } catch {}
              }
            }
          } catch (err) {
            console.error('Failed to read results file:', err);
          }
        }

        try {
          await fs.unlink(scriptPath).catch(() => {});
          if (testConfig.output === 'json') {
            await fs.unlink(resultsPath).catch(() => {});
          }
        } catch (err) {
          console.error('Failed to clean up temp files:', err);
        }

        resolve(testInfo);
      });

      k6Process.on('error', (err) => {
        testInfo.status = 'error';
        testInfo.error = err.message;
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
  
  const { process, ...cleanTest } = test;
  return cleanTest as TestInfo;
}

export function terminateTest(testId: string): boolean {
  const testInfo = runningTests.get(testId);
  if (testInfo && testInfo.process) {
    testInfo.process.kill('SIGTERM');
    testInfo.status = 'terminated';
    testInfo.progress = 100;
    return true;
  }
  return false;
}

export function listTests() {
  return Array.from(runningTests.values()).map(({ id, status, progress, startTime, config }) => ({
    id,
    status,
    progress,
    startTime,
    config: config.request.url
  }));
}
