import { createContext, useContext } from 'react';
import type {
  AssistantActionRequest,
  AssistantActionResponse,
  AssistantContext,
  AssistantMessage,
} from './schemas';

/**
 * The agent's working context and conversation.
 *
 * One provider owns both, so the home panel and the assistant route show
 * the *same* thread with the *same* context. That is what makes the agent
 * feel like one thing the student is talking to, rather than a widget on
 * each page.
 *
 * The context and the conversation are mirrored to `localStorage` so a
 * refresh never loses them. The same endpoints exist on the server, so
 * Phase B only has to change which copy is the source of truth.
 */
export interface AgentContextValue {
  /** What the agent is currently working with. */
  context: AssistantContext;
  /** The conversation, shared across every surface. */
  messages: AssistantMessage[];
  /** True while a message is in flight. */
  pending: boolean;
  /** The last failure, if any. */
  error: string | null;

  /** Adds to, or removes from, the working context. */
  setContext: (patch: Partial<AssistantContext>) => void;
  clearContext: () => void;

  /** Sends a message and appends the assistant's answer. */
  send: (message: string, selectedText?: string) => Promise<void>;

  /** Runs an action the assistant offered. */
  runAction: (request: AssistantActionRequest) => Promise<AssistantActionResponse | null>;

  /** Clears the conversation. */
  reset: () => void;
}

export const AgentContext = createContext<AgentContextValue | null>(null);

/** The agent's working context and conversation. */
export function useAgent(): AgentContextValue {
  const value = useContext(AgentContext);
  if (!value) {
    throw new Error('useAgent must be used inside <AgentProvider>.');
  }
  return value;
}
