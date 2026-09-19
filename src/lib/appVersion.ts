/** Versão dos arquivos publicados, injetada no build (ver vite.config.ts). */
declare const __APP_VERSION__: string;

export const APP_VERSION: string =
  typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "dev";

export const VERSION_FILE = "/version.json";

/** Lê a versão publicada no servidor, ignorando qualquer cache. */
export async function fetchPublishedVersion(): Promise<string | null> {
  try {
    const res = await fetch(`${VERSION_FILE}?t=${Date.now()}`, {
      cache: "no-store",
      headers: { "Cache-Control": "no-cache" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { version?: string };
    return typeof data.version === "string" && data.version ? data.version : null;
  } catch {
    return null;
  }
}

/** Limpa caches do navegador e recarrega a aplicação. */
export async function reloadToLatest() {
  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch {
    /* ignora */
  }
  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
  } catch {
    /* ignora */
  }
  const url = new URL(window.location.href);
  url.searchParams.set("v", Date.now().toString());
  window.location.replace(url.toString());
}
