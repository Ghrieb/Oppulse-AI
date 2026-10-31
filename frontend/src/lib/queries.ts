import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, newIdempotencyKey } from './api/client';
import { ApiError } from './api/errors';
import {
  alertListSchema,
  applicationListSchema,
  applicationSchema,
  compareResponseSchema,
  documentListSchema,
  documentSchema,
  draftListSchema,
  draftSchema,
  emailVerificationLinkSchema,
  emailVerificationResultSchema,
  missionListSchema,
  missionSchema,
  monitorEventListSchema,
  monitorTargetListSchema,
  nextActionResponseSchema,
  onboardingCompleteSchema,
  onboardingDraftResponseSchema,
  opportunityDetailSchema,
  opportunityListSchema,
  profileImpactSchema,
  profileRevisionsSchema,
  profileSchema,
  protectedProfileResponseSchema,
  runEventListSchema,
  runStartResponseSchema,
  agentRunSchema,
  sessionSchema,
  updateFactResponseSchema,
  type CreateMonitorTargetRequest,
  type DraftType,
  type OnboardingDraft,
  type UpdateDraftRequest,
  type UpdateDocumentRequest,
  type UpdateFactRequest,
  type UpdateMissionRequest,
  type UpdateMonitorTargetRequest,
  type UpdateProtectedProfileRequest,
} from './schemas';
import { clearLocalDraft, readLocalDraft, writeLocalDraft } from './onboarding/storage';

/**
 * Server-state hooks.
 *
 * TanStack Query owns every piece of server state. Local UI state (open
 * drawers, selected tabs, pending editor text) stays in the component.
 * Optimistic mutations always roll back on failure (spec �11).
 */

export const queryKeys = {
  session: ['session'] as const,
  profile: ['profile'] as const,
  documents: ['documents'] as const,
  document: (id: string) => ['documents', id] as const,
  onboardingDraft: ['onboarding', 'draft'] as const,
  missions: ['missions'] as const,
  mission: (id: string) => ['missions', id] as const,
  run: (id: string) => ['runs', id] as const,
  runEvents: (id: string) => ['runs', id, 'events'] as const,
  opportunities: (filters: Record<string, string | undefined>) =>
    ['opportunities', filters] as const,
  opportunity: (id: string) => ['opportunities', id] as const,
  applications: ['applications'] as const,
  application: (id: string) => ['applications', id] as const,
  draft: (id: string) => ['drafts', id] as const,
  monitorTargets: ['monitor-targets'] as const,
  monitorTarget: (id: string) => ['monitor-targets', id] as const,
  monitorEvents: ['monitor-events'] as const,
  alerts: ['alerts'] as const,
  nextAction: ['next-action'] as const,
  profileRevisions: ['profile', 'revisions'] as const,
  profileImpact: ['profile', 'impact'] as const,
  protectedProfile: ['profile', 'protected'] as const,
};

/* ------------------------------------------------------------------ */
/* Session and profile                                                 */
/* ------------------------------------------------------------------ */

/**
 * The current session.
 *
 * A transient failure must not sign the user out, so only a definitive
 * answer (401/403) ends the attempt. A network blip, a timeout or a rate
 * limit is retried � otherwise one unlucky request would empty the whole
 * workspace with no way back except a refresh.
 */
export function useSession() {
  return useQuery({
    queryKey: queryKeys.session,
    queryFn: ({ signal }) => apiClient.get('/auth/session', { schema: sessionSchema, signal }),
    retry: (failureCount, error) => {
      if (error instanceof ApiError) {
        if (error.code === 'UNAUTHORIZED' || error.code === 'FORBIDDEN') return false;
        return error.retryable && failureCount < 2;
      }
      return failureCount < 2;
    },
    staleTime: 5 * 60_000,
  });
}

export function useProfile() {
  return useQuery({
    queryKey: queryKeys.profile,
    queryFn: ({ signal }) => apiClient.get('/profile', { schema: profileSchema, signal }),
  });
}

/* ------------------------------------------------------------------ */
/* Next best action                                                    */
/* ------------------------------------------------------------------ */

/**
 * The single most useful next action.
 *
 * It is invalidated whenever the facts, opportunities or applications it
 * depends on change, because a confirmed fact can resolve � or create � a
 * blocker.
 */
