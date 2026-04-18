import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Send, Copy } from "lucide-react";
import { Container } from "../components/ui/Container";
import { Button } from "../components/ui/Button";
import { issueLinkCode, linkStatus } from "../api/telegram";
import { useUi } from "../store/uiStore";
import { track } from "../lib/analytics";

export default function TelegramSettingsPage() {
  const qc = useQueryClient();
  const showToast = useUi((s) => s.showToast);

  useEffect(() => {
    track("page_view", { path: "/app/settings/telegram" });
  }, []);

  const status = useQuery({ queryKey: ["tg-status"], queryFn: linkStatus });
  const issue = useMutation({
    mutationFn: issueLinkCode,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tg-status"] });
    },
  });

  const copy = async (v: string) => {
    try {
      await navigator.clipboard.writeText(v);
      showToast("Скопировано");
    } catch {
      /* noop */
    }
  };

  return (
    <Container className="py-12" size="md">
      <div className="text-xs uppercase tracking-[0.28em] text-brand-600 font-semibold mb-3">
        Интеграции
      </div>
      <h1 className="font-display text-4xl sm:text-5xl text-ink-900 leading-[1.02]">
        Telegram-бот
      </h1>
      <p className="mt-4 text-ink-700">
        Привяжите аккаунт, чтобы планировать поездки прямо в Telegram — тот же
        ИИ-агент, те же маршруты.
      </p>

      <div className="mt-10 rounded-3xl bg-white border border-ink-200 p-6 sm:p-8">
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="text-[10px] uppercase tracking-[0.28em] text-ink-500 font-semibold">
              Статус
            </div>
            <div className="font-display text-2xl mt-1">
              {status.data?.linked ? (
                <span className="text-green-600">Привязан</span>
              ) : (
                <span className="text-ink-500">Не привязан</span>
              )}
            </div>
          </div>
          <Send size={24} className="text-ink-500" />
        </div>

        <div className="mt-6 grid md:grid-cols-[1fr_auto] gap-3 items-center">
          <Button
            variant="dark"
            size="md"
            onClick={() => issue.mutate()}
            loading={issue.isPending}
          >
            Сгенерировать код для привязки
          </Button>
          {issue.data && (
            <div className="text-xs text-ink-500">
              Действует до следующего вызова.
            </div>
          )}
        </div>

        {issue.data && (
          <div className="mt-6 rounded-2xl bg-ink-900 text-white p-5 relative overflow-hidden">
            <div
              className="absolute inset-0 bg-noise opacity-30 mix-blend-overlay"
              aria-hidden
            />
            <div className="relative">
              <div className="text-[10px] uppercase tracking-[0.28em] text-brand-300 font-semibold">
                Ваш код
              </div>
              <div className="flex items-center gap-3 mt-1">
                <div className="font-mono text-3xl font-semibold">
                  {issue.data.code}
                </div>
                <button
                  type="button"
                  onClick={() => copy(issue.data!.code)}
                  className="inline-flex items-center gap-1 text-xs text-white/80 hover:text-white"
                  aria-label="Скопировать код"
                >
                  <Copy size={12} /> скопировать
                </button>
              </div>
              <ol className="mt-5 space-y-2 text-sm text-white/80">
                <li>
                  1. Откройте бота:{" "}
                  <a
                    href={issue.data.deep_link}
                    target="_blank"
                    rel="noreferrer"
                    className="underline underline-offset-4 decoration-brand-300"
                  >
                    {issue.data.deep_link}
                  </a>
                </li>
                <li>
                  2. Или отправьте боту команду:{" "}
                  <code className="bg-white/10 rounded px-1.5 py-0.5">
                    /link {issue.data.code}
                  </code>
                </li>
                <li>3. После подтверждения можно писать боту как обычному чату.</li>
              </ol>
            </div>
          </div>
        )}
      </div>
    </Container>
  );
}
