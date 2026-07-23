// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function json(status: number, body: any) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function focusBaseUrl(ambiente: string) {
  return ambiente === "producao"
    ? "https://api.focusnfe.com.br"
    : "https://homologacao.focusnfe.com.br";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json(401, { error: "Não autenticado" });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) return json(401, { error: "Não autenticado" });

    const { data: effectiveId } = await supabase.rpc("get_effective_user_id", {
      _user_id: userData.user.id,
    });
    const ownerId = (effectiveId as string) ?? userData.user.id;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: settings } = await admin
      .from("fiscal_settings")
      .select("provider_token, ambiente")
      .eq("owner_id", ownerId)
      .maybeSingle();

    if (!settings?.provider_token) {
      return json(400, { error: "Token do provedor fiscal não configurado. Configure em Configurações Fiscais para usar a consulta de NCM." });
    }

    const url = new URL(req.url);
    const descricao = (url.searchParams.get("descricao") || "").trim();
    const codigo = (url.searchParams.get("codigo") || "").replace(/\D/g, "");
    const pagina = url.searchParams.get("pagina") || "1";

    if (!descricao && !codigo) {
      return json(400, { error: "Informe uma descrição ou código para consultar" });
    }

    const params = new URLSearchParams();
    if (descricao) params.set("descricao", descricao);
    if (codigo) params.set("codigo", codigo);
    params.set("pagina", pagina);

    const target = `${focusBaseUrl(settings.ambiente || "homologacao")}/v2/ncms?${params.toString()}`;
    const basic = btoa(`${settings.provider_token}:`);

    const resp = await fetch(target, {
      method: "GET",
      headers: { Authorization: `Basic ${basic}`, Accept: "application/json" },
    });

    const text = await resp.text();
    let body: any = null;
    try { body = text ? JSON.parse(text) : null; } catch { body = text; }

    if (!resp.ok) {
      return json(resp.status, { error: "Falha ao consultar NCM no provedor", detail: body });
    }

    return json(200, { data: body });
  } catch (e: any) {
    return json(500, { error: e?.message || "Erro interno" });
  }
});
