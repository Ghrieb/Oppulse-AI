import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { ActionChips } from './action-chips';
import { ApprovalBoundaryNote, AssistantBlocks } from './assistant-blocks';
import { actionChipsFor } from '@/lib/action-chips';
import type { AssistantBlock } from '@/lib/schemas';

/**
 * The agent's answer cards and the context-aware suggestions.
 *
 * Two things matter here: the agent must never pretend to send anything,
 * and its suggestions must follow the context the student is actually in.
 */

const OPPORTUNITY_ID = 'd4000000-0000-4000-8000-000000000001';
const APPLICATION_ID = '4e000000-0000-4000-8000-000000000001';

describe('actionChipsFor', () => {
  it('offers general suggestions when there is no context', () => {
    const chips = actionChipsFor({});

    expect(chips.map((chip) => chip.id)).toEqual(['find', 'analyse']);
  });

  it('offers eligibility and funding when an opportunity is in context', () => {
    const chips = actionChipsFor({ opportunityId: OPPORTUNITY_ID });

    expect(chips.map((chip) => chip.id)).toEqual(['eligibility', 'funding', 'letter', 'track']);
  });

  it('offers document work when an application is in context', () => {
    const chips = actionChipsFor({ applicationId: APPLICATION_ID });

    expect(chips.map((chip) => chip.id)).toEqual(['missing', 'checklist', 'recommender']);
  });

  it('prefers the most specific context when several are set', () => {
    const chips = actionChipsFor({
      opportunityId: OPPORTUNITY_ID,
      applicationId: APPLICATION_ID,
      draftId: '60000000-0000-4000-8000-000000000001',
    });

    expect(chips.map((chip) => chip.id)).toEqual(['shorter', 'claims', 'polish']);
  });

  it('binds the draft action to the application in context', () => {
    const chips = actionChipsFor({ applicationId: APPLICATION_ID });
    const recommender = chips.find((chip) => chip.id === 'recommender');

    expect(recommender?.action?.context?.applicationId).toBe(APPLICATION_ID);
    expect(recommender?.action?.payload?.draftType).toBe('recommender_request');
  });
});

describe('ActionChips', () => {
  it('renders the suggestions for the current context', () => {
    renderWithProviders(<ActionChips />);

    expect(screen.getByRole('button', { name: 'Find opportunities for me' })).toBeInTheDocument();
  });
});

