import type { OnboardingDraft } from '@/lib/schemas';

/**
 * Local draft persistence.
 *
 * A temporary resilience layer, not the system of record: it guarantees the
 * student's answers survive a refresh, a crash or a lost connection while
 * the server-side draft endpoint is being built.
 */

const STORAGE_KEY = 'oppulse:onboarding:draft';

function canStore(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function readLocalDraft(): OnboardingDraft | null {
  if (!canStore()) return null;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<OnboardingDraft>;

    // A draft saved by an older build may not have every field. Filling the
    // gaps is better than discarding the student's answers.
    return {
      ...(parsed as OnboardingDraft),
      uploadedDocumentId: parsed.uploadedDocumentId ?? null,
      uploadedDocumentStatus: parsed.uploadedDocumentStatus ?? null,
      uploadedDocumentConsent: parsed.uploadedDocumentConsent ?? null,
    };
  } catch {
    // A corrupt local copy must never block the flow.
    return null;
  }
}

export function writeLocalDraft(draft: OnboardingDraft): void {
  if (!canStore()) return;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // Storage may be full or blocked. The in-memory draft still works.
  }
}

export function clearLocalDraft(): void {
  if (!canStore()) return;

  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to do.
  }
}
