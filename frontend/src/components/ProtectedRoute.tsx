import { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../store/authStore";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loaded, loading, load } = useAuth();

  useEffect(() => {
    if (!loaded && !loading) load();
  }, [loaded, loading, load]);

  if (!loaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ink-50 text-ink-500">
        Загрузка...
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
