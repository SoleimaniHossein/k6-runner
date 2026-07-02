// components/TestProgress.tsx
'use client';

interface TestProgressProps {
  progress: number;
  status: string;
  onTerminate: () => void;
  metrics?: Record<string, any>;
  stage?: string;
  isTerminating?: boolean;
}

export default function TestProgress({
  progress,
  status,
  onTerminate,
  metrics = {},
  stage = '',
  isTerminating = false,
}: TestProgressProps) {
  return (
    <div className="bg-[var(--bg-card)] rounded-xl shadow-[var(--shadow-lg)] p-6 border border-[var(--border-color)] mb-8 transition-colors">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-lg font-semibold text-[var(--gradient-start)]">
          {status || '🔄 Running...'}
        </h3>
        <span className="text-2xl font-bold text-[var(--gradient-start)]">
          {Math.round(progress)}%
        </span>
      </div>

      {stage && (
        <div className="text-sm text-[var(--text-secondary)] mb-3 font-mono">{stage}</div>
      )}

      <div className="relative w-full h-4 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className="absolute top-0 left-0 h-full bg-gradient-to-r from-[var(--gradient-start)] to-[var(--gradient-end)] transition-all duration-300"
          style={{ width: `${Math.min(progress, 100)}%` }}
        >
          <div className="absolute top-0 left-0 right-0 bottom-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
        </div>
      </div>

      {Object.keys(metrics).length > 0 && (
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          {metrics.http_req_duration !== undefined && (
            <div className="p-2 bg-gray-50 dark:bg-gray-900/50 rounded border border-[var(--border-color)]">
              <div className="text-xs text-[var(--text-secondary)]">HTTP Duration</div>
              <div className="text-sm font-semibold text-[var(--text-primary)]">
                avg={metrics.http_req_duration.toFixed(2)}ms
              </div>
            </div>
          )}
          {metrics.http_reqs !== undefined && (
            <div className="p-2 bg-gray-50 dark:bg-gray-900/50 rounded border border-[var(--border-color)]">
              <div className="text-xs text-[var(--text-secondary)]">Requests</div>
              <div className="text-sm font-semibold text-[var(--text-primary)]">
                {Math.round(metrics.http_reqs)}
              </div>
            </div>
          )}
          {metrics.http_req_failed !== undefined && (
            <div className="p-2 bg-gray-50 dark:bg-gray-900/50 rounded border border-[var(--border-color)]">
              <div className="text-xs text-[var(--text-secondary)]">Failure Rate</div>
              <div className={`text-sm font-semibold ${metrics.http_req_failed > 0.01 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                {(metrics.http_req_failed * 100).toFixed(2)}%
              </div>
            </div>
          )}
          {metrics.vus !== undefined && (
            <div className="p-2 bg-gray-50 dark:bg-gray-900/50 rounded border border-[var(--border-color)]">
              <div className="text-xs text-[var(--text-secondary)]">VUs</div>
              <div className="text-sm font-semibold text-[var(--text-primary)]">
                {Math.round(metrics.vus)} / {metrics.vus_max ? Math.round(metrics.vus_max) : Math.round(metrics.vus)}
              </div>
            </div>
          )}
          {metrics.iterations !== undefined && (
            <div className="p-2 bg-gray-50 dark:bg-gray-900/50 rounded border border-[var(--border-color)]">
              <div className="text-xs text-[var(--text-secondary)]">Iterations</div>
              <div className="text-sm font-semibold text-[var(--text-primary)]">
                {Math.round(metrics.iterations)}
              </div>
            </div>
          )}
        </div>
      )}

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
        .animate-shimmer { animation: shimmer 1.5s infinite; }
      `}</style>
    </div>
  );
}