export function useNextAction() {
  return useQuery({
    queryKey: queryKeys.nextAction,
    queryFn: ({ signal }) =>
      apiClient.get('/next-action', { schema: nextActionResponseSchema, signal }),
    staleTime: 30_000,
  });
}

/* ------------------------------------------------------------------ */
/* Onboarding                                                          */
/* ------------------------------------------------------------------ */

/**
 * The onboarding draft.
 *
 * The local copy is read first so the flow never flashes an empty state
 * after a refresh. The server copy is the system of record once the backend
 * exists; today MSW answers it.
 */
export function useOnboardingDraft() {
  return useQuery({
    queryKey: queryKeys.onboardingDraft,
    queryFn: ({ signal }) =>
      apiClient.get('/onboarding/draft', { schema: onboardingDraftResponseSchema, signal }),
    initialData: () => {
      const local = readLocalDraft();
      return local ? { draft: local } : undefined;
    },
    staleTime: 60_000,
  });
}

/**
 * Saves the draft.
 *
 * The local copy is written on every change so a refresh, a crash or a lost
 * connection never loses the student's answers. The server write is
 * best-effort for now; the interface reports when it is out of sync.
 */
export function useSaveOnboardingDraft() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (draft: OnboardingDraft) =>
      apiClient.put('/onboarding/draft', draft, { schema: onboardingDraftResponseSchema }),
    onMutate: async (draft) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.onboardingDraft });
      writeLocalDraft(draft);
      const previous = queryClient.getQueryData(queryKeys.onboardingDraft);
      queryClient.setQueryData(queryKeys.onboardingDraft, { draft });
      return { previous };
    },
    onError: () => {
      // The local copy survives, so the answers are not lost. The interface
      // shows that the draft is stored on this device only.
    },
  });
}

/** Turns the draft into a mission and starts a bounded research run. */
export function useCompleteOnboarding() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({ draft, idempotencyKey }: { draft: OnboardingDraft; idempotencyKey: string }) =>
      apiClient.post(
        '/onboarding/complete',
        { draft },
        { schema: onboardingCompleteSchema, idempotencyKey },
      ),
    onSuccess: () => {
      clearLocalDraft();
      void queryClient.invalidateQueries({ queryKey: queryKeys.missions });
    },
  });

  return {
    ...mutation,
    mutate: (draft: OnboardingDraft, options?: Parameters<typeof mutation.mutate>[1]) =>
      mutation.mutate({ draft, idempotencyKey: newIdempotencyKey() }, options),
    mutateAsync: (draft: OnboardingDraft, options?: Parameters<typeof mutation.mutateAsync>[1]) =>
      mutation.mutateAsync({ draft, idempotencyKey: newIdempotencyKey() }, options),
  };
}

/* ------------------------------------------------------------------ */
/* Documents                                                           */
/* ------------------------------------------------------------------ */

export function useDocuments() {
  return useQuery({
    queryKey: queryKeys.documents,
    queryFn: ({ signal }) => apiClient.get('/documents', { schema: documentListSchema, signal }),
  });
}

export function useDocument(id: string) {
  return useQuery({
    queryKey: queryKeys.document(id),
    queryFn: ({ signal }) => apiClient.get(`/documents/${id}`, { schema: documentSchema, signal }),
    enabled: Boolean(id),
  });
}

/**
 * Changes one fact: confirm it, correct its value, or exclude it from the
 * AI's context.
 *
 * Confirming a fact changes what the agent can conclude, so every
 * opportunity and assessment is invalidated � that is the whole point of
 * confirming it.
 */
export function useUpdateFact() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({
      id,
      idempotencyKey,
      ...body
    }: {
      id: string;
      idempotencyKey: string;
    } & UpdateFactRequest) =>
      apiClient.patch(`/profile/facts/${id}`, body, {
        schema: updateFactResponseSchema,
        idempotencyKey,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.profile });
      void queryClient.invalidateQueries({ queryKey: queryKeys.documents });
      void queryClient.invalidateQueries({ queryKey: queryKeys.profileRevisions });
      void queryClient.invalidateQueries({ queryKey: queryKeys.profileImpact });
      // The assessments depend on the confirmed facts.
      void queryClient.invalidateQueries({ queryKey: ['opportunities'] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.nextAction });
    },
  });

  const variables = (payload: { id: string } & UpdateFactRequest) => ({
    ...payload,
    idempotencyKey: newIdempotencyKey(),
  });

  return {
    ...mutation,
    mutate: (
      payload: { id: string } & UpdateFactRequest,
      options?: Parameters<typeof mutation.mutate>[1],
    ) => mutation.mutate(variables(payload), options),
    mutateAsync: (
      payload: { id: string } & UpdateFactRequest,
      options?: Parameters<typeof mutation.mutateAsync>[1],
    ) => mutation.mutateAsync(variables(payload), options),
  };
}

