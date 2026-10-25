import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/cn';

/** Card surfaces. Borders carry hierarchy before shadows (spec §4.4). */
export function Card({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'rounded-card border border-border bg-surface',
        'shadow-[0_1px_2px_0_rgb(11_23_48/0.04)]',
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('flex flex-col gap-1 p-5 pb-3', className)} {...props} />;
}

export function CardTitle({ className, ...props }: ComponentProps<'h3'>) {
  return (
    <h3
      className={cn('text-card-title leading-tight font-semibold text-text', className)}
      {...props}
    />
  );
}

export function CardDescription({ className, ...props }: ComponentProps<'p'>) {
  return <p className={cn('text-sm text-text-muted', className)} {...props} />;
}

export function CardContent({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('p-5 pt-0', className)} {...props} />;
}

export function CardFooter({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn('flex items-center gap-2 border-t border-border p-5 pt-4', className)}
      {...props}
    />
  );
}

export interface StatCardProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode | undefined;
  icon?: ReactNode | undefined;
  className?: string | undefined;
}

/** A compact metric tile used on the workspace overview. */
export function StatCard({ label, value, hint, icon, className }: StatCardProps) {
  return (
    <Card className={cn('p-4', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-meta font-medium text-text-muted">{label}</span>
          <span className="text-2xl leading-none font-semibold text-text">{value}</span>
          {hint ? <span className="text-meta text-text-muted">{hint}</span> : null}
        </div>
        {icon ? (
          <span aria-hidden="true" className="rounded-button bg-surface-subtle p-2 text-primary">
            {icon}
          </span>
        ) : null}
      </div>
    </Card>
  );
}
