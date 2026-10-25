import * as LabelPrimitive from '@radix-ui/react-label';
import { forwardRef, useId, type ComponentProps, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Form primitives.
 *
 * Every input has a visible label (never placeholder-only), errors are
 * associated programmatically with `aria-describedby`, and helper text
 * appears before the user makes a mistake (spec §5.2).
 */

const fieldBase =
  'w-full min-h-11 rounded-button border bg-surface px-3 text-sm text-text ' +
  'placeholder:text-text-muted/70 transition-colors ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring ' +
  'disabled:cursor-not-allowed disabled:bg-surface-subtle disabled:text-text-muted';

export const Input = forwardRef<HTMLInputElement, ComponentProps<'input'>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        fieldBase,
        'aria-[invalid=true]:border-danger aria-[invalid=true]:focus-visible:outline-danger',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';

export const Textarea = forwardRef<HTMLTextAreaElement, ComponentProps<'textarea'>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        fieldBase,
        'min-h-24 py-2 leading-relaxed',
        'aria-[invalid=true]:border-danger aria-[invalid=true]:focus-visible:outline-danger',
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = 'Textarea';

export const Label = forwardRef<
  React.ComponentRef<typeof LabelPrimitive.Root>,
  ComponentProps<typeof LabelPrimitive.Root>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn('text-sm font-medium text-text', className)}
    {...props}
  />
));
Label.displayName = 'Label';

export interface FieldProps {
  label: string;
  /** Helper text shown before the user makes an error. */
  helperText?: ReactNode | undefined;
  /** Error messages for this field. */
  errors?: readonly string[] | undefined;
  required?: boolean | undefined;
  className?: string | undefined;
  children: (props: {
    id: string;
    'aria-describedby': string | undefined;
    'aria-invalid': true | undefined;
    required: true | undefined;
  }) => ReactNode;
}

/**
 * Wraps a control with a visible label, helper text and error messages.
 * The render-prop shape guarantees the accessibility wiring cannot drift.
 */
export function Field({ label, helperText, errors, required, className, children }: FieldProps) {
  const id = useId();
  const helperId = `${id}-helper`;
  const errorId = `${id}-error`;
  const hasError = Boolean(errors && errors.length > 0);

  const describedBy =
    [hasError ? errorId : null, helperText ? helperId : null].filter(Boolean).join(' ') ||
    undefined;

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label htmlFor={id}>
        {label}
        {required ? (
          <span className="ml-1 text-danger" aria-hidden="true">
            *
          </span>
        ) : null}
      </Label>

      {helperText ? (
        <p id={helperId} className="text-meta text-text-muted">
          {helperText}
        </p>
      ) : null}

      {children({
        id,
        'aria-describedby': describedBy,
        'aria-invalid': hasError ? true : undefined,
        required: required ? true : undefined,
      })}

      {hasError ? (
        <ul id={errorId} className="flex flex-col gap-0.5 text-meta text-danger">
          {errors?.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
