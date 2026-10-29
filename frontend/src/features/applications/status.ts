import type { ApplicationStatus } from '@/lib/schemas';

/**
 * Application status presentation.
 *
 * Shared by the workspace list and the workspace detail so the same status
 * can never read differently on two screens. Colour never carries the
 * meaning alone — every badge also spells the status out (spec §4.2).
 */
export const STATUS_LABEL: Record<ApplicationStatus, string> = {
  considering: 'Considering',
  preparing: 'Preparing',
  waiting_for_documents: 'Waiting for documents',
  waiting_for_recommender: 'Waiting for recommender',
  ready_for_review: 'Ready for review',
  submitted: 'Submitted',
  accepted: 'Accepted',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
};

export const STATUS_TONE: Record<
  ApplicationStatus,
  'neutral' | 'success' | 'warning' | 'danger' | 'info'
> = {
  considering: 'neutral',
  preparing: 'info',
  waiting_for_documents: 'warning',
  waiting_for_recommender: 'warning',
  ready_for_review: 'success',
  submitted: 'info',
  accepted: 'success',
  rejected: 'danger',
  withdrawn: 'neutral',
};
