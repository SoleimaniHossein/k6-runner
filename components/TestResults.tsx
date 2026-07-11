'use client';

import { CheckCircle2, XCircle, Clock, Hash, BarChart3, Terminal } from 'lucide-react';
import Card, { CardHeader, CardTitle } from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';

interface TestResultsProps {
  results: any;
}

export default function TestResults({ results }: TestResultsProps) {
  const statusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
      case 'failed': return <XCircle className="h-5 w-5 text-red-500" />;
      case 'terminated': return <Clock className="h-5 w-5 text-amber-500" />;
      default: return <Hash className="h-5 w-5 text-[var(--text-muted)]" />;
    }
  };

  const statusVariant = (status: string) => {
    switch (status) {
      case 'completed': return 'completed' as const;
      case 'failed': return 'failed' as const;
      case 'terminated': return 'terminated' as const;
      default: return 'default' as const;
    }
  };

  const formatDuration = () => {
    if (results.startTime && results.endTime) {
      const diff = new Date(results.endTime).getTime() - new Date(results.startTime).getTime();
      return `${(diff / 1000).toFixed(2)}s`;
    }
    return 'N/A';
  };

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle icon={<BarChart3 className="h-4 w-4 text-violet-500" />}>
          Test Results
        </CardTitle>
        <Badge variant={statusVariant(results.status)}>{results.status}</Badge>
      </CardHeader>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="flex items-center gap-3 p-3 bg-[var(--bg-hover)] rounded-xl">
          {statusIcon(results.status)}
          <div>
            <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Status</div>
            <div className="text-sm font-semibold text-[var(--text-primary)] capitalize">{results.status}</div>
          </div>
        </div>
        <div className="flex items-center gap-3 p-3 bg-[var(--bg-hover)] rounded-xl">
          <Clock className="h-5 w-5 text-blue-500" />
          <div>
            <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Duration</div>
            <div className="text-sm font-semibold text-[var(--text-primary)] tabular-nums">{formatDuration()}</div>
          </div>
        </div>
        <div className="flex items-center gap-3 p-3 bg-[var(--bg-hover)] rounded-xl">
          <Hash className="h-5 w-5 text-violet-500" />
          <div>
            <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Exit Code</div>
            <div className="text-sm font-semibold text-[var(--text-primary)] tabular-nums">{results.exitCode}</div>
          </div>
        </div>
      </div>

      {/* Metrics */}
      {results.metrics && Object.keys(results.metrics).length > 0 && (
        <div className="mb-6">
          <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">Performance Metrics</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {Object.entries(results.metrics).map(([key, value]: [string, any]) => (
              <div key={key} className="p-2.5 bg-[var(--bg-hover)] rounded-lg">
                <div className="text-[10px] text-[var(--text-muted)] truncate">{key}</div>
                <div className="text-sm font-semibold text-[var(--text-primary)] tabular-nums">
                  {typeof value === 'number' ? value.toFixed(2) : String(value)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stdout */}
      {results.stdout && (
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <Terminal className="h-3.5 w-3.5 text-[var(--text-muted)]" />
            <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Output</h3>
          </div>
          <pre className="bg-zinc-950 text-zinc-100 p-4 rounded-xl overflow-x-auto text-xs leading-relaxed max-h-96 overflow-y-auto font-mono">
            {results.stdout}
          </pre>
        </div>
      )}
    </Card>
  );
}
