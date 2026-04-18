import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { LogOut, Menu, Send, X } from "lucide-react";
import { Logo } from "../components/ui/Logo";
import { useAuth } from "../store/authStore";
import { logout } from "../api/auth";
import { useUi } from "../store/uiStore";

export default function AppLayout() {
  const { user, set } = useAuth();
  const toast = useUi((s) => s.toast);
  const nav = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

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

  const mobileLinkClass = ({ isActive }: { isActive: boolean }) =>
    `block rounded-xl px-4 py-3 font-display text-lg transition-colors ${
      isActive
        ? "bg-ink-900 text-white"
        : "text-ink-900 hover:bg-ink-100"
    }`;

  return (
    <div className="min-h-screen bg-ink-50">
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-ink-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
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
              className="hidden sm:inline-flex items-center gap-1.5 text-ink-700 hover:text-ink-900 font-medium"
            >
              <LogOut size={14} /> Выйти
            </button>
            <button
              type="button"
              aria-label="Меню"
              onClick={() => setMobileOpen(true)}
              className="sm:hidden inline-flex items-center justify-center h-10 w-10 rounded-full border border-ink-200"
            >
              <Menu size={18} />
            </button>
          </div>
        </div>
      </header>

      <main>
        <Outlet />
      </main>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            key="drawer"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-ink-900/40 backdrop-blur-sm sm:hidden"
            onClick={() => setMobileOpen(false)}
          >
            <motion.aside
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="absolute top-4 inset-x-4 rounded-3xl bg-white shadow-glass p-5"
            >
              <div className="flex items-center justify-between mb-4">
                <Logo />
                <button
                  aria-label="Закрыть"
                  onClick={() => setMobileOpen(false)}
                  className="inline-flex items-center justify-center h-10 w-10 rounded-full bg-ink-100"
                >
                  <X size={18} />
                </button>
              </div>
              <nav className="space-y-1">
                <NavLink
                  to="/app/trips"
                  className={mobileLinkClass}
                  onClick={() => setMobileOpen(false)}
                >
                  Мои поездки
                </NavLink>
                <NavLink
                  to="/app/settings/telegram"
                  className={mobileLinkClass}
                  onClick={() => setMobileOpen(false)}
                >
                  Telegram
                </NavLink>
                {user?.is_admin && (
                  <NavLink
                    to="/app/admin"
                    className={mobileLinkClass}
                    onClick={() => setMobileOpen(false)}
                  >
                    Админ
                  </NavLink>
                )}
              </nav>
              <div className="mt-6 pt-4 border-t border-ink-100 flex items-center justify-between">
                <div className="text-xs text-ink-500 truncate max-w-[14rem]">
                  {user?.display_name || user?.email}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setMobileOpen(false);
                    doLogout();
                  }}
                  className="inline-flex items-center gap-1.5 text-sm text-ink-700 hover:text-ink-900 font-medium"
                >
                  <LogOut size={14} /> Выйти
                </button>
              </div>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-2xl bg-ink-900 text-white text-sm px-4 py-3 shadow-glass">
          {toast}
        </div>
      )}
    </div>
  );
}
