import type { Profile } from '@/lib/schemas';
import type { AnswerValue, OnboardingAnswer, QuestionId } from '@/lib/schemas/onboarding';

/**
 * The adaptive question catalogue.
 *
 * Each question is asked only when the confirmed profile does not already
 * answer it. A question resolved from the profile is skipped and shown as
 * pre-filled with a note explaining where the value came from, so the user
 * can see the agent doing the work instead of repeating themselves.
 *
 * A question may also be *conditional*: it is only asked when there is a
 * clear reason to ask it. The date of birth, for instance, is only asked
 * for when the kind of opportunity the student is looking for can carry an
 * age limit.
 */

export interface QuestionOption {
  value: string;
  label: string;
  description?: string;
}

export interface ResolvedFromProfile {
  value: AnswerValue;
  note: string;
  /** The profile fact key this value came from, for provenance. */
  factKey?: string | undefined;
}

export interface OnboardingQuestion {
  id: QuestionId;
  prompt: string;
  helper: string;
  kind: 'single' | 'multi' | 'text' | 'boolean' | 'date' | 'countries';
  options: QuestionOption[];
  /** Optional questions can be skipped without blocking the flow. */
  skippable: boolean;
  /** Placeholder for text questions. */
  placeholder?: string;
  /**
   * Whether this question is worth asking yet.
   *
   * A question without this is always asked. One with it is asked only when
   * the answers so far make it relevant — which is how the product avoids
   * asking for sensitive data before there is a reason to.
   */
  isRelevant?: ((answers: OnboardingAnswer[]) => boolean) | undefined;
  /** Resolves this question from confirmed profile facts or consent. */
  resolveFromProfile: (profile: Profile) => ResolvedFromProfile | null;
}

const noProfileAnswer = () => null;

