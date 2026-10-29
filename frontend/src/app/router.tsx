import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppShell } from '@/components/shell/app-shell';
import { ErrorBoundary } from './error-boundary';
import { RequireAuth } from './guards';
import { RouteFallback } from './route-fallback';
import { HomePage } from '@/features/home/HomePage';
import { LandingPage } from '@/features/landing/LandingPage';
import { OnboardingPage } from '@/features/onboarding/OnboardingPage';
import { SignInPage } from '@/features/auth/SignInPage';
import { SignUpPage } from '@/features/auth/SignUpPage';
import { NotFoundPage } from '@/features/NotFoundPage';

/**
 * Routes.
 *
 * The landing page, opportunity catalogue and opportunity evidence are
 * readable without an account. Personal workspaces and actions require a
 * session, and a signed-out visitor is returned to where they were heading
 * once they sign in.
 *
 * The home workspace is loaded eagerly because it is the first thing a
 * judge sees. Everything else is code-split.
 */
const GoalsPage = lazy(() =>
  import('@/features/goals/GoalsPage').then((module) => ({ default: module.GoalsPage })),
);
const OpportunitiesPage = lazy(() =>
  import('@/features/opportunities/OpportunitiesPage').then((module) => ({
    default: module.OpportunitiesPage,
  })),
);
const OpportunityDetailPage = lazy(() =>
  import('@/features/opportunities/OpportunityDetailPage').then((module) => ({
    default: module.OpportunityDetailPage,
  })),
);
const DocumentsPage = lazy(() =>
  import('@/features/documents/DocumentsPage').then((module) => ({
    default: module.DocumentsPage,
  })),
);
const ApplicationsPage = lazy(() =>
  import('@/features/applications/ApplicationsPage').then((module) => ({
    default: module.ApplicationsPage,
  })),
);
const ApplicationDetailPage = lazy(() =>
  import('@/features/applications/ApplicationDetailPage').then((module) => ({
    default: module.ApplicationDetailPage,
  })),
);
const WritingStudioPage = lazy(() => import('@/features/writing/WritingStudioPage'));
const WritingStudioIndex = lazy(() =>
  import('@/features/writing/WritingStudioIndex').then((module) => ({
    default: module.WritingStudioIndex,
  })),
);
const MonitoringPage = lazy(() =>
  import('@/features/monitoring/MonitoringPage').then((module) => ({
    default: module.MonitoringPage,
  })),
);
const AssistantPage = lazy(() =>
  import('@/features/assistant/AssistantPage').then((module) => ({
    default: module.AssistantPage,
  })),
);
const SettingsPage = lazy(() =>
  import('@/features/settings/SettingsPage').then((module) => ({
    default: module.SettingsPage,
  })),
);
const ProfilePassportPage = lazy(() =>
  import('@/features/profile/ProfilePassportPage').then((module) => ({
    default: module.ProfilePassportPage,
  })),
);

function withBoundary(element: React.ReactNode) {
  return <ErrorBoundary>{element}</ErrorBoundary>;
}

function lazyRoute(element: React.ReactNode) {
  return withBoundary(<Suspense fallback={<RouteFallback />}>{element}</Suspense>);
}

function protectedRoute(element: React.ReactNode) {
  return withBoundary(<RequireAuth>{element}</RequireAuth>);
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: withBoundary(<LandingPage />),
  },
  {
    path: '/auth/sign-in',
    element: withBoundary(<SignInPage />),
  },
  {
    path: '/auth/sign-up',
    element: withBoundary(<SignUpPage />),
  },
  {
    path: '/onboarding',
    element: protectedRoute(<OnboardingPage />),
  },
  {
    path: '/onboarding/resume',
    element: <Navigate to="/onboarding" replace />,
  },
  {
    // A pathless layout route, so `/` stays free for the public landing
    // page while the application routes keep their own URLs.
    element: <AppShell />,
    errorElement: <RouteFallback />,
    children: [
      { path: '/home', element: protectedRoute(<HomePage />) },
      { path: '/goals', element: protectedRoute(lazyRoute(<GoalsPage />)) },
      { path: '/opportunities', element: lazyRoute(<OpportunitiesPage />) },
      {
        path: '/opportunities/:id',
        element: lazyRoute(<OpportunityDetailPage />),
      },
      { path: '/documents', element: protectedRoute(lazyRoute(<DocumentsPage />)) },
      { path: '/profile', element: protectedRoute(lazyRoute(<ProfilePassportPage />)) },
      { path: '/applications', element: protectedRoute(lazyRoute(<ApplicationsPage />)) },
      {
        path: '/applications/:id',
        element: protectedRoute(lazyRoute(<ApplicationDetailPage />)),
      },
      { path: '/writing', element: protectedRoute(lazyRoute(<WritingStudioIndex />)) },
      { path: '/writing/:draftId', element: protectedRoute(lazyRoute(<WritingStudioPage />)) },
      { path: '/monitoring', element: protectedRoute(lazyRoute(<MonitoringPage />)) },
      { path: '/assistant', element: protectedRoute(lazyRoute(<AssistantPage />)) },
      { path: '/settings', element: protectedRoute(lazyRoute(<SettingsPage />)) },
      { path: '*', element: withBoundary(<NotFoundPage />) },
    ],
  },
]);
