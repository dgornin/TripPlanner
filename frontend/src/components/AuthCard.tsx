import { FormEvent, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight, Plane, MapPin } from "lucide-react";
import { Button } from "./ui/Button";
import { Logo } from "./ui/Logo";

export type AuthSubmit = (payload: {
  email: string;
  password: string;
  displayName?: string;
}) => Promise<void>;

interface Props {
  mode: "login" | "signup";
  onSubmit: AuthSubmit;
  error?: string | null;
  loading?: boolean;
}

export function AuthCard({ mode, onSubmit, error, loading }: Props) {
  const isSignup = mode === "signup";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit({ email, password, displayName: displayName || undefined });
  };

  return (
    <div className="min-h-screen bg-ink-50 relative overflow-hidden">
      <div
        className="absolute inset-0 bg-noise opacity-40 mix-blend-multiply"
        aria-hidden
      />
      <div
        className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-brand-200 blur-3xl opacity-50"
        aria-hidden
      />

      <div className="relative z-10 min-h-screen grid lg:grid-cols-5">
        <div className="lg:col-span-2 flex flex-col px-6 sm:px-12 py-8">
          <Logo />
          <div className="flex-1 flex items-center">
            <motion.div
              className="w-full max-w-md"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="text-xs uppercase tracking-[0.28em] text-brand-600 font-semibold mb-3">
                {isSignup ? "Регистрация · 2026" : "Вход · 2026"}
              </div>
              <h1 className="font-display text-4xl sm:text-5xl leading-[1.02] text-ink-900">
                {isSignup ? "Собираем" : "С"}{" "}
                <span className="text-brand-500">
                  {isSignup ? "маршрут." : "возвращением."}
                </span>
                <br />
                <span className="text-ink-500">
                  {isSignup ? "Это быстро." : "Куда едем?"}
                </span>
              </h1>

              <form onSubmit={submit} className="mt-10 space-y-5" noValidate>
                {isSignup && (
                  <Field
                    label="Имя"
                    hint="необязательно"
                    id="name"
                    autoComplete="name"
                    value={displayName}
                    onChange={setDisplayName}
                  />
                )}
                <Field
                  label="Почта"
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={setEmail}
                  required
                />
                <Field
                  label="Пароль"
                  id="password"
                  type="password"
                  autoComplete={isSignup ? "new-password" : "current-password"}
                  hint={isSignup ? "минимум 6 символов" : undefined}
                  value={password}
                  onChange={setPassword}
                  required
                  minLength={6}
                />

                {error && (
                  <div className="text-sm bg-red-50 border border-red-200 text-red-800 rounded-2xl px-4 py-3">
                    {error}
                  </div>
                )}

                <div className="pt-2 flex flex-col gap-4">
                  <Button type="submit" size="lg" loading={loading}>
                    {isSignup ? "Создать аккаунт" : "Войти"}
                    <ArrowRight size={18} />
                  </Button>
                  <div className="text-sm text-ink-500">
                    {isSignup ? (
                      <>
                        Уже есть аккаунт?{" "}
                        <Link
                          to="/login"
                          className="text-ink-900 underline underline-offset-4 decoration-brand-500"
                        >
                          Войти
                        </Link>
                      </>
                    ) : (
                      <>
                        Впервые здесь?{" "}
                        <Link
                          to="/signup"
                          className="text-ink-900 underline underline-offset-4 decoration-brand-500"
                        >
                          Создать аккаунт
                        </Link>
                      </>
                    )}
                  </div>
                </div>
              </form>
            </motion.div>
          </div>

          <div className="text-xs text-ink-500 mt-6">
            © 2026 Travel Buddy RU · vibe-coded
          </div>
        </div>

        <div className="hidden lg:flex lg:col-span-3 items-center justify-center p-12 bg-ink-900 relative overflow-hidden">
          <div
            className="absolute inset-0 bg-noise opacity-30 mix-blend-overlay"
            aria-hidden
          />
          <div
            className="absolute -top-20 -right-20 h-96 w-96 rounded-full bg-brand-500 blur-3xl opacity-40"
            aria-hidden
          />
          <motion.div
            initial={{ opacity: 0, rotate: -4, y: 30 }}
            animate={{ opacity: 1, rotate: -3, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="relative w-full max-w-md"
          >
            <TicketStub />
          </motion.div>
        </div>
      </div>
    </div>
  );
}

function Field({
  id,
  label,
  hint,
  value,
  onChange,
  type = "text",
  required,
  autoComplete,
  minLength,
}: {
  id: string;
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  autoComplete?: string;
  minLength?: number;
}) {
  return (
    <label htmlFor={id} className="block">
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-sm font-medium text-ink-900">{label}</span>
        {hint && <span className="text-xs text-ink-500">{hint}</span>}
      </div>
      <input
        id={id}
        type={type}
        value={value}
        required={required}
        autoComplete={autoComplete}
        minLength={minLength}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-12 px-4 rounded-2xl border border-ink-200 bg-white text-ink-900 outline-none focus:border-ink-900 focus:ring-2 focus:ring-brand-500/30 transition"
      />
    </label>
  );
}

function TicketStub() {
  return (
    <div className="relative bg-white rounded-[24px] shadow-2xl text-ink-900">
      <div className="px-8 pt-8 pb-6 flex items-start justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.3em] text-ink-500 font-semibold">
            Boarding Pass · Travel Buddy RU
          </div>
          <div className="font-display text-2xl mt-2">Ваш маршрут</div>
        </div>
        <div className="bg-brand-500 text-white h-12 w-12 rounded-2xl flex items-center justify-center rotate-12">
          <Plane size={22} strokeWidth={1.8} />
        </div>
      </div>

      <div className="px-8 pb-6">
        <div className="flex items-center gap-4">
          <RoutePoint code="MOW" city="Москва" />
          <div className="flex-1 relative h-px bg-ink-200">
            <div className="absolute left-0 right-0 -top-[5px] flex justify-between px-2 text-ink-400">
              {Array.from({ length: 10 }).map((_, i) => (
                <span
                  key={i}
                  className="h-[3px] w-[3px] rounded-full bg-ink-300"
                />
              ))}
            </div>
          </div>
          <RoutePoint code="KZN" city="Казань" accent />
        </div>
      </div>

      <div className="relative">
        <div className="border-t-2 border-dashed border-ink-200" />
        <span className="absolute left-[-14px] top-[-14px] h-7 w-7 rounded-full bg-ink-900" />
        <span className="absolute right-[-14px] top-[-14px] h-7 w-7 rounded-full bg-ink-900" />
      </div>

      <div className="px-8 py-6 grid grid-cols-3 gap-4 text-xs">
        <StubDetail label="Дата" value="02.05.2026" />
        <StubDetail label="Дней" value="4" />
        <StubDetail label="Место" value="12F" />
        <StubDetail label="Гейт" value="A3" />
        <StubDetail label="Интерес" value="Culture · Food" />
        <StubDetail label="План" value="AI" accent />
      </div>

      <div className="px-8 pb-8 flex items-end justify-between gap-4">
        <div className="text-[10px] text-ink-500 leading-relaxed">
          Покажите этот талон на входе в путешествие.
          <br />
          Точки на карте и маршрут по дням — внутри.
        </div>
        <svg
          width="64"
          height="64"
          viewBox="0 0 64 64"
          className="rounded-lg bg-ink-900 text-white"
        >
          {Array.from({ length: 8 }).flatMap((_, r) =>
            Array.from({ length: 8 }).map((_, c) =>
              (r + c + r * c) % 3 === 0 ? (
                <rect
                  key={`${r}-${c}`}
                  x={c * 8}
                  y={r * 8}
                  width="8"
                  height="8"
                  fill="currentColor"
                />
              ) : null,
            ),
          )}
        </svg>
      </div>
    </div>
  );
}

function RoutePoint({
  code,
  city,
  accent,
}: {
  code: string;
  city: string;
  accent?: boolean;
}) {
  return (
    <div>
      <div
        className={`font-display text-3xl leading-none ${
          accent ? "text-brand-500" : "text-ink-900"
        }`}
      >
        {code}
      </div>
      <div className="text-xs text-ink-500 mt-1 flex items-center gap-1">
        <MapPin size={10} /> {city}
      </div>
    </div>
  );
}

function StubDetail({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-ink-500 font-semibold">
        {label}
      </div>
      <div
        className={`font-display text-sm ${accent ? "text-brand-600" : "text-ink-900"}`}
      >
        {value}
      </div>
    </div>
  );
}
