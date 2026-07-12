'use client';

import { Activity, Clock, Users, AlertTriangle, CheckCircle2, ArrowDown, ArrowUp, Square } from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';

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
  confirmingStop?: boolean;
  elapsedTime?: string;
  remainingTime?: string;
  totalTime?: string;
}

export default function TestProgress({
  progress, status, onTerminate, metrics = {}, stage = '', currentVUs = 0,
  isTerminating = false, confirmingStop = false,
  elapsedTime = '0s', remainingTime = '0s', totalTime = '0s',
}: TestProgressProps) {
  const rps = metrics.http_reqs_rate || metrics.http_reqs || 0;
  const tps = metrics.iterations_rate || metrics.iterations || 0;
  const failureRate = metrics.http_req_failed ?? 0;
  const checksPass = metrics.checks !== undefined ? metrics.checks * 100 : 100;

  const metricCards = [
    { label: 'RPS', value: rps > 0 ? rps.toFixed(1) : '0.0', icon: Activity },
    { label: 'TPS', value: tps > 0 ? tps.toFixed(1) : '0.0', icon: Activity },
    ...(metrics.http_req_duration !== undefined ? [{ label: 'Avg Duration', value: `${metrics.http_req_duration.toFixed(1)}ms`, icon: Clock }] : []),
    ...(currentVUs > 0 ? [{ label: 'VUs', value: String(Math.round(currentVUs)), icon: Users }] : []),
    {
      label: 'Failures',
      value: `${failureRate.toFixed(2)}%`,
      icon: AlertTriangle,
      color: failureRate > 1 ? 'text-red-500' : failureRate > 0.1 ? 'text-amber-500' : 'text-emerald-500',
    },
    {
      label: 'Checks',
      value: `${checksPass.toFixed(1)}%`,
      icon: CheckCircle2,
      color: 'text-emerald-500',
    },
    ...(metrics.data_received_rate !== undefined ? [{ label: 'Received', value: `${(metrics.data_received_rate / 1024).toFixed(1)} KB/s`, icon: ArrowDown }] : []),
    ...(metrics.data_sent_rate !== undefined ? [{ label: 'Sent', value: `${(metrics.data_sent_rate / 1024).toFixed(1)} KB/s`, icon: ArrowUp }] : []),
  ];

  return (
    <Card className="mb-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-blue-600">
            <Activity className="h-4 w-4 text-white animate-pulse" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">{status || 'Running...'}</h3>
            {stage && <p className="text-xs text-[var(--text-muted)] font-mono mt-0.5">{stage}</p>}
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold bg-gradient-to-r from-violet-600 to-blue-600 bg-clip-text text-transparent">
            {Math.round(progress)}%
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="relative w-full h-2.5 bg-[var(--bg-hover)] rounded-full overflow-hidden mb-4">
        <div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-violet-600 to-blue-600 rounded-full transition-all duration-300 ease-out"
          style={{ width: `${Math.min(progress, 100)}%` }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent" style={{ animation: 'shimmer 1.5s infinite' }} />
        </div>
      </div>

      {/* Time */}
      <div className="flex items-center justify-between mb-4 text-xs text-[var(--text-muted)]">
        <span className="font-mono tabular-nums">{elapsedTime} elapsed</span>
        <span className="font-mono tabular-nums">{remainingTime} remaining</span>
        <span className="font-mono tabular-nums">/ {totalTime}</span>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        {metricCards.map((m) => (
          <div key={m.label} className="flex items-center gap-2.5 p-2.5 bg-[var(--bg-hover)] rounded-lg">
            <m.icon className={`h-4 w-4 shrink-0 ${m.color || 'text-[var(--text-muted)]'}`} />
            <div className="min-w-0">
              <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">{m.label}</div>
              <div className={`text-sm font-semibold tabular-nums ${m.color || 'text-[var(--text-primary)]'}`}>{m.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Stop */}
      <div className="flex justify-end">
        <Button
          variant="danger"
          size="sm"
          onClick={onTerminate}
          disabled={isTerminating}
          loading={isTerminating}
          icon={!isTerminating ? <Square className="h-3.5 w-3.5" /> : undefined}
          className={confirmingStop ? 'animate-pulse' : ''}
        >
          {isTerminating ? 'Terminating...' : confirmingStop ? 'Confirm Stop' : 'Stop Test'}
        </Button>
      </div>
    </Card>
  );
}
