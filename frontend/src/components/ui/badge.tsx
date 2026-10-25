import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Badge — a compact status tag.
 *
 * Colour is never the only status signal: every badge carries a text label,
 * and variants differ in border and background as well as hue (spec §4.2).
 */
const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-meta font-medium whitespace-nowrap',
  {
    variants: {
      tone: {
        neutral: 'border-border bg-surface-subtle text-text-muted',
        primary: 'border-primary/25 bg-primary/10 text-primary',
        success: 'border-success/25 bg-success-surface text-success',
        warning: 'border-warning/25 bg-warning-surface text-warning',
        danger: 'border-danger/25 bg-danger-surface text-danger',
        info: 'border-info/25 bg-info/10 text-info',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

export interface BadgeProps extends ComponentProps<'span'>, VariantProps<typeof badgeVariants> {
  icon?: ReactNode;
}

export function Badge({ className, tone, icon, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ tone }), className)} {...props}>
      {icon ? (
        <span aria-hidden="true" className="[&_svg]:size-3.5">
          {icon}
        </span>
      ) : null}
      {children}
    </span>
  );
}