describe('AssistantBlocks', () => {
  it('renders a text answer', () => {
    renderWithProviders(
      <AssistantBlocks blocks={[{ kind: 'text', text: 'Here is what I could verify.' }]} />,
    );

    expect(screen.getByText('Here is what I could verify.')).toBeInTheDocument();
  });

  it('shows the source of every piece of evidence', () => {
    const block: AssistantBlock = {
      kind: 'evidence',
      title: 'Funding covers the stipend',
      summary: 'The call states a full stipend.',
      sources: [
        {
          title: 'Official call',
          url: 'https://example.edu/call',
          quote: 'A full stipend is provided.',
          quality: 'official',
        },
      ],
      requirementId: null,
    };

    renderWithProviders(<AssistantBlocks blocks={[block]} />);

    expect(screen.getByRole('link', { name: /Official call/ })).toBeInTheDocument();
    expect(screen.getByText('“A full stipend is provided.”')).toBeInTheDocument();
    expect(screen.getByText('Official source')).toBeInTheDocument();
  });

  it('links an unresolved requirement to where it can be resolved', () => {
    const block: AssistantBlock = {
      kind: 'checklist',
      title: 'What this requires',
      items: [
        {
          label: 'IELTS 6.5',
          status: 'needs_attention',
          detail: null,
          route: '/profile?fact=ielts',
        },
      ],
    };

    renderWithProviders(<AssistantBlocks blocks={[block]} />);

    expect(screen.getByRole('link', { name: 'Resolve' })).toHaveAttribute(
      'href',
      '/profile?fact=ielts',
    );
  });

  it('marks a document that only prepares, never sends', () => {
    const block: AssistantBlock = {
      kind: 'draft_action',
      title: 'Start your motivation letter',
      description: 'Grounded in your confirmed facts.',
      draftType: 'motivation_letter',
      applicationId: APPLICATION_ID,
      effect: 'prepares',
    };

    renderWithProviders(<AssistantBlocks blocks={[block]} />);

    expect(screen.getByText('Prepares only')).toBeInTheDocument();
    expect(screen.queryByText(/Would send/)).not.toBeInTheDocument();
  });

  it('asks for confirmation before it creates a document', async () => {
    const { user } = renderWithProviders(
      <AssistantBlocks
        blocks={[
          {
            kind: 'draft_action',
            title: 'Start your motivation letter',
            description: 'Grounded in your confirmed facts.',
            draftType: 'motivation_letter',
            applicationId: APPLICATION_ID,
            effect: 'prepares',
          },
        ]}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Start this document' }));

    expect(screen.getByRole('button', { name: 'Create the draft' })).toBeInTheDocument();
  });

  it('warns before anything that would leave the device', () => {
    const block: AssistantBlock = {
      kind: 'action',
      label: 'Email the programme',
      description: 'Uses your own mail client.',
      action: 'open_route',
      payload: { route: '/applications' },
      effect: 'would_send',
    };

    renderWithProviders(<AssistantBlocks blocks={[block]} />);

    expect(screen.getByText('Would send — needs your confirmation')).toBeInTheDocument();
  });

  it('degrades gracefully when it meets a block it cannot display', () => {
    renderWithProviders(
      <AssistantBlocks blocks={[{ kind: 'text', text: 'ok' }, { kind: 'mystery' } as never]} />,
    );

    expect(screen.getByText(/format Oppulse does not display yet/)).toBeInTheDocument();
  });
});

describe('ApprovalBoundaryNote', () => {
  it('states that the agent never sends anything', () => {
    renderWithProviders(<ApprovalBoundaryNote />);

    expect(screen.getByText(/never sends anything on your behalf/)).toBeInTheDocument();
  });
});

describe('the institution answer', () => {
  const institution: AssistantBlock = {
    kind: 'institution',
    description: 'Helios Institute runs a computational biology research group.',
    location: 'Helios Institute for Applied Genomics',
    country: 'Netherlands',
    institutionType: 'Research institute',
    programmeContext: 'A fellowship for computational biologists.',
    evidence: [
      {
        title: 'Helios Research Fellowship — official call',
        url: 'https://helios-fellowship.org/call',
        quote: 'Applicants must be enrolled in a Master’s programme.',
        sourceType: 'official',
      },
    ],
    media: [
      {
        kind: 'image',
        url: 'https://helios-fellowship.org/media/campus',
        title: 'The campus',
        publisher: 'Helios Institute',
        publishedAt: null,
        sourceType: 'official',
        attribution: null,
        summary: null,
        status: 'available',
      },
    ],
    unverified: ['How competitive the programme is.'],
    action: 'Check your eligibility.',
  };

  it('renders the description, the location and the verified type', () => {
    renderWithProviders(<AssistantBlocks blocks={[institution]} />);

    expect(
      screen.getByText('Helios Institute runs a computational biology research group.'),
    ).toBeInTheDocument();
    expect(screen.getByText(/Research institute/)).toBeInTheDocument();
  });

  it('says what it could not verify, rather than hiding it', () => {
    renderWithProviders(<AssistantBlocks blocks={[institution]} />);

    expect(screen.getByText('What I could not verify')).toBeInTheDocument();
    expect(screen.getByText('How competitive the programme is.')).toBeInTheDocument();
  });

  it('keeps the sources behind a control, and shows them on request', async () => {
    const { user } = renderWithProviders(<AssistantBlocks blocks={[institution]} />);

    expect(screen.queryByText(/Helios Research Fellowship/)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Show the 1 source/ }));

    expect(screen.getByRole('link', { name: /Helios Research Fellowship/ })).toBeInTheDocument();
  });

  it('labels the media as a secondary source', () => {
    renderWithProviders(<AssistantBlocks blocks={[institution]} />);

    expect(screen.getByText(/Media context — secondary source/)).toBeInTheDocument();
  });

  it('is not mistaken for a format the interface cannot show', () => {
    renderWithProviders(<AssistantBlocks blocks={[institution]} />);

    expect(screen.queryByText(/format Oppulse does not display yet/)).not.toBeInTheDocument();
  });
});

