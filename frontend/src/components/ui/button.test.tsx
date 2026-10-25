import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { Button } from './button';

/**
 * The pending contract of the button.
 *
 * "Loading" must always mean "not clickable", and `loadingLabel` is how the
 * button says what is happening instead of a vague spinner.
 */
describe('Button', () => {
  it('disables itself while loading, even when the caller passes disabled={false}', () => {
    renderWithProviders(
      <Button loading disabled={false}>
        Run research
      </Button>,
    );

    expect(screen.getByRole('button', { name: 'Run research' })).toBeDisabled();
  });

  it('stays disabled when an explicit disabled meets a loading spinner', () => {
    renderWithProviders(
      <Button loading disabled>
        Save
      </Button>,
    );

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('replaces the children with the loading label while pending', () => {
    const { rerender } = renderWithProviders(
      <Button loading loadingLabel="Starting run…">
        Run research
      </Button>,
    );

    expect(screen.getByRole('button', { name: 'Starting run…' })).toBeDisabled();
    expect(screen.queryByText('Run research')).not.toBeInTheDocument();

    rerender(
      <Button loading={false} loadingLabel="Starting run…">
        Run research
      </Button>,
    );

    expect(screen.getByRole('button', { name: 'Run research' })).toBeEnabled();
    expect(screen.queryByText('Starting run…')).not.toBeInTheDocument();
  });

  it('is enabled and clickable when nothing is pending', () => {
    renderWithProviders(<Button>Save</Button>);

    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  });
});
