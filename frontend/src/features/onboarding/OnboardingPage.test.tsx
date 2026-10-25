import { describe, expect, it, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders, signInAsDemo } from '@/test/utils';
import { OnboardingPage } from './OnboardingPage';
import { resetState, getState } from '@/mocks/state';
import { clearLocalDraft } from '@/lib/onboarding/storage';
import { deriveMissionPreview, hydrateAnswers, nextQuestionId } from '@/lib/onboarding/engine';
import { DEMO_PROFILE } from '@/mocks/fixtures/profile';

/**
 * Onboarding.
 *
 * The behaviour that matters: the agent asks only what the profile does
 * not already answer, the mission is derived from the answers, and the
 * draft survives a refresh.
 */
describe('onboarding engine', () => {
  beforeEach(() => {
    resetState();
    clearLocalDraft();
  });

  it('skips the questions the confirmed profile already answers', () => {
    const draft = hydrateAnswers(
      {
        id: 'd1000000-0000-4000-8000-000000000009',
        intent: 'goal',
        referenceUrl: null,
        uploadedDocumentId: null,
        uploadedDocumentStatus: null,
        uploadedDocumentConsent: null,
        answers: [],
        currentQuestionId: 'goal',
        completed: false,
        updatedAt: new Date().toISOString(),
      },
      DEMO_PROFILE,
    );

    // The field and the start period come from confirmed facts.
    const inferred = draft.answers.filter((answer) => answer.source !== 'user');
    expect(inferred.map((answer) => answer.questionId)).toEqual([
      'field',
      'start_period',
      'use_documents',
    ]);
    expect(inferred[0]?.factKey).toBe('field');
    expect(inferred[0]?.note).toContain('confirmed profile fact');
  });

  it('asks the questions the profile cannot answer', () => {
    const draft = hydrateAnswers(
      {
        id: 'd1000000-0000-4000-8000-000000000010',
        intent: 'goal',
        referenceUrl: null,
        uploadedDocumentId: null,
        uploadedDocumentStatus: null,
        uploadedDocumentConsent: null,
        answers: [],
        currentQuestionId: 'goal',
        completed: false,
        updatedAt: new Date().toISOString(),
      },
      DEMO_PROFILE,
    );

    expect(nextQuestionId(draft.answers)).toBe('goal');
  });

  it('derives a mission in plain language from the answers', () => {
    const draft = {
      id: 'd1000000-0000-4000-8000-000000000011',
      intent: 'goal' as const,
      referenceUrl: null,
      uploadedDocumentId: null,
      uploadedDocumentStatus: null,
      uploadedDocumentConsent: null,
      answers: [
        {
          questionId: 'opportunity_type' as const,
          value: 'research_internship',
          answeredAt: new Date().toISOString(),
          source: 'user' as const,
          factKey: null,
          note: null,
        },
        {
          questionId: 'field' as const,
          value: 'Machine learning for climate science',
          answeredAt: new Date().toISOString(),
          source: 'user' as const,
          factKey: null,
          note: null,
        },
        {
          questionId: 'destinations' as const,
          value: ['NL', 'DE'],
          answeredAt: new Date().toISOString(),
          source: 'user' as const,
          factKey: null,
          note: null,
        },
        {
          questionId: 'funding' as const,
          value: 'fully_funded',
          answeredAt: new Date().toISOString(),
          source: 'user' as const,
          factKey: null,
          note: null,
        },
      ],
      currentQuestionId: null,
      completed: false,
      updatedAt: new Date().toISOString(),
    };

    const preview = deriveMissionPreview(draft, DEMO_PROFILE);

    expect(preview.objective).toContain('research internships');
    expect(preview.objective).toContain('machine learning for climate science');
    expect(preview.objective).toContain('netherlands');
    expect(preview.objective).toContain('fully funded');
    expect(preview.criteria.fundingPreference).toBe('fully_funded');
    expect(preview.criteria.destinations).toEqual(['Europe']);
    expect(preview.criteria.destinationCountries).toEqual(['NL', 'DE']);
    expect(preview.limitations.length).toBeGreaterThan(0);
  });
});

