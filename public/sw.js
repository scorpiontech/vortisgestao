/* Service worker mínimo do Vortis Gestão.
   Serve apenas para habilitar a instalação do app (desktop/mobile).
   Estratégia: rede sempre em primeiro lugar — nunca serve HTML/JS antigo.
   Só os arquivos com hash em /assets/ ficam em cache. */

const CACHE = "vortis-assets-v1";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "clear-cache") caches.delete(CACHE);
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Arquivos versionados (hash no nome) podem vir do cache.
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res && res.ok) cache.put(req, res.clone());
        return res;
      })()
    );
    return;
  }

  // Todo o resto: rede. Offline em navegação → última página em cache, se houver.
  event.respondWith(
    fetch(req).catch(async () => {
      const cache = await caches.open(CACHE);
      const hit = await cache.match(req);
      if (hit) return hit;
      if (req.mode === "navigate") {
        const index = await cache.match("/index.html");
        if (index) return index;
      }
      return new Response("Sem conexão", { status: 503, statusText: "Offline" });
    })
  );
});
