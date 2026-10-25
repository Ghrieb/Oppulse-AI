import type { ProfileFact } from '@/lib/schemas';

/**
 * The state of a fact.
 *
 * The state is derived, never stored separately, so a fact can never claim
 * to be confirmed while it is excluded, or be proposed and corrected at the
 * same time.
 */
export type FactState =
  'proposed' | 'confirmed' | 'corrected' | 'excluded' | 'conflicting' | 'rejected';

export function factState(fact: ProfileFact): FactState {
  if (fact.excluded) return 'excluded';
  if (fact.conflicting) return 'conflicting';
  if (fact.corrected && fact.status === 'confirmed') return 'corrected';
  if (fact.status === 'confirmed') return 'confirmed';
  if (fact.status === 'rejected') return 'rejected';
  return 'proposed';
}

export interface FactStateMeta {
  label: string;
  tone: 'success' | 'warning' | 'info' | 'neutral' | 'danger';
  /** What this state means, in plain language. */
  description: string;
}

export const FACT_STATE_META: Record<FactState, FactStateMeta> = {
  proposed: {
    label: 'Proposed',
    tone: 'warning',
    description:
      'Oppulse found this in your document but you have not confirmed it, so it is not used yet.',
  },
  confirmed: {
    label: 'Confirmed',
    tone: 'success',
    description: 'You confirmed this, so Oppulse uses it to check your applications.',
  },
  corrected: {
    label: 'Corrected',
    tone: 'info',
    description: 'You corrected the value Oppulse extracted. The corrected value is used.',
  },
  excluded: {
    label: 'Excluded',
    tone: 'neutral',
    description:
      'You took this out of the agent’s context. Requirements that depend on it stay unresolved.',
  },
  conflicting: {
    label: 'Conflicting',
    tone: 'danger',
    description: 'Two of your documents state different values. You choose which one is right.',
  },
  rejected: {
    label: 'Not mine',
    tone: 'neutral',
    description: 'You said this is not about you, so Oppulse ignores it.',
  },
};
