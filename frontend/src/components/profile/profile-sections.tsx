import { cn } from '@/lib/cn';
import type { PassportSection, SectionStatus } from './passport-sections';

const STATUS_DOT: Record<SectionStatus, string> = {
  ok: 'bg-success',
  pending: 'bg-warning',
  empty: 'bg-border',
};

/**
 * The section navigation.
 *
 * A status dot per section, so the student can see at a glance which part
 * of their profile still needs attention.
 */
export function ProfileSections({
  sections,
  statusById,
  activeId,
  onSelect,
  variant = 'rail',
}: {
  sections: readonly PassportSection[];
  statusById: Record<string, SectionStatus>;
  activeId: string | null;
  onSelect: (id: string) => void;
  variant?: 'rail' | 'chips';
}) {
  if (variant === 'chips') {
    return (
      <nav
        aria-label="Profile sections"
        className="-mx-4 flex scrollbar-subtle gap-2 overflow-x-auto px-4 pb-2"
      >
        {sections.map((section) => (
          <button
            key={section.id}
            type="button"
            onClick={() => onSelect(section.id)}
            aria-current={activeId === section.id ? 'true' : undefined}
            className={cn(
              'inline-flex min-h-9 shrink-0 items-center gap-2 rounded-full border px-3 text-sm font-medium transition-colors',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring',
              activeId === section.id
                ? 'border-primary/50 bg-primary/10 text-primary'
                : 'border-border bg-surface text-text-muted hover:bg-surface-subtle',
            )}
          >
            <span
              aria-hidden="true"
              className={cn('size-1.5 rounded-full', STATUS_DOT[statusById[section.id] ?? 'empty'])}
            />
            {section.shortLabel}
          </button>
        ))}
      </nav>
    );
  }

  return (
    <nav aria-label="Profile sections" className="flex flex-col gap-1">
      {sections.map((section) => {
        const status = statusById[section.id] ?? 'empty';
        const isActive = activeId === section.id;

        return (
          <button
            key={section.id}
            type="button"
            onClick={() => onSelect(section.id)}
            aria-current={isActive ? 'true' : undefined}
            className={cn(
              'flex min-h-11 items-center gap-2.5 rounded-button px-3 text-left text-sm transition-colors',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring',
              isActive
                ? 'bg-surface-subtle font-medium text-text'
                : 'text-text-muted hover:bg-surface-subtle hover:text-text',
            )}
          >
            <span
              aria-hidden="true"
              className={cn('size-2 shrink-0 rounded-full', STATUS_DOT[status])}
            />
            <span className="flex-1 truncate">{section.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
