const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Tenta obter horário oficial usando NTP.br como referência principal.
// Evita APIs de horário com cache/instabilidade que podem retornar minutos de diferença.
async function fetchReferenceTime(): Promise<{ source: string; utcMs: number } | null> {
  const attempts = ["https://ntp.br", "https://www.ntp.br"];

  for (const url of attempts) {
    try {
      const startedAt = Date.now();
      const r = await fetch(`${url}?_=${startedAt}`, {
        method: "HEAD",
        headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
        signal: AbortSignal.timeout(4000),
      });
      const finishedAt = Date.now();
      const dateHeader = r.headers.get("date");
      if (!r.ok || !dateHeader) continue;

      const headerMs = new Date(dateHeader).getTime();
      if (!Number.isFinite(headerMs)) continue;

      // O header Date tem precisão de segundos. Ajusta pela metade da latência para
      // não criar falso desvio em conexões lentas, sem depender de APIs JSON externas.
      const latencyMs = Math.max(0, finishedAt - startedAt);
      return { source: "ntp.br", utcMs: headerMs + Math.round(latencyMs / 2) };
    } catch (_) {
      // try next
    }
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const serverNow = Date.now();
  const ref = await fetchReferenceTime();

  if (!ref) {
    return json(200, {
      server_utc: new Date(serverNow).toISOString(),
      reference_utc: null,
      drift_seconds: null,
      status: "unknown",
      message: "Não foi possível consultar fonte de horário confiável.",
    });
  }

  const driftMs = serverNow - ref.utcMs;
  const driftSeconds = Math.round(driftMs / 1000);
  const abs = Math.abs(driftSeconds);
  let status: "ok" | "warn" | "critical" = "ok";
  if (abs >= 120) status = "critical";
  else if (abs >= 30) status = "warn";

  return json(200, {
    server_utc: new Date(serverNow).toISOString(),
    reference_utc: new Date(ref.utcMs).toISOString(),
    reference_source: ref.source,
    drift_seconds: driftSeconds,
    status,
    message:
      status === "critical"
        ? `Servidor com desvio de ${driftSeconds}s. Emissões podem ser rejeitadas pela SEFAZ.`
        : status === "warn"
        ? `Servidor com pequeno desvio (${driftSeconds}s). Monitorar.`
        : "Relógio do servidor sincronizado.",
  });
});
