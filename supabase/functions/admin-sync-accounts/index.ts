import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    // 1. Identificar todas as contas
    const { data: accounts, error: accErr } = await adminClient
      .from("client_accounts")
      .select("id, user_id, email, name");

    if (accErr) throw accErr;

    const results = [];

    for (const account of accounts) {
      // 2. Tentar vincular owner_id nos perfis/company_members se estiver órfão
      // Isso garante que o Master relativo a essa conta veja tudo do dono
      const { data: profiles } = await adminClient
        .from("profiles")
        .select("id, owner_id")
        .eq("id", account.user_id)
        .maybeSingle();

      if (profiles && !profiles.owner_id) {
        await adminClient.from("profiles").update({ owner_id: account.user_id }).eq("id", account.user_id);
      }

      // 3. Verificar fiscal_settings (vincular CNPJ se existir na conta mas não no fiscal)
      const { data: fiscal } = await adminClient
        .from("fiscal_settings")
        .select("id, cnpj")
        .eq("owner_id", account.user_id)
        .maybeSingle();

      if (!fiscal) {
        // Tenta criar um registro fiscal básico se a conta tiver documento
        const { data: accDetail } = await adminClient.from("client_accounts").select("document").eq("id", account.id).maybeSingle();
        if (accDetail?.document) {
          await adminClient.from("fiscal_settings").insert({
            owner_id: account.user_id,
            cnpj: accDetail.document,
            provider: "focusnfe",
            ambiente: "homologacao"
          });
        }
      }

      results.push({ email: account.email, status: "processed" });
    }

    return new Response(JSON.stringify({ success: true, processed: results.length }), { 
      status: 200, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 500, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
});