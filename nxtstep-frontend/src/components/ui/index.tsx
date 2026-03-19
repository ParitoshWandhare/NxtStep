// ============================================================
// NxtStep — Core UI Primitives
// ============================================================

import { type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/utils';

// ── Card ──────────────────────────────────────────────────────
interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'bordered' | 'glass';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hover?: boolean;
}

export function Card({
  variant = 'default',
  padding = 'md',
  hover = false,
  className,
  children,
  ...props
}: CardProps) {
  const variantStyles = {
    default: 'bg-[var(--color-bg-card)] border border-[var(--color-border)]',
    elevated: 'bg-[var(--color-bg-elevated)] border border-[var(--color-border)]',
    bordered: 'bg-transparent border-2 border-[var(--color-border)]',
    glass: 'glass',
  };

  const paddingStyles = {
    none: '',
    sm: 'p-3',
    md: 'p-5',
    lg: 'p-6 sm:p-8',
  };

  return (
    <div
      className={cn(
        'rounded-2xl',
        variantStyles[variant],
        paddingStyles[padding],
        hover && 'transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 cursor-pointer',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

// ── Badge ─────────────────────────────────────────────────────
type BadgeVariant = 'primary' | 'secondary' | 'accent' | 'success' | 'warning' | 'error' | 'ghost';

interface BadgeProps {
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  dot?: boolean;
  className?: string;
  children: ReactNode;
}

const badgeVariants: Record<BadgeVariant, string> = {
  primary: 'bg-primary-500/10 text-primary-500 dark:text-primary-400',
  secondary: 'bg-secondary-500/10 text-secondary-500 dark:text-secondary-400',
  accent: 'bg-accent-500/10 text-accent-600 dark:text-accent-400',
  success: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  warning: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
  error: 'bg-red-500/10 text-red-600 dark:text-red-400',
  ghost: 'bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)]',
};

export function Badge({ variant = 'ghost', size = 'md', dot = false, className, children }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-medium rounded-full',
        size === 'sm' ? 'px-2 py-0.5 text-2xs' : 'px-2.5 py-1 text-xs',
        badgeVariants[variant],
        className
      )}
    >
      {dot && (
        <span className={cn(
          'w-1.5 h-1.5 rounded-full',
          variant === 'success' ? 'bg-emerald-500' :
          variant === 'error' ? 'bg-red-500' :
          variant === 'warning' ? 'bg-yellow-500' :
          'bg-current'
        )} />
      )}
      {children}
    </span>
  );
}

// ── Spinner ───────────────────────────────────────────────────
interface SpinnerProps {
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

const spinnerSizes = {
  xs: 'w-3 h-3 border',
  sm: 'w-4 h-4 border-2',
  md: 'w-6 h-6 border-2',
  lg: 'w-8 h-8 border-[3px]',
};

export default function Spinner({ size = 'md', className }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cn(
        'inline-block rounded-full border-current border-r-transparent animate-spin',
        spinnerSizes[size],
        className
      )}
    />
  );
}

// ── PageLoader ────────────────────────────────────────────────
export function PageLoader() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-[var(--color-bg)] z-50">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="w-12 h-12 rounded-2xl bg-primary-500 flex items-center justify-center">
            <span className="text-white font-display font-bold text-lg">N</span>
          </div>
          <div className="absolute -inset-1 rounded-2xl border-2 border-primary-500/30 animate-ping" />
        </div>
        <p className="text-sm text-[var(--color-text-muted)] font-medium">Loading NxtStep…</p>
      </div>
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────
interface SkeletonProps {
  className?: string;
  lines?: number;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} />;
}

export function SkeletonCard() {
  return (
    <Card>
      <div className="space-y-3">
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
        <div className="flex gap-2 pt-2">
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
      </div>
    </Card>
  );
}

// ── Divider ───────────────────────────────────────────────────
export function Divider({ label, className }: { label?: string; className?: string }) {
  if (!label) {
    return <hr className={cn('border-[var(--color-border)]', className)} />;
  }
  return (
    <div className={cn('relative flex items-center', className)}>
      <div className="flex-1 border-t border-[var(--color-border)]" />
      <span className="px-3 text-xs text-[var(--color-text-muted)] font-medium">{label}</span>
      <div className="flex-1 border-t border-[var(--color-border)]" />
    </div>
  );
}

