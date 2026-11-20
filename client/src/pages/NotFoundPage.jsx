import { Link } from 'react-router-dom';
import { ArrowLeft, Compass } from 'lucide-react';
import EmptyState from '../components/ui/EmptyState.jsx';

export default function NotFoundPage() {
  return (
    <div className="py-12">
      <EmptyState
        icon={Compass}
        title="404 – Page Not Found"
        description="The page you are looking for does not exist or may have been moved."
        action={
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>Return to Overview</span>
          </Link>
        }
      />
    </div>
  );
}
