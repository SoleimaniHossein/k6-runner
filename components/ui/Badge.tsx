'use client';

type BadgeVariant = 'default' | 'running' | 'completed' | 'failed' | 'terminated' | 'purple' | 'green' | 'orange' | 'amber';

interface BadgeProps {
  variant?: BadgeVariant;
  pulse?: boolean;
  children: React.ReactNode;
  className?: string;
}

const variantVarMap: Record<BadgeVariant, { bg: string; fg: string; border: string }> = {
  default:    { bg: '--badge-default-bg',     fg: '--badge-default-fg',     border: '--badge-default-border' },
  running:    { bg: '--badge-running-bg',     fg: '--badge-running-fg',     border: '--badge-running-border' },
  completed:  { bg: '--badge-completed-bg',   fg: '--badge-completed-fg',   border: '--badge-completed-border' },
  failed:     { bg: '--badge-failed-bg',      fg: '--badge-failed-fg',      border: '--badge-failed-border' },
  terminated: { bg: '--badge-terminated-bg',  fg: '--badge-terminated-fg',  border: '--badge-terminated-border' },
  purple:     { bg: '--badge-running-bg',     fg: '--badge-running-fg',     border: '--badge-running-border' },
  green:      { bg: '--badge-completed-bg',   fg: '--badge-completed-fg',   border: '--badge-completed-border' },
  orange:     { bg: '--badge-terminated-bg',  fg: '--badge-terminated-fg',  border: '--badge-terminated-border' },
  amber:      { bg: '--badge-terminated-bg',  fg: '--badge-terminated-fg',  border: '--badge-terminated-border' },
};

export default function Badge({ variant = 'default', pulse = false, children, className = '' }: BadgeProps) {
  const v = variantVarMap[variant];
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-semibold rounded-full ${pulse ? 'animate-pulse' : ''} ${className}`}
      style={{
        background: `var(${v.bg})`,
        color: `var(${v.fg})`,
        border: `1px solid var(${v.border})`,
      }}
    >
      {children}
    </span>
  );
}
