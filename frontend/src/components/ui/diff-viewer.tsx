import { useMemo } from 'react';
import { cn } from '@/lib/cn';

/**
 * Word-level diff.
 *
 * Used by the writing studio to show exactly what an AI proposal would
 * change, so the student reviews a real diff instead of a rewritten
 * document (spec §6.7, ADR-006).
 */

type DiffToken = { type: 'equal' | 'added' | 'removed'; value: string };

function tokenize(text: string): string[] {
  return text.split(/(\s+)/).filter((token) => token.length > 0);
}

/**
 * Longest common subsequence over words, computed with a rolling matrix so
 * long documents do not blow the stack.
 */
function diffTokens(before: string[], after: string[]): DiffToken[] {
  const rows = before.length;
  const cols = after.length;

  // Guard against pathological inputs; a truncated diff is better than a hang.
  const limit = 4000;
  if (rows * cols > limit * limit) {
    return [
      { type: 'removed', value: before.join('') },
      { type: 'added', value: after.join('') },
    ];
  }

  const table: number[][] = Array.from({ length: rows + 1 }, () =>
    new Array<number>(cols + 1).fill(0),
  );

  for (let i = rows - 1; i >= 0; i -= 1) {
    const row = table[i];
    const next = table[i + 1];
    if (!row || !next) continue;
    for (let j = cols - 1; j >= 0; j -= 1) {
      row[j] =
        before[i] === after[j] ? (next[j + 1] ?? 0) + 1 : Math.max(next[j] ?? 0, row[j + 1] ?? 0);
    }
  }

  const tokens: DiffToken[] = [];
  let i = 0;
  let j = 0;

  const push = (type: DiffToken['type'], value: string) => {
    const last = tokens[tokens.length - 1];
    if (last && last.type === type) last.value += value;
    else tokens.push({ type, value });
  };

  while (i < rows && j < cols) {
    if (before[i] === after[j]) {
      push('equal', before[i] ?? '');
      i += 1;
      j += 1;
    } else if ((table[i + 1]?.[j] ?? 0) >= (table[i]?.[j + 1] ?? 0)) {
      push('removed', before[i] ?? '');
      i += 1;
    } else {
      push('added', after[j] ?? '');
      j += 1;
    }
  }

  while (i < rows) {
    push('removed', before[i] ?? '');
    i += 1;
  }
  while (j < cols) {
    push('added', after[j] ?? '');
    j += 1;
  }

  return tokens;
}

export interface DiffViewerProps {
  before: string;
  after: string;
  className?: string;
}

export function DiffViewer({ before, after, className }: DiffViewerProps) {
  const tokens = useMemo(() => diffTokens(tokenize(before), tokenize(after)), [before, after]);

  const added = tokens.filter((token) => token.type === 'added').length;
  const removed = tokens.filter((token) => token.type === 'removed').length;

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <p className="text-meta text-text-muted">
        {added > 0 ? `${added} word${added === 1 ? '' : 's'} added` : 'No words added'}
        {' · '}
        {removed > 0 ? `${removed} word${removed === 1 ? '' : 's'} removed` : 'No words removed'}
      </p>
      <div className="rounded-card border border-border bg-surface p-4 text-sm leading-relaxed">
        {tokens.map((token, index) => (
          <span
            // Tokens are positional; the index is the only stable identity.
            key={index}
            className={cn(
              token.type === 'added' && 'rounded bg-success-surface text-success',
              token.type === 'removed' && 'rounded bg-danger-surface text-danger line-through',
            )}
          >
            {token.value}
          </span>
        ))}
      </div>
    </div>
  );
}