describe('the media context', () => {
  it('says what the media is about and marks it secondary', () => {
    renderWithProviders(
      <AssistantBlocks
        blocks={[
          {
            kind: 'media_context',
            subject: 'What the official page shows',
            media: [
              {
                kind: 'video',
                url: 'https://www.youtube.com/watch?v=demo',
                title: 'An introduction',
                publisher: 'Helios Institute',
                publishedAt: '2026-10-01',
                sourceType: 'official',
                attribution: null,
                summary: 'A short introduction.',
                status: 'not_reviewed',
              },
            ],
          },
        ]}
      />,
    );

    expect(screen.getByText('What the official page shows')).toBeInTheDocument();
    expect(screen.getByText(/Media context — secondary source/)).toBeInTheDocument();
    expect(screen.getByText('Not reviewed')).toBeInTheDocument();
  });

  it('says plainly when the media is unavailable, and does not link to it', () => {
    renderWithProviders(
      <AssistantBlocks
        blocks={[
          {
            kind: 'media_context',
            subject: 'A missing picture',
            media: [
              {
                kind: 'image',
                url: 'https://example.edu/media/x.png',
                title: 'A picture',
                publisher: 'Example',
                publishedAt: null,
                sourceType: 'secondary',
                attribution: null,
                summary: null,
                status: 'unavailable',
              },
            ],
          },
        ]}
      />,
    );

    expect(screen.getByText('Unavailable')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'A picture' })).not.toBeInTheDocument();
    expect(
      screen.getByText(/could not be opened, so what it shows is not claimed here/),
    ).toBeInTheDocument();
  });

  it('says plainly when the media was removed, and does not link to it', () => {
    renderWithProviders(
      <AssistantBlocks
        blocks={[
          {
            kind: 'media_context',
            subject: 'A removed video',
            media: [
              {
                kind: 'video',
                url: 'https://www.youtube.com/watch?v=removed',
                title: 'An introduction',
                publisher: 'Helios Institute',
                publishedAt: null,
                sourceType: 'official',
                attribution: null,
                summary: null,
                status: 'removed',
              },
            ],
          },
        ]}
      />,
    );

    expect(screen.getByText('Removed')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'An introduction' })).not.toBeInTheDocument();
    expect(screen.getByText(/no longer carries this asset/)).toBeInTheDocument();
  });

  it('still links the media that is available', () => {
    renderWithProviders(
      <AssistantBlocks
        blocks={[
          {
            kind: 'media_context',
            subject: 'What the page shows',
            media: [
              {
                kind: 'image',
                url: 'https://helios-fellowship.org/media/campus',
                title: 'The campus',
                publisher: 'Helios Institute',
                publishedAt: null,
                sourceType: 'official',
                attribution: null,
                summary: null,
                status: 'available',
              },
            ],
          },
        ]}
      />,
    );

    expect(screen.getByRole('link', { name: /The campus/ })).toBeInTheDocument();
  });
});

describe('the opportunity reference', () => {
  it('points at the opportunity instead of repeating it', () => {
    renderWithProviders(
      <AssistantBlocks
        blocks={[
          {
            kind: 'opportunity_reference',
            opportunityId: 'd4000000-0000-4000-8000-000000000001',
            title: 'Helios Research Fellowship',
            institution: 'Helios Institute',
            country: 'Netherlands',
            reason: 'This is the call the answer is based on.',
          },
        ]}
      />,
    );

    expect(screen.getByText('Helios Research Fellowship')).toBeInTheDocument();
    // Desktop opens the right-side panel without leaving the chat.
    expect(screen.getByRole('link', { name: /Open in the panel/ })).toHaveAttribute(
      'href',
      '/home?opportunity=d4000000-0000-4000-8000-000000000001',
    );
    // Mobile, where there is no panel, opens the full opportunity page.
    expect(screen.getByRole('link', { name: /Open the opportunity/ })).toHaveAttribute(
      'href',
      '/opportunities/d4000000-0000-4000-8000-000000000001',
    );
  });
});

describe('what could not be verified', () => {
  it('shows what was checked and what to do next', () => {
    renderWithProviders(
      <AssistantBlocks
        blocks={[
          {
            kind: 'unknown_or_conflict',
            question: 'Two sources give different closing dates.',
            checked: ['The official programme page', 'The directory listing'],
            nextAction: 'Open the call and check the date.',
            conflict: true,
          },
        ]}
      />,
    );

    expect(screen.getByText('Two sources disagree')).toBeInTheDocument();
    expect(screen.getByText('Two sources give different closing dates.')).toBeInTheDocument();
    expect(screen.getByText('What I checked')).toBeInTheDocument();
    expect(screen.getByText('Next: Open the call and check the date.')).toBeInTheDocument();
  });

  it('distinguishes a gap from a disagreement', () => {
    renderWithProviders(
      <AssistantBlocks
        blocks={[
          {
            kind: 'unknown_or_conflict',
            question: 'Oppulse has not yet reached the official page.',
            checked: [],
            nextAction: null,
            conflict: false,
          },
        ]}
      />,
    );

    expect(screen.getByText('I could not verify this')).toBeInTheDocument();
    expect(screen.queryByText('What I checked')).not.toBeInTheDocument();
  });
});
