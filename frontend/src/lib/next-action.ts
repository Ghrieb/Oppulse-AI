import { deterministicUuid } from './ids';
import type {
  Alert,
  Application,
  Document,
  Draft,
  NextAction,
  Opportunity,
  Profile,
  Source,
} from './schemas';

/**
 * Next best action.
 *
 * The workspace shows one prioritised action at a time, tied to a real
 * blocker, with the reason it matters and a link to the place where it can
 * be resolved. It is derived, not authored: the same inputs always produce
 * the same action, and the derivation is shared by the mock, the client and
 * (later) the backend so the three never disagree.
 */

export interface NextActionInput {
  profile: Profile | null | undefined;
  opportunities: Opportunity[];
  applications: Application[];
  drafts: Draft[];
  sources: Source[];
  alerts: Alert[];
  /** The documents the student has uploaded, and how far they were read. */
  documents?: Document[];
  /** Timestamp for the created action. Supplied by the caller for determinism. */
  now: string;
}

/** Capitalises the first character without lower-casing the rest. */
function capitalise(value: string): string {
  return value.length === 0 ? value : `${value[0]!.toUpperCase()}${value.slice(1)}`;
}

function action(
  init: Omit<NextAction, 'createdAt'> & { createdAt?: string },
  now: string,
): NextAction {
  return { ...init, createdAt: init.createdAt ?? now };
}

/**
 * Derives the single most useful next action.
 *
 * The ladder is ordered by how much the action is actually blocking the
 * student, not by how easy it is to explain.
 */
