import type { AssistantActionRequest } from './schemas';

/**
 * The suggestions the agent offers.
 *
 * They follow the working context, so the agent always offers the actions
 * that make sense right now rather than a fixed list of demonstrations.
 * This is pure logic, so the client and the backend can agree on it.
 */
export interface ActionChip {
  id: string;
  label: string;
  /** A question to ask. */
  message: string | null;
  /** An action to run, behind a confirmation. */
  action: AssistantActionRequest | null;
}

export function actionChipsFor(context: {
  opportunityId?: string | undefined;
  applicationId?: string | undefined;
  draftId?: string | undefined;
}): ActionChip[] {
  if (context.draftId) {
    return [
      { id: 'shorter', label: 'Make it shorter', message: 'Make this more concise.', action: null },
      {
        id: 'claims',
        label: 'Check every claim',
        message: 'Check that every claim in this document is backed by my confirmed profile.',
        action: null,
      },
      {
        id: 'polish',
        label: 'Suggest stronger openings',
        message: 'Suggest a stronger opening for this document.',
        action: null,
      },
    ];
  }

  if (context.applicationId) {
    return [
      {
        id: 'missing',
        label: 'Find missing documents',
        message: 'Which documents am I still missing for this application?',
        action: null,
      },
      {
        id: 'checklist',
        label: 'Create checklist',
        message: 'Create the application checklist.',
        action: { action: 'create_checklist', context: { applicationId: context.applicationId } },
      },
      {
        id: 'recommender',
        label: 'Draft recommendation request',
        message: 'Draft a request to my referee.',
        action: {
          action: 'create_draft',
          context: { applicationId: context.applicationId },
          payload: { draftType: 'recommender_request' },
        },
      },
    ];
  }

  if (context.opportunityId) {
    return [
      {
        id: 'eligibility',
        label: 'Check my eligibility',
        message: 'Am I eligible for this? What is still unresolved?',
        action: null,
      },
      {
        id: 'funding',
        label: 'Compare funding',
        message: 'What does this cover, and what would I still have to pay?',
        action: null,
      },
      {
        id: 'letter',
        label: 'Draft motivation letter',
        message: 'Draft a motivation letter for this opportunity.',
        action: {
          action: 'create_draft',
          context: { opportunityId: context.opportunityId },
          payload: { draftType: 'motivation_letter' },
        },
      },
      {
        id: 'track',
        label: 'Track changes',
        message: 'Track this opportunity and tell me when it changes.',
        action: null,
      },
    ];
  }

  return [
    {
      id: 'find',
      label: 'Find opportunities for me',
      message: 'Find fully funded opportunities that fit my profile.',
      action: null,
    },
    {
      id: 'analyse',
      label: 'Analyse a link',
      message: 'Analyse this opportunity:',
      action: null,
    },
  ];
}
