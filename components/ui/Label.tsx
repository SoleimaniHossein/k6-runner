'use client';

interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  hint?: string;
}

export default function Label({ children, hint, className = '', ...props }: LabelProps) {
  return (
    <label className={`block text-sm font-medium text-[var(--text-secondary)] ${className}`} {...props}>
      {children}
      {hint && <span className="ml-1 text-[var(--text-muted)] font-normal">{hint}</span>}
    </label>
  );
}
