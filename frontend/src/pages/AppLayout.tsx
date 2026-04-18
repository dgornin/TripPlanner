import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { LogOut, Send } from "lucide-react";
import { Logo } from "../components/ui/Logo";
import { useAuth } from "../store/authStore";
import { logout } from "../api/auth";
import { useUi } from "../store/uiStore";

export default function AppLayout() {
  const { user, set } = useAuth();
  const toast = useUi((s) => s.toast);
  const nav = useNavigate();

  const doLogout = async () => {
    try {
      await logout();
    } finally {
      set(null);
      nav("/");
    }
  };

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `relative inline-flex items-center gap-1.5 px-1 py-1 text-sm transition-colors ${
      isActive
        ? "text-ink-900 after:absolute after:left-0 after:right-0 after:-bottom-2 after:h-0.5 after:bg-brand-500 after:rounded-full"
        : "text-ink-500 hover:text-ink-900"
    }`;

  return (
    <div className="min-h-screen bg-ink-50">
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-ink-200">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between gap-6">
          <Logo />
          <nav className="hidden sm:flex items-center gap-6 mt-1">
            <NavLink to="/app/trips" className={linkClass}>
              Мои поездки
            </NavLink>
            <NavLink to="/app/settings/telegram" className={linkClass}>
              <Send size={14} /> Telegram
            </NavLink>
            {user?.is_admin && (
              <NavLink to="/app/admin" className={linkClass}>
                Админ
              </NavLink>
            )}
          </nav>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-ink-500 hidden md:inline truncate max-w-[14rem]">
              {user?.display_name || user?.email}
            </span>
            <button
              type="button"
              onClick={doLogout}
              className="inline-flex items-center gap-1.5 text-ink-700 hover:text-ink-900 font-medium"
            >
              <LogOut size={14} /> Выйти
            </button>
          </div>
        </div>
      </header>

      <main>
        <Outlet />
      </main>

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-2xl bg-ink-900 text-white text-sm px-4 py-3 shadow-glass">
          {toast}
        </div>
      )}

      <style>{``}</style>
      {/* tiny hidden link to satisfy router types */}
      <Link to="/app/trips" className="hidden" />
    </div>
  );
}
