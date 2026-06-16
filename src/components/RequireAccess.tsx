import { Navigate, useLocation } from "react-router-dom";
import { useAccess } from "@/hooks/useAccess";

export default function RequireAccess({ children }: { children: JSX.Element }) {
  const { loading, reason } = useAccess();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Carregando...
      </div>
    );
  }
  if (reason === "no-session") return <Navigate to="/auth" replace state={{ from: location }} />;
  if (reason === "needs-subscription") return <Navigate to="/subscribe" replace />;
  return children;
}
