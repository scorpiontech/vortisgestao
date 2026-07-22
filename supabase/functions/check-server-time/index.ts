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

// Tenta obter horário oficial de uma fonte confiável.
// Ordem: worldtimeapi (America/Sao_Paulo) → timeapi.io → header Date do Google.
async function fetchReferenceTime(): Promise<{ source: string; utcMs: number } | null> {
  const attempts: Array<() => Promise<{ source: string; utcMs: number } | null>> = [
    async () => {
      const r = await fetch("https://worldtimeapi.org/api/timezone/America/Sao_Paulo", {
        signal: AbortSignal.timeout(4000),
      });
      if (!r.ok) return null;
      const j = await r.json();
      return { source: "worldtimeapi", utcMs: new Date(j.utc_datetime).getTime() };
    },
    async () => {
      const r = await fetch("https://timeapi.io/api/Time/current/zone?timeZone=UTC", {
        signal: AbortSignal.timeout(4000),
      });
      if (!r.ok) return null;
      const j = await r.json();
      return { source: "timeapi.io", utcMs: new Date(j.dateTime + "Z").getTime() };
    },
    async () => {
      const r = await fetch("https://www.google.com", {
        method: "HEAD",
        signal: AbortSignal.timeout(4000),
      });
      const d = r.headers.get("date");
      if (!d) return null;
      return { source: "google-date-header", utcMs: new Date(d).getTime() };
    },
  ];

  for (const a of attempts) {
    try {
      const res = await a();
      if (res && Number.isFinite(res.utcMs)) return res;
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
