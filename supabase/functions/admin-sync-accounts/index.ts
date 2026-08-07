import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const onlyDigits = (v: string) => (v || "").replace(/\D/g, "");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Não autorizado" }, 401);

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Não autenticado" }, 401);

    const { data: roleData } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleData) return json({ error: "Apenas administradores" }, 403);

    const { data: accounts, error: accErr } = await admin
      .from("client_accounts")
      .select("id, user_id, name, email, document");
    if (accErr) throw accErr;

    const [{ data: members }, { data: registrations }, { data: fiscals }] = await Promise.all([
      admin.from("company_members").select("user_id, owner_id, active"),
      admin.from("company_registrations").select("user_id, name, document, phone"),
      admin.from("fiscal_settings").select("owner_id, cnpj"),
    ]);

    const ownerByUser = new Map<string, string>();
    (members || []).filter((m) => m.active).forEach((m) => ownerByUser.set(m.user_id, m.owner_id));
    const regByOwner = new Map((registrations || []).map((r) => [r.user_id, r]));
    const fiscalByOwner = new Map((fiscals || []).map((f) => [f.owner_id, f]));

    const linked: string[] = [];
    const pending: { email: string; name: string }[] = [];
    const unchanged: string[] = [];

    for (const account of accounts || []) {
      // Master efetivo: sub-usuários herdam a empresa do proprietário
      const masterId = ownerByUser.get(account.user_id) || account.user_id;
      const reg = regByOwner.get(masterId);
      const fiscal = fiscalByOwner.get(masterId);

      const document = onlyDigits(reg?.document || fiscal?.cnpj || "");
      const current = onlyDigits(account.document || "");

      if (!document) {
        pending.push({ email: account.email, name: account.name });
        continue;
      }
      if (document === current) {
        unchanged.push(account.email);
        continue;
      }

      const { error: updErr } = await admin
        .from("client_accounts")
        .update({ document })
        .eq("id", account.id);
      if (updErr) {
        pending.push({ email: account.email, name: account.name });
        continue;
      }
      linked.push(account.email);
    }

    return json({
      success: true,
      total: accounts?.length || 0,
      linked: linked.length,
      already_linked: unchanged.length,
      pending,
    });
  } catch (err) {
    console.error(err);
    return json({ error: err instanceof Error ? err.message : "Erro inesperado" }, 500);
  }
});
