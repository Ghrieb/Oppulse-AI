import { FileText, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/feedback/banners';
import { useToast } from '@/lib/hooks/use-toast';
import { DocumentLibrary } from '@/components/profile/document-library';
import {
  useDeleteDocument,
  useDocuments,
  useProfile,
  useUpdateDocument,
  useUploadDocument,
} from '@/lib/queries';
import type { Document } from '@/lib/schemas';

/**
 * The document library.
 *
 * The passport's "Documents and consent" section renders the same
 * component, so the two surfaces can never drift apart.
 */
export function DocumentsPage() {
  const { data: documents } = useDocuments();
  const { data: profile } = useProfile();
  const updateDocument = useUpdateDocument();
  const uploadDocument = useUploadDocument();
  const deleteDocument = useDeleteDocument();
  const { toast } = useToast();

  const pendingFacts = (profile?.facts ?? []).filter(
    (fact) => fact.status === 'proposed' && !fact.excluded,
  );

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="My documents"
        description="Your CV, transcripts and certificates. Oppulse reads them locally and proposes what it finds — nothing is used until you confirm it."
        actions={
          pendingFacts.length > 0 ? (
            <Badge tone="warning">
              {pendingFacts.length} fact{pendingFacts.length === 1 ? '' : 's'} to confirm
            </Badge>
          ) : null
        }
      />

      {pendingFacts.length > 0 ? (
        <Card className="flex flex-wrap items-center justify-between gap-3 border-warning/30 bg-warning-surface p-4">
          <div className="flex items-start gap-3">
            <Sparkles aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning" />
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-text">
                {pendingFacts.length} fact{pendingFacts.length === 1 ? '' : 's'} waiting for your
                confirmation
              </span>
              <span className="text-meta text-text-muted">
                Unconfirmed facts are not used to decide your eligibility.
              </span>
            </div>
          </div>
          <Button asChild size="sm" variant="outline">
            <a href="/profile">Review in your passport</a>
          </Button>
        </Card>
      ) : null}

      <DocumentLibrary
        documents={documents?.documents ?? []}
        pendingDocumentId={updateDocument.isPending ? updateDocument.variables.id : null}
        uploading={uploadDocument.isPending}
        deletingDocumentId={deleteDocument.isPending ? deleteDocument.variables : null}
        onError={(title, description) => toast({ tone: 'error', title, description })}
        onUpload={(file) => {
          uploadDocument.mutate(file, {
            onSuccess: () => {
              toast({
                tone: 'info',
                title: 'Document received',
                description: 'We are reading it now.',
              });
            },
            onError: () => {
              toast({
                tone: 'error',
                title: 'We could not upload that file',
                description: 'Nothing was saved. Try again.',
              });
            },
          });
        }}
        onToggleConsent={(document: Document, consentToUse: boolean) =>
          updateDocument.mutate(
            { id: document.id, consentToUse },
            {
              onSuccess: () =>
                toast({
                  tone: 'success',
                  title: consentToUse
                    ? 'Oppulse may use this document'
                    : 'Document excluded from AI context',
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
        onDelete={(document: Document) =>
          deleteDocument.mutate(document.id, {
            onSuccess: () =>
              toast({
                tone: 'info',
                title: 'Document deleted',
                description:
                  'Facts extracted from it are no longer used, unless you confirmed them separately.',
              }),
            onError: () =>
              toast({
                tone: 'error',
                title: 'We could not delete that document',
                description: 'Nothing was changed. Try again.',
              }),
          })
        }
      />

      <Card className="flex items-start gap-3 p-4">
        <FileText aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-text-muted" />
        <p className="text-sm text-text-muted">
          Deleting a document revokes its access and withdraws the facts extracted from it, unless
          you confirmed them separately.
        </p>
      </Card>
    </div>
  );
}
