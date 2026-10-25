import { useState } from 'react';
import { CalendarDays, Lock, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/controls';
import { useToast } from '@/lib/hooks/use-toast';
import { useProtectedProfile, useUpdateProtectedProfile } from '@/lib/queries';
import { parseDateOfBirth, todayIsoDate } from '@/lib/date-of-birth';
import type { ProtectedProfile } from '@/lib/schemas';

/**
 * The protected part of the profile.
 *
 * The date of birth is sensitive personal data, so it is not a fact: facts
 * are sent to the model, this is not. It is used for exactly one thing —
 * checking an age requirement — and the interface says so, shows its state,
 * and gives the student a way to change or remove it.
 *
 * The derived outcome of each age check is shown on the opportunity, never
 * the date itself, so the answer can travel without the data.
 */

const STATUS_META: Record<
  ProtectedProfile['dateOfBirth']['status'],
  { label: string; tone: 'neutral' | 'success' | 'warning' }
> = {
  not_provided: { label: 'Not provided', tone: 'neutral' },
  provided: { label: 'Provided', tone: 'success' },
  declined: { label: 'Declined', tone: 'neutral' },
  excluded: { label: 'Excluded', tone: 'warning' },
};

export function ProtectedDetails() {
  const { data, isPending } = useProtectedProfile();
  const update = useUpdateProtectedProfile();
  const { toast } = useToast();

  const [editing, setEditing] = useState(false);
  const [typed, setTyped] = useState('');
  const [error, setError] = useState<string | null>(null);

  const protectedProfile = data?.protectedProfile;

  if (isPending || !protectedProfile) {
    return (
      <Card className="flex flex-col gap-3 p-5">
        <p className="text-sm text-text-muted">Loading your protected details…</p>
      </Card>
    );
  }

  const { dateOfBirth } = protectedProfile;
  const meta = STATUS_META[dateOfBirth.status];

  const save = (iso: string) => {
    update.mutate(
      { dateOfBirth: iso, dateOfBirthStatus: 'provided' },
      {
        onSuccess: () => {
          setEditing(false);
          setTyped('');
          setError(null);
          toast({
            tone: 'success',
            title: 'Your date of birth is saved',
            description: 'It is used only to check age requirements.',
          });
        },
        onError: () =>
          toast({
            tone: 'error',
            title: 'We could not save that',
            description: 'Nothing was changed. Try again.',
          }),
      },
    );
  };

  const submitTyped = () => {
    const parsed = parseDateOfBirth(typed);
    if (parsed === null) {
      setError('Enter your date of birth.');
      return;
    }
    if ('error' in parsed) {
      setError(parsed.error);
      return;
    }
    save(parsed.iso);
  };

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-text">
            <Lock aria-hidden="true" className="size-4 text-text-muted" />
            Date of birth
          </h3>
          <p className="text-meta text-text-muted">
            Stored apart from your profile facts, and never sent to a model. It is used for one
            thing: checking age requirements.
          </p>
        </div>
        <Badge tone={meta.tone}>{meta.label}</Badge>
      </div>

      {editing ? (
        <div className="flex flex-col gap-2">
          <label htmlFor="date-of-birth" className="text-sm font-medium text-text">
            Your date of birth
          </label>
          <Input
            id="date-of-birth"
            type="date"
            value={typed}
            max={todayIsoDate()}
            onChange={(event) => {
              setTyped(event.target.value);
              setError(null);
            }}
          />
          <p className="text-meta text-text-muted">
            If the date picker does not work, type it as YYYY-MM-DD or DD/MM/YYYY.
          </p>
          {error ? (
            <p role="alert" className="text-meta text-danger">
              {error}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              loading={update.isPending}
              loadingLabel="Saving…"
              onClick={submitTyped}
            >
              Save
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setEditing(false);
                setTyped('');
                setError(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-text">
            {dateOfBirth.value
              ? `On file, and used only for age checks.`
              : dateOfBirth.status === 'declined'
                ? 'You chose not to share it. Age requirements stay unresolved.'
                : 'Not given. Age requirements stay unresolved until it is.'}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {dateOfBirth.value ? (
              <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                <CalendarDays aria-hidden="true" className="size-4" />
                Change it
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                <CalendarDays aria-hidden="true" className="size-4" />
                Add it
              </Button>
            )}
            {dateOfBirth.value ? (
              <Button
                size="sm"
                variant="ghost"
                loading={update.isPending}
                loadingLabel="Saving…"
                onClick={() =>
                  update.mutate(
                    { dateOfBirth: null, dateOfBirthStatus: 'excluded' },
                    {
                      onSuccess: () =>
                        toast({
                          tone: 'info',
                          title: 'Your date of birth was removed',
                          description: 'Age requirements will stay unresolved again.',
                        }),
                      onError: () =>
                        toast({
                          tone: 'error',
                          title: 'We could not remove that',
                          description: 'Nothing was changed. Try again.',
                        }),
                    },
                  )
                }
              >
                <Trash2 aria-hidden="true" className="size-4" />
                Remove it
              </Button>
            ) : null}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-3 rounded-button bg-surface-subtle p-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium text-text">Use it for age checks</span>
          <span className="text-meta text-text-muted">
            Off means Oppulse never uses your date of birth to decide anything.
          </span>
        </div>
        <Switch
          checked={!dateOfBirth.excludedFromAiContext}
          disabled={update.isPending || !dateOfBirth.value}
          onCheckedChange={(checked) =>
            update.mutate(
              { excludedFromAiContext: !checked },
              {
                onSuccess: () =>
                  toast({
                    tone: 'info',
                    title: checked ? 'Age checks are on' : 'Age checks are off',
                    description: checked
                      ? 'Your date of birth is used only to check age requirements.'
                      : 'Age requirements stay unresolved.',
                  }),
                onError: () =>
                  toast({
                    tone: 'error',
                    title: 'We could not change that',
                    description: 'Nothing was changed. Try again.',
                  }),
              },
            )
          }
          aria-label="Use my date of birth for age checks"
        />
      </div>
    </Card>
  );
}
