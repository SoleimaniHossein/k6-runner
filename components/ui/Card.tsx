'use client';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
}

export default function Card({ children, className = '', noPadding = false }: CardProps) {
  return (
    <div
      className={`
        bg-[var(--bg-card)] rounded-xl
        border border-[var(--border-color)]
        shadow-sm
        ${noPadding ? '' : 'p-6'}
        ${className}
      `}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export function CardHeader({ children, className = '' }: CardHeaderProps) {
  return (
    <div className={`flex items-center justify-between pb-4 mb-4 border-b border-[var(--border-color)] ${className}`}>
      {children}
    </div>
  );
}

interface CardTitleProps {
  children: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}

export function CardTitle({ children, icon, className = '' }: CardTitleProps) {
  return (
    <h3 className={`text-base font-semibold text-[var(--text-primary)] flex items-center gap-2 ${className}`}>
      {icon}
      {children}
    </h3>
  );
}
