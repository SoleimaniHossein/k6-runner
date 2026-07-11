'use client';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  statusText?: string;
  activeColor?: string;
  disabled?: boolean;
}

export default function Toggle({
  checked,
  onChange,
  label,
  statusText,
  activeColor = 'bg-violet-600',
  disabled = false,
}: ToggleProps) {
  return (
    <div className="flex items-center justify-between">
      {label && (
        <span className="text-sm font-medium text-[var(--text-secondary)]">{label}</span>
      )}
      <div className="flex items-center gap-2">
        {statusText && (
          <span className={`text-xs font-medium ${checked ? 'text-violet-600 dark:text-violet-400' : 'text-[var(--text-muted)]'}`}>
            {statusText}
          </span>
        )}
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          disabled={disabled}
          onClick={() => onChange(!checked)}
          className={`
            relative inline-flex h-6 w-11 shrink-0 cursor-pointer
            rounded-full border-2 border-transparent
            transition-colors duration-200 ease-in-out
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/30
            disabled:opacity-50 disabled:cursor-not-allowed
            ${checked ? activeColor : 'bg-slate-300 dark:bg-slate-600'}
          `}
        >
          <span
            className={`
              pointer-events-none inline-block h-5 w-5
              rounded-full bg-white shadow-lg ring-0
              transform transition duration-200 ease-in-out
              ${checked ? 'translate-x-5' : 'translate-x-0'}
            `}
          />
        </button>
      </div>
    </div>
  );
}
