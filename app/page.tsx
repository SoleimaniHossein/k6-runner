// app/page.tsx
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import RequestForm from '@/components/RequestForm';
import K6Config from '@/components/K6Config';
import TestProgress from '@/components/TestProgress';
import TestResults from '@/components/TestResults';
import ThemeToggle from '@/components/ThemeToggle';

interface TestConfig {
  request: {
    method: string;
    url: string;
    headers: Record<string, string>;
    body: string;
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
  dashboardHost?: string;
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
    dashboardHost: 'localhost',
    dashboardPort: 5665,
    restAPIPort: 6565,
    useRestAPI: true,
    useInfluxDB: false,
    influxDBURL: 'http://localhost:8086/k6',
    influxDBUser: '',
    influxDBPass: '',
    runnerTag: 'login-test-001',
  });

  // UI State
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
  const confirmTimerRef = useRef<NodeJS.Timeout>();
  const testIdRef = useRef(testId);
  testIdRef.current = testId;

  // Load persisted state
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
          setDashboardUrl(state.dashboardUrl);
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

  // Persist state
  useEffect(() => {
    try {
      const state = {
        testId,
        isRunning,
        progress,
        statusMessage,
        currentStage,
        liveMetrics,
        currentVUs,
        dashboardUrl,
        showDashboard,
        elapsedTime,
        remainingTime,
        totalTime,
        timestamp: Date.now(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.error('Error persisting state:', error);
    }
  }, [
    testId,
    isRunning,
    progress,
    statusMessage,
    currentStage,
    liveMetrics,
    currentVUs,
    dashboardUrl,
    showDashboard,
    elapsedTime,
    remainingTime,
    totalTime,
  ]);

  const loadTests = useCallback(async () => {
    try {
      const response = await fetch('/api/test?action=list');
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      if (isMounted.current) {
        setTests(Array.isArray(data) ? data : []);
        // Auto-resume a running test from another tab
        const running = Array.isArray(data) ? data.find((t: any) => t.status === 'running') : null;
        if (running && !testId) {
          setTestId(running.id);
          setIsRunning(true);
          setProgress(running.progress || 0);
          setStatusMessage('Running...');
          setCurrentStage(running.stage || '');
          if (running.dashboardUrl) setDashboardUrl(running.dashboardUrl);
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

  useEffect(() => {
    loadTests();
  }, [loadTests]);

  useEffect(() => {
    return () => {
      isMounted.current = false;
      clearTimeout(confirmTimerRef.current);
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(null), 8000);
    return () => clearTimeout(timer);
  }, [error]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !isRunning && !loading) {
        runTest();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  // Refresh the tests list when test starts or completes
  useEffect(() => {
    loadTests();
  }, [isRunning, loadTests]);

  /**
   * Central update function
   */
  const updateState = useCallback((data: any) => {
    if (!isMounted.current) return;

    if (data.error) {
      setError(data.error);
      setIsRunning(false);
      setTestId(null);
      return;
    }

    // Update progress
    if (data.progress !== undefined) {
      setProgress(data.progress);
    }

    if (data.stage) {
      setCurrentStage(data.stage);
    }

    if (data.metrics) {
      setLiveMetrics(data.metrics);
      if (data.metrics.vus !== undefined) {
        setCurrentVUs(data.metrics.vus);
      }
    }

    if (data.status) {
      setStatusMessage(data.status);
    }

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

    // Keep the recent tests list in sync with live progress
    if (data.id) {
      setTests(prev => {
        const entry = {
          id: data.id,
          status: data.status || 'running',
          progress: data.progress ?? 0,
          config: data.config?.request?.url || data.config || '',
          stage: data.stage || '',
          elapsedSeconds: data.elapsedSeconds,
          remainingSeconds: data.remainingSeconds,
          totalDurationSeconds: data.totalDurationSeconds,
          fullConfig: data.config,
        };
        const filtered = prev.filter(t => t.id !== data.id);
        return [entry, ...filtered];
      });
    }

    if (data.dashboardUrl) {
      setDashboardUrl(data.dashboardUrl);
    }

    // ✅ Keep isRunning true if status is running
    if (data.status === 'running') {
      setIsRunning(true);
    }

    if (data.complete || data.status === 'completed' || 
        data.status === 'failed' || data.status === 'terminated') {
      setIsRunning(false);
      setTestResults(data);
      setTestId(null);
      setLiveMetrics({});
      setIsTerminating(false);

      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }

      loadTests();
    }
  }, [loadTests]);

  const updateStateRef = useRef(updateState);
  updateStateRef.current = updateState;

  useEffect(() => {
    if (!isRunning || !testId) return;

    let cancelled = false;
    let pollCount = 0;

    const poll = async () => {
      if (cancelled) return;
      pollCount++;
      try {
        const res = await fetch(`/api/test?action=status&id=${testId}`);
        if (!res.ok) {
          if (res.status === 404) return;
          return;
        }
        const data = await res.json();
        updateStateRef.current(data);
      } catch {
        // ignore polling errors
      }
    };

    const interval = setInterval(poll, 200);
    poll();

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isRunning, testId]);

  /**
   * Start test
   */
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

    // Dashboard URL
    if (testConfig.useDashboard) {
      const host = testConfig.dashboardHost || 'localhost';
      const port = testConfig.dashboardPort || 5665;
      const url = `http://${host}:${port}/ui/`;
      setDashboardUrl(url);
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
      clearTimeout(confirmTimerRef.current);
      confirmTimerRef.current = setTimeout(() => setConfirmingStop(false), 3000);
      return;
    }

    setConfirmingStop(false);
    setIsTerminating(true);

    try {
      const response = await fetch(`/api/test?action=terminate&id=${testId}`);
      
      if (response.ok) {
        setIsRunning(false);
        setTestId(null);
        setLiveMetrics({});
        setShowDashboard(false);
        setStatusMessage('Test terminated');

        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }

        await loadTests();
      } else {
        const err = await response.json();
        setError(`Terminate failed: ${err.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('❌ Terminate error:', error);
      setError('Failed to terminate test');
    } finally {
      setIsTerminating(false);
    }
  };

  const formatTime = (seconds: number) => {
    if (!seconds || seconds < 0) return '0s';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return mins > 0 ? `${mins}m${secs}s` : `${secs}s`;
  };

  return (
    <main className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] transition-colors duration-300">
      <header className="bg-gradient-to-r from-[var(--gradient-start)] to-[var(--gradient-end)] text-white shadow-lg">
        <div className="container mx-auto px-4 py-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🚀</span>
              <h1 className="text-3xl font-bold">K6 Test Runner</h1>
              {isRunning && (
                <span className="ml-3 px-3 py-1 bg-white/20 rounded-full text-sm animate-pulse">
                  ⏳ Running
                </span>
              )}
            </div>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-300 rounded-lg">
            ❌ {error}
            <button onClick={() => setError(null)} className="float-right font-bold">✕</button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <RequestForm
            request={testConfig.request}
            onChange={(request) => setTestConfig({ ...testConfig, request })}
          />
          <K6Config
            options={testConfig.options}
            envVars={testConfig.env}
            args={testConfig.args}
            output={testConfig.output}
            useDashboard={testConfig.useDashboard}
            dashboardHost={testConfig.dashboardHost}
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
          <div className="mb-8 bg-[var(--bg-card)] rounded-xl shadow-[var(--shadow-lg)] border border-[var(--border-color)] overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b border-[var(--border-color)]">
              <div className="flex items-center gap-2">
                <span className="text-xl">📊</span>
                <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                  K6 Live Dashboard
                </h3>
                {isRunning && (
                  <span className="ml-2 px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs rounded-full animate-pulse">
                    Live
                  </span>
                )}
              </div>
              <button
                onClick={() => setShowDashboard(false)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition text-[var(--text-secondary)]"
              >
                ✕
              </button>
            </div>
            <div className="relative" style={{ height: '600px' }}>
              <iframe
                src={dashboardUrl}
                className="w-full h-full border-0"
                title="K6 Web Dashboard"
                sandbox="allow-scripts allow-same-origin"
                allow="same-origin"
              />
            </div>
          </div>
        )}

        {/* Progress Bar */}
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

        {/* Action buttons */}
        <div className="flex gap-4 mb-8 flex-wrap">
          <button
            onClick={runTest}
            disabled={isRunning || loading}
            className="px-8 py-3 bg-gradient-to-r from-[var(--gradient-start)] to-[var(--gradient-end)] text-white font-semibold rounded-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? (
              <><span className="animate-spin">⏳</span> Starting...</>
            ) : isRunning ? (
              <><span className="animate-pulse">⏳</span> Running...</>
            ) : (
              <><span>▶️</span> Run Test</>
            )}
          </button>

          {dashboardUrl && !showDashboard && (
            <button
              onClick={() => setShowDashboard(true)}
              disabled={!isRunning}
              title={!isRunning ? 'Start a test first to view the dashboard' : ''}
              className="px-8 py-3 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-lg transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>📊</span> View Dashboard
            </button>
          )}

          {isRunning && (
            <button
              onClick={terminateTest}
              disabled={isTerminating}
              className={`px-8 py-3 font-semibold rounded-lg transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                confirmingStop
                  ? 'bg-red-600 hover:bg-red-700 text-white animate-pulse'
                  : 'bg-red-500 hover:bg-red-600 text-white'
              }`}
              title={confirmingStop ? 'Click again to confirm' : 'Stop the running test'}
            >
              {isTerminating ? (
                <><span className="animate-spin">⏳</span> Terminating...</>
              ) : confirmingStop ? (
                <><span>⚠️</span> Click again to stop</>
              ) : (
                <><span>⏹️</span> Stop Test</>
              )}
            </button>
          )}
        </div>

        {testResults && <TestResults results={testResults} />}

        {tests.length > 0 ? (
          <div className="bg-[var(--bg-card)] rounded-xl shadow-[var(--shadow-lg)] p-6 border border-[var(--border-color)]">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-[var(--text-primary)]">📊 Recent Tests</h2>
              <button
                onClick={() => setTests([])}
                className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition"
              >
                Clear all
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--border-color)]">
                    <th className="text-left py-2 px-3 text-sm font-semibold text-[var(--text-secondary)]">ID</th>
                    <th className="text-left py-2 px-3 text-sm font-semibold text-[var(--text-secondary)]">URL</th>
                    <th className="text-left py-2 px-3 text-sm font-semibold text-[var(--text-secondary)]">Progress</th>
                    <th className="text-left py-2 px-3 text-sm font-semibold text-[var(--text-secondary)]">Status</th>
                    <th className="text-left py-2 px-3 text-sm font-semibold text-[var(--text-secondary)]">Elapsed</th>
                    <th className="text-left py-2 px-3 text-sm font-semibold text-[var(--text-secondary)]">Stage</th>
                    <th className="text-left py-2 px-3 text-sm font-semibold text-[var(--text-secondary)]"></th>
                  </tr>
                </thead>
                <tbody>
                  {tests.slice(0, 10).map((test) => (
                    <tr key={test.id} className="border-b border-[var(--border-color)] hover:bg-[var(--bg-hover)] transition">
                      <td className="py-2 px-3 text-sm font-mono text-[var(--text-secondary)]">
                        {test.id.substring(0, 8)}
                      </td>
                      <td className="py-2 px-3 text-sm text-[var(--text-primary)] truncate max-w-xs">
                        {test.config}
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-[var(--gradient-start)] to-[var(--gradient-end)] transition-all duration-300"
                              style={{ width: `${test.progress || 0}%` }}
                            />
                          </div>
                          <span className="text-xs font-medium text-[var(--text-secondary)]">
                            {test.progress || 0}%
                          </span>
                        </div>
                      </td>
                      <td className="py-2 px-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${
                          test.status === 'running'
                            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 animate-pulse'
                            : test.status === 'completed'
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                            : test.status === 'failed'
                            ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                        }`}>
                          {test.status}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-sm text-[var(--text-secondary)]">
                        {test.elapsedSeconds ? formatTime(test.elapsedSeconds) : '-'}
                      </td>
                      <td className="py-2 px-3 text-sm text-[var(--text-secondary)] truncate max-w-xs">
                        {test.stage || '-'}
                      </td>
                      <td className="py-2 px-3">
                        {test.status !== 'running' && test.fullConfig && (
                          <button
                            onClick={() => {
                              setTestConfig(test.fullConfig);
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            className="text-xs px-2 py-1 bg-[var(--gradient-start)] text-white rounded hover:opacity-90 transition"
                            title="Load this test's config and run it again"
                          >
                            Retry
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="bg-[var(--bg-card)] rounded-xl shadow-[var(--shadow-lg)] p-6 border border-[var(--border-color)] text-center">
            <p className="text-[var(--text-muted)]">No tests run yet. Configure your test above and click <strong>Run Test</strong>.</p>
          </div>
        )}
      </div>
    </main>
  );
}