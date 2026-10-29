import { useState } from 'react';
import { Bell, CheckCircle2, Plug, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/controls';
import { PageHeader } from '@/components/feedback/banners';
import { useToast } from '@/lib/hooks/use-toast';
import { useProfile } from '@/lib/queries';
import { apiClient } from '@/lib/api/client';
import { profileSchema } from '@/lib/schemas';
import { useCapabilityStatus } from '@/lib/hooks/use-capability-status';

export function SettingsPage() {
  const { data: profile, refetch } = useProfile();
  const { data: capabilities, isPending: capabilitiesPending } = useCapabilityStatus();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const updatePreference = async (key: 'guidedView', value: boolean) => {
    if (saving) return;
    setSaving(true);
    try {
      await apiClient.patch(
        '/profile',
        { preferences: { [key]: value } },
        { schema: profileSchema },
      );
      await refetch();
    } catch {
      toast({
        tone: 'error',
        title: 'We could not save that setting',
        description: 'Nothing was changed. Try again.',
      });
    } finally {
      setSaving(false);
    }
  };

  const updateConsent = async (
    key: 'allowProfileMatching' | 'externalModelProcessing' | 'emailNotifications',
    value: boolean,
  ) => {
    if (saving) return;
    setSaving(true);
    try {
      await apiClient.patch('/profile', { consent: { [key]: value } }, { schema: profileSchema });
      await refetch();
    } catch {
      toast({
        tone: 'error',
        title: 'We could not save that change',
        description: 'Nothing was changed. Try again.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Settings"
        description="Control what Oppulse can use, how it matches opportunities, and how results are presented."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="flex flex-col gap-4 p-5">
          <h2 className="text-card-title font-semibold text-text">Profile and privacy</h2>

          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-text">Use my confirmed profile</span>
                <span className="text-meta text-text-muted">
                  Personalises fit and eligibility checks. Unconfirmed facts are never used.
                </span>
              </div>
              <Switch
                checked={profile?.consent.allowProfileMatching ?? true}
                disabled={saving}
                onCheckedChange={(checked) => void updateConsent('allowProfileMatching', checked)}
                aria-label="Use my confirmed profile"
              />
            </div>

            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-text">
                  Use document content for analysis
                </span>
                <span className="text-meta text-text-muted">
                  Only the minimum necessary text is sent, and never your original files.
                </span>
              </div>
              <Switch
                checked={profile?.consent.externalModelProcessing ?? true}
                disabled={saving}
                onCheckedChange={(checked) =>
                  void updateConsent('externalModelProcessing', checked)
                }
                aria-label="Use document content for analysis"
              />
            </div>
          </div>

          <div className="rounded-button bg-surface-subtle p-3">
            <p className="flex items-center gap-2 text-sm font-medium text-text">
              <ShieldCheck aria-hidden="true" className="size-4 text-success" />
              Your documents are private
            </p>
            <p className="mt-1 text-meta text-text-muted">
              Files are stored in a private bucket and served only through short-lived links you are
              authorised to open. Deleting a document revokes its access.
            </p>
          </div>
        </Card>

        <Card className="flex flex-col gap-4 p-5">
          <h2 className="text-card-title font-semibold text-text">Experience</h2>

          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-text">Guided view</span>
              <span className="text-meta text-text-muted">
                More explanation and context. Switch to Focus view for a denser list.
              </span>
            </div>
            <Switch
              checked={profile?.preferences.guidedView ?? true}
              disabled={saving}
              onCheckedChange={(checked) => void updatePreference('guidedView', checked)}
              aria-label="Guided view"
            />
          </div>
        </Card>

        <Card className="flex flex-col gap-4 p-5 lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-card-title font-semibold text-text">Notifications</h2>
            <Badge tone="neutral">
              <Bell aria-hidden="true" className="size-3.5" />
              In-app only, for now
            </Badge>
          </div>

          <p className="text-sm text-text-muted">
            Every alert appears in the app, where you can read it, act on it and keep it. Email
            notifications are not available yet — they arrive as soon as an email service is
            connected.
          </p>

          <ul className="grid gap-2 sm:grid-cols-2">
            <IntegrationRow
              name="In-app alerts"
              detail="Deadline changes, source updates and run results"
              connected
            />
            <IntegrationRow
              name="Email notifications"
              detail="Not available yet"
              connected={false}
            />
          </ul>
        </Card>

        <Card className="flex flex-col gap-4 p-5 lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-card-title font-semibold text-text">Integrations</h2>
            <Badge tone="neutral">
              <Plug aria-hidden="true" className="size-3.5" />
              Provider keys stay on the server
            </Badge>
          </div>

          <ul className="grid gap-2 sm:grid-cols-2">
            <IntegrationRow
              name="AI model provider"
              detail="Reasoning, extraction and drafting"
              mode={capabilities?.capabilities.find((item) => item.key === 'ai')?.mode}
              pending={capabilitiesPending}
            />
            <IntegrationRow
              name="Web search"
              detail="Opportunity discovery and page retrieval"
              mode={capabilities?.capabilities.find((item) => item.key === 'search')?.mode}
              pending={capabilitiesPending}
            />
            <IntegrationRow
              name="Database and storage"
              detail="Profiles, evidence and private files"
              mode={capabilities?.capabilities.find((item) => item.key === 'data')?.mode}
              pending={capabilitiesPending}
            />
          </ul>
        </Card>
      </div>
    </div>
  );
}

function IntegrationRow({
  name,
  detail,
  connected = true,
  mode,
  pending = false,
}: {
  name: string;
  detail: string;
  connected?: boolean;
  mode?: 'live' | 'mocked' | 'unavailable' | undefined;
  pending?: boolean;
}) {
  const status = mode
    ? {
        live: { label: 'Connected', tone: 'success' as const },
        mocked: { label: 'Simulated', tone: 'info' as const },
        unavailable: { label: 'Unavailable', tone: 'neutral' as const },
      }[mode]
    : connected
      ? { label: 'Connected', tone: 'success' as const }
      : { label: 'Not configured', tone: 'neutral' as const };

  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-card border border-border p-3">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium text-text">{name}</span>
        <span className="text-meta text-text-muted">{detail}</span>
      </div>
      <Badge
        tone={pending ? 'neutral' : status.tone}
        icon={!pending && status.label === 'Connected' ? <CheckCircle2 /> : undefined}
      >
        {pending ? 'Checking…' : status.label}
      </Badge>
    </li>
  );
}
