// lib/k6-runner.tsx
import { spawn, ChildProcess } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';
import path from 'path';
import { EventEmitter } from 'events';
import { createReadStream } from 'fs';
import readline from 'readline';

export interface TestConfig {
  request: {
    method: string;
    url: string;
    headers: Record<string, string>;
    body?: string;
    excelData?: any[];
    useExcelLoop?: boolean;
    selectedExcelColumns?: string[];
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
  useRestAPI?: boolean;
  useInfluxDB?: boolean;
  influxDBURL?: string;
  influxDBUser?: string;
  influxDBPass?: string;
  runnerTag?: string;
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
  useRestAPI: boolean;
  useInfluxDB: boolean;
  isCompleted: boolean;
  elapsedSeconds?: number;
  remainingSeconds?: number;
  totalDurationSeconds?: number;
  _pollInterval?: NodeJS.Timeout;
  _safetyInterval?: NodeJS.Timeout;
  _lastProgressUpdate?: number;
  _lastEmittedProgress?: number;
  _startTimestamp: number;
  _durationSeconds: number;
  _lastEmitTime: number;
  _testCompleted: boolean;
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
  script += `  const vu = __VU;\n`;
  script += `  const iter = __ITER;\n`;
  script += `  const progress = exec.scenario.progress;\n`;
  script += `  const percent = Math.round(progress * 100);\n`;
  script += `  console.log(JSON.stringify({ type: 'progress', percent, vu, iter, timestamp: Date.now() }));\n\n`;

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

function generateScriptWithExcelData(config: TestConfig, excelData: any[], selectedColumns: string[]): string {
  const { request, options = {}, env = {} } = config;

  let script = `import http from 'k6/http';\n`;
  script += `import { check, sleep } from 'k6';\n`;
  script += `import exec from 'k6/execution';\n\n`;

  script += `const excelData = ${JSON.stringify(excelData)};\n\n`;
  script += `const selectedColumns = ${JSON.stringify(selectedColumns)};\n\n`;

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
  script += `  const vu = __VU;\n`;
  script += `  const iter = __ITER;\n`;
  script += `  const progress = exec.scenario.progress;\n`;
  script += `  const percent = Math.round(progress * 100);\n`;
  script += `  console.log(JSON.stringify({ type: 'progress', percent, vu, iter, timestamp: Date.now() }));\n\n`;

  script += `  for (let i = 0; i < excelData.length; i++) {\n`;
  script += `    const row = excelData[i];\n`;
  script += `    const rowData = {};\n`;
  script += `    selectedColumns.forEach(col => { rowData[col] = row[col]; });\n`;
  script += `    console.log(JSON.stringify({ type: 'excel_row', row: i + 1, total: excelData.length, data: rowData }));\n\n`;

  script += `    let url = '${request.url}';\n`;
  selectedColumns.forEach(col => {
    script += `    url = url.replace(/{{${col}}}/g, row['${col}'] || '');\n`;
  });
  script += `\n`;

  if (request.body) {
    try {
      const bodyObj = JSON.parse(request.body);
      let bodyStr = JSON.stringify(bodyObj);
      selectedColumns.forEach(col => {
        bodyStr = bodyStr.replace(new RegExp(`"{{${col}}}"`, 'g'), `"${'${row[\'' + col + '\']}'}"`);
        bodyStr = bodyStr.replace(new RegExp(`{{${col}}}`, 'g'), '${row[\'' + col + '\']}');
      });
      script += `    const payload = ${bodyStr};\n`;
    } catch {
      let bodyTemplate = request.body;
      selectedColumns.forEach(col => {
        bodyTemplate = bodyTemplate.replace(new RegExp(`{{${col}}}`, 'g'), '${row[\'' + col + '\']}');
      });
      script += `    const payload = \`${bodyTemplate}\`;\n`;
    }
  } else {
    script += `    const payload = null;\n`;
  }

  if (request.headers && Object.keys(request.headers).length > 0) {
    let headersStr = JSON.stringify(request.headers);
    selectedColumns.forEach(col => {
      headersStr = headersStr.replace(new RegExp(`"{{${col}}}"`, 'g'), `"${'${row[\'' + col + '\']}'}"`);
    });
    script += `    const headers = ${headersStr};\n`;
  } else {
    script += `    const headers = { 'Content-Type': 'application/json' };\n`;
  }

  const method = request.method.toUpperCase();
  switch (method) {
    case 'GET': script += `    const res = http.get(url, { headers });\n`; break;
    case 'POST': script += `    const res = http.post(url, JSON.stringify(payload), { headers });\n`; break;
    case 'PUT': script += `    const res = http.put(url, JSON.stringify(payload), { headers });\n`; break;
    case 'DELETE': script += `    const res = http.del(url, null, { headers });\n`; break;
    case 'PATCH': script += `    const res = http.patch(url, JSON.stringify(payload), { headers });\n`; break;
    default: script += `    const res = http.request('${method}', url, JSON.stringify(payload), { headers });\n`;
  }

  script += `\n    check(res, {\n`;
  script += `      'status is 200': (r) => r.status === 200,\n`;
  script += `      'response time < 500ms': (r) => r.timings.duration < 500,\n`;
  script += `    });\n\n`;
  script += `    sleep(1);\n`;
  script += `  }\n`;
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

function parseK6ConsoleLine(line: string, info: TestInfo): boolean {
  let changed = false;

  if (line.trim().startsWith('{')) {
    try {
      const data = JSON.parse(line);
      if (data.type === 'progress' && data.percent !== undefined) {
        if (data.percent !== info.progress) {
          info.progress = data.percent;
          info._lastProgressUpdate = Date.now();
          changed = true;
          console.log(`📈 Progress from JSON: ${data.percent}%`);
        }
        if (data.vu !== undefined && data.vu !== info.currentVUs) {
          info.currentVUs = data.vu;
          info.metrics.vus = data.vu;
          changed = true;
        }
        if (changed) {
          info._lastEmitTime = 0;
        }
        return changed;
      }
      if (data.type === 'excel_row') {
        const dataStr = data.data ? Object.entries(data.data).map(([k, v]) => `${k}:${v}`).join(', ') : '';
        info.stage = `Row ${data.row}/${data.total}: ${dataStr}`;
        const rowProgress = Math.round((data.row / data.total) * 100);
        if (rowProgress > info.progress) {
          info.progress = rowProgress;
          changed = true;
        }
        return changed;
      }
      if (data.type === 'Metric' && data.metric) {
        if (data.data?.value !== undefined) {
          info.metrics[data.metric] = data.data.value;
          changed = true;
        }
        if (data.data?.avg !== undefined) {
          info.metrics[`${data.metric}_avg`] = data.data.avg;
          changed = true;
        }
        if (data.data?.rate !== undefined) {
          info.metrics[`${data.metric}_rate`] = data.data.rate;
          changed = true;
        }
        return changed;
      }
    } catch (e) {
      // Not JSON
    }
  }

  // Parse "default [  10% ] 1 VUs  01.0s/10s"
  const k6ProgressRegex = /default\s*\[\s*(\d+)%\s*\]\s*(\d+)\s*VUs?\s*([\d.]+s)\/([\d.]+s)/i;
  const progressMatch = line.match(k6ProgressRegex);
  
  if (progressMatch) {
    const percent = parseInt(progressMatch[1]);
    const vus = parseInt(progressMatch[2]);
    const current = progressMatch[3];
    const total = progressMatch[4];
    
    if (percent !== info.progress) {
      info.progress = percent;
      info._lastProgressUpdate = Date.now();
      changed = true;
      console.log(`📈 Progress from k6 console: ${percent}%`);
    }
    
    if (vus !== info.currentVUs) {
      info.currentVUs = vus;
      info.metrics.vus = vus;
      changed = true;
    }
    
    info.stage = `${vus} VUs - ${current}/${total}`;
    changed = true;
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

    if (id === 'iterations' && sample.count !== undefined) {
      if (info.metrics.iterations !== sample.count) {
        info.metrics.iterations = sample.count;
        changed = true;
      }
    }
  }

  return changed;
}

export async function runK6Test(config: TestConfig): Promise<TestInfo> {
  return new Promise(async (resolve, reject) => {
    const testId = uuidv4();
    
    const hasExcelData = config.request.excelData && 
                         config.request.excelData.length > 0 && 
                         config.request.useExcelLoop &&
                         config.request.selectedExcelColumns &&
                         config.request.selectedExcelColumns.length > 0;
    
    let script: string;
    if (hasExcelData) {
      console.log(`📊 Using Excel data with ${config.request.excelData.length} rows`);
      script = generateScriptWithExcelData(
        config, 
        config.request.excelData!, 
        config.request.selectedExcelColumns!
      );
    } else {
      script = generateScript(config);
    }
    
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
      const useRestAPI = config.useRestAPI !== false;
      const useInfluxDB = config.useInfluxDB || false;

      // ✅ Add runner tag if provided
      if (config.runnerTag) {
        args.push('--tag', `runner_tag=${config.runnerTag}`);
      }
      // Always output JSON for parsing
      args.push('--out', `json=${resultsPath}`);

      // Add InfluxDB output if enabled
      if (useInfluxDB && config.influxDBURL) {
        let influxURL = config.influxDBURL;
        if (config.influxDBUser && config.influxDBPass) {
          const urlObj = new URL(influxURL);
          urlObj.username = config.influxDBUser;
          urlObj.password = config.influxDBPass;
          influxURL = urlObj.toString();
        }
        args.push('--out', `influxdb=${influxURL}`);
        console.log(`📊 InfluxDB output enabled: ${influxURL}`);
      }

      const env = {
        ...process.env,
        ...config.env,
        K6_WEB_DASHBOARD: useDashboard ? 'true' : 'false',
        K6_WEB_DASHBOARD_PORT: String(dashboardPort),
        K6_ADDRESS: useRestAPI ? `localhost:${restAPIPort}` : '',
        K6_EXPERIMENTAL: 'true',
        FORCE_COLOR: '1',
        K6_NO_USAGE_REPORT: 'true',
        K6_SUMMARY_TREND_STATS: 'min,avg,max,p(95),p(99)',
      };

      if (config.args) {
        args.push(...config.args.split(' '));
      }

      console.log(`🚀 Running test ${testId}`);
      console.log(`📋 Command: ${k6Path} ${args.join(' ')}`);

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
      let lastEmittedTime = 0;

      const durationSeconds = parseDurationToSeconds(config.options.duration || '30s');

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
        useRestAPI: useRestAPI,
        useInfluxDB: useInfluxDB,
        isCompleted: false,
        elapsedSeconds: 0,
        remainingSeconds: durationSeconds,
        totalDurationSeconds: durationSeconds,
        _lastProgressUpdate: Date.now(),
        _lastEmittedProgress: -1,
        _startTimestamp: Date.now(),
        _durationSeconds: durationSeconds,
        _lastEmitTime: 0,
        _testCompleted: false,
      };

      runningTests.set(testId, info);

      const calculateProgress = () => {
        const elapsed = (Date.now() - info._startTimestamp) / 1000;
        const progress = Math.min(100, Math.round((elapsed / durationSeconds) * 100));
        return { elapsed, progress };
      };

      const emitUpdate = (force = false) => {
        const now = Date.now();
        
        if (!force && now - info._lastEmitTime < 100) return;
        info._lastEmitTime = now;
        
        const { elapsed, progress } = calculateProgress();
        info.elapsedSeconds = Math.round(elapsed);
        info.remainingSeconds = Math.max(0, durationSeconds - Math.round(elapsed));
        
        if (info.progress === 0 && progress > 0) {
          info.progress = progress;
        }

        if (force || info.progress !== info._lastEmittedProgress || now - lastEmittedTime > 200) {
          info._lastEmittedProgress = info.progress;
          lastEmittedTime = now;
          
          runningTests.set(testId, { ...info });
          
          const { process, ...clean } = info;
          emitter.emit('update', clean);
          console.log(`📤 Emitted: progress=${info.progress}%, status=${info.status}`);
        }
      };

      setTimeout(() => {
        emitUpdate(true);
        console.log('📤 Initial update sent');
      }, 50);

      let pollInterval: NodeJS.Timeout | null = null;
      if (useRestAPI) {
        pollInterval = setInterval(async () => {
          try {
            const data = await fetchMetricsFromRESTAPI(restAPIPort);
            if (data) {
              const changed = processMetricsFromRESTAPI(data, info);
              if (changed) {
                runningTests.set(testId, { ...info });
                emitUpdate();
              }
            }
          } catch (error) {
            // Silent fail
          }
        }, 200);
        info._pollInterval = pollInterval;
        console.log(`🔌 REST API polling enabled on port ${restAPIPort}`);
      }

      let buffer = '';
      k6Process.stdout.on('data', (data) => {
        const chunk = data.toString();
        stdout += chunk;
        buffer += chunk;

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim()) {
            const changed = parseK6ConsoleLine(line, info);
            if (changed) {
              runningTests.set(testId, { ...info });
              emitUpdate(true);
            }
            if (!line.trim().startsWith('{')) {
              console.log(`[k6] ${line.trim()}`);
            }
          }
        }
      });

      k6Process.stderr.on('data', (data) => {
        const chunk = data.toString();
        stderr += chunk;
        if (chunk.trim().startsWith('{')) {
          const lines = chunk.split('\n');
          for (const line of lines) {
            if (line.trim().startsWith('{')) {
              const changed = parseK6ConsoleLine(line.trim(), info);
              if (changed) {
                runningTests.set(testId, { ...info });
                emitUpdate(true);
              }
            }
          }
        } else {
          console.error(`[k6 stderr] ${chunk.trim()}`);
        }
      });

      const safetyInterval = setInterval(() => {
        if (info.status === 'running' && !info._testCompleted) {
          const { elapsed, progress } = calculateProgress();
          info.elapsedSeconds = Math.round(elapsed);
          info.remainingSeconds = Math.max(0, durationSeconds - Math.round(elapsed));
          
          if (info.progress === 0 && progress > 0) {
            info.progress = progress;
            runningTests.set(testId, { ...info });
            emitUpdate(true);
            console.log(`⏰ Time-based progress: ${progress}%`);
          }
          
          runningTests.set(testId, { ...info });
          emitUpdate();
        } else {
          clearInterval(safetyInterval);
        }
      }, 200);
      info._safetyInterval = safetyInterval;

      k6Process.on('close', async (code) => {
        if (info.status === 'running') {
          info.status = code === 0 ? 'completed' : 'failed';
          info.exitCode = code;
          info.progress = 100;
          info.isCompleted = true;
          info.remainingSeconds = 0;
          info._testCompleted = true;

          if (pollInterval) {
            clearInterval(pollInterval);
            info._pollInterval = null;
          }
          clearInterval(safetyInterval);
          info._safetyInterval = null;

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
        info._testCompleted = true;
        if (pollInterval) {
          clearInterval(pollInterval);
          info._pollInterval = null;
        }
        clearInterval(safetyInterval);
        info._safetyInterval = null;
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
  if (!info || !info.process) {
    console.log(`❌ Test ${testId} not found`);
    return false;
  }

  console.log(`🛑 Terminating test ${testId}`);
  const restAPIPort = info.restAPIPort || 6565;

  if (info.useRestAPI !== false) {
    try {
      console.log(`🔄 Trying REST API termination on port ${restAPIPort}`);
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
        info._testCompleted = true;

        if (info._pollInterval) {
          clearInterval(info._pollInterval);
          info._pollInterval = null;
        }
        if (info._safetyInterval) {
          clearInterval(info._safetyInterval);
          info._safetyInterval = null;
        }

        runningTests.set(testId, { ...info });

        const emitter = testEmitters.get(testId);
        if (emitter) {
          const { process, ...clean } = info;
          emitter.emit('update', { ...clean, complete: true });
        }

        return true;
      }
    } catch (error) {
      console.log(`⚠️ REST API termination failed: ${error}`);
    }
  }

  if (info.process) {
    console.log(`🔄 Sending SIGTERM to process ${info.process.pid}`);
    info.process.kill('SIGTERM');
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    if (info.process.exitCode === null) {
      console.log(`🔄 Sending SIGKILL`);
      info.process.kill('SIGKILL');
    }
    
    info.status = 'terminated';
    info.progress = 100;
    info.isCompleted = true;
    info.remainingSeconds = 0;
    info._testCompleted = true;

    if (info._pollInterval) {
      clearInterval(info._pollInterval);
      info._pollInterval = null;
    }
    if (info._safetyInterval) {
      clearInterval(info._safetyInterval);
      info._safetyInterval = null;
    }

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