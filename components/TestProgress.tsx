// components/TestProgress.tsx
'use client';

interface TestProgressProps {
  progress: number;
  status: string;
  onTerminate: () => void;
  metrics?: {
    http_req_duration?: number;
    http_reqs?: number;
    http_reqs_rate?: number;
    http_req_failed?: number;
    iterations?: number;
    iterations_rate?: number;
    vus?: number;
    vus_max?: number;
    data_received_rate?: number;
    data_sent_rate?: number;
    checks?: number;
    [key: string]: any;
  };
  stage?: string;
  currentVUs?: number;
  isTerminating?: boolean;
  elapsedTime?: string;
  remainingTime?: string;
  totalTime?: string;
}

export default function TestProgress({
  progress,
  status,
  onTerminate,
  metrics = {},
  stage = '',
  currentVUs = 0,
  isTerminating = false,
  elapsedTime = '0s',
  remainingTime = '0s',
  totalTime = '0s',
}: TestProgressProps) {
  // Calculate RPS (Requests Per Second) from rate
  const rps = metrics.http_reqs_rate || metrics.http_reqs || 0;
  
  // Calculate TPS (Transactions Per Second) from rate
  const tps = metrics.iterations_rate || metrics.iterations || 0;

  // Calculate failure rate percentage
  const failureRate = metrics.http_req_failed !== undefined 
    ? metrics.http_req_failed * 100 
    : 0;

  // Calculate checks pass rate
  const checksPass = metrics.checks !== undefined 
    ? metrics.checks * 100 
    : 100;

  return (
    <div className="bg-[var(--bg-card)] rounded-xl shadow-[var(--shadow-lg)] p-6 border border-[var(--border-color)] mb-8 transition-colors">
      {/* Header: Status and percentage */}
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-lg font-semibold text-[var(--gradient-start)]">
          {status || '🔄 Running...'}
        </h3>
        <span className="text-2xl font-bold text-[var(--gradient-start)]">
          {Math.round(progress)}%
        </span>
      </div>

      {/* Stage information and time */}
      <div className="flex justify-between items-center mb-3">
        {stage && (
          <div className="text-sm text-[var(--text-secondary)] font-mono">
            {stage}
          </div>
        )}
        <div className="text-sm text-[var(--text-secondary)] font-mono">
          ⏱️ {elapsedTime} / {totalTime} (Remaining: {remainingTime})
        </div>
      </div>

      {/* Progress bar with animated shimmer */}
      <div className="relative w-full h-4 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className="absolute top-0 left-0 h-full bg-gradient-to-r from-[var(--gradient-start)] to-[var(--gradient-end)] transition-all duration-300"
          style={{ width: `${Math.min(progress, 100)}%` }}
        >
          <div className="absolute top-0 left-0 right-0 bottom-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
        </div>
      </div>

      {/* Live metrics grid - 4 columns */}
      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* RPS - Requests Per Second */}
        <div className="p-2 bg-gray-50 dark:bg-gray-900/50 rounded border border-[var(--border-color)]">
          <div className="text-xs text-[var(--text-secondary)]">RPS</div>
          <div className="text-sm font-semibold text-[var(--text-primary)]">
            {rps > 0 ? rps.toFixed(1) : '0.0'}
          </div>
        </div>

        {/* TPS - Transactions Per Second */}
        <div className="p-2 bg-gray-50 dark:bg-gray-900/50 rounded border border-[var(--border-color)]">
          <div className="text-xs text-[var(--text-secondary)]">TPS</div>
          <div className="text-sm font-semibold text-[var(--text-primary)]">
            {tps > 0 ? tps.toFixed(1) : '0.0'}
          </div>
        </div>

        {/* HTTP Duration */}
        {metrics.http_req_duration !== undefined && (
          <div className="p-2 bg-gray-50 dark:bg-gray-900/50 rounded border border-[var(--border-color)]">
            <div className="text-xs text-[var(--text-secondary)]">HTTP Duration</div>
            <div className="text-sm font-semibold text-[var(--text-primary)]">
              avg={metrics.http_req_duration.toFixed(2)}ms
            </div>
          </div>
        )}

        {/* VUs */}
        {currentVUs > 0 && (
          <div className="p-2 bg-gray-50 dark:bg-gray-900/50 rounded border border-[var(--border-color)]">
            <div className="text-xs text-[var(--text-secondary)]">VUs</div>
            <div className="text-sm font-semibold text-[var(--text-primary)]">
              {Math.round(currentVUs)}
            </div>
          </div>
        )}

        {/* Failure Rate */}
        <div className="p-2 bg-gray-50 dark:bg-gray-900/50 rounded border border-[var(--border-color)]">
          <div className="text-xs text-[var(--text-secondary)]">Failure Rate</div>
          <div className={`text-sm font-semibold ${
            failureRate > 1
              ? 'text-red-600 dark:text-red-400'
              : failureRate > 0.1
              ? 'text-yellow-600 dark:text-yellow-400'
              : 'text-green-600 dark:text-green-400'
          }`}>
            {failureRate.toFixed(2)}%
          </div>
        </div>

        {/* Checks Pass Rate */}
        <div className="p-2 bg-gray-50 dark:bg-gray-900/50 rounded border border-[var(--border-color)]">
          <div className="text-xs text-[var(--text-secondary)]">Checks Pass</div>
          <div className="text-sm font-semibold text-green-600 dark:text-green-400">
            {checksPass.toFixed(1)}%
          </div>
        </div>

        {/* Data Received */}
        {metrics.data_received_rate !== undefined && (
          <div className="p-2 bg-gray-50 dark:bg-gray-900/50 rounded border border-[var(--border-color)]">
            <div className="text-xs text-[var(--text-secondary)]">Data Received</div>
            <div className="text-sm font-semibold text-[var(--text-primary)]">
              {(metrics.data_received_rate / 1024).toFixed(1)} KB/s
            </div>
          </div>
        )}

        {/* Data Sent */}
        {metrics.data_sent_rate !== undefined && (
          <div className="p-2 bg-gray-50 dark:bg-gray-900/50 rounded border border-[var(--border-color)]">
            <div className="text-xs text-[var(--text-secondary)]">Data Sent</div>
            <div className="text-sm font-semibold text-[var(--text-primary)]">
              {(metrics.data_sent_rate / 1024).toFixed(1)} KB/s
            </div>
          </div>
        )}
      </div>

      {/* Stop button */}
      <div className="mt-4 flex justify-end">
        <button
          onClick={onTerminate}
          disabled={isTerminating}
          className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isTerminating ? (
            <><span className="animate-spin inline-block mr-2">⏳</span> Terminating...</>
          ) : (
            '⏹️ Stop Test'
          )}
        </button>
      </div>

      <style jsx>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-shimmer {
          animation: shimmer 1.5s infinite;
        }
      `}</style>
    </div>
  );
}
