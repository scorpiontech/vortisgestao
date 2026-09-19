import { useCallback, useEffect, useRef, useState } from "react";
import { APP_VERSION, fetchPublishedVersion } from "@/lib/appVersion";

const CHECK_INTERVAL_MS = 2 * 60 * 1000;

/**
 * Verifica periodicamente se há uma nova versão publicada dos arquivos
 * (ao abrir, a cada 2 minutos e ao voltar para a aba).
 */
export function useVersionCheck() {
  const [newVersion, setNewVersion] = useState<string | null>(null);
  const currentRef = useRef(APP_VERSION);

  const check = useCallback(async () => {
    const published = await fetchPublishedVersion();
    if (!published) return;
    if (currentRef.current === "dev") return;
    if (published !== currentRef.current) setNewVersion(published);
  }, []);

  useEffect(() => {
    void check();
    const id = window.setInterval(() => void check(), CHECK_INTERVAL_MS);
    const onFocus = () => {
      if (document.visibilityState === "visible") void check();
    };
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener("online", onFocus);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("online", onFocus);
    };
  }, [check]);

  return { currentVersion: APP_VERSION, newVersion };
}
