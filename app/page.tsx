'use client';

import { useState, useEffect } from 'react';
import RequestForm from '@/components/RequestForm';
import K6Config from '@/components/K6Config';
import TestProgress from '@/components/TestProgress';
import TestResults from '@/components/TestResults';

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
  };
  env: Record<string, string>;
  args: string;
  output: string;
}

export default function Home() {
  const [testConfig, setTestConfig] = useState<TestConfig>({
    request: {
      method: 'GET',
      url: 'https://httpbin.org/get',
      headers: { 'Content-Type': 'application/json' },
      body: ''
    },
    options: {
      vus: 1,
      duration: '10s'
    },
    env: {},
    args: '',
    output: 'json'
  });

  const [isRunning, setIsRunning] = useState(false);
  const [testId, setTestId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [testResults, setTestResults] = useState<any>(null);
  const [tests, setTests] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState('');

  const loadTests = async () => {
    try {
      const response = await fetch('/api/test?action=list');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setTests(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error loading tests:', error);
      setTests([]);
    }
  };

  useEffect(() => {
    loadTests();
  }, []);

  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    
    if (isRunning && testId) {
      intervalId = setInterval(async () => {
        try {
          const response = await fetch(`/api/test?action=status&id=${testId}`);
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          const data = await response.json();
          
          setProgress(data.progress || 0);
          setStatusMessage(data.status || '');
          
          if (data.status !== 'running') {
            setIsRunning(false);
            setTestResults(data);
            setTestId(null);
            await loadTests();
          }
        } catch (error) {
          console.error('Error checking test status:', error);
        }
      }, 1000);
    }

    return () => clearInterval(intervalId);
  }, [isRunning, testId]);

  const runTest = async () => {
    setLoading(true);
    setError(null);
    setTestResults(null);
    setProgress(0);
    setStatusMessage('');

    try {
      // Validate JSON body
      if (testConfig.request.body && testConfig.request.headers['Content-Type']?.includes('application/json')) {
        try {
          JSON.parse(testConfig.request.body);
        } catch (e) {
          setError('Invalid JSON in request body');
          setLoading(false);
          return;
        }
      }

      const response = await fetch('/api/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testConfig)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to start test');
      }

      const data = await response.json();
      
      if (data.success) {
        setIsRunning(true);
        setTestId(data.id);
        await loadTests();
      } else {
        setError('Failed to start test');
      }
    } catch (error: any) {
      setError(error.message || 'Error running test');
    } finally {
      setLoading(false);
    }
  };

  const terminateTest = async () => {
    if (!testId) return;
    
    try {
      await fetch(`/api/test?action=terminate&id=${testId}`);
      setIsRunning(false);
      setTestId(null);
      await loadTests();
    } catch (error) {
      setError('Failed to terminate test');
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg">
        <div className="container mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold">🚀 K6 Test Runner</h1>
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
            onChange={(updates) => setTestConfig({ ...testConfig, ...updates })}
          />
        </div>

        {isRunning && (
          <TestProgress 
            progress={progress}
            status={statusMessage}
            onTerminate={terminateTest}
          />
        )}

        <div className="flex gap-4 mb-8">
          <button 
            onClick={runTest}
            disabled={isRunning || loading}
            className="px-8 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold rounded-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '⏳ Starting...' : isRunning ? '⏳ Running...' : '▶️ Run Test'}
          </button>
          
          {isRunning && (
            <button 
              onClick={terminateTest}
              className="px-8 py-3 bg-red-500 text-white font-semibold rounded-lg hover:bg-red-600 transition-all"
            >
              ⏹️ Terminate
            </button>
          )}
        </div>

        {testResults && <TestResults results={testResults} />}

        {tests.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 border border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-6">📊 Recent Tests</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-2 px-3 text-sm font-semibold text-gray-600 dark:text-gray-400">ID</th>
                    <th className="text-left py-2 px-3 text-sm font-semibold text-gray-600 dark:text-gray-400">URL</th>
                    <th className="text-left py-2 px-3 text-sm font-semibold text-gray-600 dark:text-gray-400">Progress</th>
                    <th className="text-left py-2 px-3 text-sm font-semibold text-gray-600 dark:text-gray-400">Status</th>
                    <th className="text-left py-2 px-3 text-sm font-semibold text-gray-600 dark:text-gray-400">Started</th>
                  </tr>
                </thead>
                <tbody>
                  {tests.slice(0, 10).map((test) => (
                    <tr key={test.id} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition">
                      <td className="py-2 px-3 text-sm font-mono text-gray-600 dark:text-gray-400">{test.id.substring(0, 8)}</td>
                      <td className="py-2 px-3 text-sm text-gray-700 dark:text-gray-300 truncate max-w-xs">{test.config}</td>
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-gradient-to-r from-purple-600 to-blue-600 transition-all duration-300"
                              style={{ width: `${test.progress || 0}%` }}
                            />
                          </div>
                          <span className="text-xs font-medium text-gray-600 dark:text-gray-400">{test.progress || 0}%</span>
                        </div>
                      </td>
                      <td className="py-2 px-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize
                          ${test.status === 'running' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : ''}
                          ${test.status === 'completed' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : ''}
                          ${test.status === 'failed' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' : ''}
                          ${test.status === 'terminated' ? 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300' : ''}
                        `}>
                          {test.status}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-sm text-gray-600 dark:text-gray-400">
                        {new Date(test.startTime).toLocaleTimeString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