/** The drafts belonging to an application. */
export function useDrafts(applicationId: string | null) {
  return useQuery({
    queryKey: ['drafts', 'by-application', applicationId],
    queryFn: ({ signal }) =>
      apiClient.get(`/applications/${applicationId ?? ''}/drafts`, {
        schema: draftListSchema,
        signal,
      }),
    enabled: Boolean(applicationId),
  });
}

/** Starts a new document on an application. */
export function useCreateDraft() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, type }: { id: string; type: DraftType }) =>
      apiClient.post(`/applications/${id}/drafts`, { type }, { schema: draftSchema }),
    onSuccess: (draft) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.applications });
      void queryClient.invalidateQueries({ queryKey: queryKeys.draft(draft.id) });
    },
  });
}

/**
 * Asks the backend to send a verification link to the current address.
 *
 * Only the backend can decide that an address is verified. The client can
 * ask for a link; it can never set the state.
 */
export function useRequestEmailVerification() {
  return useMutation({
    mutationFn: () =>
      apiClient.post('/auth/email/verification', undefined, {
        schema: emailVerificationLinkSchema,
      }),
  });
}

/** Confirms the address with the token the backend issued. */
export function useConfirmEmailVerification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (token: string) =>
      apiClient.post(
        '/auth/email/verification/confirm',
        { token },
        { schema: emailVerificationResultSchema },
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.session });
    },
  });
}

/**
 * The protected part of the profile.
 *
 * It is a separate endpoint on purpose: a routine profile read never
 * returns the date of birth, so it cannot leak into a list view, a log or
 * a prompt.
 */
export function useProtectedProfile() {
  return useQuery({
    queryKey: queryKeys.protectedProfile,
    queryFn: ({ signal }) =>
      apiClient.get('/profile/protected', { schema: protectedProfileResponseSchema, signal }),
  });
}

/** Changes the protected part of the profile. */
export function useUpdateProtectedProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: UpdateProtectedProfileRequest) =>
      apiClient.patch('/profile/protected', body, { schema: protectedProfileResponseSchema }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.protectedProfile });
      // The conclusions change with the date, so everything that depends on
      // them is refreshed.
      void queryClient.invalidateQueries({ queryKey: queryKeys.profile });
      void queryClient.invalidateQueries({ queryKey: ['opportunities'] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.nextAction });
    },
  });
}

/** The review history: every change the student made to a fact. */
export function useProfileRevisions() {
  return useQuery({
    queryKey: queryKeys.profileRevisions,
    queryFn: ({ signal }) =>
      apiClient.get('/profile/revisions', { schema: profileRevisionsSchema, signal }),
  });
}

/** What each fact is holding up. */
export function useProfileImpact() {
  return useQuery({
    queryKey: queryKeys.profileImpact,
    queryFn: ({ signal }) =>
      apiClient.get('/profile/impact', { schema: profileImpactSchema, signal }),
  });
}

/** The consent controls for one document. */
export function useUpdateDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & UpdateDocumentRequest) =>
      apiClient.patch(`/documents/${id}`, body, { schema: documentSchema }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.documents });
      void queryClient.invalidateQueries({ queryKey: queryKeys.profile });
    },
  });
}

/** Uploads a document. The file is sent as the raw request body. */
export function useUploadDocument() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({ file, idempotencyKey }: { file: File; idempotencyKey: string }) =>
      apiClient.upload('/documents', file, { schema: documentSchema, idempotencyKey }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.documents });
    },
  });

  return {
    ...mutation,
    mutate: (file: File, options?: Parameters<typeof mutation.mutate>[1]) =>
      mutation.mutate({ file, idempotencyKey: newIdempotencyKey() }, options),
    mutateAsync: (file: File, options?: Parameters<typeof mutation.mutateAsync>[1]) =>
      mutation.mutateAsync({ file, idempotencyKey: newIdempotencyKey() }, options),
  };
}

