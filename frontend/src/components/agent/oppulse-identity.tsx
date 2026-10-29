import { cn } from '@/lib/cn';

/**
 * The agent's face.
 *
 * One master illustration (`public/brand/oppulse-robot-avatar.svg`) served
 * from the static bundle, so every surface that speaks as Oppulse shows the
 * same character rather than a per-screen reinterpretation. It scales with
 * the box and stays crisp because the source is vector.
 *
 * Decorative by default: the surrounding copy already says "Oppulse", so a
 * screen reader would only hear the name twice. Pass `label` when the image
 * is the *only* thing identifying the agent (for example beside a bare
 * heading with no adjacent name).
 */
export function OppulseIdentity({
  size = 'md',
  className,
  label,
}: {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string | undefined;
  label?: string | undefined;
}) {
  const sizes = {
    sm: 'size-8',
    md: 'size-11',
    lg: 'size-14',
    xl: 'size-20 sm:size-24',
  } as const;

  return (
    <img
      src="/brand/oppulse-robot-avatar.svg"
      alt=""
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn('shrink-0 rounded-full', sizes[size], className)}
    />
  );
}
