import { ExternalLink, FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SourceUnavailableState } from '@/components/feedback/states';
import type { Evidence, Source } from '@/lib/schemas';

const QUALITY_LABEL: Record<Source['quality'], string> = {
  official: 'Official source',
  primary: 'Primary source',
  secondary: 'Secondary source',
  aggregator: 'Directory listing',
  unknown: 'Quality unknown',
};

/**
 * Evidence drawer.
 *
 * Every high-stakes claim must be traceable: this shows the URL, the
 * excerpt, the page reference, the retrieval date and the source quality
 * (spec §6.5).
 */
export function EvidenceDrawer({
  open,
  onOpenChange,
  evidence,
  sources,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  evidence: Evidence[];
  sources: Source[];
}) {
  const sourceById = new Map(sources.map((source) => [source.id, source]));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Source evidence</DialogTitle>
          <p className="text-sm text-text-muted">
            {evidence.length} claim{evidence.length === 1 ? '' : 's'} traced to retrieved sources.
          </p>
        </DialogHeader>

        <ul className="flex scrollbar-subtle max-h-[60vh] flex-col gap-3 overflow-y-auto pr-1">
          {evidence.map((item) => {
            const source = sourceById.get(item.sourceId);
            return (
              <li key={item.id} className="rounded-card border border-border p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={item.quality === 'official' ? 'success' : 'neutral'}>
                    {QUALITY_LABEL[item.quality]}
                  </Badge>
                  {item.stance === 'contradicts' ? (
                    <Badge tone="warning">Contradicts another source</Badge>
                  ) : null}
                </div>

                {source?.status === 'unavailable' ? (
                  <SourceUnavailableState
                    className="mt-2 rounded-button px-3 py-2.5"
                    sourceUrl={item.url}
                    sourceTitle={source?.title ?? ''}
                  />
                ) : null}

                <p className="mt-2 text-sm font-medium text-text">{item.claim}</p>

                <blockquote className="mt-2 border-l-2 border-border pl-3 text-sm text-text-muted italic">
                  {item.excerpt}
                </blockquote>

                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-meta text-text-muted">
                  <div className="col-span-2 flex items-center gap-1.5">
                    <FileText aria-hidden="true" className="size-3.5" />
                    <dt className="sr-only">Source</dt>
                    <dd>
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="inline-flex items-center gap-1 text-info underline-offset-2 hover:underline"
                      >
                        {item.url}
                        <ExternalLink aria-hidden="true" className="size-3" />
                      </a>
                    </dd>
                  </div>
                  <div>
                    <dt>Page</dt>
                    <dd>{item.pageReference ?? 'Not applicable'}</dd>
                  </div>
                  <div>
                    <dt>Retrieved</dt>
                    <dd>
                      {item.retrievedAt
                        ? new Date(item.retrievedAt).toLocaleString('en-GB', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })
                        : 'Not available'}
                    </dd>
                  </div>
                </dl>
              </li>
            );
          })}
        </ul>
      </DialogContent>
    </Dialog>
  );
}