/** Deletes a document and withdraws the facts extracted from it. */
export function useDeleteDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/documents/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.documents });
      void queryClient.invalidateQueries({ queryKey: queryKeys.profile });
      void queryClient.invalidateQueries({ queryKey: ['opportunities'] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.nextAction });
    },
  });
}

/* ------------------------------------------------------------------ */
/* Missions and runs                                                   */
/* ------------------------------------------------------------------ */

export function useMissions() {
  return useQuery({
    queryKey: queryKeys.missions,
    queryFn: ({ signal }) => apiClient.get('/missions', { schema: missionListSchema, signal }),
  });
}

export function useMission(id: string) {
  return useQuery({
    queryKey: queryKeys.mission(id),
    queryFn: ({ signal }) => apiClient.get(`/missions/${id}`, { schema: missionSchema, signal }),
    enabled: Boolean(id),
  });
}

export function useUpdateMission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & UpdateMissionRequest) =>
      apiClient.patch(`/missions/${id}`, body, { schema: missionSchema }),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.mission(variables.id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.missions });
    },
  });
}

const TERMINAL_RUN_STATES = new Set(['completed', 'partial', 'failed', 'cancelled']);

/**
 * A run's state is polled while it is in flight and the poll stops as soon
 * as the run reaches a terminal state (spec �11).
 */
export function useRun(runId: string | null) {
  return useQuery({
    queryKey: queryKeys.run(runId ?? 'none'),
    queryFn: ({ signal }) =>
      apiClient.get(`/runs/${runId ?? ''}`, { schema: agentRunSchema, signal }),
    enabled: Boolean(runId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status && TERMINAL_RUN_STATES.has(status) ? false : 1_000;
    },
  });
}

export function useRunEvents(runId: string | null) {
  return useQuery({
    queryKey: queryKeys.runEvents(runId ?? 'none'),
    queryFn: ({ signal }) =>
      apiClient.get(`/runs/${runId ?? ''}/events`, { schema: runEventListSchema, signal }),
    enabled: Boolean(runId),
    refetchInterval: (query) => {
      const events = query.state.data?.events;
      const last = events?.[events.length - 1];
      if (!last) return 1_000;
      return TERMINAL_RUN_STATES.has(last.type.replace('run.', '')) ? false : 1_000;
    },
  });
}

export function useStartRun() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({ missionId, idempotencyKey }: { missionId: string; idempotencyKey: string }) =>
      apiClient.post(`/missions/${missionId}/runs`, undefined, {
        schema: runStartResponseSchema,
        idempotencyKey,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.missions });
    },
  });

  return {
    ...mutation,
    mutate: (missionId: string, options?: Parameters<typeof mutation.mutate>[1]) =>
      mutation.mutate({ missionId, idempotencyKey: newIdempotencyKey() }, options),
    mutateAsync: (missionId: string, options?: Parameters<typeof mutation.mutateAsync>[1]) =>
      mutation.mutateAsync({ missionId, idempotencyKey: newIdempotencyKey() }, options),
  };
}

/** The shared invalidation for a run-control mutation: the run, its timeline and the mission list. */
function invalidateRun(queryClient: ReturnType<typeof useQueryClient>, runId: string): void {
  void queryClient.invalidateQueries({ queryKey: queryKeys.run(runId) });
  void queryClient.invalidateQueries({ queryKey: queryKeys.runEvents(runId) });
  void queryClient.invalidateQueries({ queryKey: queryKeys.missions });
}

export function usePauseRun() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (runId: string) =>
      apiClient.post(`/runs/${runId}/pause`, undefined, { schema: agentRunSchema }),
    onSuccess: (run) => invalidateRun(queryClient, run.id),
  });
}

export function useResumeRun() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (runId: string) =>
      apiClient.post(`/runs/${runId}/resume`, undefined, { schema: agentRunSchema }),
    onSuccess: (run) => invalidateRun(queryClient, run.id),
  });
}

export function useCancelRun() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (runId: string) =>
      apiClient.post(`/runs/${runId}/cancel`, undefined, { schema: agentRunSchema }),
    onSuccess: (run) => invalidateRun(queryClient, run.id),
  });
}

/* ------------------------------------------------------------------ */
/* Opportunities                                                       */
/* ------------------------------------------------------------------ */

export interface OpportunityFilters {
  type?: string;
  funding?: string;
  saved?: boolean;
  dismissed?: boolean;
}

