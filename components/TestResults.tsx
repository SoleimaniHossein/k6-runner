// components/TestResults.tsx
'use client';

export default function TestResults({ results }: any) {
  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      completed: 'text-green-600 dark:text-green-400',
      failed: 'text-red-600 dark:text-red-400',
      terminated: 'text-yellow-600 dark:text-yellow-400',
      error: 'text-red-600 dark:text-red-400',
    };
    return colors[status] || 'text-gray-600 dark:text-gray-400';
  };

  const formatDuration = () => {
    if (results.startTime && results.endTime) {
      const diff = new Date(results.endTime).getTime() - new Date(results.startTime).getTime();
      return `${(diff / 1000).toFixed(2)}s`;
    }
    return 'N/A';
  };

  return (
    <div className="bg-[var(--bg-card)] rounded-xl shadow-[var(--shadow-lg)] p-6 border border-[var(--border-color)] mb-8">
      <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-6 pb-2 border-b border-[var(--border-color)]">
        📊 Test Results
      </h2>
      <div className="grid grid-cols-3 gap-4 mb-6 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
        <div>
          <div className="text-sm text-[var(--text-secondary)]">Status</div>
          <div className={`text-lg font-semibold ${getStatusColor(results.status)}`}>{results.status}</div>
        </div>
        <div>
          <div className="text-sm text-[var(--text-secondary)]">Duration</div>
          <div className="text-lg font-semibold text-[var(--text-primary)]">{formatDuration()}</div>
        </div>
        <div>
          <div className="text-sm text-[var(--text-secondary)]">Exit Code</div>
          <div className="text-lg font-semibold text-[var(--text-primary)]">{results.exitCode}</div>
        </div>
      </div>
      {results.metrics && Object.keys(results.metrics).length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-3">Performance Metrics</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(results.metrics).map(([key, value]: [string, any]) => (
              <div key={key} className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                <div className="text-xs text-[var(--text-muted)] truncate">{key}</div>
                <div className="text-sm font-semibold text-[var(--text-primary)]">
                  {typeof value === 'number' ? value.toFixed(2) : value}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {results.stdout && (
        <div>
          <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-2">Output</h3>
          <pre className="bg-gray-900 dark:bg-black text-gray-100 p-4 rounded-lg overflow-x-auto text-sm max-h-96 overflow-y-auto">
            {results.stdout}
          </pre>
        </div>
      )}
    </div>
  );
}
