import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { AgentComposer } from './agent-composer';

/**
 * The message composer.
 *
 * While a request is pending the composer must not accept a second draft or
 * submit it — a disabled composer is the pending contract made visible.
 */
describe('AgentComposer', () => {
  it('refuses typing and sending while a request is pending', () => {
    const onSend = vi.fn();
    renderWithProviders(<AgentComposer onSend={onSend} pending />);

    const textarea = screen.getByLabelText('Message to Oppulse');
    expect(textarea).toBeDisabled();

    fireEvent.submit(textarea.closest('form') as HTMLFormElement);
    expect(onSend).not.toHaveBeenCalled();

    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Attach a document or paste a link' }),
    ).toBeDisabled();
  });

  it('still sends when nothing is pending', async () => {
    const onSend = vi.fn();
    const { user } = renderWithProviders(<AgentComposer onSend={onSend} />);

    const textarea = screen.getByLabelText('Message to Oppulse');
    expect(textarea).toBeEnabled();
    await user.type(textarea, 'Am I eligible?');
    await user.keyboard('{Enter}');

    expect(onSend).toHaveBeenCalledWith('Am I eligible?');
    expect(textarea).toHaveValue('');
  });

  it('opens the link flow from the attach button and sends the link', async () => {
    const onSend = vi.fn();
    const { user } = renderWithProviders(<AgentComposer onSend={onSend} />);

    const attach = screen.getByRole('button', { name: 'Attach a document or paste a link' });
    expect(attach).toHaveAttribute('aria-expanded', 'false');
    await user.click(attach);

    const link = screen.getByLabelText('Link to analyse');
    await user.type(link, 'https://helios-fellowship.org/call');
    await user.click(screen.getByRole('button', { name: 'Analyse this link' }));

    expect(onSend).toHaveBeenCalledWith('https://helios-fellowship.org/call');
    expect(link).not.toBeInTheDocument();
  });

  it('sends the link on Enter', async () => {
    const onSend = vi.fn();
    const { user } = renderWithProviders(<AgentComposer onSend={onSend} />);

    await user.click(screen.getByRole('button', { name: 'Attach a document or paste a link' }));
    const link = screen.getByLabelText('Link to analyse');

    await user.type(link, 'https://helios-fellowship.org/call{Enter}');
    expect(onSend).toHaveBeenCalledWith('https://helios-fellowship.org/call');
  });
});
