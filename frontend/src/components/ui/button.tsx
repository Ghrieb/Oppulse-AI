import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { useId, type ComponentProps } from 'react';
import { cn } from '@/lib/cn';

/**
 * Button.
 *
 * Every size is at least 44px tall (spec §5.1). A button is never disabled
 * silently — pass `disabledReason` to explain what is missing, which the
 * component surfaces to assistive technology.
 */
const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 rounded-button font-medium',
    'transition-colors duration-150 select-none',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring',
    'disabled:pointer-events-none disabled:opacity-55',
    '[&_svg]:shrink-0',
  ].join(' '),
  {
    variants: {
      variant: {
        primary: 'bg-primary text-white hover:bg-primary-hover',
        secondary: 'bg-surface-subtle text-text hover:bg-border/60',
        outline: 'border border-border bg-surface text-text hover:bg-surface-subtle',
        ghost: 'text-text hover:bg-surface-subtle',
        danger: 'bg-danger text-white hover:brightness-110',
        sidebar: 'text-sidebar-raised hover:bg-white/10 hover:text-white',
      },
      size: {
        sm: 'min-h-11 px-3 text-sm',
        md: 'min-h-11 px-4 text-sm',
        lg: 'min-h-12 px-6 text-base',
        icon: 'size-11 p-0',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export interface ButtonProps extends ComponentProps<'button'>, VariantProps<typeof buttonVariants> {
  /** Render the child element instead of a `<button>`. The child must be a single element. */
  asChild?: boolean | undefined;
  /** Shows a spinner and always disables the button. Not available with `asChild`. */
  loading?: boolean | undefined;
  /** Replaces the children while `loading`, so the button says what is happening ("Saving…"). */
  loadingLabel?: string | undefined;
  /** Explains why the button is unavailable. Announced to assistive tech. */
  disabledReason?: string | undefined;
}

export function Button({
  className,
  variant,
  size,
  asChild = false,
  loading = false,
  loadingLabel,
  disabledReason,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const reasonId = useId();
  // A pending action is never clickable: an explicit `disabled` widens the
  // gate, it can never re-enable a button that is waiting on a request.
  const isDisabled = (disabled ?? false) || loading;
  const classes = cn(buttonVariants({ variant, size }), className);
  const content = loading && loadingLabel ? loadingLabel : children;

  // `asChild` forwards props to a single child element, so the button may
  // not inject extra children of its own.
  if (asChild) {
    return (
      <Slot
        className={classes}
        aria-disabled={isDisabled ? true : undefined}
        aria-describedby={disabledReason && isDisabled ? reasonId : undefined}
        data-loading={loading ? 'true' : undefined}
        {...props}
      >
        {children}
      </Slot>
    );
  }

  return (
    <button
      className={classes}
      disabled={isDisabled}
      aria-describedby={disabledReason && isDisabled ? reasonId : undefined}
      data-loading={loading ? 'true' : undefined}
      {...props}
    >
      {loading ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
      {content}
      {disabledReason && isDisabled ? (
        <span id={reasonId} className="sr-only">
          {disabledReason}
        </span>
      ) : null}
    </button>
  );
}
