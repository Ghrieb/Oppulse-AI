import { useState } from 'react';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  FileText,
  Globe,
  Info,
  Pencil,
  Search,
  UserCheck,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/cn';
import type { AnswerValue, MissionPreview, QuestionId } from '@/lib/schemas/onboarding';
import { countryName } from '@/lib/countries';
import type { OnboardingQuestion } from '@/lib/onboarding/questions';

/**
 * The mission preview.
 *
 * The mission is derived from the answers, so this screen never asks the
 * user to write it. They review it in plain language, edit any criterion
 * they disagree with, and only then start the research.
 */
export function MissionPreview({
  preview,
  questions,
  answers,
  onEditAnswer,
  onRun,
  onBack,
  running = false,
  usedDocuments,
}: {
  preview: MissionPreview;
  questions: OnboardingQuestion[];
  answers: Record<string, AnswerValue | undefined>;
  onEditAnswer: (questionId: QuestionId, value: AnswerValue) => void;
  onRun: () => void;
  onBack: () => void;
  running?: boolean;
  usedDocuments: { id: string; filename: string }[];
}) {
  const [editing, setEditing] = useState<QuestionId | null>(null);

  const criterionRows: {
    questionId: QuestionId;
    label: string;
    summary: string;
  }[] = [
    {
      questionId: 'opportunity_type',
      label: 'Opportunity type',
      summary:
        preview.criteria.opportunityTypes.length > 0
          ? preview.criteria.opportunityTypes
              .map((type) => type.replace(/_/g, ' '))
              .join(', ')
              .replace(/^./, (character) => character.toUpperCase())
          : 'A range of opportunities',
    },
    {
      questionId: 'field',
      label: 'Field or research area',
      summary: preview.criteria.academicInterests[0] ?? 'Not specified yet',
    },
    {
      questionId: 'destinations',
      label: 'Destinations',
      // The countries, by name: the codes are the criterion, and the names
      // are what the student recognises.
      summary:
        preview.criteria.destinationCountries.length > 0
          ? preview.criteria.destinationCountries.map((code) => countryName(code)).join(', ')
          : 'Anywhere — no preference',
    },
    {
      questionId: 'funding',
      label: 'Funding',
      summary: preview.criteria.fundingPreference.replace(/_/g, ' '),
    },
    {
      questionId: 'start_period',
      label: 'Start period',
      summary: preview.criteria.startPeriod
        ? preview.criteria.startPeriod.replace(/^./, (character) => character.toUpperCase())
        : 'Flexible',
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <h2 className="text-card-title font-semibold text-text">Here is what I will do</h2>
        <p className="text-sm leading-relaxed text-text-muted">{preview.objective}</p>
      </div>

      <Card className="flex flex-col gap-1 p-0">
        {criterionRows.map((row) => {
          const question = questions.find((item) => item.id === row.questionId);
          const isEditing = editing === row.questionId;
          const value = answers[row.questionId];

          return (
            <div key={row.questionId} className="border-b border-border last:border-b-0">
              <div className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-meta font-medium text-text-muted">{row.label}</span>
                  <span className="text-sm text-text">{row.summary}</span>
                </div>
                {question ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditing(isEditing ? null : row.questionId)}
                    aria-expanded={isEditing}
                  >
                    <Pencil aria-hidden="true" className="size-4" />
                    {isEditing ? 'Done' : 'Change'}
                    <ChevronDown
                      aria-hidden="true"
                      className={cn('size-3.5 transition-transform', isEditing && 'rotate-180')}
                    />
                  </Button>
                ) : null}
              </div>

              {isEditing && question ? (
                <div className="flex flex-col gap-2 bg-surface-subtle p-4 pt-0">
                  {question.kind === 'text' ? (
                    <>
                      <label htmlFor={`edit-${question.id}`} className="sr-only">
                        {row.label}
                      </label>
                      <Input
                        id={`edit-${question.id}`}
                        defaultValue={typeof value === 'string' ? value : ''}
                        onBlur={(event) => {
                          const next = event.target.value.trim();
                          if (next) onEditAnswer(question.id, next);
                        }}
                        placeholder={question.placeholder ?? ''}
                      />
                    </>
                  ) : (
                    question.options.map((option) => {
                      const selectedValues = Array.isArray(value) ? value : [];
                      const isMulti = question.kind === 'multi';
                      const isSelected = isMulti
                        ? selectedValues.includes(option.value)
                        : value === option.value;

                      return (
                        <button
                          key={option.value}
                          type="button"
                          role={isMulti ? 'checkbox' : 'radio'}
                          aria-checked={isSelected}
                          onClick={() => {
                            if (isMulti) {
                              const next = isSelected
                                ? selectedValues.filter((entry) => entry !== option.value)
                                : [...selectedValues, option.value];
                              onEditAnswer(question.id, next);
                              return;
                            }
                            onEditAnswer(question.id, option.value);
                          }}
                          className={cn(
                            'flex min-h-11 items-center gap-3 rounded-button border px-3 text-left text-sm transition-colors',
                            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring',
                            isSelected
                              ? 'border-primary/50 bg-surface text-text'
                              : 'border-border bg-surface text-text-muted hover:bg-surface',
                          )}
                        >
                          <span
                            aria-hidden="true"
                            className={cn(
                              'grid size-5 shrink-0 place-items-center border',
                              isMulti ? 'rounded-[5px]' : 'rounded-full',
                              isSelected ? 'border-primary bg-primary text-white' : 'border-border',
                            )}
                          >
                            {isSelected ? <Check className="size-3" /> : null}
                          </span>
                          {option.label}
                        </button>
                      );
                    })
                  )}
                </div>
              ) : null}
            </div>
          );
        })}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="flex flex-col gap-2 p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-text">
            <UserCheck aria-hidden="true" className="size-4 text-primary" />
            What I will use
          </h3>
          {preview.usedFacts.length > 0 ? (
            <ul className="flex flex-wrap gap-1.5">
              {preview.usedFacts.map((fact) => (
                <li key={fact.key}>
                  <Badge tone="primary" icon={<Check />}>
                    {fact.label}
                  </Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-text-muted">Only your answers — no documents.</p>
          )}

          {usedDocuments.length > 0 ? (
            <ul className="mt-1 flex flex-col gap-1">
              {usedDocuments.map((document) => (
                <li key={document.id} className="flex items-center gap-2 text-meta text-text-muted">
                  <FileText aria-hidden="true" className="size-3.5" />
                  {document.filename}
                </li>
              ))}
            </ul>
          ) : null}
        </Card>

        <Card className="flex flex-col gap-2 p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-text">
            <Search aria-hidden="true" className="size-4 text-primary" />
            Where I will look
          </h3>
          <ul className="flex flex-col gap-1">
            {preview.sourceScope.map((scope) => (
              <li key={scope} className="flex items-start gap-2 text-sm text-text-muted">
                <Globe aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
                {scope}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card className="flex flex-col gap-2 border-warning/25 bg-warning-surface p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-warning">
          <AlertTriangle aria-hidden="true" className="size-4" />
          What this mission cannot promise
        </h3>
        <ul className="flex flex-col gap-1.5">
          {preview.limitations.map((limitation) => (
            <li key={limitation} className="flex items-start gap-2 text-sm text-warning/90">
              <Info aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
              {limitation}
            </li>
          ))}
        </ul>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={onRun} loading={running} loadingLabel="Starting run…" size="lg">
          Run research
        </Button>
        <Button variant="ghost" onClick={onBack}>
          Back to my answers
        </Button>
      </div>
    </div>
  );
}
