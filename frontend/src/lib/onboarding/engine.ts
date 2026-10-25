import type {
  AnswerValue,
  MissionPreview,
  OnboardingAnswer,
  OnboardingDraft,
  Profile,
  QuestionId,
} from '@/lib/schemas';
import { ONBOARDING_QUESTIONS, getQuestion, isQuestionRelevant } from './questions';
import { countryName, GLOBAL_DESTINATION, regionsFor } from '../countries';

/**
 * The onboarding engine.
 *
 * Two jobs: decide which question to ask next, and turn the answers into an
 * editable mission. The mission is *derived* — it is never written by hand
 * — so editing an answer always updates the preview.
 */

const SOURCE_SCOPE = [
  'Official programme and fellowship pages',
  'University research offices and careers pages',
  'Fellowship directories and aggregators',
];

/** Fills in every question the confirmed profile already answers. */
export function hydrateAnswers(draft: OnboardingDraft, profile: Profile): OnboardingDraft {
  const answered = new Set(draft.answers.map((answer) => answer.questionId));
  const additions: OnboardingAnswer[] = [];

  for (const question of ONBOARDING_QUESTIONS) {
    if (answered.has(question.id)) continue;

    const resolved = question.resolveFromProfile(profile);
    if (!resolved) continue;

    additions.push({
      questionId: question.id,
      value: resolved.value,
      answeredAt: new Date().toISOString(),
      source: question.id === 'use_documents' ? 'consent' : 'profile_fact',
      factKey: resolved.factKey ?? null,
      note: resolved.note,
    });
  }

  if (additions.length === 0) return draft;

  const answers = [...draft.answers, ...additions];
  return {
    ...draft,
    answers,
    currentQuestionId: nextQuestionId(answers),
  };
}

/** The first question that is neither answered nor inferable. */
export function nextQuestionId(answers: OnboardingAnswer[]): QuestionId | null {
  const answered = new Set(answers.map((answer) => answer.questionId));
  const firstOpen = ONBOARDING_QUESTIONS.find(
    (question) => !answered.has(question.id) && isQuestionRelevant(question, answers),
  );
  return firstOpen?.id ?? null;
}

/** The questions that were answered from the profile rather than by the user. */
export function inferredAnswers(draft: OnboardingDraft): OnboardingAnswer[] {
  return draft.answers.filter((answer) => answer.source !== 'user');
}

function answerFor(draft: OnboardingDraft, questionId: QuestionId): OnboardingAnswer | undefined {
  return draft.answers.find((answer) => answer.questionId === questionId);
}

function asString(value: AnswerValue | undefined): string | null {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return null;
}

function asList(value: AnswerValue | undefined): string[] {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') return [value];
  return [];
}

const TYPE_LABEL: Record<string, string> = {
  research_internship: 'research internships',
  fellowship: 'fellowships',
  scholarship: 'scholarships',
  summer_school: 'summer schools',
  research_program: 'research programmes',
};

const TYPE_TITLE: Record<string, string> = {
  research_internship: 'Research internships',
  fellowship: 'Fellowships',
  scholarship: 'Scholarships',
  summer_school: 'Summer schools',
  research_program: 'Research programmes',
};

const FUNDING_LABEL: Record<string, string> = {
  fully_funded: 'fully funded',
  partial_ok: 'partially funded',
  any: 'any funding',
};

const START_LABEL: Record<string, string> = {
  soon: 'starting within three months',
  six_to_twelve: 'starting within a year',
  next_year: 'starting next year or later',
  flexible: 'with a flexible start date',
};

/**
 * Builds the mission preview from the answers and the confirmed profile.
 *
 * The preview is what the user confirms before any research runs, so it
 * states plainly what will be searched, what will be used, and what the
 * mission cannot promise.
 */
