import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { ApplicationWorkflow } from './application-workflow';
import { summariseApplication } from '@/lib/application-workflow';
import type { Application, Draft } from '@/lib/schemas';

/**
 * The working-applicant view.
 *
 * The estimates are the part that has to be honest: they come from a stated
 * assumption, and an unverified deadline is never turned into a countdown.
 */

const OPPORTUNITY_ID = 'd4000000-0000-4000-8000-000000000001';
const APPLICATION_ID = '4e000000-0000-4000-8000-000000000001';
const DRAFT_ID = '60000000-0000-4000-8000-000000000001';

function buildApplication(overrides: Partial<Application> = {}): Application {
  return {
    id: APPLICATION_ID,
    opportunityId: OPPORTUNITY_ID,
    opportunityTitle: 'Helios Research Fellowship',
    institution: 'Helios Institute for Applied Genomics',
    status: 'preparing',
    deadline: null,
    deadlineVerified: false,
    checklist: [],
    tasks: [],
    draftIds: [],
    completion: { completed: 0, total: 0 },
    nextBestAction: null,
    officialUrl: null,
    notes: null,
    createdAt: '2026-10-01T09:00:00.000Z',
    updatedAt: '2026-10-01T09:00:00.000Z',
    ...overrides,
  };
}

function buildDraft(overrides: Partial<Draft> = {}): Draft {
  return {
    id: DRAFT_ID,
    applicationId: APPLICATION_ID,
    opportunityId: OPPORTUNITY_ID,
    type: 'motivation_letter',
    title: 'motivation letter — Helios Research Fellowship',
    currentVersion: 2,
    content: '{}',
    versions: [],
    pendingProposal: null,
    updatedAt: '2026-10-02T09:00:00.000Z',
    ...overrides,
  };
}

describe('summariseApplication', () => {
  it('counts only the outstanding requirements', () => {
    const application = buildApplication({
      checklist: [
        {
          id: '5f000000-0000-4000-8000-000000000001',
          label: 'CV',
          status: 'done',
          source: null,
          dueDate: null,
          documentId: 'b2000000-0000-4000-8000-000000000001',
          note: null,
        },
        {
          id: '5f000000-0000-4000-8000-000000000002',
          label: 'IELTS',
          status: 'missing',
          source: null,
          dueDate: null,
          documentId: null,
          note: null,
        },
      ],
    });

    const summary = summariseApplication(application);

    expect(summary.remaining).toBe(1);
    expect(summary.missingDocuments).toBe(1);
    expect(summary.estimatedMinutes).toBe(45);
  });

  it('never invents a countdown from an unverified deadline', () => {
    const summary = summariseApplication(
      buildApplication({ deadline: '2026-10-30T23:59:59.000Z', deadlineVerified: false }),
    );

    expect(summary.daysLeft).toBeNull();
    expect(summary.priority).toBe('unknown');
  });

  it('derives the urgency from a verified deadline', () => {
    const soon = new Date(Date.now() + 3 * 86_400_000).toISOString();
    const later = new Date(Date.now() + 60 * 86_400_000).toISOString();

    expect(
      summariseApplication(buildApplication({ deadline: soon, deadlineVerified: true })).priority,
    ).toBe('tight');
    expect(
      summariseApplication(buildApplication({ deadline: later, deadlineVerified: true })).priority,
    ).toBe('comfortable');
  });
});

describe('ApplicationWorkflow', () => {
  it('says so plainly when there is nothing outstanding', () => {
    renderWithProviders(<ApplicationWorkflow application={buildApplication()} drafts={[]} />);

    expect(screen.getByText('Nothing outstanding')).toBeInTheDocument();
    expect(screen.getByText('No deadline verified')).toBeInTheDocument();
  });

  it('offers a way to upload a missing document', () => {
    const application = buildApplication({
      checklist: [
        {
          id: '5f000000-0000-4000-8000-000000000001',
          label: 'IELTS',
          status: 'missing',
          source: null,
          dueDate: null,
          documentId: null,
          note: null,
        },
      ],
    });

    renderWithProviders(<ApplicationWorkflow application={application} drafts={[]} />);

    expect(screen.getByText('1 to upload')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Upload them' })).toHaveAttribute('href', '/documents');
  });

  it('points back at the most recently touched draft', () => {
    renderWithProviders(
      <ApplicationWorkflow application={buildApplication()} drafts={[buildDraft()]} />,
    );

    expect(screen.getByText(/Continue where you left off/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Open the draft/ })).toHaveAttribute(
      'href',
      `/writing/${DRAFT_ID}`,
    );
  });
});
