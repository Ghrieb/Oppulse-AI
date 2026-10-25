import { useState } from 'react';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CountrySelect } from '@/components/onboarding/country-select';
import { cn } from '@/lib/cn';
import { parseDateOfBirth, PREFER_NOT_TO_SAY, todayIsoDate } from '@/lib/date-of-birth';
import type { AnswerValue } from '@/lib/schemas/onboarding';
import type { OnboardingQuestion } from '@/lib/onboarding/questions';

/**
 * One question, one screen.
 *
 * Only the question that matters right now is asked, and an optional
 * question can be skipped without blocking the flow.
 *
 * A single-choice answer is confirmed by choosing it. A multiple-choice
 * answer is confirmed by pressing Continue, so ticking a box does not move
 * the user on before they have finished.
 *
 * The component is mounted with the question id as its key, so switching
 * questions resets the local state without an effect.
 */
export function QuestionStep({
  question,
  value,
  onAnswer,
  onSkip,
  submitting = false,
}: {
  question: OnboardingQuestion;
  value: AnswerValue | undefined;
  onAnswer: (value: AnswerValue) => void;
  onSkip?: (() => void) | undefined;
  submitting?: boolean | undefined;
}) {
  const [text, setText] = useState(typeof value === 'string' ? value : '');
  const [selected, setSelected] = useState<string[]>(Array.isArray(value) ? value : []);
  const [selectedCountries, setSelectedCountries] = useState<string[]>(
    Array.isArray(value) ? value : [],
  );
  const [dateError, setDateError] = useState<string | null>(null);

  if (question.kind === 'date') {
    const chosen = typeof value === 'string' ? value : '';
    const declined = chosen === PREFER_NOT_TO_SAY;

    const submit = () => {
      const parsed = parseDateOfBirth(text);
      if (parsed === null) {
        setDateError('Enter your date of birth, or choose “Prefer not to say”.');
        return;
      }
      if ('error' in parsed) {
        setDateError(parsed.error);
        return;
      }
      setDateError(null);
      onAnswer(parsed.iso);
    };

    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-text-muted">{question.helper}</p>

        <div className="flex flex-col gap-2">
          <label htmlFor="question-date" className="text-sm font-medium text-text">
            Your date of birth
          </label>
          <Input
            id="question-date"
            type="date"
            max={todayIsoDate()}
            value={declined ? '' : text}
            onChange={(event) => {
              setText(event.target.value);
              setDateError(null);
            }}
          />
          <p className="text-meta text-text-muted">
            If the date picker does not work, type it as YYYY-MM-DD or DD/MM/YYYY.
          </p>
        </div>

        {dateError ? (
          <p role="alert" className="text-meta text-danger">
            {dateError}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={submit} disabled={declined} loading={submitting} loadingLabel="Saving…">
            Continue
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setDateError(null);
              onAnswer(PREFER_NOT_TO_SAY);
            }}
          >
            Prefer not to say
          </Button>
        </div>

        <p className="text-meta text-text-muted">
          Preferring not to say is fine. Some age-restricted checks may stay unresolved, and Oppulse
          will tell you which ones instead of guessing.
        </p>

        {declined ? (
          <p className="text-meta text-text-muted">
            You chose not to share it. Age requirements stay unresolved, and nothing was rejected on
            the strength of a date you never gave.
          </p>
        ) : null}
      </div>
    );
  }

  if (question.kind === 'countries') {
    // The choice is confirmed with Continue, so ticking a country does not
    // move the student on before they have finished.
    const chosen = Array.isArray(value) ? value : [];

    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-text-muted">{question.helper}</p>

        <CountrySelect value={chosen} onChange={setSelectedCountries} />

        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={() => onAnswer(selectedCountries)}
            disabled={selectedCountries.length === 0}
            loading={submitting}
            loadingLabel="Saving…"
          >
            Continue
          </Button>
          {question.skippable && onSkip ? (
            <Button variant="ghost" onClick={onSkip}>
              Skip for now
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  if (question.kind === 'text') {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-text-muted">{question.helper}</p>
        <label htmlFor="question-field" className="sr-only">
          {question.prompt}
        </label>
        <Input
          id="question-field"
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && text.trim()) {
              event.preventDefault();
              onAnswer(text.trim());
            }
          }}
          placeholder={question.placeholder ?? ''}
          autoFocus
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={() => onAnswer(text.trim())}
            disabled={!text.trim()}
            loading={submitting}
            loadingLabel="Saving…"
          >
            Continue
          </Button>
          {question.skippable && onSkip ? (
            <Button variant="ghost" onClick={onSkip}>
              Skip for now
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  if (question.kind === 'boolean') {
    const chosen = value === true ? 'true' : value === false ? 'false' : undefined;

    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-text-muted">{question.helper}</p>
        <div className="flex flex-col gap-2">
          {question.options.map((option) => (
            <OptionRow
              key={option.value}
              label={option.label}
              description={option.description}
              selected={chosen === option.value}
              onSelect={() => onAnswer(option.value === 'true')}
            />
          ))}
        </div>
      </div>
    );
  }

  if (question.kind === 'multi') {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-text-muted">{question.helper}</p>
        <div className="flex flex-col gap-2">
          {question.options.map((option) => {
            const isSelected = selected.includes(option.value);

            return (
              <OptionRow
                key={option.value}
                label={option.label}
                description={option.description}
                selected={isSelected}
                multi
                onSelect={() => {
                  setSelected((current) =>
                    isSelected
                      ? current.filter((entry) => entry !== option.value)
                      : [...current, option.value],
                  );
                }}
              />
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={() => onAnswer(selected)}
            disabled={selected.length === 0}
            loading={submitting}
            loadingLabel="Saving…"
          >
            Continue
          </Button>
          {question.skippable && onSkip ? (
            <Button variant="ghost" onClick={onSkip}>
              Skip for now
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  const chosen = typeof value === 'string' ? value : undefined;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-text-muted">{question.helper}</p>
      <div className="flex flex-col gap-2">
        {question.options.map((option) => (
          <OptionRow
            key={option.value}
            label={option.label}
            description={option.description}
            selected={chosen === option.value}
            onSelect={() => onAnswer(option.value)}
          />
        ))}
      </div>

      {question.skippable && onSkip ? (
        <Button variant="ghost" onClick={onSkip} className="self-start">
          Skip for now
        </Button>
      ) : null}
    </div>
  );
}

function OptionRow({
  label,
  description,
  selected,
  multi = false,
  onSelect,
}: {
  label: string;
  description?: string | undefined;
  selected: boolean;
  multi?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      role={multi ? 'checkbox' : 'radio'}
      aria-checked={selected}
      className={cn(
        'flex min-h-11 w-full items-start gap-3 rounded-button border p-3 text-left transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring',
        selected
          ? 'border-primary/50 bg-primary/5 text-text'
          : 'border-border bg-surface text-text hover:bg-surface-subtle',
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'mt-0.5 grid size-5 shrink-0 place-items-center border',
          multi ? 'rounded-[5px]' : 'rounded-full',
          selected ? 'border-primary bg-primary text-white' : 'border-border bg-surface',
        )}
      >
        {selected ? <Check className="size-3" /> : null}
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-sm font-medium">{label}</span>
        {description ? <span className="text-meta text-text-muted">{description}</span> : null}
      </span>
    </button>
  );
}
