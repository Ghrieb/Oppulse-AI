import { Link } from 'react-router-dom';
import { Bell, CheckCircle2, ClipboardList, FileText, Plug, Settings2, Upload } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/tooltip';
import { ErrorState, RefreshingIndicator } from '@/components/feedback/states';
import {
  useAlerts,
  useApplications,
  useDocuments,
  useMonitorTargets,
  useProfile,
} from '@/lib/queries';
import { useCapabilityStatus } from '@/lib/hooks/use-capability-status';
import type { Capability } from '@/lib/schemas';

/**
 * Workspace summary panels.
 *
 * These are live summaries with a single clear action each — never a
 * decorative dashboard tour (spec §13).
 */
export function SummaryPanels() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <ProfilePanel />
      <ApplicationCanvasPanel />
      <MonitoringPanel />
      <SettingsPanel />
    </div>
  );
}

function PanelShell({
  title,
  icon,
  action,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="flex flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-border p-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-text">
          <span aria-hidden="true" className="text-text-muted">
            {icon}
          </span>
          {title}
        </h2>
        {action}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">{children}</div>
    </Card>
  );
}

/**
 * Per-section failure.
 *
 * One panel failing must never take the workspace with it: the student
 * keeps the sections that loaded, and this one explains itself — with the
 * state that matches the failure — and offers the retry.
 */
function PanelError({ error, onRetry }: { error?: unknown; onRetry: () => void }) {
  return (
    <ErrorState
      error={error}
      onRetry={onRetry}
      message="This section could not load. The rest of your workspace is unaffected, and nothing was lost."
    />
  );
}

function ProfilePanel() {
  const {
    data: profile,
    isPending,
    isError,
    error: profileError,
    isFetching,
    refetch,
  } = useProfile();
  const { data: documents } = useDocuments();

  if (isPending) {
    return (
      <PanelShell title="My CV and profile" icon={<FileText className="size-4" />}>
        <Skeleton className="h-16" />
        <Skeleton className="h-9" />
      </PanelShell>
    );
  }

  if (isError) {
    return (
      <PanelShell title="My CV and profile" icon={<FileText className="size-4" />}>
        <PanelError error={profileError} onRetry={() => void refetch()} />
      </PanelShell>
    );
  }

  const confirmed = profile.facts.filter((fact) => fact.status === 'confirmed').length;
  const pending = profile.facts.filter((fact) => fact.status === 'proposed').length;

  return (
    <PanelShell
      title="My CV and profile"
      icon={<FileText className="size-4" />}
      action={
        <>
          {isFetching ? <RefreshingIndicator /> : null}
          <Button asChild variant="ghost" size="sm">
            <Link to="/documents">Manage</Link>
          </Button>
        </>
      }
    >
      <p className="text-sm text-text-muted">
        {documents?.documents.length ?? 0} document(s) · {confirmed} confirmed fact(s)
      </p>

      {pending > 0 ? (
        <div className="rounded-button bg-warning-surface px-3 py-2">
          <p className="text-meta font-medium text-warning">
            {pending} fact{pending === 1 ? '' : 's'} waiting for your confirmation
          </p>
          <p className="mt-0.5 text-meta text-warning/90">
            Unconfirmed facts are not used for eligibility decisions.
          </p>
          <Button asChild variant="outline" size="sm" className="mt-2">
            <Link to="/documents">
              <CheckCircle2 aria-hidden="true" className="size-4" />
              Review facts
            </Link>
          </Button>
        </div>
      ) : (
        <div className="rounded-button bg-success-surface px-3 py-2">
          <p className="text-meta font-medium text-success">Your profile is fully confirmed.</p>
        </div>
      )}

      <Button asChild variant="outline" size="sm">
        <Link to="/documents">
          <Upload aria-hidden="true" className="size-4" />
          Upload a document
        </Link>
      </Button>
    </PanelShell>
  );
}

