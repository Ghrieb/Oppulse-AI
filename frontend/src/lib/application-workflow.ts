import type { Application } from './schemas';

/**
 * The working-applicant summary.
 *
 * A student juggling several applications needs to know how much work is
 * left, how urgent it is, and where they stopped. All three are derived
 * from data the workspace already holds, so the numbers cannot drift from
 * the workspace.
 */

/** The time we assume a single outstanding requirement takes. */
export const MINUTES_PER_ITEM = 45;

export interface ApplicationWorkflowSummary {
  /** Outstanding requirements. */
  remaining: number;
  /** Estimated minutes of work left. */
  estimatedMinutes: number;
  /** Outstanding requirements that need a document the student does not have. */
  missingDocuments: number;
  /** The deadline priority, derived only from a *verified* deadline. */
  priority: 'tight' | 'normal' | 'comfortable' | 'unknown';
  /** Days left, when the deadline is verified. */
  daysLeft: number | null;
}

export function summariseApplication(application: Application): ApplicationWorkflowSummary {
  const remaining = application.checklist.filter((item) => item.status !== 'done').length;
  const missingDocuments = application.checklist.filter(
    (item) => item.status === 'missing' && item.documentId === null,
  ).length;

  let daysLeft: number | null = null;
  let priority: ApplicationWorkflowSummary['priority'] = 'unknown';

  if (application.deadlineVerified && application.deadline) {
    const target = new Date(application.deadline).getTime();
    const now = Date.now();
    daysLeft = Math.ceil((target - now) / 86_400_000);
    priority = daysLeft <= 7 ? 'tight' : daysLeft <= 21 ? 'normal' : 'comfortable';
  }

  return {
    remaining,
    estimatedMinutes: remaining * MINUTES_PER_ITEM,
    missingDocuments,
    priority,
    daysLeft,
  };
}
