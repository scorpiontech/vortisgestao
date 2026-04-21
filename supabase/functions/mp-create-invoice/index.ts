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

    let amount = Number(custom_amount ?? account.subscription_plans?.monthly_value ?? account.monthly_value);
    const planName = account.subscription_plans?.name ?? account.plan ?? "Mensalidade";

    // Mercado Pago em produção exige valor mínimo (R$ 3,00 para Pix, R$ 5,00 para cartão)
    // Forçar mínimo de R$ 5,00 para garantir todos os meios de pagamento
    if (amount < 5) {
      console.warn(`[mp-create-invoice] amount ${amount} below minimum, adjusting to 5.00`);
      amount = 5;
    }
    // Garantir 2 casas decimais
    amount = Math.round(amount * 100) / 100;

    const isTestToken = mpToken.startsWith("TEST-");
    console.log(`[mp-create-invoice] mode=${isTestToken ? "TEST" : "LIVE"} token_prefix=${mpToken.substring(0, 8)} amount=${amount} email=${account.email}`);

    // IMPORTANTE: NÃO enviar payer.email, pois o MP bloqueia auto-pagamento
    // (quando o e-mail do comprador = conta MP do vendedor, todos os métodos ficam inativos).
    // Deixamos o MP coletar o e-mail do comprador na própria página de checkout.
    // excluded_payment_types: account_money exige conta MP logada e é o principal causador
    // do bloqueio quando o visitante usa a mesma conta MP do vendedor.
    const preferencePayload: Record<string, unknown> = {
      items: [{
        id: String(client_account_id).slice(0, 12),
        title: `${planName} - ${reference_month}`.slice(0, 250),
        description: `Mensalidade ${planName}`.slice(0, 250),
        category_id: "services",
        quantity: 1,
        currency_id: "BRL",
        unit_price: amount,
      }],
      external_reference: `${client_account_id}|${reference_month}`,
      notification_url: `${supabaseUrl}/functions/v1/mp-webhook`,
      statement_descriptor: "VORTISGESTAO",
      back_urls: {
        success: "https://vortisgestao.lovable.app/cobrancas",
        pending: "https://vortisgestao.lovable.app/cobrancas",
        failure: "https://vortisgestao.lovable.app/cobrancas",
      },
      payment_methods: {
        installments: 12,
      },
      binary_mode: false,
    };

    const mpRes = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${mpToken}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": `${client_account_id}-${reference_month}-${Date.now()}`,
      },
      body: JSON.stringify(preferencePayload),
    });

    const mpData = await mpRes.json();
    if (!mpRes.ok) {
      console.error("MP error:", JSON.stringify(mpData));
      return new Response(JSON.stringify({ error: "Falha ao criar cobrança no Mercado Pago", details: mpData }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Em LIVE usamos init_point. sandbox_init_point só funciona com TEST-
    const checkoutUrl = isTestToken ? mpData.sandbox_init_point : mpData.init_point;
    console.log(`[mp-create-invoice] preference_id=${mpData.id} checkout=${checkoutUrl}`);

    // grava fatura
    const { data: invoice, error: invErr } = await supabase
      .from("subscription_invoices")
      .insert({
        client_account_id,
        plan_id: account.plan_id,
        amount,
        due_date,
        status: "pending",
        mp_preference_id: mpData.id,
        payment_link: checkoutUrl,
        reference_month,
      })
      .select()
      .single();

    if (invErr) {
      return new Response(JSON.stringify({ error: invErr.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ success: true, invoice, payment_link: checkoutUrl, mode: isTestToken ? "test" : "live" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
