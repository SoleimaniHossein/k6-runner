'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Rocket, Play, Square, RotateCcw, LayoutDashboard, X, Clock, Activity, Trash2, ExternalLink } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import RequestForm, { RequestConfig } from '@/components/RequestForm';
import K6Config from '@/components/K6Config';
import TestProgress from '@/components/TestProgress';
import TestResults from '@/components/TestResults';
import ThemeToggle from '@/components/ThemeToggle';
import Badge from '@/components/ui/Badge';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';

interface TestConfig {
  request: {
    method: string;
    url: string;
    headers: Record<string, string>;
    body: string;
  };
  requests?: RequestConfig[];
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

const STORAGE_KEY = 'k6_test_state';

export default function Home() {
  const [testConfig, setTestConfig] = useState<TestConfig>({
    request: {
      method: 'GET',
      url: 'https://httpbin.io/get',
      headers: { 'Content-Type': 'application/json' },
      body: '',
    },
    requests: [{
      id: 'default-request',
      method: 'GET',
      url: 'https://httpbin.io/get',
      headers: { 'Content-Type': 'application/json' },
      body: '',
    }],
    options: {
      vus: 1,
      duration: '10s',
      stages: '',
      thresholds: '',
    },
    env: {},
    args: '',
    output: 'json',
    useDashboard: true,
    dashboardPort: 5665,
    restAPIPort: 6565,
    useRestAPI: true,
    useInfluxDB: false,
    influxDBURL: 'http://localhost:8086/k6',
    influxDBUser: '',
    influxDBPass: '',
    runnerTag: 'login-test-001',
  });

  const [isRunning, setIsRunning] = useState(false);
  const [testId, setTestId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [testResults, setTestResults] = useState<any>(null);
  const [tests, setTests] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [currentStage, setCurrentStage] = useState('');
  const [liveMetrics, setLiveMetrics] = useState<any>({});
  const [currentVUs, setCurrentVUs] = useState<number>(0);
  const [dashboardUrl, setDashboardUrl] = useState<string | undefined>(undefined);
  const [showDashboard, setShowDashboard] = useState(false);
  const [isTerminating, setIsTerminating] = useState(false);
  const [confirmingStop, setConfirmingStop] = useState(false);
  const [elapsedTime, setElapsedTime] = useState<string>('0s');
  const [remainingTime, setRemainingTime] = useState<string>('0s');
  const [totalTime, setTotalTime] = useState<string>('0s');

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMounted = useRef(true);
  const confirmTimerRef = useRef<NodeJS.Timeout | null>(null);
  const testIdRef = useRef(testId);
  testIdRef.current = testId;

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const state = JSON.parse(saved);
        if (state.testId && state.isRunning) {
          setTestId(state.testId);
          setIsRunning(state.isRunning);
          setProgress(state.progress || 0);
          setStatusMessage(state.statusMessage || '');
          setCurrentStage(state.currentStage || '');
          setLiveMetrics(state.liveMetrics || {});
          setCurrentVUs(state.currentVUs || 0);
          setDashboardUrl(resolveDashboardUrl(state.dashboardUrl));
          setShowDashboard(state.showDashboard || false);
          setElapsedTime(state.elapsedTime || '0s');
          setRemainingTime(state.remainingTime || '0s');
          setTotalTime(state.totalTime || '0s');
        }
      }
    } catch (error) {
      console.error('Error loading persisted state:', error);
    }
  }, []);

  useEffect(() => {
    try {
      const state = {
        testId, isRunning, progress, statusMessage, currentStage,
        liveMetrics, currentVUs, dashboardUrl, showDashboard,
        elapsedTime, remainingTime, totalTime, timestamp: Date.now(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.error('Error persisting state:', error);
    }
  }, [testId, isRunning, progress, statusMessage, currentStage, liveMetrics, currentVUs, dashboardUrl, showDashboard, elapsedTime, remainingTime, totalTime]);

  const loadTests = useCallback(async () => {
    try {
      const response = await fetch('/api/test?action=list');
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      if (isMounted.current) {
        setTests(Array.isArray(data) ? data : []);
        const running = Array.isArray(data) ? data.find((t: any) => t.status === 'running') : null;
        if (running && !testId) {
          setTestId(running.id);
          setIsRunning(true);
          setProgress(running.progress || 0);
          setStatusMessage('Running...');
          setCurrentStage(running.stage || '');
          if (running.dashboardUrl) setDashboardUrl(resolveDashboardUrl(running.dashboardUrl));
          if (running.elapsedSeconds) {
            const mins = Math.floor(running.elapsedSeconds / 60);
            const secs = running.elapsedSeconds % 60;
            setElapsedTime(mins > 0 ? `${mins}m${secs}s` : `${secs}s`);
          }
          if (running.totalDurationSeconds) {
            const mins = Math.floor(running.totalDurationSeconds / 60);
            const secs = running.totalDurationSeconds % 60;
            setTotalTime(mins > 0 ? `${mins}m${secs}s` : `${secs}s`);
          }
        }
      }
    } catch (error) {
      console.error('Error loading tests:', error);
      if (isMounted.current) setTests([]);
    }
  }, [testId]);

  useEffect(() => { loadTests(); }, [loadTests]);

  useEffect(() => {
    return () => {
      isMounted.current = false;
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
      if (pollIntervalRef.current) { clearInterval(pollIntervalRef.current); pollIntervalRef.current = null; }
    };
  }, []);

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(null), 8000);
    return () => clearTimeout(timer);
  }, [error]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !isRunning && !loading) runTest();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  useEffect(() => { loadTests(); }, [isRunning, loadTests]);

  const updateState = useCallback((data: any) => {
    if (!isMounted.current) return;

    if (data.error) { setError(data.error); setIsRunning(false); setTestId(null); return; }
    if (data.progress !== undefined) setProgress(data.progress);
    if (data.stage) setCurrentStage(data.stage);
    if (data.metrics) { setLiveMetrics(data.metrics); if (data.metrics.vus !== undefined) setCurrentVUs(data.metrics.vus); }
    if (data.status) setStatusMessage(data.status);

    if (data.elapsedSeconds !== undefined) {
      const mins = Math.floor(data.elapsedSeconds / 60);
      const secs = data.elapsedSeconds % 60;
      setElapsedTime(mins > 0 ? `${mins}m${secs}s` : `${secs}s`);
    }
    if (data.remainingSeconds !== undefined) {
      const mins = Math.floor(data.remainingSeconds / 60);
      const secs = data.remainingSeconds % 60;
      setRemainingTime(mins > 0 ? `${mins}m${secs}s` : `${secs}s`);
    }
    if (data.totalDurationSeconds !== undefined) {
      const mins = Math.floor(data.totalDurationSeconds / 60);
      const secs = data.totalDurationSeconds % 60;
      setTotalTime(mins > 0 ? `${mins}m${secs}s` : `${secs}s`);
    }

    if (data.id) {
      setTests(prev => {
        const entry = {
          id: data.id, status: data.status || 'running', progress: data.progress ?? 0,
          config: data.config?.request?.url || data.config || '', stage: data.stage || '',
          elapsedSeconds: data.elapsedSeconds, remainingSeconds: data.remainingSeconds,
          totalDurationSeconds: data.totalDurationSeconds, fullConfig: data.config,
        };
        return [entry, ...prev.filter(t => t.id !== data.id)];
      });
    }

    if (data.dashboardUrl) setDashboardUrl(resolveDashboardUrl(data.dashboardUrl));
    if (data.status === 'running') setIsRunning(true);

    if (data.complete || data.status === 'completed' || data.status === 'failed' || data.status === 'terminated') {
      setIsRunning(false);
      setTestResults(data);
      setTestId(null);
      setLiveMetrics({});
      setIsTerminating(false);
      if (pollIntervalRef.current) { clearInterval(pollIntervalRef.current); pollIntervalRef.current = null; }
      loadTests();
    }
  }, [loadTests]);

  const updateStateRef = useRef(updateState);
  updateStateRef.current = updateState;

  useEffect(() => {
    if (!isRunning || !testId) return;
    let cancelled = false;
    const poll = async () => {
      if (cancelled) return;
      try {
        const res = await fetch(`/api/test?action=status&id=${testId}`);
        if (!res.ok) return;
        const data = await res.json();
        updateStateRef.current(data);
      } catch { }
    };
    const interval = setInterval(poll, 200);
    poll();
    return () => { cancelled = true; clearInterval(interval); };
  }, [isRunning, testId]);

  const runTest = async () => {
    setIsRunning(true);
    setLoading(true);
    setError(null);
    setTestResults(null);
    setProgress(0);
    setStatusMessage('Starting test...');
    setLiveMetrics({});
    setCurrentStage('');
    setElapsedTime('0s');
    setRemainingTime('0s');
    setTotalTime(testConfig.options.duration || '10s');

    if (testConfig.useDashboard) {
      const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
      const port = testConfig.dashboardPort || 5665;
      setDashboardUrl(`http://${host}:${port}/ui/`);
    }
    setShowDashboard(false);
    setIsTerminating(false);

    try {
      const response = await fetch('/api/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testConfig),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to start test');
      }
      const data = await response.json();
      if (data.success && data.id) {
        setTestId(data.id);
        setStatusMessage('Running...');
        await loadTests();
        setTimeout(() => {
          document.getElementById('test-progress')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 300);
      } else {
        setError('Failed to start test');
        setIsRunning(false);
        setTestId(null);
      }
    } catch (error: any) {
      setError(error.message || 'Error running test');
      setIsRunning(false);
      setTestId(null);
    } finally {
      setLoading(false);
    }
  };

  const terminateTest = async () => {
    if (!testId || isTerminating) return;
    if (!confirmingStop) {
      setConfirmingStop(true);
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
      confirmTimerRef.current = setTimeout(() => setConfirmingStop(false), 3000);
      return;
    }
    setConfirmingStop(false);
    setIsTerminating(true);
    try {
      const response = await fetch(`/api/test?action=terminate&id=${testId}`);
      if (response.ok) {
        setIsRunning(false); setTestId(null); setLiveMetrics({}); setShowDashboard(false);
        setStatusMessage('Test terminated');
        if (pollIntervalRef.current) { clearInterval(pollIntervalRef.current); pollIntervalRef.current = null; }
        await loadTests();
      } else {
        const err = await response.json();
        setError(`Terminate failed: ${err.error || 'Unknown error'}`);
      }
    } catch {
      setError('Failed to terminate test');
    } finally {
      setIsTerminating(false);
    }
  };

  const formatTime = (seconds: number) => {
    if (!seconds || seconds < 0) return '0s';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  const resolveDashboardUrl = (url: string | undefined) => {
    if (!url) return undefined;
    try {
      const u = new URL(url);
      if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') u.hostname = window.location.hostname;
      return u.toString();
    } catch { return url; }
  };

  const statusBadgeVariant = (status: string) => {
    switch (status) {
      case 'running': return 'running';
      case 'completed': return 'completed';
      case 'failed': return 'failed';
      case 'terminated': return 'terminated';
      default: return 'default';
    }
  };

  return (
    <main className="min-h-screen bg-[var(--bg-primary)]">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-[var(--border-color)] bg-[var(--bg-card)]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-blue-600 shadow-md shadow-violet-500/20">
                <Rocket className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-[var(--text-primary)] tracking-tight">K6 Runner</h1>
              </div>
              {isRunning && (
                <Badge variant="running" pulse>
                  <Activity className="h-3 w-3" />
                  Running
                </Badge>
              )}
            </div>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Error */}
        {error && (
          <div className="mb-6 flex items-center gap-3 px-4 py-3 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 rounded-xl text-sm text-red-700 dark:text-red-300">
            <span className="flex-1">{error}</span>
            <button onClick={() => setError(null)} className="p-1 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-lg transition">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Config Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <RequestForm
            requests={testConfig.requests || [testConfig.request as any]}
            onChange={(requests) => {
              const first = requests[0];
              setTestConfig({
                ...testConfig,
                requests,
                request: first ? { method: first.method, url: first.url, headers: first.headers, body: first.body } : testConfig.request,
              });
            }}
          />
          <K6Config
            options={testConfig.options}
            envVars={testConfig.env}
            args={testConfig.args}
            output={testConfig.output}
            useDashboard={testConfig.useDashboard}
            dashboardPort={testConfig.dashboardPort}
            restAPIPort={testConfig.restAPIPort}
            useRestAPI={testConfig.useRestAPI}
            useInfluxDB={testConfig.useInfluxDB}
            influxDBURL={testConfig.influxDBURL}
            influxDBUser={testConfig.influxDBUser}
            influxDBPass={testConfig.influxDBPass}
            runnerTag={testConfig.runnerTag}
            onChange={(updates) => setTestConfig({ ...testConfig, ...updates })}
          />
        </div>

        {/* Dashboard iframe */}
        {showDashboard && dashboardUrl && (
          <Card noPadding className="mb-8">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-color)]">
              <div className="flex items-center gap-2">
                <LayoutDashboard className="h-4 w-4 text-[var(--text-muted)]" />
                <span className="text-sm font-medium text-[var(--text-primary)]">K6 Live Dashboard</span>
                {isRunning && <Badge variant="completed" pulse>Live</Badge>}
              </div>
              <button onClick={() => setShowDashboard(false)} className="p-1 hover:bg-[var(--bg-hover)] rounded-lg transition text-[var(--text-muted)]">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div style={{ height: '600px' }}>
              <iframe src={dashboardUrl} className="w-full h-full border-0" title="K6 Web Dashboard" sandbox="allow-scripts allow-same-origin" allow="same-origin" />
            </div>
          </Card>
        )}

        {/* Test Progress */}
        {isRunning && (
          <div id="test-progress">
            <TestProgress
              progress={progress}
              status={statusMessage || 'Running...'}
              onTerminate={terminateTest}
              metrics={liveMetrics}
              stage={currentStage}
              currentVUs={currentVUs}
              isTerminating={isTerminating}
              confirmingStop={confirmingStop}
              elapsedTime={elapsedTime}
              remainingTime={remainingTime}
              totalTime={totalTime}
            />
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-3 mb-8">
          <Button
            onClick={runTest}
            disabled={isRunning || loading}
            loading={loading}
            icon={!loading ? <Play className="h-4 w-4" /> : undefined}
            size="lg"
          >
            {loading ? 'Starting...' : isRunning ? 'Running...' : 'Run Test'}
          </Button>

          {dashboardUrl && !showDashboard && (
            <Button
              variant="secondary"
              onClick={() => setShowDashboard(true)}
              disabled={!isRunning}
              icon={<ExternalLink className="h-4 w-4" />}
              size="lg"
            >
              Dashboard
            </Button>
          )}

          {isRunning && (
            <Button
              variant="danger"
              onClick={terminateTest}
              disabled={isTerminating}
              loading={isTerminating}
              icon={!isTerminating ? <Square className="h-4 w-4" /> : undefined}
              size="lg"
              className={confirmingStop ? 'animate-pulse' : ''}
            >
              {isTerminating ? 'Terminating...' : confirmingStop ? 'Confirm Stop' : 'Stop Test'}
            </Button>
          )}

          <div className="ml-auto text-xs text-[var(--text-muted)] hidden sm:block">
            <kbd className="px-1.5 py-0.5 bg-[var(--bg-hover)] border border-[var(--border-color)] rounded text-[10px] font-mono">Ctrl+Enter</kbd>
            {' '}to run
          </div>
        </div>

        {/* Test Results */}
        {testResults && <TestResults results={testResults} />}

        {/* Recent Tests */}
        {tests.length > 0 ? (
          <Card noPadding className="overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)]">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-[var(--text-muted)]" />
                <h2 className="text-sm font-semibold text-[var(--text-primary)]">Recent Tests</h2>
                <span className="text-xs text-[var(--text-muted)]">({tests.length})</span>
              </div>
              <button
                onClick={() => setTests([])}
                className="flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--danger)] transition px-2 py-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/50"
              >
                <Trash2 className="h-3 w-3" />
                Clear
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border-color)] bg-[var(--bg-hover)]/50">
                    <th className="text-left py-2.5 px-4 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">ID</th>
                    <th className="text-left py-2.5 px-4 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">URL</th>
                    <th className="text-left py-2.5 px-4 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">Progress</th>
                    <th className="text-left py-2.5 px-4 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">Status</th>
                    <th className="text-left py-2.5 px-4 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">Elapsed</th>
                    <th className="text-left py-2.5 px-4 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">Stage</th>
                    <th className="py-2.5 px-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-color)]">
                  {tests.slice(0, 10).map((test) => (
                    <tr key={test.id} className="hover:bg-[var(--bg-hover)]/50 transition-colors">
                      <td className="py-2.5 px-4 font-mono text-xs text-[var(--text-muted)]">{test.id.substring(0, 8)}</td>
                      <td className="py-2.5 px-4 text-[var(--text-secondary)] truncate max-w-[200px]">{test.config}</td>
                      <td className="py-2.5 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-1.5 bg-[var(--bg-hover)] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-violet-600 to-blue-600 rounded-full transition-all duration-300"
                              style={{ width: `${test.progress || 0}%` }}
                            />
                          </div>
                          <span className="text-xs text-[var(--text-muted)] tabular-nums">{test.progress || 0}%</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-4">
                        <Badge variant={statusBadgeVariant(test.status)} pulse={test.status === 'running'}>
                          {test.status}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-4 text-xs text-[var(--text-muted)] tabular-nums">
                        {test.elapsedSeconds ? formatTime(test.elapsedSeconds) : '-'}
                      </td>
                      <td className="py-2.5 px-4 text-xs text-[var(--text-muted)] truncate max-w-[120px]">
                        {test.stage || '-'}
                      </td>
                      <td className="py-2.5 px-4">
                        {test.status !== 'running' && test.fullConfig && (
                          <button
                            onClick={() => {
                              const cfg = test.fullConfig;
                              if (cfg?.requests && cfg.requests.length > 0) {
                                setTestConfig(cfg);
                              } else if (cfg?.request) {
                                const req: RequestConfig = {
                                  id: uuidv4(),
                                  method: cfg.request.method,
                                  url: cfg.request.url,
                                  headers: cfg.request.headers,
                                  body: cfg.request.body || '',
                                };
                                setTestConfig({ ...cfg, requests: [req], request: cfg.request });
                              }
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            className="flex items-center gap-1 text-xs text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 transition px-2 py-1 rounded-lg hover:bg-violet-50 dark:hover:bg-violet-950/50"
                            title="Load this test's config and run it again"
                          >
                            <RotateCcw className="h-3 w-3" />
                            Retry
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        ) : (
          <Card className="text-center py-12">
            <div className="flex flex-col items-center gap-3">
              <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-[var(--bg-hover)]">
                <Activity className="h-6 w-6 text-[var(--text-muted)]" />
              </div>
              <div>
                <p className="text-sm text-[var(--text-secondary)]">No tests run yet</p>
                <p className="text-xs text-[var(--text-muted)] mt-1">Configure your test above and click Run Test</p>
              </div>
            </div>
          </Card>
        )}
      </div>
    </main>
  );
}
