import { useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowUpRight,
  Compass,
  MapPinned,
  Mic,
  MessageSquare,
  Share2,
  Sparkles,
} from "lucide-react";
import { buttonClasses } from "../components/ui/Button";
import { Container, Section } from "../components/ui/Container";
import { Logo } from "../components/ui/Logo";
import { track } from "../lib/analytics";

const pins = [
  { n: 1, x: 130, y: 170, name: "Москва", delay: 0.2 },
  { n: 2, x: 230, y: 215, name: "Владимир", delay: 0.5 },
  { n: 3, x: 275, y: 182, name: "Суздаль", delay: 0.8 },
  { n: 4, x: 395, y: 275, name: "Казань", delay: 1.1 },
];

function HeroRouteMap() {
  return (
    <div className="relative aspect-[1/1] w-full">
      <div
        className="absolute inset-0 rounded-3xl bg-white shadow-glass overflow-hidden"
        aria-hidden
      >
        <svg
          className="absolute inset-0 w-full h-full opacity-[0.08]"
          viewBox="0 0 500 500"
          preserveAspectRatio="none"
        >
          {Array.from({ length: 20 }).map((_, i) => (
            <line
              key={`v${i}`}
              x1={i * 25}
              y1="0"
              x2={i * 25}
              y2="500"
              stroke="#0b1220"
              strokeWidth="0.5"
            />
          ))}
          {Array.from({ length: 20 }).map((_, i) => (
            <line
              key={`h${i}`}
              x1="0"
              y1={i * 25}
              x2="500"
              y2={i * 25}
              stroke="#0b1220"
              strokeWidth="0.5"
            />
          ))}
        </svg>
        <div className="absolute inset-0 bg-noise opacity-50 mix-blend-multiply" aria-hidden />
      </div>

      <svg
        viewBox="0 0 500 500"
        className="relative w-full h-full"
        aria-label="Схема маршрута"
      >
        <motion.path
          d="M130 170 Q180 190 230 215 T275 182 Q330 200 395 275"
          fill="none"
          stroke="#f97316"
          strokeWidth="2.5"
          strokeDasharray="6 7"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.8, ease: "easeInOut", delay: 0.3 }}
        />

        {pins.map((p) => (
          <motion.g
            key={p.n}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, delay: p.delay }}
          >
            <motion.circle
              cx={p.x}
              cy={p.y}
              r="22"
              fill="#f97316"
              opacity="0.18"
              animate={{ scale: [1, 1.8, 1], opacity: [0.22, 0, 0.22] }}
              transition={{
                duration: 2.2,
                delay: p.delay,
                repeat: Infinity,
                repeatDelay: 0.3,
              }}
              style={{ originX: `${p.x}px`, originY: `${p.y}px` }}
            />
            <circle cx={p.x} cy={p.y} r="9" fill="#f97316" />
            <circle cx={p.x} cy={p.y} r="4" fill="white" />
          </motion.g>
        ))}

        {pins.map((p) => {
          const flip = p.x > 300;
          return (
            <motion.g
              key={`label-${p.n}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: p.delay + 0.15 }}
            >
              <line
                x1={p.x}
                y1={p.y}
                x2={flip ? p.x - 18 : p.x + 18}
                y2={p.y - 40}
                stroke="#0b1220"
                strokeWidth="1"
                strokeDasharray="2 3"
              />
              <g transform={`translate(${flip ? p.x - 150 : p.x + 18}, ${p.y - 70})`}>
                <rect
                  width="130"
                  height="42"
                  rx="10"
                  fill="white"
                  stroke="#0b1220"
                  strokeWidth="1.25"
                />
                <text x="12" y="18" fontSize="10" fill="#6b7280" fontWeight="600">
                  ДЕНЬ 0{p.n}
                </text>
                <text x="12" y="34" fontSize="14" fill="#0b1220" fontWeight="600">
                  {p.name}
                </text>
              </g>
            </motion.g>
          );
        })}

        <g transform="translate(420, 100)" opacity="0.7">
          <circle r="28" fill="none" stroke="#0b1220" strokeWidth="1" />
          <circle
            r="22"
            fill="none"
            stroke="#0b1220"
            strokeWidth="0.5"
            strokeDasharray="2 4"
          />
          <path d="M 0 -22 L 4 0 L 0 22 L -4 0 Z" fill="#f97316" />
          <text y="-34" fontSize="8" textAnchor="middle" fill="#6b7280" fontWeight="600">
            N
          </text>
        </g>
      </svg>

      <div className="absolute bottom-4 right-4 rotate-[-8deg] border-2 border-brand-500 border-dashed rounded px-2 py-1 text-[10px] uppercase tracking-widest text-brand-600 font-semibold bg-white/60">
        Ваш маршрут · 4 дня
      </div>
    </div>
  );
}

export default function LandingPage() {
  useEffect(() => {
    track("page_view", { path: "/" });
  }, []);

  return (
    <div className="bg-ink-50 text-ink-900 min-h-screen relative overflow-hidden">
      <div
        className="pointer-events-none absolute -top-40 -right-40 h-[30rem] w-[30rem] rounded-full bg-brand-200 blur-3xl opacity-50"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute top-1/3 -left-32 h-80 w-80 rounded-full bg-brand-100 blur-3xl opacity-70"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-noise opacity-40 mix-blend-multiply"
        aria-hidden
      />

      <header className="relative z-10">
        <Container className="py-6 flex items-center justify-between">
          <Logo />
          <nav className="hidden md:flex items-center gap-8 text-sm text-ink-700">
            <a href="#how" className="hover:text-ink-900">
              Как работает
            </a>
            <a href="#features" className="hover:text-ink-900">
              Возможности
            </a>
            <a href="#faq" className="hover:text-ink-900">
              FAQ
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <Link
              to="/login"
              className="text-sm font-medium text-ink-700 hover:text-ink-900 px-4 py-2 hidden sm:inline"
            >
              Войти
            </Link>
            <Link to="/signup" className={buttonClasses("dark", "sm")}>
              Начать бесплатно
            </Link>
          </div>
        </Container>
      </header>

      <section className="relative">
        <Container className="relative pt-10 pb-24 md:pt-16 md:pb-32">
          <div className="grid md:grid-cols-12 gap-10 items-center">
            <motion.div
              className="md:col-span-7"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.28em] text-brand-600 font-semibold mb-6">
                <span className="h-px w-6 bg-brand-500" />
                <span>Travel Buddy · RU · 2026</span>
              </div>

              <h1 className="font-display font-bold text-5xl sm:text-6xl md:text-7xl lg:text-8xl leading-[0.95] tracking-tight">
                Поездка <br />
                по России —{" "}
                <span className="relative inline-block whitespace-nowrap">
                  <span className="relative z-10">с умом</span>
                  <svg
                    className="absolute -bottom-2 left-0 w-full"
                    viewBox="0 0 300 20"
                    preserveAspectRatio="none"
                    aria-hidden
                  >
                    <path
                      d="M2 12 C 80 0, 160 22, 298 8"
                      stroke="#f97316"
                      strokeWidth="5"
                      fill="none"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
                , <br />
                <span className="text-ink-500">не наугад.</span>
              </h1>

              <p className="mt-8 text-lg md:text-xl text-ink-700 leading-relaxed max-w-xl">
                ИИ-агент на Claude Haiku&nbsp;4.5 составит маршрут за полминуты,
                расставит точки на карте по дням и ответит голосом. Или
                попросите его в Telegram.
              </p>

              <div className="mt-10 flex flex-wrap items-center gap-4">
                <Link to="/signup" className={buttonClasses("primary", "lg")}>
                  Спланировать поездку
                  <ArrowUpRight size={18} />
                </Link>
                <a
                  href="#how"
                  className="text-sm font-medium text-ink-700 hover:text-ink-900 underline underline-offset-4 decoration-brand-500 decoration-2"
                >
                  Как это работает →
                </a>
              </div>

              <div className="mt-14 grid grid-cols-3 gap-6 max-w-lg">
                {[
                  { k: "12 000+", v: "достопримечательностей" },
                  { k: "10", v: "городов в базе" },
                  { k: "< 30с", v: "до готового плана" },
                ].map((s) => (
                  <div key={s.v}>
                    <div className="font-display text-2xl md:text-3xl text-ink-900">
                      {s.k}
                    </div>
                    <div className="text-xs text-ink-500 mt-1 leading-snug">
                      {s.v}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div
              className="md:col-span-5"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.7, delay: 0.15 }}
            >
              <HeroRouteMap />
            </motion.div>
          </div>
        </Container>
      </section>

      <section id="how" className="relative bg-ink-900 text-white py-24 sm:py-32 overflow-hidden">
        <div className="absolute inset-0 bg-noise opacity-30 mix-blend-overlay" aria-hidden />
        <Container>
          <div className="mb-16 max-w-2xl">
            <div className="text-xs uppercase tracking-[0.28em] text-brand-300 font-semibold mb-3">
              Три шага
            </div>
            <h2 className="font-display text-4xl md:text-6xl leading-[1.02]">
              От идеи до маршрута — <br />
              быстрее, чем свариться кофе.
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-px bg-white/10 rounded-3xl overflow-hidden">
            {[
              {
                n: "01",
                title: "Расскажите",
                body:
                  "Текстом или голосом: «Казань на выходные, хочу татарскую кухню и Кремль».",
                icon: Mic,
              },
              {
                n: "02",
                title: "Получите",
                body:
                  "Агент подберёт места из своей базы знаний и расставит их на карте по дням.",
                icon: MapPinned,
              },
              {
                n: "03",
                title: "Поделитесь",
                body:
                  "Отправьте ссылку другу или продолжайте редактировать план в Telegram-боте.",
                icon: Share2,
              },
            ].map((s) => (
              <div key={s.n} className="bg-ink-900 p-10 sm:p-12 group relative">
                <div className="flex items-start justify-between mb-10">
                  <span className="font-display text-6xl text-brand-500 opacity-90">
                    {s.n}
                  </span>
                  <s.icon
                    size={28}
                    strokeWidth={1.5}
                    className="text-white/60 group-hover:text-brand-300 transition-colors"
                  />
                </div>
                <h3 className="font-display text-2xl mb-3">{s.title}</h3>
                <p className="text-white/70 text-sm leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      <Section
        id="features"
        eyebrow="Что умеет"
        title="Серьёзная начинка. Человеческий интерфейс."
        kicker="Travel Buddy — это не просто чат. Это целая инженерная кухня: ИИ-агент, карта, голос, база знаний и бот."
      >
        <div className="grid md:grid-cols-6 gap-6">
          <FeatureCard
            n="01"
            title="ИИ-агент на Claude Haiku 4.5"
            body="Не имитация — настоящая tool-calling архитектура на LangChain + LangGraph: агент сам ищет факты в базе знаний, геокодирует точки и ведёт диалог."
            icon={Sparkles}
            className="md:col-span-4"
            accent
          />
          <FeatureCard
            n="02"
            title="RAG по России"
            body="Подключён pgvector с описаниями главных мест в 10 городах. Агент ссылается на реальные источники."
            icon={Compass}
            className="md:col-span-2"
          />

          <FeatureCard
            n="03"
            title="Карта по дням"
            body="Маршрут с цветными метками на Leaflet + OSM. Переключайте дни цифровыми клавишами 1–9."
            icon={MapPinned}
            className="md:col-span-2"
          />
          <FeatureCard
            n="04"
            title="Голосовой ввод на русском"
            body="Встроенный Web Speech API с fallback на Whisper на бекенде — говорите, а не набирайте."
            icon={Mic}
            className="md:col-span-2"
          />
          <FeatureCard
            n="05"
            title="Telegram-бот"
            body="Привяжите аккаунт и продолжайте переписку с тем же агентом прямо в Telegram."
            icon={MessageSquare}
            className="md:col-span-2"
          />
        </div>
      </Section>

      <section className="py-10 overflow-hidden border-y border-ink-200 bg-white" aria-hidden>
        <div className="flex gap-14 whitespace-nowrap animate-[marquee_40s_linear_infinite] font-display text-3xl sm:text-4xl text-ink-900/80">
          {Array.from({ length: 3 }).flatMap((_, rep) =>
            [
              "Москва",
              "★",
              "Казань",
              "★",
              "Санкт-Петербург",
              "★",
              "Екатеринбург",
              "★",
              "Нижний Новгород",
              "★",
              "Сочи",
              "★",
              "Калининград",
              "★",
              "Суздаль",
              "★",
              "Владивосток",
              "★",
              "Иркутск",
              "★",
            ].map((c, i) => (
              <span
                key={`${rep}-${i}`}
                className={i % 2 ? "text-brand-500" : undefined}
              >
                {c}
              </span>
            )),
          )}
        </div>
        <style>{`
          @keyframes marquee {
            0% { transform: translateX(0); }
            100% { transform: translateX(-33%); }
          }
        `}</style>
      </section>

      <section className="py-24 sm:py-32">
        <Container>
          <div className="relative rounded-3xl bg-brand-500 text-white p-10 sm:p-16 overflow-hidden shadow-pop">
            <div className="absolute inset-0 bg-noise opacity-40 mix-blend-overlay" aria-hidden />
            <div
              className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-brand-600"
              aria-hidden
            />
            <div className="relative grid md:grid-cols-2 gap-10 items-center">
              <h2 className="font-display text-4xl sm:text-5xl md:text-6xl leading-[1.04]">
                Следующая поездка <br />
                рождается прямо сейчас.
              </h2>
              <div className="flex flex-col items-start md:items-end gap-4">
                <Link to="/signup" className={buttonClasses("dark", "lg")}>
                  Спланировать поездку <ArrowUpRight size={18} />
                </Link>
                <div className="text-sm text-white/80">
                  Бесплатно · Без привязки карты · 30 секунд на старт
                </div>
              </div>
            </div>
          </div>
        </Container>
      </section>

      <footer id="faq" className="border-t border-ink-200">
        <Container className="py-14 grid md:grid-cols-3 gap-10">
          <div>
            <Logo />
            <p className="mt-4 text-sm text-ink-500 max-w-sm leading-relaxed">
              ИИ-планировщик путешествий по России. Сделано студенческим
              проектом HSE в сессии Claude Code.
            </p>
          </div>
          <div className="text-sm">
            <div className="font-display text-ink-900 mb-3">Продукт</div>
            <ul className="space-y-2 text-ink-500">
              <li>
                <a href="#how" className="hover:text-ink-900">
                  Как работает
                </a>
              </li>
              <li>
                <a href="#features" className="hover:text-ink-900">
                  Возможности
                </a>
              </li>
              <li>
                <Link to="/signup" className="hover:text-ink-900">
                  Начать планирование
                </Link>
              </li>
            </ul>
          </div>
          <div className="text-sm">
            <div className="font-display text-ink-900 mb-3">Поддержка</div>
            <ul className="space-y-2 text-ink-500">
              <li>
                <Link to="/login" className="hover:text-ink-900">
                  Войти
                </Link>
              </li>
              <li>Email: dgornin@gmail.com</li>
              <li>Telegram-бот: /start</li>
            </ul>
          </div>
        </Container>
        <div className="border-t border-ink-200">
          <Container className="py-5 flex flex-col sm:flex-row items-center justify-between text-xs text-ink-500 gap-2">
            <div>© 2026 Travel Buddy RU · vibe-coded in a Claude Code session</div>
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
              Все системы работают
            </div>
          </Container>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  n,
  title,
  body,
  icon: Icon,
  className = "",
  accent = false,
}: {
  n: string;
  title: string;
  body: string;
  icon: any;
  className?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`group relative rounded-3xl p-8 sm:p-10 transition-all duration-300 ${
        accent
          ? "bg-ink-900 text-white hover:translate-y-[-2px]"
          : "bg-white border border-ink-200 hover:border-ink-900 hover:shadow-glass"
      } ${className}`}
    >
      <div className="flex items-start justify-between mb-10">
        <span
          className={`font-display text-5xl ${
            accent ? "text-brand-400" : "text-ink-300"
          } transition-colors group-hover:text-brand-500`}
        >
          {n}
        </span>
        <Icon
          size={26}
          strokeWidth={1.5}
          className={accent ? "text-white/60" : "text-ink-500"}
        />
      </div>
      <h3 className="font-display text-xl sm:text-2xl mb-3">{title}</h3>
      <p
        className={`text-sm leading-relaxed ${
          accent ? "text-white/70" : "text-ink-500"
        }`}
      >
        {body}
      </p>
    </div>
  );
}