export const ONBOARDING_QUESTIONS: OnboardingQuestion[] = [
  {
    id: 'goal',
    prompt: 'What are you hoping to achieve?',
    helper: 'This shapes what Oppulse prioritises. You can change it later.',
    kind: 'single',
    skippable: false,
    options: [
      {
        value: 'study_abroad',
        label: 'Study in another country',
        description: 'A degree or exchange outside your current institution.',
      },
      {
        value: 'research_experience',
        label: 'Get research experience',
        description: 'A placement, internship or lab attachment.',
      },
      {
        value: 'funding',
        label: 'Find funding for my current studies',
        description: 'Support for the programme you are already in.',
      },
      {
        value: 'career',
        label: 'Change direction',
        description: 'Move into a new field through a funded programme.',
      },
      { value: 'not_sure', label: 'I am not sure yet', description: 'Show me what is realistic.' },
    ],
    resolveFromProfile: noProfileAnswer,
  },
  {
    id: 'opportunity_type',
    prompt: 'Which type of opportunity are you considering?',
    helper: 'Pick the one that matters most. Oppulse can widen the search later.',
    kind: 'single',
    skippable: true,
    options: [
      { value: 'research_internship', label: 'Research internship' },
      { value: 'fellowship', label: 'Fellowship' },
      { value: 'scholarship', label: 'Scholarship' },
      { value: 'summer_school', label: 'Summer school' },
      { value: 'research_program', label: 'Research programme' },
      { value: 'not_sure', label: 'Show me a range' },
    ],
    resolveFromProfile: noProfileAnswer,
  },
  {
    id: 'field',
    prompt: 'What field or research area should I prioritise?',
    helper: 'Be specific if you can — it is the single biggest factor in a good match.',
    kind: 'text',
    skippable: true,
    placeholder: 'e.g. computational biology, machine learning for climate science',
    options: [],
    resolveFromProfile: (profile) => {
      const fact = profile.facts.find(
        (item) => item.key === 'field' && item.status === 'confirmed' && !item.excluded,
      );
      if (!fact) return null;
      return {
        value: fact.value,
        note: `Taken from your confirmed profile fact “${fact.label}”.`,
        factKey: fact.key,
      };
    },
  },
  {
    id: 'destinations',
    prompt: 'Where could you realistically study or work?',
    helper:
      'Pick the countries you would actually consider. The names are what the agent searches and ranks by; “Global” means no preference at all.',
    kind: 'countries',
    skippable: true,
    options: [],
    resolveFromProfile: noProfileAnswer,
  },
  {
    id: 'funding',
    prompt: 'What does funding need to cover for you?',
    helper: 'This decides which opportunities Oppulse treats as worth your time.',
    kind: 'single',
    skippable: true,
    options: [
      {
        value: 'fully_funded',
        label: 'Fully funded',
        description: 'I cannot contribute to the cost.',
      },
      {
        value: 'partial_ok',
        label: 'Partial funding is fine',
        description: 'Show me anything that leaves a small, stated gap.',
      },
      {
        value: 'any',
        label: 'Show everything',
        description: 'Explain the cost so I can decide.',
      },
    ],
    resolveFromProfile: noProfileAnswer,
  },
  {
    id: 'start_period',
    prompt: 'When would you like to start?',
    helper: 'An approximate answer is fine.',
    kind: 'single',
    skippable: true,
    options: [
      { value: 'soon', label: 'Within 3 months' },
      { value: 'six_to_twelve', label: 'In 6 to 12 months' },
      { value: 'next_year', label: 'Next year or later' },
      { value: 'flexible', label: 'Flexible — I am not fixed to a date' },
    ],
    resolveFromProfile: (profile) => {
      const fact = profile.facts.find(
        (item) => item.key === 'graduation_year' && item.status === 'confirmed' && !item.excluded,
      );
      if (!fact) return null;
      return {
        value: 'next_year',
        note: `Based on your expected graduation year (${fact.value}).`,
        factKey: fact.key,
      };
    },
  },
  {
    id: 'use_documents',
    prompt: 'Should I use your confirmed documents?',
    helper: 'Only confirmed facts are ever used, and you can exclude any document.',
    kind: 'boolean',
    skippable: true,
    options: [
      { value: 'true', label: 'Yes, use my confirmed documents' },
      { value: 'false', label: 'No — search from my instructions only' },
    ],
    resolveFromProfile: (profile) => {
      if (!profile.consent.allowProfileMatching) return null;
      return {
        value: true,
        note: 'Your profile already allows profile matching, so I will use your confirmed facts.',
      };
    },
  },
  {
    id: 'age',
    prompt: 'What is your date of birth?',
    helper:
      'Some opportunities have age limits. Your date of birth helps Oppulse check those requirements accurately. It is private, it is used only for that, and you can change or remove it at any time.',
    kind: 'date',
    skippable: true,
    options: [],
    // Only asked when the kind of opportunity can carry an age limit. A
    // date of birth is sensitive, so there has to be a reason to ask.
    isRelevant: (answers) => {
      const type = answers.find((answer) => answer.questionId === 'opportunity_type')?.value;
      return typeof type === 'string' && AGE_SENSITIVE_TYPES.includes(type);
    },
    // Never resolved from the profile: a date of birth is not inferred
    // from nationality, education level, graduation year or a CV.
    resolveFromProfile: noProfileAnswer,
  },
];

/** The opportunity types whose calls can carry an age condition. */
const AGE_SENSITIVE_TYPES = [
  'research_internship',
  'fellowship',
  'summer_school',
  'research_program',
];

/** Whether a question is worth asking, given the answers so far. */
export function isQuestionRelevant(
  question: OnboardingQuestion,
  answers: OnboardingAnswer[],
): boolean {
  return question.isRelevant ? question.isRelevant(answers) : true;
}

export function getQuestion(id: QuestionId): OnboardingQuestion {
  const question = ONBOARDING_QUESTIONS.find((item) => item.id === id);
  if (!question) {
    throw new Error(`Unknown onboarding question: ${id}`);
  }
  return question;
}
