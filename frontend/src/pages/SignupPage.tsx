import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { AuthCard } from "../components/AuthCard";
import { signup } from "../api/auth";
import { useAuth } from "../store/authStore";
import { track } from "../lib/analytics";

export default function SignupPage() {
  const setUser = useAuth((s) => s.set);
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    track("page_view", { path: "/signup" });
  }, []);

  const submit = async (p: {
    email: string;
    password: string;
    displayName?: string;
  }) => {
    setLoading(true);
    setError(null);
    try {
      const user = await signup({
        email: p.email,
        password: p.password,
        display_name: p.displayName,
      });
      setUser(user);
      // signup event is emitted server-side too, but a client event helps
      // the funnel capture anonymous→signed sessions when the user starts
      // from the landing tab.
      track("signup_completed", {});
      navigate("/app/trips");
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Не получилось создать аккаунт.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard mode="signup" onSubmit={submit} error={error} loading={loading} />
  );
}
