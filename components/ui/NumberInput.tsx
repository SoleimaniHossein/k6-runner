'use client';

import { forwardRef } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';

interface NumberInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  label?: string;
  hint?: string;
  error?: string;
  icon?: React.ReactNode;
  value: number;
  onChange: (value: number) => void;
}

const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(
  ({ label, hint, error, icon, className = '', id, value, onChange, min, max, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    const step = Number(props.step) || 1;
    const minVal = min !== undefined ? Number(min) : undefined;
    const maxVal = max !== undefined ? Number(max) : undefined;

    const clamp = (v: number) => {
      if (minVal !== undefined && v < minVal) return minVal;
      if (maxVal !== undefined && v > maxVal) return maxVal;
      return v;
    };

    const increment = () => onChange(clamp(value + step));
    const decrement = () => onChange(clamp(value - step));

    return (
      <div className="space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-[var(--text-secondary)]"
          >
            {label}
          </label>
        )}
        <div className="relative group">
          {icon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            type="number"
            value={value}
            min={min}
            max={max}
            onChange={(e) => onChange(clamp(parseInt(e.target.value) || 0))}
            className={`
              w-full px-3 py-2 pr-10 text-sm font-mono tabular-nums
              bg-[var(--bg-input)] text-[var(--text-primary)]
              rounded-lg
              placeholder:text-[var(--text-muted)]
              border border-[var(--border-color)] hover:border-[var(--text-muted)]
              focus:outline-none focus:border-violet-500
              transition-colors duration-150
              [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none
              ${icon ? 'pl-9' : ''}
              ${error ? 'border-red-500' : ''}
              ${className}
            `}
            {...props}
          />
          <div className="absolute right-0 top-0 h-full flex flex-col border-l border-[var(--border-color)] rounded-r-lg overflow-hidden opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={increment}
              className="flex-1 flex items-center justify-center w-7 hover:bg-[var(--bg-hover)] active:bg-[var(--border-color)] transition-colors text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              tabIndex={-1}
            >
              <ChevronUp className="h-3 w-3" />
            </button>
            <div className="h-px bg-[var(--border-color)]" />
            <button
              type="button"
              onClick={decrement}
              className="flex-1 flex items-center justify-center w-7 hover:bg-[var(--bg-hover)] active:bg-[var(--border-color)] transition-colors text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              tabIndex={-1}
            >
              <ChevronDown className="h-3 w-3" />
            </button>
          </div>
        </div>
        {hint && !error && (
          <p className="text-xs text-[var(--text-muted)]">{hint}</p>
        )}
        {error && (
          <p className="text-xs text-red-500">{error}</p>
        )}
      </div>
    );
  }
);

NumberInput.displayName = 'NumberInput';

export default NumberInput;
