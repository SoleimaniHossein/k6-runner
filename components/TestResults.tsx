'use client';

interface TestResultsProps {
  results: any;
}

export default function TestResults({ results }: TestResultsProps) {
  const getStatusColor = (status: string) => {
    const colors = {
      completed: 'text-green-600 dark:text-green-400',
      failed: 'text-red-600 dark:text-red-400',
      terminated: 'text-yellow-600 dark:text-yellow-400',
      error: 'text-red-600 dark:text-red-400'
    };
    return colors[status as keyof typeof colors] || 'text-gray-600 dark:text-gray-400';
  };

  const formatDuration = () => {
    if (results.startTime && results.endTime) {
      const diff = new Date(results.endTime) - new Date(results.startTime);
      return `${(diff / 1000).toFixed(2)}s`;
    }
    return 'N/A';
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 border border-gray-200 dark:border-gray-700 mb-8">
      <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-6 pb-2 border-b border-gray-200 dark:border-gray-700">
        📊 Test Results
      </h2>

      <div className="grid grid-cols-3 gap-4 mb-6 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
        <div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Status</div>
          <div className={`text-lg font-semibold ${getStatusColor(results.status)}`}>
            {results.status}
          </div>
        </div>
        <div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Duration</div>
          <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">{formatDuration()}</div>
        </div>
        <div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Exit Code</div>
          <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">{results.exitCode}</div>
        </div>
      </div>

      {results.metrics && Object.keys(results.metrics).length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Performance Metrics</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(results.metrics).map(([key, value]: [string, any]) => (
              <div key={key} className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                <div className="text-xs text-gray-600 dark:text-gray-400 truncate">{key}</div>
                <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {typeof value === 'number' ? value.toFixed(2) : value}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {results.stdout && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Output</h3>
          <pre className="bg-gray-900 dark:bg-black text-gray-100 p-4 rounded-lg overflow-x-auto text-sm max-h-96 overflow-y-auto">
            {results.stdout}
          </pre>
        </div>
      )}
    </div>
  );
}
