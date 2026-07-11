'use client';

import { forwardRef } from 'react';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
  showCount?: boolean;
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, hint, error, showCount, className = '', id, value, ...props }, ref) => {
    const textareaId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);
    const charCount = typeof value === 'string' ? value.length : 0;

    return (
      <div className="space-y-1.5">
        {label && (
          <div className="flex items-center justify-between">
            <label
              htmlFor={textareaId}
              className="block text-sm font-medium text-[var(--text-secondary)]"
            >
              {label}
            </label>
            {showCount && charCount > 0 && (
              <span className="text-xs text-[var(--text-muted)]">{charCount} chars</span>
            )}
          </div>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          value={value}
          className={`
            w-full px-3 py-2 text-sm font-mono
            bg-[var(--bg-input)] text-[var(--text-primary)]
            rounded-lg
            placeholder:text-[var(--text-muted)]
            border border-[var(--border-color)] hover:border-[var(--text-muted)]
            focus:outline-none focus:border-violet-500
            transition-colors duration-150
            resize-y
            ${error ? 'border-red-500' : ''}
            ${className}
          `}
          {...props}
        />
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

Textarea.displayName = 'Textarea';

export default Textarea;
