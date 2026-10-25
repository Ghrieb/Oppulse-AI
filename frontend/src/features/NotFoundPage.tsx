import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/feedback/states';

/** Catch-all route. */
export function NotFoundPage() {
  return (
    <div className="grid min-h-[50vh] place-items-center">
      <EmptyState
        icon={<Compass className="size-5" />}
        title="We could not find that page"
        description="The link may be out of date, or the item may have been deleted."
        action={
          <Button asChild size="sm">
            <Link to="/home">Back to your workspace</Link>
          </Button>
        }
      />
    </div>
  );
}