export function useOpportunities(filters: OpportunityFilters = {}) {
  return useQuery({
    queryKey: queryKeys.opportunities(filters as Record<string, string | undefined>),
    queryFn: ({ signal }) =>
      apiClient.get('/opportunities', {
        query: {
          type: filters.type,
          funding: filters.funding,
          saved: filters.saved ? 'true' : undefined,
          dismissed: filters.dismissed ? 'true' : undefined,
        },
        schema: opportunityListSchema,
        signal,
      }),
  });
}

/** Runs the bounded live discovery endpoint and refreshes persisted cards. */
export function useDiscoverOpportunities() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (objective: string) =>
      apiClient.post(
        '/opportunities/discover',
        { objective, maxResults: 3 },
        { schema: opportunityListSchema, timeoutMs: 120_000 },
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['opportunities'] });
    },
  });
}

export function useOpportunity(id: string | null) {
  return useQuery({
    queryKey: queryKeys.opportunity(id ?? 'none'),
    queryFn: ({ signal }) =>
      apiClient.get(`/opportunities/${id ?? ''}`, { schema: opportunityDetailSchema, signal }),
    enabled: Boolean(id),
  });
}

export function useToggleSaveOpportunity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => apiClient.post(`/opportunities/${id}/save`),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.opportunities({}) });
      const previous = queryClient.getQueriesData({ queryKey: ['opportunities'] });
      queryClient.setQueriesData<{ opportunities: { id: string; saved: boolean }[] }>(
        { queryKey: ['opportunities'] },
        (existing) =>
          existing
            ? {
                ...existing,
                opportunities: existing.opportunities.map((item) =>
                  item.id === id ? { ...item, saved: !item.saved } : item,
                ),
              }
            : existing,
      );
      return { previous };
    },
    onError: (_error, _id, context) => {
      // Roll the optimistic update back so the card never lies about state.
      context?.previous.forEach(([key, data]) => queryClient.setQueryData(key, data));
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['opportunities'] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.nextAction });
    },
  });
}

export function useDismissOpportunity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      apiClient.post(`/opportunities/${id}/dismiss`, { reason }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['opportunities'] });
    },
  });
}

export function useCreateApplication() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (opportunityId: string) =>
      apiClient.post(`/opportunities/${opportunityId}/applications`, undefined, {
        schema: applicationSchema,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.applications });
      void queryClient.invalidateQueries({ queryKey: ['opportunities'] });
    },
  });
}

/**
 * Compares two to four opportunities side by side.
 *
 * A read of what the agent already found � the same eligibility, funding
 * and deadline with the differences named. It never invents a ranking the
 * evidence does not support (spec �6.4).
 */
export function useCompareOpportunities() {
  return useMutation({
    mutationFn: (opportunityIds: string[]) =>
      apiClient.post('/opportunities/compare', { opportunityIds }, {
        schema: compareResponseSchema,
      }),
  });
}

/* ------------------------------------------------------------------ */
/* Applications and drafts                                             */
/* ------------------------------------------------------------------ */

export function useApplications() {
  return useQuery({
    queryKey: queryKeys.applications,
    queryFn: ({ signal }) =>
      apiClient.get('/applications', { schema: applicationListSchema, signal }),
  });
}

export function useApplication(id: string | null) {
  return useQuery({
    queryKey: queryKeys.application(id ?? 'none'),
    queryFn: ({ signal }) =>
      apiClient.get(`/applications/${id ?? ''}`, { schema: applicationSchema, signal }),
    enabled: Boolean(id),
  });
}

export function useUpdateApplication() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Record<string, unknown>) =>
      apiClient.patch(`/applications/${id}`, body, { schema: applicationSchema }),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.application(variables.id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.applications });
      void queryClient.invalidateQueries({ queryKey: queryKeys.nextAction });
    },
  });
}

export function useDraft(id: string | null) {
  return useQuery({
    queryKey: queryKeys.draft(id ?? 'none'),
    queryFn: ({ signal }) => apiClient.get(`/drafts/${id ?? ''}`, { schema: draftSchema, signal }),
    enabled: Boolean(id),
  });
}

export function useSaveDraft() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & UpdateDraftRequest) =>
      apiClient.patch(`/drafts/${id}`, body, { schema: draftSchema }),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.draft(variables.id) });
    },
  });
}