export function deriveNextAction(input: NextActionInput): NextAction | null {
  const { profile, opportunities, applications, drafts, sources, alerts, documents, now } = input;

  // 1. An unconfirmed fact is blocking a requirement. Nothing else matters
  //    as much: the answer is wrong until this is settled.
  const pendingFacts = (profile?.facts ?? []).filter(
    (fact) => fact.status === 'proposed' && !fact.excluded,
  );

  if (pendingFacts.length > 0) {
    // A fact blocks when a requirement that depends on it is unresolved.
    // This is a structural check, not a text match on the warning copy.
    const blockingFact = pendingFacts.find((fact) =>
      opportunities.some((opportunity) =>
        opportunity.requirements.some(
          (requirement) =>
            requirement.profileFactKey === fact.key && requirement.status === 'unresolved',
        ),
      ),
    );

    if (blockingFact) {
      return action(
        {
          id: deterministicUuid(`confirm-fact:${blockingFact.id}`),
          kind: 'confirm_fact',
          title: `Confirm your ${capitalise(blockingFact.label)}`,
          rationale:
            'It is the one thing blocking an eligibility requirement, so every assessment stays unresolved until you confirm it.',
          cta: 'Review the fact',
          route: `/profile?fact=${blockingFact.id}`,
          priority: 100,
          blockerId: blockingFact.id,
        },
        now,
      );
    }
  }

  // 1b. An age rule cannot be checked without the date of birth. It is a
  //     protected attribute rather than a fact, so it gets its own rung —
  //     and the student is told what it is for.
  const ageOpportunity = opportunities.find((opportunity) =>
    opportunity.requirements.some(
      (requirement) => requirement.kind === 'age' && requirement.status === 'unresolved',
    ),
  );

  if (ageOpportunity) {
    const ageRequirement = ageOpportunity.requirements.find(
      (requirement) => requirement.kind === 'age' && requirement.status === 'unresolved',
    );

    return action(
      {
        id: deterministicUuid(`age:${ageRequirement?.id ?? ageOpportunity.id}`),
        kind: 'confirm_fact',
        title: 'Add your date of birth',
        rationale: `The ${ageOpportunity.title} call has an age rule, and it cannot be checked without your date of birth. It stays private, and you can remove it at any time.`,
        cta: 'Add it in your passport',
        route: '/profile?section=protected',
        priority: 95,
        blockerId: ageRequirement?.id ?? null,
      },
      now,
    );
  }

  // 1c. A requirement depends on a fact the student has not provided. It
  //     stays unresolved until they add it, so it is a real blocker.
  const missingFactOpportunity = opportunities.find((opportunity) =>
    opportunity.requirements.some(
      (requirement) =>
        requirement.profileFactKey !== null &&
        requirement.status === 'unresolved' &&
        !(profile?.facts ?? []).some((fact) => fact.key === requirement.profileFactKey),
    ),
  );

  if (missingFactOpportunity) {
    const missingRequirement = missingFactOpportunity.requirements.find(
      (requirement) =>
        requirement.profileFactKey !== null &&
        requirement.status === 'unresolved' &&
        !(profile?.facts ?? []).some((fact) => fact.key === requirement.profileFactKey),
    );

    return action(
      {
        id: deterministicUuid(
          `missing-fact:${missingRequirement?.id ?? missingFactOpportunity.id}`,
        ),
        kind: 'confirm_fact',
        title: `Add your ${missingRequirement?.label ?? 'missing detail'}`,
        rationale:
          'This requirement is decided by something you have not told us yet, so it stays unresolved until you add it.',
        cta: 'Add it in your passport',
        route: '/profile',
        priority: 92,
        blockerId: missingRequirement?.id ?? null,
      },
      now,
    );
  }

  // 1d. A document the agent could not read. The part that was unread is
  //     an unresolved requirement, not a gap in the student's profile.
  const unreadDocument = (documents ?? []).find(
    (document) => document.status === 'partial' || document.status === 'failed',
  );

  if (unreadDocument) {
    return action(
      {
        id: deterministicUuid(`document-unread:${unreadDocument.id}`),
        kind: 'complete_document',
        title: `Upload ${unreadDocument.filename} again`,
        rationale:
          'Part of that document could not be read, so anything it says about you is still unknown.',
        cta: 'Open your documents',
        route: '/documents',
        priority: 94,
        blockerId: unreadDocument.id,
      },
      now,
    );
  }

  // 2. A deadline conflict means the application date is not yet known.
  const conflicting = opportunities.find(
    (opportunity) => opportunity.deadline.status === 'conflict' && !opportunity.dismissed,
  );

  if (conflicting) {
    return action(
      {
        id: deterministicUuid(`conflict:${conflicting.id}`),
        kind: 'resolve_conflict',
        title: `Two sources disagree on the ${conflicting.title} deadline`,
        rationale:
          'Until the official date is confirmed, the application window cannot be planned around.',
        cta: 'Review the conflict',
        route: `/opportunities/${conflicting.id}`,
        priority: 90,
        blockerId: conflicting.id,
      },
      now,
    );
  }

  // 3. A source we could not reach means part of the assessment is missing.
  const unreachable = sources.find((source) => source.status === 'unavailable');
  const unreachableOpportunity = unreachable
    ? opportunities.find(
        (opportunity) => opportunity.sourceDomain === unreachable.domain && !opportunity.dismissed,
      )
    : undefined;

  if (unreachable && unreachableOpportunity) {
    return action(
      {
        id: deterministicUuid(`source:${unreachable.id}`),
        kind: 'check_source',
        title: `We could not reach the source for ${unreachableOpportunity.title}`,
        rationale:
          'Nothing from that page has been verified, so its deadline and funding are unknown rather than absent.',
        cta: 'See what is missing',
        route: `/opportunities/${unreachableOpportunity.id}`,
        priority: 70,
        blockerId: unreachable.id,
      },
      now,
    );
  }

  // 4. A document a live application still needs.
  const applicationWithMissing = applications.find((application) =>
    application.checklist.some((item) => item.status === 'missing' && item.documentId === null),
  );

  if (applicationWithMissing) {
    const missing = applicationWithMissing.checklist.find(
      (item) => item.status === 'missing' && item.documentId === null,
    );

    return action(
      {
        id: deterministicUuid(`document:${applicationWithMissing.id}:${missing?.id ?? 'unknown'}`),
        kind: 'complete_document',
        title: `Upload the document ${applicationWithMissing.opportunityTitle} needs`,
        rationale: missing?.note ?? 'This requirement is on the checklist and still missing.',
        cta: 'Open the checklist',
        route: `/applications/${applicationWithMissing.id}`,
        priority: 60,
        blockerId: missing?.id ?? null,
      },
      now,
    );
  }

  // 5. A draft the student has not reviewed yet.
  const draftWithProposal = drafts.find((draft) => draft.pendingProposal);

  if (draftWithProposal?.pendingProposal) {
    return action(
      {
        id: deterministicUuid(`proposal:${draftWithProposal.pendingProposal.id}`),
        kind: 'review_proposal',
        title: `Review the proposed revision to your ${draftWithProposal.title.toLowerCase()}`,
        rationale:
          'The assistant has drafted a change but nothing has been applied to your document yet.',
        cta: 'Review the diff',
        route: `/writing/${draftWithProposal.id}`,
        priority: 50,
        blockerId: draftWithProposal.pendingProposal.id,
      },
      now,
    );
  }

  // 6. An application whose requirements are all ready.
  const readyApplication = applications.find(
    (application) =>
      application.completion.total > 0 &&
      application.completion.completed === application.completion.total &&
      application.status === 'preparing',
  );

  if (readyApplication) {
    return action(
      {
        id: deterministicUuid(`submit:${readyApplication.id}`),
        kind: 'finish_draft',
        title: `Every requirement for ${readyApplication.opportunityTitle} is ready`,
        rationale: 'The checklist is complete, so this application is ready for a final read.',
        cta: 'Open the application',
        route: `/applications/${readyApplication.id}`,
        priority: 40,
        blockerId: readyApplication.id,
      },
      now,
    );
  }

  // 7. An unread alert.
  const unreadAlert = alerts.find((alert) => !alert.read);

  if (unreadAlert) {
    return action(
      {
        id: deterministicUuid(`alert:${unreadAlert.id}`),
        kind: 'check_source',
        title: unreadAlert.title,
        rationale: unreadAlert.body,
        cta: 'Read the alert',
        route: '/monitoring',
        priority: 30,
        blockerId: unreadAlert.id,
      },
      now,
    );
  }

  return null;
}
