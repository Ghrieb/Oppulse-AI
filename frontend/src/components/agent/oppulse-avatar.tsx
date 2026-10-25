import { cn } from '@/lib/cn';

/**
 * Oppulse's shared companion mark. The face remains legible at 20–48px and
 * uses the same indigo accent as the product mark without looking like an
 * emoji or a generic bot icon.
 */
export function OppulseAvatar({
  size = 'md',
  className,
  label = 'Oppulse',
}: {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  label?: string;
}) {
  const sizes = { sm: 'size-8', md: 'size-11', lg: 'size-14' };

  return (
    <span
      className={cn(
        'inline-grid shrink-0 place-items-center rounded-[30%] bg-primary/10 text-primary',
        sizes[size],
        className,
      )}
      aria-label={label}
      role="img"
    >
      <svg viewBox="0 0 48 48" aria-hidden="true" className="size-[72%]">
        <path
          d="M14 18.5A6.5 6.5 0 0 1 20.5 12h7A6.5 6.5 0 0 1 34 18.5v14A6.5 6.5 0 0 1 27.5 39h-7a6.5 6.5 0 0 1-6.5-6.5v-14Z"
          fill="currentColor"
          opacity=".16"
        />
        <rect
          x="12.5"
          y="16"
          width="23"
          height="20"
          rx="7"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
        />
        <path d="M24 16V11M20 8h8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="20" cy="25" r="2.25" fill="currentColor" />
        <circle cx="28" cy="25" r="2.25" fill="currentColor" />
        <path
          d="M19.5 30.5c2.4 2 6.6 2 9 0"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path d="M9 24h3M36 24h3" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    </span>
  );
}