export function deriveMissionPreview(draft: OnboardingDraft, profile: Profile): MissionPreview {
  const typeAnswer = asString(answerFor(draft, 'opportunity_type')?.value);
  const typeKey = typeAnswer && typeAnswer !== 'not_sure' ? typeAnswer : null;

  const field = asString(answerFor(draft, 'field')?.value);
  const destinationCountries = asList(answerFor(draft, 'destinations')?.value);
  const destinations = regionsFor(destinationCountries);
  const fundingKey = asString(answerFor(draft, 'funding')?.value) ?? 'any';
  const startKey = asString(answerFor(draft, 'start_period')?.value) ?? 'flexible';
  const useDocuments = answerFor(draft, 'use_documents')?.value;

  const typePhrase = typeKey
    ? (TYPE_LABEL[typeKey] ?? 'opportunities')
    : 'a range of research opportunities';
  const fieldPhrase = field ? field.toLowerCase() : 'your field';
  const destinationPhrase =
    destinationCountries.length === 0
      ? 'anywhere in the world'
      : destinationCountries.includes(GLOBAL_DESTINATION)
        ? 'anywhere in the world'
        : destinationCountries.map((code) => countryName(code).toLowerCase()).join(', ');
  const fundingPhrase = FUNDING_LABEL[fundingKey] ?? 'any funding';
  const startPhrase = START_LABEL[startKey] ?? 'with a flexible start date';
  const profilePhrase =
    useDocuments === true
      ? 'using your confirmed profile facts and documents'
      : useDocuments === false
        ? 'without using your documents'
        : 'using your confirmed profile facts';

  const title = typeKey
    ? `${fundingPhrase === 'any funding' ? '' : `${fundingPhrase} `}${TYPE_TITLE[typeKey] ?? 'Opportunities'} in ${destinationPhrase.split(' and ')[0]}`
    : `Research opportunities in ${fieldPhrase}`;

  const objective = `I will search for ${typePhrase} in ${fieldPhrase}, prioritising ${destinationPhrase}, ${fundingPhrase}, ${startPhrase}, ${profilePhrase}.`;

  const usedFactKeys = [
    ...new Set(
      draft.answers
        .filter((answer) => answer.source === 'profile_fact' && answer.factKey)
        .map((answer) => answer.factKey as string),
    ),
  ];

  // The field answer may have come from the user, in which case the matching
  // confirmed fact is still what the agent will compare against.
  const fieldValue = asString(answerFor(draft, 'field')?.value);
  const fieldFact = profile.facts.find(
    (item) => item.key === 'field' && item.status === 'confirmed' && !item.excluded,
  );
  if (fieldFact && fieldValue && !usedFactKeys.includes(fieldFact.key)) {
    usedFactKeys.push(fieldFact.key);
  }

  // The interface shows the fact's own label, never its storage key.
  const usedFacts = usedFactKeys
    .map((key) => {
      const fact = profile.facts.find((item) => item.key === key);
      return fact ? { key, label: fact.label } : null;
    })
    .filter((entry): entry is { key: string; label: string } => entry !== null);

  const usedDocumentIds = [
    ...new Set(
      profile.facts
        .filter((item) => usedFactKeys.includes(item.key))
        .map((item) => item.source?.documentId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  return {
    title: title.replace(/\s+/g, ' ').trim(),
    objective,
    criteria: {
      opportunityTypes:
        typeKey && typeKey !== 'not_sure'
          ? [typeKey as MissionPreview['criteria']['opportunityTypes'][number]]
          : ['research_internship', 'fellowship', 'summer_school'],
      academicInterests: field ? [field] : [],
      destinations,
      destinationCountries,
      educationLevel: 'any',
      fundingPreference: fundingKey as MissionPreview['criteria']['fundingPreference'],
      startPeriod: startPhrase.replace(/^starting /, ''),
      useProfile: useDocuments !== false,
      sourceScope: SOURCE_SCOPE,
    },
    summary: objective,
    usedFacts,
    usedDocumentIds,
    sourceScope: SOURCE_SCOPE,
    limitations: [
      'Oppulse reports the sources it can reach. A source it cannot open is shown as unreachable, never as “no opportunity found”.',
      'Competitiveness stays unknown unless a source states it. No acceptance rates are guessed.',
      'A profile match measures fit, not the likelihood of an offer.',
    ],
  };
}

/** A short label for a question, used in the progress indicator. */
export function questionLabel(questionId: QuestionId): string {
  return getQuestion(questionId).prompt;
}
