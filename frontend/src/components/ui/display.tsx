import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

/**
 * Progress bar.
 *
 * Determinate only. When progress cannot be estimated, the interface says
 * "Working through the available sources" rather than inventing a
 * percentage (spec §5.5).
 */
export function Progress({
  value,
  className,
  label,
}: {
  /** 0–100. Omit for an indeterminate bar. */
  value?: number;
  className?: string;
  label?: string;
}) {
  const clamped = value === undefined ? null : Math.max(0, Math.min(100, value));

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clamped ?? undefined}
      aria-label={label}
      className={cn('h-1.5 w-full overflow-hidden rounded-full bg-surface-subtle', className)}
    >
      <div
        className={cn(
          'h-full rounded-full bg-primary transition-[width] duration-300',
          clamped === null && 'w-1/3',
        )}
        style={clamped === null ? undefined : { width: `${clamped}%` }}
      />
    </div>
  );
}

export function Separator({
  className,
  orientation = 'horizontal',
  ...props
}: ComponentProps<'div'> & { orientation?: 'horizontal' | 'vertical' }) {
  return (
    <div
      role="separator"
      aria-orientation={orientation}
      className={cn(
        'bg-border',
        orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px',
        className,
      )}
      {...props}
    />
  );
}

export function Avatar({
  name,
  src,
  size = 'md',
  className,
}: {
  name: string;
  src?: string | null | undefined;
  size?: 'sm' | 'md' | 'lg';
  className?: string | undefined;
}) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  const sizeClass = { sm: 'size-8 text-meta', md: 'size-10 text-sm', lg: 'size-14 text-base' }[
    size
  ];

  if (src) {
    return (
      <img
        src={src}
        alt=""
        className={cn('shrink-0 rounded-full object-cover', sizeClass, className)}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={cn(
        'grid shrink-0 place-items-center rounded-full bg-primary/12 font-semibold text-primary',
        sizeClass,
        className,
      )}
    >
      {initials}
    </span>
  );
}

/**
 * Circular score indicator.
 *
 * The accessible name always spells out what the number means, so a screen
 * reader never announces a bare "92" that could be read as a probability.
 */
export function ScoreRing({
  value,
  label,
  size = 64,
  tone = 'primary',
}: {
  value: number;
  /** Full accessible label, e.g. "Profile match: 92 out of 100". */
  label: string;
  size?: number;
  tone?: 'primary' | 'success' | 'warning' | 'muted';
}) {
  const stroke = 5;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.max(0, Math.min(100, value)) / 100);

  const toneClass = {
    primary: 'text-primary',
    success: 'text-success',
    warning: 'text-warning',
    muted: 'text-text-muted',
  }[tone];

  return (
    <span
      role="img"
      aria-label={label}
      className={cn('relative inline-grid place-items-center', toneClass)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className="stroke-surface-subtle"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="stroke-current"
        />
      </svg>
      <span aria-hidden="true" className="absolute text-sm font-semibold tabular-nums">
        {value}
      </span>
    </span>
  );
}