// ── Empty State ───────────────────────────────────────────────
interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-8">
      {icon && (
        <div className="w-16 h-16 rounded-2xl bg-[var(--color-bg-elevated)] flex items-center justify-center mb-4 text-2xl">
          {icon}
        </div>
      )}
      <h3 className="font-display font-semibold text-lg text-[var(--color-text-primary)] mb-2">
        {title}
      </h3>
      {description && (
        <p className="text-sm text-[var(--color-text-muted)] max-w-sm mb-6">{description}</p>
      )}
      {action}
    </div>
  );
}

// ── Progress Bar ──────────────────────────────────────────────
interface ProgressBarProps {
  value: number;
  max?: number;
  size?: 'sm' | 'md' | 'lg';
  color?: 'primary' | 'success' | 'warning' | 'error' | 'accent';
  showLabel?: boolean;
  animated?: boolean;
  className?: string;
}

const progressColors = {
  primary: 'bg-primary-500',
  success: 'bg-emerald-500',
  warning: 'bg-yellow-500',
  error: 'bg-red-500',
  accent: 'bg-cyan-500',
};

const progressSizes = {
  sm: 'h-1',
  md: 'h-2',
  lg: 'h-3',
};

export function ProgressBar({
  value,
  max = 100,
  size = 'md',
  color = 'primary',
  showLabel = false,
  animated = false,
  className,
}: ProgressBarProps) {
  const pct = Math.min(Math.max((value / max) * 100, 0), 100);
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div className={cn('flex-1 bg-[var(--color-bg-elevated)] rounded-full overflow-hidden', progressSizes[size])}>
        <div
          className={cn(
            'h-full rounded-full transition-all duration-700 ease-out',
            progressColors[color],
            animated && 'animate-pulse'
          )}
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={value}
          aria-valuemax={max}
        />
      </div>
      {showLabel && (
        <span className="text-xs font-medium text-[var(--color-text-muted)] w-9 text-right">
          {Math.round(pct)}%
        </span>
      )}
    </div>
  );
}

// ── Score Ring ────────────────────────────────────────────────
interface ScoreRingProps {
  score: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  sublabel?: string;
  className?: string;
}

export function ScoreRing({
  score,
  max = 10,
  size = 120,
  strokeWidth = 8,
  label,
  sublabel,
  className,
}: ScoreRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.min(score / max, 1);
  const offset = circumference - pct * circumference;

  const getColor = () => {
    if (score >= 8) return '#10b981';
    if (score >= 6) return '#6366f1';
    if (score >= 4) return '#f59e0b';
    return '#ef4444';
  };

  return (
    <div className={cn('relative flex items-center justify-center', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="var(--color-bg-elevated)"
          strokeWidth={strokeWidth}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={getColor()}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s ease-out' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display font-bold text-xl text-[var(--color-text-primary)]">
          {score.toFixed(1)}
        </span>
        {label && (
          <span className="text-2xs text-[var(--color-text-muted)] font-medium mt-0.5">
            {label}
          </span>
        )}
        {sublabel && (
          <span className="text-2xs text-[var(--color-text-muted)]">{sublabel}</span>
        )}
      </div>
    </div>
  );
}

// ── Tooltip ───────────────────────────────────────────────────
interface TooltipProps {
  content: string;
  children: ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
}

export function Tooltip({ content, children, side = 'top' }: TooltipProps) {
  const positionStyles = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };
  return (
    <div className="relative group inline-flex">
      {children}
      <div
        className={cn(
          'absolute z-50 px-2.5 py-1.5 text-xs font-medium text-white bg-gray-900 dark:bg-gray-700',
          'rounded-lg whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100',
          'transition-opacity duration-200 shadow-lg',
          positionStyles[side]
        )}
      >
        {content}
      </div>
    </div>
  );
}