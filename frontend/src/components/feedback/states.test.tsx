import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { ApiError, type ApiErrorCode } from '@/lib/api/errors';
import { describeViolations, findAccessibilityViolations } from '@/test/a11y';
import { ErrorState, PartialState, RefreshingIndicator, SourceUnavailableState } from './states';

function apiError(code: ApiErrorCode, retryable = false): ApiError {
  return new ApiError({
    code,
    message: 'Raw server text that must never be shown: CV of Sara Benali.',
    status: undefined,
    requestId: 'req_test_1',
    retryable,
    fieldErrors: undefined,
    details: { dob: '1999-01-01' },
    cause: undefined,
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('the distinct error states', () => {
  it('renders the offline state, and waits for the connection before retrying', async () => {
    const onRetry = vi.fn();
    renderWithProviders(<ErrorState error={apiError('NETWORK', true)} onRetry={onRetry} />);

    expect(await screen.findByText("You're offline")).toBeInTheDocument();
    expect(screen.getByText('Your last local changes are preserved.')).toBeInTheDocument();

    const retry = screen.getByRole('button', { name: /try again/i });
    expect(retry).toBeEnabled();
  });

  it('holds the offline retry back while the browser is still offline', async () => {
    vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(false);

    renderWithProviders(<ErrorState error={apiError('NETWORK', true)} onRetry={vi.fn()} />);

    expect(await screen.findByRole('button', { name: /try again/i })).toBeDisabled();
    expect(screen.getByText(/once you reconnect/i)).toBeInTheDocument();
  });

  it('renders the rate-limited state with the matrix wording', async () => {
    renderWithProviders(<ErrorState error={apiError('RATE_LIMITED', true)} onRetry={vi.fn()} />);

    expect(
      await screen.findByText('The service needs a moment before trying again.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('renders the provider-unavailable state and keeps the saved-work promise', async () => {
    renderWithProviders(
      <ErrorState error={apiError('PROVIDER_UNAVAILABLE', true)} onRetry={vi.fn()} />,
    );

    expect(
      await screen.findByText('The AI provider is temporarily unavailable'),
    ).toBeInTheDocument();
    expect(screen.getByText(/Your mission is saved/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry analysis/i })).toBeInTheDocument();
  });

  it('renders the session-expired state with a return to where the student was', async () => {
    renderWithProviders(<ErrorState error={apiError('UNAUTHORIZED')} />, { route: '/goals' });

    expect(await screen.findByText('Your session has expired')).toBeInTheDocument();
    const signIn = screen.getByRole('link', { name: /sign in again/i });
    expect(signIn).toHaveAttribute('href', expect.stringContaining('/auth/sign-in?next='));
  });

  it('renders the contract-mismatch state with the reference and no partial data', async () => {
    renderWithProviders(<ErrorState error={apiError('CONTRACT_MISMATCH')} />);

    expect(await screen.findByText('Oppulse received an unexpected response')).toBeInTheDocument();
    expect(screen.getByText(/Nothing partial was rendered/i)).toBeInTheDocument();
    expect(screen.getByText(/req_test_1/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /try again/i })).toBeNull();
  });

  it('falls back to the generic card, with the caller message, for a code with no state', async () => {
    renderWithProviders(
      <ErrorState error={apiError('UNKNOWN')} message="This section could not load." />,
    );

    expect(await screen.findByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('This section could not load.')).toBeInTheDocument();
  });

  it('never shows the raw server message or the smuggled details', async () => {
    renderWithProviders(
      <>
        <ErrorState error={apiError('RATE_LIMITED', true)} onRetry={vi.fn()} />
        <ErrorState error={apiError('CONTRACT_MISMATCH')} />
      </>,
    );

    await screen.findByText('The service needs a moment before trying again.');
    expect(screen.queryByText(/Sara Benali/)).toBeNull();
    expect(screen.queryByText(/1999-01-01/)).toBeNull();
  });
});

describe('copying the technical details', () => {
  it('copies only the whitelisted identifiers', async () => {
    const { user } = renderWithProviders(<ErrorState error={apiError('RATE_LIMITED', true)} />);
    // Defined after render: userEvent.setup() installs its own clipboard stub.
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

    await user.click(await screen.findByRole('button', { name: /copy technical details/i }));

    expect(writeText).toHaveBeenCalledOnce();
    const copied = writeText.mock.calls[0]?.[0] as string;
    expect(copied).toContain('request id: req_test_1');
    expect(copied).toContain('code: RATE_LIMITED');
    expect(copied).toContain('route: /');
    expect(copied).not.toContain('Sara Benali');
    expect(copied).not.toContain('dob');
    expect(await screen.findByRole('button', { name: /copied/i })).toBeInTheDocument();
  });

  it('says so plainly when the clipboard is not available', async () => {
    const { user } = renderWithProviders(<ErrorState error={apiError('RATE_LIMITED', true)} />);
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });

    await user.click(await screen.findByRole('button', { name: /copy technical details/i }));

    expect(await screen.findByText(/could not copy automatically/i)).toBeInTheDocument();
  });
});

describe('partial and source states', () => {
  it('states that some sections could not be read, without calling it a failure', () => {
    renderWithProviders(<PartialState description="The scanned signature page." />);

    expect(screen.getByText('Some sections could not be read')).toBeInTheDocument();
    expect(screen.getByText('The scanned signature page.')).toBeInTheDocument();
  });

  it('keeps an unreachable source visible and says what that does not mean', () => {
    renderWithProviders(
      <SourceUnavailableState sourceUrl="https://example.edu/call" sourceTitle="The call" />,
    );

    expect(screen.getByText('We could not open this source')).toBeInTheDocument();
    expect(screen.getByText(/This does not mean no opportunity exists/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /open source/i })).toHaveAttribute(
      'href',
      'https://example.edu/call',
    );
  });

  it('announces the refresh politely while the panel keeps its data', () => {
    renderWithProviders(<RefreshingIndicator />);

    expect(screen.getByRole('status')).toHaveTextContent('Refreshing…');
  });
});

describe('accessibility of the states', () => {
  it('has no serious violations', async () => {
    const { container } = renderWithProviders(
      <div className="flex flex-col gap-4">
        <ErrorState error={apiError('NETWORK', true)} onRetry={vi.fn()} />
        <ErrorState error={apiError('RATE_LIMITED', true)} onRetry={vi.fn()} />
        <ErrorState error={apiError('PROVIDER_UNAVAILABLE', true)} onRetry={vi.fn()} />
        <ErrorState error={apiError('UNAUTHORIZED')} />
        <ErrorState error={apiError('CONTRACT_MISMATCH')} />
        <PartialState description="One page." />
        <SourceUnavailableState sourceUrl="https://example.edu/call" />
        <RefreshingIndicator />
      </div>,
    );

    await screen.findByText("You're offline");

    const violations = await findAccessibilityViolations(container);
    expect(describeViolations(violations)).toBe('');
  });
});
