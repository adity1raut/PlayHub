import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { LogoMark, Spinner } from "../components/ui";

export function FullScreenLoader({ label = "Loading session" }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-background bg-grid text-foreground">
      <LogoMark className="size-12 text-primary drop-shadow-[0_0_8px_var(--glow)]" />
      <div className="flex items-center gap-3">
        <Spinner label={label} className="size-4" />
        <p className="eyebrow text-faint">{label}…</p>
      </div>
    </div>
  );
}

const ProtectedRoute = ({ children, redirectPath = "/login" }) => {
  const { isAuthenticated, loading, user } = useAuth();
  const location = useLocation();

  if (loading) return <FullScreenLoader />;

  if (!isAuthenticated || !user) {
    return <Navigate to={redirectPath} replace state={{ from: location.pathname }} />;
  }

  return children;
};

export default ProtectedRoute;
