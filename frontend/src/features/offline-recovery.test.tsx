import { screen, waitFor } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { renderWithProviders, signInAsDemo } from '@/test/utils';
import { OnboardingPage } from '@/features/onboarding/OnboardingPage';
import WritingStudioPage from '@/features/writing/WritingStudioPage';
import { resetState, getState } from '@/mocks/state';
import { setChaosRule, clearChaosRule } from '@/mocks/chaos';
import { clearLocalDraft, readLocalDraft } from '@/lib/onboarding/storage';

/**
 * Journey 16 — offline recovery after an onboarding or draft mutation.
 *
 * A lost connection must never cost the student their answers or their
 * text. Both surfaces keep a local copy the moment the change is made, so
 * the recovery is the *default* path, not a consolation prize:
 *
 * - onboarding writes the draft to this device before the request is sent,
 *   so a failed save leaves the answers exactly where they were, and the
 *   next successful save carries them to the server;
 * - the writing studio keeps the last text on a failed autosave, says so
 *   plainly, and offers a retry that works the moment the connection is
 *   back.
 */
describe('journey 16 — offline recovery', () => {
  beforeEach(() => {
    resetState();
    clearLocalDraft();
    window.localStorage.removeItem('oppulse:draft:60000000-0000-4000-8000-000000000001');
    signInAsDemo();
  });

  it('keeps the onboarding answers through a failed save, and syncs when the connection returns', async () => {
    const { user, unmount } = renderWithProviders(<OnboardingPage />);

    const startHere = await screen.findAllByRole('button', { name: 'Start here' });
    await user.click(startHere[0]!);

    await screen.findByRole('heading', { name: 'What are you hoping to achieve?' });
    await user.click(screen.getByRole('radio', { name: /Study in another country/ }));

    // The first save succeeded, so the server copy and the device copy agree.
    await waitFor(() => {
      expect(
        getState().onboardingDraft?.answers.some((answer) => answer.questionId === 'goal'),
      ).toBe(true);
    });

    // The connection drops.
    setChaosRule({ pattern: '/onboarding', mode: 'offline', delayMs: 0 });

    await screen.findByRole('heading', {
      name: 'Which type of opportunity are you considering?',
    });
    await user.click(screen.getByRole('radio', { name: /Fellowship/ }));

    // The save failed, but the answer is on this device — and the flow kept
    // moving instead of bouncing back, because the optimistic copy is the
    // one the interface reads.
    await waitFor(() => {
      const local = readLocalDraft();
      expect(local?.answers.some((answer) => answer.questionId === 'opportunity_type')).toBe(true);
      expect(local?.answers.some((answer) => answer.questionId === 'goal')).toBe(true);
    });
    expect(
      await screen.findByRole('heading', { name: 'Where could you realistically study or work?' }),
    ).toBeInTheDocument();

    // A refresh while still offline resumes from the device copy, further
    // along the flow — not from the beginning.
    unmount();
    renderWithProviders(<OnboardingPage />);
    expect(
      await screen.findByRole('heading', { name: 'Where could you realistically study or work?' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('radio', { name: /Study in another country/ }),
    ).not.toBeInTheDocument();

    // The connection returns; the next save carries the whole draft up.
    clearChaosRule('/onboarding');
    await user.click(screen.getByRole('button', { name: 'Skip for now' }));

    await waitFor(() => {
      const server = getState().onboardingDraft;
      expect(
        server?.answers.some(
          (answer) => answer.questionId === 'opportunity_type' && answer.value === 'fellowship',
        ),
      ).toBe(true);
      expect(server?.answers.some((answer) => answer.questionId === 'goal')).toBe(true);
    });
  });

  it('keeps the draft text through a failed autosave, and the retry saves it when the connection returns', async () => {
    const { user } = renderWithProviders(
      <Routes>
        <Route path="/writing/:draftId" element={<WritingStudioPage />} />
      </Routes>,
      { route: '/writing/60000000-0000-4000-8000-000000000001' },
    );

    // The draft loads while the connection is still up.
    await screen.findByText(/Dear Selection Committee/);

    // The connection drops before the next autosave.
    setChaosRule({ pattern: '/drafts', mode: 'offline', delayMs: 0 });

    const proseMirror = document.querySelector('.ProseMirror') as HTMLElement;
    await waitFor(() => {
      expect(proseMirror).not.toBeNull();
    });
    await user.click(proseMirror);
    await user.keyboard('Offline.');

    // The autosave failed: the interface says so, and the text is on this device.
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Changes not saved');
    expect(alert).toHaveTextContent(/preserved on this device/);
    await waitFor(() => {
      const backup = window.localStorage.getItem(
        'oppulse:draft:60000000-0000-4000-8000-000000000001',
      );
      expect(backup).toContain('Offline.');
    });

    // The connection returns; the retry saves the text.
    clearChaosRule('/drafts');
    await user.click(screen.getByRole('button', { name: /Try saving again/ }));

    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
    await waitFor(() => {
      const stored = window.localStorage.getItem(
        'oppulse:draft:60000000-0000-4000-8000-000000000001',
      );
      expect(stored).toBeNull();
    });
    const draft = getState().drafts.find(
      (item) => item.id === '60000000-0000-4000-8000-000000000001',
    );
    expect(draft?.content).toContain('Offline.');
  });
});
