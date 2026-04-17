import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const mpToken = Deno.env.get("MP_ACCESS_TOKEN")!;

    if (!mpToken) {
      return new Response(JSON.stringify({ error: "Token Mercado Pago não configurado" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // valida admin
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Não autenticado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: roleData } = await supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (!roleData) return new Response(JSON.stringify({ error: "Apenas administradores" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { client_account_id, due_date, reference_month, custom_amount } = await req.json();

    if (!client_account_id || !due_date || !reference_month) {
      return new Response(JSON.stringify({ error: "Dados incompletos" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // busca conta + plano
    const { data: account, error: accErr } = await supabase
      .from("client_accounts")
      .select("*, subscription_plans(id, name, monthly_value)")
      .eq("id", client_account_id)
      .maybeSingle();

    if (accErr || !account) {
      return new Response(JSON.stringify({ error: "Conta não encontrada" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const amount = custom_amount ?? account.subscription_plans?.monthly_value ?? account.monthly_value;
    const planName = account.subscription_plans?.name ?? account.plan ?? "Mensalidade";

    // cria preferência no Mercado Pago
    const mpRes = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${mpToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        items: [{
          title: `${planName} - ${reference_month}`,
          quantity: 1,
          currency_id: "BRL",
          unit_price: Number(amount),
        }],
        payer: { email: account.email, name: account.name },
        external_reference: `${client_account_id}|${reference_month}`,
        notification_url: `${supabaseUrl}/functions/v1/mp-webhook`,
        payment_methods: {
          excluded_payment_types: [],
          installments: 1,
        },
        back_urls: {
          success: "https://vortisgestao.lovable.app/cobrancas",
          pending: "https://vortisgestao.lovable.app/cobrancas",
          failure: "https://vortisgestao.lovable.app/cobrancas",
        },
      }),
    });

    const mpData = await mpRes.json();
    if (!mpRes.ok) {
      console.error("MP error:", mpData);
      return new Response(JSON.stringify({ error: "Falha ao criar cobrança no Mercado Pago", details: mpData }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // grava fatura
    const { data: invoice, error: invErr } = await supabase
      .from("subscription_invoices")
      .insert({
        client_account_id,
        plan_id: account.plan_id,
        amount: Number(amount),
        due_date,
        status: "pending",
        mp_preference_id: mpData.id,
        payment_link: mpData.init_point,
        reference_month,
      })
      .select()
      .single();

    if (invErr) {
      return new Response(JSON.stringify({ error: invErr.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ success: true, invoice, payment_link: mpData.init_point }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
