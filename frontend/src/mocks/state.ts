import {
  DEMO_ALERTS,
  DEMO_APPLICATIONS,
  DEMO_DOCUMENTS,
  DEMO_DRAFTS,
  DEMO_EVIDENCE,
  DEMO_MATCHES,
  DEMO_MISSIONS,
  DEMO_MONITOR_EVENTS,
  DEMO_MONITOR_TARGETS,
  DEMO_OPPORTUNITIES,
  DEMO_PROFILE,
  DEMO_PROTECTED_PROFILE,
  DEMO_RUNS,
  DEMO_RUN_EVENTS,
  DEMO_SOURCES,
  DEMO_USER,
} from './fixtures';
import type {
  Alert,
  Application,
  Draft,
  Mission,
  MonitorEvent,
  MonitorTarget,
  Opportunity,
  ProfileFactRevision,
  ProtectedProfile,
  RunEvent,
} from '@/lib/schemas';
import type { OnboardingDraft } from '@/lib/schemas/onboarding';
import { MOCK_KEYS, readValue, removeValue, writeValue } from './store';

/**
 * In-memory state backing the MSW handlers.
 *
 * This is the mock *server's* storage, not a second client. The browser
 * still talks to the network through `apiClient`; MSW answers those
 * requests from this state. The state is resettable so tests are
 * deterministic and order-independent.
 */
export interface MockState {
  user: typeof DEMO_USER;
  profile: typeof DEMO_PROFILE;
  /** The protected part of the profile: never a fact, never in a prompt. */
  protectedProfile: ProtectedProfile;
  documents: typeof DEMO_DOCUMENTS;
  missions: Mission[];
  runs: typeof DEMO_RUNS;
  runEvents: typeof DEMO_RUN_EVENTS;
  opportunities: Opportunity[];
  sources: typeof DEMO_SOURCES;
  evidence: typeof DEMO_EVIDENCE;
  matches: typeof DEMO_MATCHES;
  applications: Application[];
  drafts: Draft[];
  monitorTargets: MonitorTarget[];
  monitorEvents: MonitorEvent[];
  alerts: Alert[];
  /** Runs created during this session by pressing "Run research". */
  simulatedRuns: SimulatedRun[];
  /** The in-progress onboarding draft, if any. */
  onboardingDraft: OnboardingDraft | null;
  /** The audit trail of every change the student made to a fact. */
  revisions: ProfileFactRevision[];
  /** Auth state. `null` means signed out. */
  signedIn: boolean;
}

export interface SimulatedRun {
  id: string;
  missionId: string;
  startedAtMs: number;
  /**
   * Set while the run is paused. The derived timeline freezes at this
   * instant, the way a paused backend run stops at its next checkpoint.
   */
  pausedAtMs?: number | null;
  /**
   * Set when the student cancels the run. The run stays on the books as
   * cancelled — the backend never deletes a run row — and the timeline
   * freezes at the cancellation instant.
   */
  cancelledAtMs?: number | null;
  /**
   * Events the run-control endpoints wrote (pause, resume), stored like
   * the backend's timeline rows rather than derived from the clock.
   */
  controlEvents?: RunEvent[];
}

/**
 * The part of the state that changes while the student works.
 *
 * It is persisted, because the mock backend has to behave like a server: a
 * confirmed fact, a started draft or a marked alert must still be there
 * after a refresh. The large, read-only collections (sources, evidence,
 * missions) stay in the fixtures.
 */
interface PersistedState {
  user: MockState['user'];
  profile: MockState['profile'];
  protectedProfile: ProtectedProfile;
  documents: MockState['documents'];
  opportunities: Opportunity[];
  matches: MockState['matches'];
  applications: Application[];
  drafts: Draft[];
  monitorTargets: MonitorTarget[];
  alerts: Alert[];
  revisions: ProfileFactRevision[];
  signedIn: boolean;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

export function createInitialState(): MockState {
  const base: MockState = {
    user: clone(DEMO_USER),
    profile: clone(DEMO_PROFILE),
    protectedProfile: clone(DEMO_PROTECTED_PROFILE),
    documents: clone(DEMO_DOCUMENTS),
    missions: clone(DEMO_MISSIONS),
    runs: clone(DEMO_RUNS),
    runEvents: clone(DEMO_RUN_EVENTS),
    opportunities: clone(DEMO_OPPORTUNITIES),
    sources: clone(DEMO_SOURCES),
    evidence: clone(DEMO_EVIDENCE),
    matches: clone(DEMO_MATCHES),
    applications: clone(DEMO_APPLICATIONS),
    drafts: clone(DEMO_DRAFTS),
    monitorTargets: clone(DEMO_MONITOR_TARGETS),
    monitorEvents: clone(DEMO_MONITOR_EVENTS),
    alerts: clone(DEMO_ALERTS),
    // Runs and the onboarding draft survive a page reload, so a refresh
    // does not lose a research run or the answers already given.
    simulatedRuns: readValue<SimulatedRun[]>(MOCK_KEYS.runs, []),
    onboardingDraft: readValue<OnboardingDraft | null>(MOCK_KEYS.onboarding, null),
    revisions: [],
    signedIn: false,
  };

  const persisted = readValue<PersistedState | null>(MOCK_KEYS.state, null);
  if (!persisted) return base;

  // A reload restores what the student has already done, the way the real
  // backend would.
  return {
    ...base,
    user: clone(persisted.user),
    profile: clone(persisted.profile),
    protectedProfile: clone(persisted.protectedProfile),
    documents: clone(persisted.documents),
    opportunities: clone(persisted.opportunities),
    matches: clone(persisted.matches),
    applications: clone(persisted.applications),
    drafts: clone(persisted.drafts),
    monitorTargets: clone(persisted.monitorTargets),
    alerts: clone(persisted.alerts),
    revisions: clone(persisted.revisions),
    signedIn: persisted.signedIn,
  };
}

let state: MockState = createInitialState();

export function getState(): MockState {
  return state;
}

/**
 * Writes the mutable state to the store.
 *
 * The mock backend has to survive a refresh, so every change is written back
 * the way a server would write it to a database.
 */
export function persistState(): void {
  writeValue<PersistedState>(MOCK_KEYS.state, {
    user: state.user,
    profile: state.profile,
    protectedProfile: state.protectedProfile,
    documents: state.documents,
    opportunities: state.opportunities,
    matches: state.matches,
    applications: state.applications,
    drafts: state.drafts,
    monitorTargets: state.monitorTargets,
    alerts: state.alerts,
    revisions: state.revisions,
    signedIn: state.signedIn,
  });
}

export function resetState(): void {
  // The store is cleared first: `createInitialState` reads from it, so
  // clearing afterwards would restore a stale draft or a stale run.
  removeValue(MOCK_KEYS.session);
  removeValue(MOCK_KEYS.runs);
  removeValue(MOCK_KEYS.onboarding);
  removeValue(MOCK_KEYS.state);
  state = createInitialState();
}

/** Persists the in-flight runs so a refresh does not lose a research run. */
export function persistRuns(): void {
  writeValue(MOCK_KEYS.runs, state.simulatedRuns);
}

/** Persists the onboarding draft so the server copy matches the local one. */
export function persistOnboardingDraft(): void {
  writeValue(MOCK_KEYS.onboarding, state.onboardingDraft);
}

/**
 * Signs in as the demo student.
 *
 * The prototype starts signed out so the landing page and the route guard
 * behave as they will in production.
 */
export function signInAsDemo(): void {
  state.signedIn = true;
}