describe('OnboardingPage', () => {
  beforeEach(() => {
    resetState();
    clearLocalDraft();
    signInAsDemo();
  });

  it('offers three ways to begin', async () => {
    renderWithProviders(<OnboardingPage />);

    expect(await screen.findByText('Tell Oppulse what you need')).toBeInTheDocument();
    expect(screen.getByText('Upload my CV and documents')).toBeInTheDocument();
    expect(screen.getByText('I already found an opportunity')).toBeInTheDocument();
  });

  it('asks the first question after a starting path is chosen', async () => {
    const { user } = renderWithProviders(<OnboardingPage />);

    const startHere = await screen.findAllByRole('button', { name: 'Start here' });
    await user.click(startHere[0]!);

    expect(
      await screen.findByRole('heading', { name: 'What are you hoping to achieve?' }),
    ).toBeInTheDocument();
  });

  it('saves the draft so a refresh does not lose the answers', async () => {
    const { user } = renderWithProviders(<OnboardingPage />);

    const startHere = await screen.findAllByRole('button', { name: 'Start here' });
    await user.click(startHere[0]!);

    await screen.findByRole('heading', { name: 'What are you hoping to achieve?' });
    await user.click(screen.getByRole('radio', { name: /Study in another country/ }));

    await waitFor(() => {
      const draft = getState().onboardingDraft;
      expect(draft?.intent).toBe('goal');
      expect(draft?.answers.some((answer) => answer.questionId === 'goal')).toBe(true);
    });
  });

  it('records the uploaded document in the draft, not in browser state', async () => {
    const { user } = renderWithProviders(<OnboardingPage />);

    const startHere = await screen.findAllByRole('button', { name: 'Start here' });
    await user.click(startHere[1]!); // "Upload my CV and documents"

    await screen.findByRole('heading', { name: 'Upload your documents' });

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(
      input,
      new File(['%PDF-1.4 fake'], 'benali-cv.pdf', { type: 'application/pdf' }),
    );

    await waitFor(() => {
      const draft = getState().onboardingDraft;
      expect(draft?.uploadedDocumentId).not.toBeNull();
      expect(draft?.uploadedDocumentStatus).toBe('processing');
    });

    // And the document really exists on the server, with its own id.
    const uploaded = getState().documents.find((item) => item.filename === 'benali-cv.pdf');
    expect(uploaded?.id).toBe(getState().onboardingDraft?.uploadedDocumentId);
  });

  it('resumes the materials path from the server draft after a refresh', async () => {
    const { user, unmount } = renderWithProviders(<OnboardingPage />);

    const startHere = await screen.findAllByRole('button', { name: 'Start here' });
    await user.click(startHere[1]!);
    await screen.findByRole('heading', { name: 'Upload your documents' });

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(
      input,
      new File(['%PDF-1.4 fake'], 'benali-cv.pdf', { type: 'application/pdf' }),
    );

    await waitFor(() => {
      expect(getState().onboardingDraft?.uploadedDocumentId).not.toBeNull();
    });

    unmount();

    // A fresh mount reads the server copy, so the upload panel does not
    // reappear and ask for the file again.
    renderWithProviders(<OnboardingPage />);
    await waitFor(() => {
      expect(
        screen.queryByRole('heading', { name: 'Upload your documents' }),
      ).not.toBeInTheDocument();
    });
  });

  it('builds a mission preview from the answers', async () => {
    const { user } = renderWithProviders(<OnboardingPage />);

    const startHere = await screen.findAllByRole('button', { name: 'Start here' });
    await user.click(startHere[0]!);

    await screen.findByRole('heading', { name: 'What are you hoping to achieve?' });
    await user.click(screen.getByRole('radio', { name: /Study in another country/ }));

    await user.click(screen.getByRole('button', { name: 'Skip the rest and show me the mission' }));

    expect(
      await screen.findByRole('heading', { name: 'Here is what I will do' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Opportunity type')).toBeInTheDocument();
    expect(screen.getByText('What this mission cannot promise')).toBeInTheDocument();
  });

  it('asks for a date of birth only when the opportunity can carry an age limit', async () => {
    const { user } = renderWithProviders(<OnboardingPage />);

    const startHere = await screen.findAllByRole('button', { name: 'Start here' });
    await user.click(startHere[0]!);

    await screen.findByRole('heading', { name: 'What are you hoping to achieve?' });
    await user.click(screen.getByRole('radio', { name: /Study in another country/ }));

    // A scholarship is not asked for: there is no reason to take the date.
    await screen.findByRole('heading', { name: 'Which type of opportunity are you considering?' });
    await user.click(screen.getByRole('radio', { name: 'Scholarship' }));

    await waitFor(() => {
      expect(
        screen.queryByRole('heading', { name: 'What is your date of birth?' }),
      ).not.toBeInTheDocument();
    });
  });

  it('asks for a date of birth when the opportunity type can have an age rule', async () => {
    const { user } = renderWithProviders(<OnboardingPage />);

    const startHere = await screen.findAllByRole('button', { name: 'Start here' });
    await user.click(startHere[0]!);

    await screen.findByRole('heading', { name: 'What are you hoping to achieve?' });
    await user.click(screen.getByRole('radio', { name: /Study in another country/ }));

    await screen.findByRole('heading', { name: 'Which type of opportunity are you considering?' });
    await user.click(screen.getByRole('radio', { name: 'Research internship' }));

    await screen.findByRole('heading', {
      name: 'Where could you realistically study or work?',
    });
    await user.click(screen.getByRole('checkbox', { name: /Netherlands/ }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    await screen.findByRole('heading', {
      name: 'What does funding need to cover for you?',
    });
    await user.click(screen.getByRole('radio', { name: /Fully funded/ }));

    // Every other question is answered from the profile, so this one is
    // next — and it explains why it is asking.
    expect(
      await screen.findByRole('heading', { name: 'What is your date of birth?' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/It is private, it is used only for that/)).toBeInTheDocument();
  });

  it('records "prefer not to say" as declined, and leaves the age rule unresolved', async () => {
    const { user } = renderWithProviders(<OnboardingPage />);

    const startHere = await screen.findAllByRole('button', { name: 'Start here' });
    await user.click(startHere[0]!);

    await screen.findByRole('heading', { name: 'What are you hoping to achieve?' });
    await user.click(screen.getByRole('radio', { name: /Study in another country/ }));

    await screen.findByRole('heading', { name: 'Which type of opportunity are you considering?' });
    await user.click(screen.getByRole('radio', { name: 'Research internship' }));

    await screen.findByRole('heading', {
      name: 'Where could you realistically study or work?',
    });
    await user.click(screen.getByRole('checkbox', { name: /Netherlands/ }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    await screen.findByRole('heading', {
      name: 'What does funding need to cover for you?',
    });
    await user.click(screen.getByRole('radio', { name: /Fully funded/ }));

    await screen.findByRole('heading', { name: 'What is your date of birth?' });

    // The choice is informed: it says what "prefer not to say" costs before
    // it is offered, rather than after.
    expect(
      await screen.findByText(/Some age-restricted checks may stay unresolved/),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Prefer not to say' }));

    // The answer is kept, so a refresh does not ask again.
    await waitFor(() => {
      const answer = getState().onboardingDraft?.answers.find(
        (entry) => entry.questionId === 'age',
      );
      expect(answer?.value).toBe('prefer_not_to_say');
    });
  });
});
