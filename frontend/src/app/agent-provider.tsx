import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AgentContext, type AgentContextValue } from '@/lib/agent-context';
import { apiClient } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import {
  assistantActionResponseSchema,
  assistantHistorySchema,
  assistantResponseSchema,
  runStartResponseSchema,
  type AssistantActionRequest,
  type AssistantBlock,
  type AssistantContext,
  type AssistantMessage,
} from '@/lib/schemas';

/**
 * The agent provider.
 *
 * It owns the working context and the conversation, persists both to the
 * device, and exposes the two operations the interface needs: asking a
 * question, and running an action the agent offered.
 */

const CONTEXT_KEY = 'oppulse:agent-context';
const CONVERSATION_KEY = 'oppulse:agent:conversation';

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage may be full or blocked. The in-memory state still works.
  }
}

const EMPTY_CONTEXT: AssistantContext = {};

/** A pasted bare link is an analysis request, not a question. */
const URL_ONLY = /^https?:\/\/\S+$/i;

/** A superseded or unmounted request must not leave an error banner behind. */
function isCancellation(error: unknown): boolean {
  return error instanceof ApiError
    ? error.code === 'CANCELLED'
    : error instanceof DOMException && error.name === 'AbortError';
}

export function AgentProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const [context, setContextState] = useState<AssistantContext>(() =>
    readJson<AssistantContext>(CONTEXT_KEY, EMPTY_CONTEXT),
  );
  const [messages, setMessages] = useState<AssistantMessage[]>(() =>
    readJson<AssistantMessage[]>(CONVERSATION_KEY, []),
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // One lane for every agent request: a newer send, a newer action, or an
  // unmount aborts whatever is still in flight, so obsolete work is dropped
  // instead of racing the request that replaced it.
  const requestRef = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      requestRef.current?.abort();
    },
    [],
  );

  // The server copy is the Phase B source of truth. Today the device copy
  // wins, so a refresh never loses the thread.
  useEffect(() => {
    if (messages.length > 0) return;

    const controller = new AbortController();
    void apiClient
      .get('/assistant/history', { schema: assistantHistorySchema, signal: controller.signal })
      .then((history) => {
        if (history.messages.length === 0) return;
        setMessages(history.messages);
      })
      .catch(() => {
        // The local copy is the fallback; a failure here is not worth showing.
      });

    return () => {
      controller.abort();
    };
    // Restoring once, on mount, is the intent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    writeJson(CONTEXT_KEY, context);
  }, [context]);

  useEffect(() => {
    writeJson(CONVERSATION_KEY, messages);
  }, [messages]);

  const setContext = useCallback((patch: Partial<AssistantContext>) => {
    setContextState((current) => ({ ...current, ...patch }));
  }, []);

  const clearContext = useCallback(() => {
    setContextState(EMPTY_CONTEXT);
  }, []);

  const send = useCallback(
    async (message: string, selectedText?: string) => {
      const trimmed = message.trim();
      if (!trimmed) return;

      requestRef.current?.abort();
      const controller = new AbortController();
      requestRef.current = controller;

      const userMessage: AssistantMessage = {
        id: `u_${Date.now()}`,
        role: 'user',
        content: trimmed,
        createdAt: new Date().toISOString(),
        context,
      };

      setMessages((current) => [...current, userMessage]);
      setPending(true);
      setError(null);

      const isLink = URL_ONLY.test(trimmed);

      try {
        // A pasted link asks for one thing: analyse this page. It starts a
        // durable run rather than a chat turn, so closing the tab does not
        // lose the work.
        if (isLink) {
          const run = await apiClient.post(
            '/opportunities/analyze',
            { url: trimmed },
            { schema: runStartResponseSchema, signal: controller.signal },
          );

          if (controller.signal.aborted) return;

          const reply: AssistantMessage = {
            id: `a_${Date.now()}`,
            role: 'assistant',
            content: 'The link is queued for analysis. I will bring the sources back here.',
            createdAt: newDateIso(),
            blocks: [
              {
                kind: 'run',
                runId: run.runId,
                status: run.status,
                message: 'The link is queued for analysis.',
              },
            ],
            context,
          };

          setMessages((current) => [...current, reply]);
          void queryClient.invalidateQueries({ queryKey: ['runs'] });
          void queryClient.invalidateQueries({ queryKey: ['missions'] });
          return;
        }

        const response = await apiClient.post(
          '/assistant/messages',
          { message: trimmed, context, selectedText },
          // Research opens pages and reads them with the model; the default
          // 15s is a data-fetch budget, not an assistant-turn budget.
          { schema: assistantResponseSchema, signal: controller.signal, timeoutMs: 90_000 },
        );

        if (controller.signal.aborted) return;

        const reply: AssistantMessage = {
          id: `a_${Date.now()}`,
          role: 'assistant',
          content: response.blocks
            .filter(
              (block): block is Extract<AssistantBlock, { kind: 'text' }> => block.kind === 'text',
            )
            .map((block) => block.text)
            .join('\n\n'),
          createdAt: new Date().toISOString(),
          blocks: response.blocks,
          context: response.context,
        };

        setMessages((current) => [...current, reply]);
      } catch (cause) {
        if (isCancellation(cause)) return;
        // The service's error envelope is written for the student and never
        // carries a provider body. A rate limit therefore says "try again in
        // a minute" instead of pretending the service is down.
        setError(
          isLink
            ? 'We could not queue that link for analysis. Nothing was lost — try again.'
            : cause instanceof ApiError
              ? cause.userMessage
              : 'We could not reach the assistant service. Nothing was lost — try again.',
        );
      } finally {
        if (requestRef.current === controller) {
          requestRef.current = null;
          setPending(false);
        }
      }
    },
    [context, queryClient],
  );

  const runAction = useCallback(
    async (request: AssistantActionRequest) => {
      requestRef.current?.abort();
      const controller = new AbortController();
      requestRef.current = controller;

      setPending(true);
      setError(null);

      try {
        const response = await apiClient.post('/assistant/actions', request, {
          schema: assistantActionResponseSchema,
          signal: controller.signal,
        });

        if (controller.signal.aborted) return null;

        const reply: AssistantMessage = {
          id: `a_${Date.now()}`,
          role: 'assistant',
          content: '',
          createdAt: newDateIso(),
          blocks: [response.block],
          context: request.context ?? context,
        };

        setMessages((current) => [...current, reply]);
        void queryClient.invalidateQueries({ queryKey: ['applications'] });
        void queryClient.invalidateQueries({ queryKey: ['opportunities'] });
        void queryClient.invalidateQueries({ queryKey: ['drafts'] });
        void queryClient.invalidateQueries({ queryKey: ['missions'] });

        return response;
      } catch (cause) {
        if (isCancellation(cause)) return null;
        setError('That action could not be completed. Nothing was changed.');
        return null;
      } finally {
        if (requestRef.current === controller) {
          requestRef.current = null;
          setPending(false);
        }
      }
    },
    [context, queryClient],
  );

  const reset = useCallback(() => {
    setMessages([]);
  }, []);

  const value = useMemo<AgentContextValue>(
    () => ({
      context,
      messages,
      pending,
      error,
      setContext,
      clearContext,
      send,
      runAction,
      reset,
    }),
    [context, messages, pending, error, setContext, clearContext, send, runAction, reset],
  );

  return <AgentContext.Provider value={value}>{children}</AgentContext.Provider>;
}

function newDateIso(): string {
  return new Date().toISOString();
}
