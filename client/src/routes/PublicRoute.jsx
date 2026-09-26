import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { FullScreenLoader } from "./ProtectedRoute";

const PublicRoute = ({ children, redirectPath = "/dashboard" }) => {
  const { loading, isAuthenticated } = useAuth();

  if (loading) return <FullScreenLoader />;

  if (isAuthenticated) return <Navigate to={redirectPath} replace />;

  return children;
};

export default PublicRoute;