function ApplicationCanvasPanel() {
  const {
    data: applications,
    isPending,
    isError,
    error: applicationsError,
    isFetching,
    refetch,
  } = useApplications();

  if (isPending) {
    return (
      <PanelShell title="Application canvas" icon={<ClipboardList className="size-4" />}>
        <Skeleton className="h-16" />
      </PanelShell>
    );
  }

  if (isError) {
    return (
      <PanelShell title="Application canvas" icon={<ClipboardList className="size-4" />}>
        <PanelError error={applicationsError} onRetry={() => void refetch()} />
      </PanelShell>
    );
  }

  const list = applications.applications;
  const active = list.filter((application) =>
    ['considering', 'preparing', 'waiting_for_documents', 'waiting_for_recommender'].includes(
      application.status,
    ),
  );

  return (
    <PanelShell
      title="Application canvas"
      icon={<ClipboardList className="size-4" />}
      action={
        <>
          {isFetching ? <RefreshingIndicator /> : null}
          <Button asChild variant="ghost" size="sm">
            <Link to="/applications">Open</Link>
          </Button>
        </>
      }
    >
      {list.length === 0 ? (
        <p className="text-sm text-text-muted">
          Nothing in progress. Save an opportunity to start an application workspace.
        </p>
      ) : (
        <>
          <p className="text-sm text-text-muted">
            {active.length} active · {list.length} total
          </p>
          <ul className="flex flex-col gap-2">
            {list.slice(0, 2).map((application) => (
              <li key={application.id} className="flex flex-col gap-1">
                <Link
                  to={`/applications/${application.id}`}
                  className="truncate text-sm font-medium text-text underline-offset-2 hover:underline"
                >
                  {application.opportunityTitle}
                </Link>
                <span className="text-meta text-text-muted">
                  {application.completion.completed}/{application.completion.total} requirements
                  ready
                </span>
              </li>
            ))}
          </ul>
          {active[0]?.nextBestAction ? (
            <p className="rounded-button bg-surface-subtle px-3 py-2 text-meta text-text-muted">
              Next: {active[0].nextBestAction}
            </p>
          ) : null}
        </>
      )}
    </PanelShell>
  );
}

function MonitoringPanel() {
  const {
    data: targets,
    isPending,
    isError,
    error: targetsError,
    isFetching,
    refetch,
  } = useMonitorTargets();
  const { data: alerts } = useAlerts();

  if (isPending) {
    return (
      <PanelShell title="Monitoring and alerts" icon={<Bell className="size-4" />}>
        <Skeleton className="h-16" />
      </PanelShell>
    );
  }

  if (isError) {
    return (
      <PanelShell title="Monitoring and alerts" icon={<Bell className="size-4" />}>
        <PanelError error={targetsError} onRetry={() => void refetch()} />
      </PanelShell>
    );
  }

  const list = targets.targets;
  const unread = alerts?.unreadCount ?? 0;

  return (
    <PanelShell
      title="Monitoring and alerts"
      icon={<Bell className="size-4" />}
      action={
        <>
          {isFetching ? <RefreshingIndicator /> : null}
          <Button asChild variant="ghost" size="sm">
            <Link to="/monitoring">Open</Link>
          </Button>
        </>
      }
    >
      <p className="text-sm text-text-muted">
        {list.length} target(s) · {unread} unread alert(s)
      </p>

      {list.slice(0, 2).map((target) => (
        <div key={target.id} className="flex flex-col gap-1">
          <span className="truncate text-sm font-medium text-text">{target.label}</span>
          <span className="text-meta text-text-muted">
            {target.lastSuccessfulCheckAt
              ? `Last checked ${new Date(target.lastSuccessfulCheckAt).toLocaleString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}`
              : 'No successful check yet'}
          </span>
        </div>
      ))}

      {list.some((target) => target.sourceUnreachable) ? (
        <Badge tone="warning">A source could not be checked</Badge>
      ) : null}
    </PanelShell>
  );
}

function SettingsPanel() {
  const { data: capabilities, isFetching } = useCapabilityStatus();

  const rows: { key: Capability['key']; label: string }[] = [
    { key: 'ai', label: 'Model provider' },
    { key: 'search', label: 'Web search' },
    { key: 'data', label: 'Database' },
    { key: 'email', label: 'Email notifications' },
  ];

  return (
    <PanelShell
      title="Settings and integrations"
      icon={<Plug className="size-4" />}
      action={isFetching ? <RefreshingIndicator /> : undefined}
    >
      <ul className="flex flex-col gap-2 text-sm">
        {rows.map((row) => {
          const capability = capabilities?.capabilities.find((item) => item.key === row.key);

          return (
            <li key={row.key} className="flex items-center justify-between gap-2">
              <span className="text-text-muted">{row.label}</span>
              {capability?.mode === 'live' ? (
                <Badge tone="success" icon={<CheckCircle2 />}>
                  Connected
                </Badge>
              ) : capability?.mode === 'mocked' ? (
                <Badge tone="info">Simulated</Badge>
              ) : (
                <Badge tone="neutral">Not configured</Badge>
              )}
            </li>
          );
        })}
      </ul>

      <Button asChild variant="outline" size="sm">
        <Link to="/settings">
          <Settings2 aria-hidden="true" className="size-4" />
          Manage integrations
        </Link>
      </Button>
    </PanelShell>
  );
}
