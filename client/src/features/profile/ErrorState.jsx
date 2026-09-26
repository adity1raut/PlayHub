import { Link } from "react-router-dom";
import { RefreshCw, UserX } from "lucide-react";
import { Alert, Button, Card, EmptyState } from "../../components/ui";

/** Profile failed to load (or doesn't exist). */
const ErrorState = ({ error, onRetry, notFound = false }) =>
  notFound ? (
    <Card className="mx-auto max-w-lg">
      <EmptyState
        icon={UserX}
        title="User not found"
        description={error || "The profile you're looking for doesn't exist or has been removed."}
        action={
          <Button as={Link} to="/dashboard" variant="outline">
            Go home
          </Button>
        }
      />
    </Card>
  ) : (
    <div className="mx-auto max-w-lg space-y-4">
      <Alert variant="destructive" title="Error loading profile">
        {error || "Something went wrong while loading this profile."}
      </Alert>
      <div className="flex flex-wrap gap-2">
        {onRetry && (
          <Button icon={RefreshCw} onClick={onRetry}>
            Try again
          </Button>
        )}
        <Button as={Link} to="/dashboard" variant="outline">
          Go home
        </Button>
      </div>
    </div>
  );

export default ErrorState;
