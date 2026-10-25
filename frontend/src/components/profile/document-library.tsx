import { useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  EyeOff,
  FileSearch,
  FileText,
  Loader2,
  Trash2,
  Upload,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/controls';
import { PartialState } from '@/components/feedback/states';
import { cn } from '@/lib/cn';
import type { Document } from '@/lib/schemas';

const ACCEPTED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
const MAX_SIZE_BYTES = 10 * 1024 * 1024;

const STATUS_META: Record<
  Document['status'],
  { label: string; tone: 'neutral' | 'success' | 'warning' | 'danger' | 'info' }
> = {
  awaiting_upload: { label: 'Not uploaded yet', tone: 'warning' },
  uploaded: { label: 'Received', tone: 'neutral' },
  processing: { label: 'Processing', tone: 'info' },
  needs_review: { label: 'Needs your review', tone: 'warning' },
  processed: { label: 'Ready to use', tone: 'success' },
  partial: { label: 'Partly read', tone: 'warning' },
  failed: { label: 'Could not read', tone: 'danger' },
  deleted: { label: 'Deleted', tone: 'neutral' },
};

const CATEGORY_LABEL: Record<Document['category'], string> = {
  cv: 'CV',
  transcript: 'Transcript',
  certificate: 'Certificate',
  language: 'Language result',
  announcement: 'Programme document',
  other: 'Document',
};

/**
 * The document library.
 *
 * One implementation, used by the passport's "Documents and consent"
 * section and by the documents route, so the two never drift apart.
 *
 * Every state says what happened and what to do next — a document that
 * could not be read explains why and offers the alternative.
 */
export function DocumentLibrary({
  documents,
  onUpload,
  onToggleConsent,
  onDelete,
  onError,
  pendingDocumentId = null,
  uploading = false,
  deletingDocumentId = null,
  className,
}: {
  documents: Document[];
  onUpload: (file: File) => void;
  onToggleConsent: (document: Document, consentToUse: boolean) => void;
  onDelete: (document: Document) => void;
  /** Reports a validation problem with the chosen file. */
  onError?: (title: string, description: string) => void;
  /** The document whose consent switch is waiting on a response. */
  pendingDocumentId?: string | null;
  /** An upload is in flight, so no second file can start. */
  uploading?: boolean | undefined;
  /** The document whose delete is waiting on a response. */
  deletingDocumentId?: string | null;
  className?: string | undefined;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleFile = (file: File | undefined) => {
    if (!file || uploading) return;

    if (!ACCEPTED_TYPES.includes(file.type)) {
      onError?.(
        'That file type is not supported',
        'Upload a PDF or a Word document. Those are the formats we can read.',
      );
      return;
    }

    if (file.size > MAX_SIZE_BYTES) {
      onError?.(
        'That file is too large',
        'The limit is 10 MB. Compress the file or upload a smaller version.',
      );
      return;
    }

    onUpload(file);
  };

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          handleFile(event.dataTransfer.files[0]);
        }}
        className={cn(
          'flex min-h-36 flex-col items-center justify-center gap-2 rounded-card border-2 border-dashed p-6 text-center transition-colors',
          dragging ? 'border-primary/60 bg-primary/5' : 'border-border bg-surface',
        )}
      >
        <FileSearch aria-hidden="true" className="size-7 text-primary" />
        <p className="text-sm font-medium text-text">Add a CV or supporting document</p>
        <p className="text-meta text-text-muted">PDF or Word, up to 10 MB. It stays private.</p>

        <input
          ref={fileInput}
          type="file"
          className="sr-only"
          accept=".pdf,.docx"
          onChange={(event) => {
            handleFile(event.target.files?.[0]);
            event.target.value = '';
          }}
        />
        <Button
          size="sm"
          variant="outline"
          loading={uploading}
          loadingLabel="Uploading…"
          onClick={() => fileInput.current?.click()}
        >
          <Upload aria-hidden="true" className="size-4" />
          Choose a file
        </Button>
      </div>

      <ul className="flex flex-col gap-3">
        {documents.map((document) => {
          const meta = STATUS_META[document.status];
          const isPending = pendingDocumentId === document.id;

          return (
            <li key={document.id}>
              <Card className="flex flex-col gap-4 p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <span
                      aria-hidden="true"
                      className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-button bg-surface-subtle text-text-muted"
                    >
                      {document.status === 'processing' ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <FileText className="size-4" />
                      )}
                    </span>
                    <div className="flex min-w-0 flex-col gap-1">
                      <span className="truncate text-sm font-semibold text-text">
                        {document.filename}
                      </span>
                      <span className="text-meta text-text-muted">
                        {CATEGORY_LABEL[document.category]} ·{' '}
                        {(document.sizeBytes / 1024 / 1024).toFixed(1)} MB
                      </span>
                    </div>
                  </div>
                  <Badge tone={meta.tone} aria-label={`${meta.label}: ${document.filename}`}>
                    {meta.label}
                  </Badge>
                </div>

                <DocumentStateNote document={document} />

                {document.extraction.proposedFactIds.length > 0 ? (
                  <div className="flex flex-wrap gap-2 text-meta text-text-muted">
                    <span className="rounded-full bg-surface-subtle px-2.5 py-1">
                      {document.extraction.proposedFactIds.length} profile fact
                      {document.extraction.proposedFactIds.length === 1 ? '' : 's'} found
                    </span>
                    {document.status === 'needs_review' ? (
                      <span className="rounded-full bg-warning-surface px-2.5 py-1 text-warning">
                        Confirmation needed
                      </span>
                    ) : null}
                  </div>
                ) : null}

                <div className="flex flex-col gap-3 border-t border-border pt-3 sm:flex-row sm:items-center sm:justify-between">
                  <label className="flex min-h-11 items-center gap-3">
                    <Switch
                      checked={document.consentToUse}
                      disabled={isPending}
                      onCheckedChange={(checked) => onToggleConsent(document, checked)}
                      aria-label={`Allow Oppulse to use ${document.filename} for opportunity matching`}
                    />
                    <span className="flex items-center gap-1.5 text-sm text-text">
                      {document.consentToUse ? (
                        <Eye aria-hidden="true" className="size-4 text-text-muted" />
                      ) : (
                        <EyeOff aria-hidden="true" className="size-4 text-text-muted" />
                      )}
                      {document.consentToUse
                        ? 'Available for opportunity matching'
                        : 'Not used for matching'}
                    </span>
                  </label>

                  <Button
                    size="sm"
                    variant="ghost"
                    loading={deletingDocumentId === document.id}
                    loadingLabel="Deleting…"
                    onClick={() => onDelete(document)}
                    aria-label={`Delete ${document.filename}`}
                  >
                    <Trash2 aria-hidden="true" className="size-4" />
                    Delete
                  </Button>
                </div>
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Each state explains itself and, where possible, offers the way forward. */
function DocumentStateNote({ document }: { document: Document }) {
  if (document.status === 'processing') {
    return (
      <p className="flex items-start gap-2 text-sm text-text-muted">
        <Loader2 aria-hidden="true" className="mt-0.5 size-4 shrink-0 animate-spin" />
        Reading the text in your document. You can leave this page — it will keep working.
      </p>
    );
  }

  if (document.status === 'needs_review') {
    return (
      <p className="flex items-start gap-2 text-sm text-warning">
        <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        We found facts in this document that you have not confirmed yet. Nothing from it is used for
        matching until you confirm it.
      </p>
    );
  }

  if (document.status === 'partial') {
    return (
      <PartialState
        className="rounded-button px-3 py-3"
        description={
          <>
            <p className="font-medium text-warning">We could only read part of this document.</p>
            <ul className="mt-1 flex list-disc flex-col gap-0.5 pl-5 text-sm text-text">
              {document.extraction.unreadSections.map((section) => (
                <li key={section}>{section}</li>
              ))}
            </ul>
            <p className="mt-1 text-meta text-text-muted">
              Everything we did read is shown below. Upload a clearer copy if the missing part
              matters.
            </p>
          </>
        }
      />
    );
  }

  if (document.status === 'failed') {
    return (
      <div className="flex flex-col gap-1.5 rounded-button border border-danger/30 bg-danger-surface p-3">
        <p className="flex items-center gap-1.5 text-sm font-medium text-danger">
          <AlertTriangle aria-hidden="true" className="size-4 shrink-0" />
          We could not read this file.
        </p>
        {document.errorMessage ? (
          <p className="text-sm text-text">{document.errorMessage}</p>
        ) : (
          <p className="text-sm text-text">
            Upload the PDF version, or paste the text into a document.
          </p>
        )}
        <p className="text-meta text-text-muted">
          The original file is still in your library — nothing was deleted.
        </p>
      </div>
    );
  }

  if (document.status === 'processed') {
    return (
      <p className="flex items-start gap-2 text-sm text-text-muted">
        <CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success" />
        Read successfully. {document.extraction.proposedFactIds.length} profile fact
        {document.extraction.proposedFactIds.length === 1 ? '' : 's'} proposed from it.
      </p>
    );
  }

  return null;
}