export function useCreateProposal() {
  const queryClient = useQueryClient();

  type ProposalRequest = { id: string; instruction: string; selectedText?: string };

  const mutation = useMutation({
    mutationFn: ({ id, idempotencyKey, ...body }: ProposalRequest & { idempotencyKey: string }) =>
      apiClient.post(`/drafts/${id}/proposals`, body, { idempotencyKey }),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.draft(variables.id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.nextAction });
    },
  });

  return {
    ...mutation,
    mutate: (request: ProposalRequest, options?: Parameters<typeof mutation.mutate>[1]) =>
      mutation.mutate({ ...request, idempotencyKey: newIdempotencyKey() }, options),
    mutateAsync: (request: ProposalRequest, options?: Parameters<typeof mutation.mutateAsync>[1]) =>
      mutation.mutateAsync({ ...request, idempotencyKey: newIdempotencyKey() }, options),
  };
}

export function useAcceptProposal() {
  const queryClient = useQueryClient();

  type DecisionRequest = { id: string; proposalId: string };

  const mutation = useMutation({
    mutationFn: ({
      id,
      proposalId,
      idempotencyKey,
    }: DecisionRequest & { idempotencyKey: string }) =>
      apiClient.post(`/drafts/${id}/proposals/${proposalId}/accept`, undefined, {
        schema: draftSchema,
        idempotencyKey,
      }),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.draft(variables.id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.nextAction });
    },
  });

  return {
    ...mutation,
    mutate: (request: DecisionRequest, options?: Parameters<typeof mutation.mutate>[1]) =>
      mutation.mutate({ ...request, idempotencyKey: newIdempotencyKey() }, options),
    mutateAsync: (request: DecisionRequest, options?: Parameters<typeof mutation.mutateAsync>[1]) =>
      mutation.mutateAsync({ ...request, idempotencyKey: newIdempotencyKey() }, options),
  };
}

export function useRejectProposal() {
  const queryClient = useQueryClient();

  type DecisionRequest = { id: string; proposalId: string };

  const mutation = useMutation({
    mutationFn: ({
      id,
      proposalId,
      idempotencyKey,
    }: DecisionRequest & { idempotencyKey: string }) =>
      apiClient.post(`/drafts/${id}/proposals/${proposalId}/reject`, undefined, {
        schema: draftSchema,
        idempotencyKey,
      }),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.draft(variables.id) });
    },
  });

  return {
    ...mutation,
    mutate: (request: DecisionRequest, options?: Parameters<typeof mutation.mutate>[1]) =>
      mutation.mutate({ ...request, idempotencyKey: newIdempotencyKey() }, options),
    mutateAsync: (request: DecisionRequest, options?: Parameters<typeof mutation.mutateAsync>[1]) =>
      mutation.mutateAsync({ ...request, idempotencyKey: newIdempotencyKey() }, options),
  };
}

/* ------------------------------------------------------------------ */
/* Monitoring and alerts                                               */
/* ------------------------------------------------------------------ */

export function useMonitorTargets() {
  return useQuery({
    queryKey: queryKeys.monitorTargets,
    queryFn: ({ signal }) =>
      apiClient.get('/monitor-targets', { schema: monitorTargetListSchema, signal }),
  });
}

export function useCreateMonitorTarget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CreateMonitorTargetRequest) =>
      apiClient.post('/monitor-targets', body, {
        schema: monitorTargetListSchema.shape.targets.element,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.monitorTargets });
    },
  });
}

export function useUpdateMonitorTarget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & UpdateMonitorTargetRequest) =>
      apiClient.patch(`/monitor-targets/${id}`, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.monitorTargets });
    },
  });
}

export function useMonitorEvents() {
  return useQuery({
    queryKey: queryKeys.monitorEvents,
    queryFn: ({ signal }) =>
      apiClient.get('/monitor-events', { schema: monitorEventListSchema, signal }),
  });
}

export function useAlerts() {
  return useQuery({
    queryKey: queryKeys.alerts,
    queryFn: ({ signal }) => apiClient.get('/alerts', { schema: alertListSchema, signal }),
    refetchInterval: 60_000,
  });
}

export function useMarkAlertRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => apiClient.post(`/alerts/${id}/read`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.alerts });
      void queryClient.invalidateQueries({ queryKey: queryKeys.nextAction });
    },
  });
}

export function useRetryAlertDelivery() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => apiClient.post(`/alerts/${id}/retry`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.alerts });
    },
  });
}
