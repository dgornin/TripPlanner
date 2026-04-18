import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { AuthCard } from "../components/AuthCard";
import { login } from "../api/auth";
import { useAuth } from "../store/authStore";
import { track } from "../lib/analytics";

export default function LoginPage() {
  const setUser = useAuth((s) => s.set);
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    track("page_view", { path: "/login" });
  }, []);

  const submit = async (p: { email: string; password: string }) => {
    setLoading(true);
    setError(null);
    try {
      const user = await login({ email: p.email, password: p.password });
      setUser(user);
      track("login", {});
      navigate("/app/trips");
    } catch (e: any) {
      setError(
        e?.response?.data?.detail ??
          "Не удалось войти. Проверьте почту и пароль.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard mode="login" onSubmit={submit} error={error} loading={loading} />
  );
}
