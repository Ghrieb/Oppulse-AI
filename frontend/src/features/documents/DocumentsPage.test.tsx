import { describe, expect, it, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders, signInAsDemo } from '@/test/utils';
import { DocumentsPage } from './DocumentsPage';
import { getState, resetState } from '@/mocks/state';
import { setChaosRule } from '@/mocks/chaos';

/**
 * The document library.
 *
 * Each extraction state must explain itself, and the consent control must
 * actually change what the agent is allowed to send.
 */
describe('DocumentsPage', () => {
  beforeEach(() => {
    resetState();
    signInAsDemo();
  });

  it('lists every document with its state', async () => {
    renderWithProviders(<DocumentsPage />);

    expect(await screen.findByText('Benali_CV.pdf')).toBeInTheDocument();
    expect(screen.getByText('transcript_2026.pdf')).toBeInTheDocument();
    expect(screen.getByText('IELTS_2025.pdf')).toBeInTheDocument();
    expect(screen.getByText('conference_poster_2026.png')).toBeInTheDocument();

    expect(screen.getByText('Ready to use')).toBeInTheDocument();
    expect(screen.getByText('Partly read')).toBeInTheDocument();
    expect(screen.getByText('Needs your review')).toBeInTheDocument();
    expect(screen.getByText('Could not read')).toBeInTheDocument();
  });

  it('names the section it could not read in a partially read document', async () => {
    renderWithProviders(<DocumentsPage />);

    expect(
      await screen.findByText(/We could only read part of this document/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/The scanned signature page could not be read/i)).toBeInTheDocument();
  });

  it('explains a document it could not read and offers an alternative', async () => {
    renderWithProviders(<DocumentsPage />);

    expect(await screen.findByText(/We could not read this file/i)).toBeInTheDocument();
    expect(screen.getByText(/upload the PDF version/i)).toBeInTheDocument();
  });

  it('says how many facts are waiting for confirmation', async () => {
    renderWithProviders(<DocumentsPage />);

    expect(await screen.findByText(/facts waiting for your confirmation/i)).toBeInTheDocument();
  });

  it('excludes a document from AI context when the switch is turned off', async () => {
    const { user } = renderWithProviders(<DocumentsPage />);

    const toggle = await screen.findByLabelText(
      /Allow Oppulse to use Benali_CV.pdf for opportunity matching/i,
    );
    await user.click(toggle);

    await waitFor(() => {
      const document = getState().documents.find((item) => item.filename === 'Benali_CV.pdf');
      expect(document?.consentToUse).toBe(false);
    });
  });

  it('keeps a document on screen until the server confirms the delete', async () => {
    const { user } = renderWithProviders(<DocumentsPage />);

    expect(await screen.findByText('Benali_CV.pdf')).toBeInTheDocument();

    // Only the delete itself is slow, so the page loads at normal speed first.
    setChaosRule({ pattern: '/documents', mode: 'slow', delayMs: 1500 });
    await user.click(screen.getByRole('button', { name: 'Delete Benali_CV.pdf' }));

    // The row is still here while the request is on the wire: nothing is
    // removed before the server says it is gone.
    expect(await screen.findByText('Deleting…')).toBeInTheDocument();
    expect(screen.getByText('Benali_CV.pdf')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete Benali_CV.pdf' })).toBeDisabled();

    await waitFor(
      () => {
        expect(screen.queryByText('Benali_CV.pdf')).not.toBeInTheDocument();
      },
      { timeout: 5000 },
    );
  });
});
