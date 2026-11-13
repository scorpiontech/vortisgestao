import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

function device(ua: string) {
  const os = /Android/i.test(ua) ? "Android" : /iPhone|iPad/i.test(ua) ? "iOS" : /Windows/i.test(ua) ? "Windows" : /Mac OS/i.test(ua) ? "Mac" : /Linux/i.test(ua) ? "Linux" : "Outro";
  const br = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Navegador";
  return `${br} no ${os}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  try {
    const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: { user }, error } = await admin.auth.getUser(token);
    if (error || !user) return json({ error: "unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const action = body?.action === "logout" ? "logout" : "ping";
    const sessionKey = typeof body?.session_key === "string" ? body.session_key.slice(0, 64) : "";
    if (!sessionKey) return json({ error: "session_key required" }, 400);

    const ip = (req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for")?.split(",")[0] || req.headers.get("x-real-ip") || "").trim();
    const ua = (req.headers.get("user-agent") || "").slice(0, 400);
    const dev = body?.native ? `App ${device(ua).split(" no ")[1]}` : device(ua);
    const { data: owner } = await admin.rpc("get_effective_user_id", { _user_id: user.id });
    const now = new Date().toISOString();
    const online = action === "ping";

    await admin.from("user_presence").upsert({
      user_id: user.id, owner_id: owner || user.id, user_email: user.email || "",
      ip_address: ip, user_agent: ua, device: dev, online, last_seen_at: now,
    });
    await admin.from("user_session_logs").upsert({
      user_id: user.id, owner_id: owner || user.id, user_email: user.email || "", session_key: sessionKey,
      ip_address: ip, user_agent: ua, device: dev, last_seen_at: now, ended_at: online ? null : now,
    }, { onConflict: "user_id,session_key", ignoreDuplicates: false });
    // retenção de 30 dias
    await admin.from("user_session_logs").delete().eq("user_id", user.id).lt("started_at", new Date(Date.now() - 30 * 864e5).toISOString());
    return json({ ok: true });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
