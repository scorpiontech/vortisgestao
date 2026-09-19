import { useEffect, useState } from "react";
import { RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useVersionCheck } from "@/hooks/useVersionCheck";
import { reloadToLatest } from "@/lib/appVersion";

const AUTO_RELOAD_SECONDS = 30;

/** Aviso de nova versão disponível com recarregamento automático. */
export function UpdateAvailableBanner() {
  const { newVersion } = useVersionCheck();
  const [dismissed, setDismissed] = useState(false);
  const [seconds, setSeconds] = useState(AUTO_RELOAD_SECONDS);
  const [reloading, setReloading] = useState(false);

  const visible = Boolean(newVersion) && !dismissed;

  useEffect(() => {
    if (!visible) return;
    setSeconds(AUTO_RELOAD_SECONDS);
    const id = window.setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) {
          window.clearInterval(id);
          setReloading(true);
          void reloadToLatest();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-1/2 z-[100] w-[min(92vw,30rem)] -translate-x-1/2 rounded-lg border border-border bg-card p-4 shadow-lg"
      style={{ marginBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex items-start gap-3">
        <RefreshCw className={`mt-0.5 h-5 w-5 shrink-0 text-primary ${reloading ? "animate-spin" : ""}`} />
        <div className="flex-1">
          <p className="text-sm font-semibold text-foreground">Nova versão disponível</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {reloading
              ? "Atualizando o sistema..."
              : `O sistema será atualizado automaticamente em ${seconds}s para evitar o uso de arquivos antigos.`}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={() => {
                setReloading(true);
                void reloadToLatest();
              }}
              disabled={reloading}
            >
              Atualizar agora
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setDismissed(true)} disabled={reloading}>
              Depois
            </Button>
          </div>
        </div>
        <button
          type="button"
          aria-label="Fechar aviso de atualização"
          className="text-muted-foreground transition-colors hover:text-foreground"
          onClick={() => setDismissed(true)}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
