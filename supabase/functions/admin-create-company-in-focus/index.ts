import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function focusBaseUrl(ambiente: string) {
  return ambiente === "producao"
    ? "https://api.focusnfe.com.br"
    : "https://homologacao.focusnfe.com.br";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization")!;

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    
    // Auth Check
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Não autenticado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) return new Response(JSON.stringify({ error: "Apenas administradores" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { client_account_id, fiscal_data } = await req.json();

    if (!client_account_id || !fiscal_data) {
      return new Response(JSON.stringify({ error: "ID da conta e dados fiscais são obrigatórios" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: account } = await adminClient.from("client_accounts").select("*").eq("id", client_account_id).maybeSingle();
    if (!account) return new Response(JSON.stringify({ error: "Conta não encontrada" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Focus NFe Config (Admin key for company management)
    const focusAdminToken = Deno.env.get("FOCUS_ADMIN_TOKEN");

    if (!focusAdminToken) {
       return new Response(JSON.stringify({ error: "Token administrativo Focus NFe não configurado (FOCUS_ADMIN_TOKEN)" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const ambiente = fiscal_data.ambiente || "homologacao";
    const baseUrl = focusBaseUrl(ambiente);
    const basic = btoa(`${focusAdminToken}:`);

    // Payload Focus (https://doc.focusnfe.com.br/reference/empresas)
    const payload = {
      nome: account.name,
      nome_fantasia: fiscal_data.nome_fantasia || account.name,
      inscricao_estadual: fiscal_data.ie,
      cnpj: fiscal_data.cnpj.replace(/\D/g, ""),
      regime_tributario: fiscal_data.regime_tributario === "simples_nacional" ? "1" : fiscal_data.regime_tributario === "simples_excesso" ? "2" : "3",
      email: account.email,
      telefone: fiscal_data.telefone || "",
      logradouro: fiscal_data.logradouro || "",
      numero: fiscal_data.numero || "",
      bairro: fiscal_data.bairro || "",
      cep: (fiscal_data.cep || "").replace(/\D/g, ""),
      municipio: fiscal_data.municipio || "",
      uf: fiscal_data.uf || "",
      enviar_email_destinatario: true,
    };

    const resp = await fetch(`${baseUrl}/v2/empresas`, {
      method: "POST",
      headers: { 
        "Authorization": `Basic ${basic}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const result = await resp.json();
    
    // Status 422 usually means company already exists in Focus
    if (!resp.ok && resp.status !== 422) {
      return new Response(JSON.stringify({ error: result.mensagem || "Erro na Focus NFe" }), { status: resp.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Save company reference in fiscal_settings
    await adminClient.from("fiscal_settings").upsert({
      owner_id: account.user_id,
      cnpj: fiscal_data.cnpj,
      ie: fiscal_data.ie,
      regime_tributario: fiscal_data.regime_tributario,
      provider: "focusnfe",
      provider_token: focusAdminToken,
      ambiente: ambiente,
      certificate_valid: false, // User still needs to upload A1
    }, { onConflict: "owner_id" });

    return new Response(JSON.stringify({ success: true, focus_data: result }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
