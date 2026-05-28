import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const MP_TOKEN = Deno.env.get("MP_ACCESS_TOKEN")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Sessão inválida" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { target_plan_id } = await req.json();
    if (!target_plan_id || typeof target_plan_id !== "string") {
      return new Response(JSON.stringify({ error: "target_plan_id obrigatório" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: account } = await admin
      .from("client_accounts")
      .select("id, plan_id, monthly_value, due_day, name, email, subscription_plans(id, name, monthly_value, tier)")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!account) {
      return new Response(JSON.stringify({ error: "Conta não encontrada" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (account.plan_id === target_plan_id) {
      return new Response(JSON.stringify({ error: "Você já está neste plano" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: targetPlan } = await admin
      .from("subscription_plans")
      .select("id, name, monthly_value, tier")
      .eq("id", target_plan_id)
      .eq("active", true)
      .maybeSingle();

    if (!targetPlan) {
      return new Response(JSON.stringify({ error: "Plano alvo inválido" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (targetPlan.tier === "pro_custom") {
      return new Response(JSON.stringify({ error: "Plano Pro+ é negociado manualmente. Fale com o suporte." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const currentValue = Number((account as any).subscription_plans?.monthly_value ?? account.monthly_value ?? 0);
    const targetValue = Number(targetPlan.monthly_value);
    const delta = targetValue - currentValue;

    if (delta <= 0) {
      // Downgrade — não cobra proporcional, agenda a troca para o próximo ciclo
      await admin.from("audit_logs").insert({
        user_id: user.id,
        owner_id: user.id,
        user_email: user.email ?? "",
        user_name: user.email ?? "",
        action: "plan_downgrade_request",
        entity: "subscription_plan",
        entity_id: target_plan_id,
        details: { from: account.plan_id, to: target_plan_id, current: currentValue, target: targetValue },
      });
      return new Response(JSON.stringify({
        success: true,
        downgrade: true,
        message: "Downgrade solicitado. A mudança será aplicada no próximo ciclo, sem cobrança adicional.",
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Calcula proporcional
    const now = new Date();
    const dueDay = Math.min(account.due_day || 10, 28);
    const nextDue = new Date(now.getFullYear(), now.getMonth(), dueDay);
    if (nextDue <= now) nextDue.setMonth(nextDue.getMonth() + 1);
    const daysRemaining = Math.max(1, Math.ceil((nextDue.getTime() - now.getTime()) / 86400000));
    const totalCycleDays = 30;

    let proRated = Math.round(delta * (daysRemaining / totalCycleDays) * 100) / 100;
    if (proRated < 5) proRated = 5; // mínimo MP

    const referenceMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-upgrade`;
    const dueDate = nextDue.toISOString().slice(0, 10);

    const isTest = MP_TOKEN.startsWith("TEST-");
    const prefPayload = {
      items: [{
        id: `up-${target_plan_id.slice(0, 8)}`,
        title: `Upgrade para ${targetPlan.name}`.slice(0, 250),
        description: `Diferença proporcional (${daysRemaining}/${totalCycleDays} dias)`.slice(0, 250),
        category_id: "services",
        quantity: 1,
        currency_id: "BRL",
        unit_price: proRated,
      }],
      external_reference: `${account.id}|${referenceMonth}`,
      notification_url: `${SUPABASE_URL}/functions/v1/mp-webhook`,
      statement_descriptor: "VORTISGESTAO",
      back_urls: {
        success: "https://vortisgestao.lovable.app/cobrancas",
        pending: "https://vortisgestao.lovable.app/cobrancas",
        failure: "https://vortisgestao.lovable.app/cobrancas",
      },
      payment_methods: { installments: 12 },
      binary_mode: false,
    };

    const mpRes = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${MP_TOKEN}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": `upgrade-${account.id}-${target_plan_id}-${Date.now()}`,
      },
      body: JSON.stringify(prefPayload),
    });
    const mpData = await mpRes.json();
    if (!mpRes.ok) {
      console.error("MP upgrade error:", JSON.stringify(mpData));
      return new Response(JSON.stringify({ error: "Falha ao criar cobrança no Mercado Pago", details: mpData }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const checkoutUrl = isTest ? mpData.sandbox_init_point : mpData.init_point;

    const { data: invoice, error: invErr } = await admin
      .from("subscription_invoices")
      .insert({
        client_account_id: account.id,
        plan_id: account.plan_id,
        amount: proRated,
        due_date: dueDate,
        status: "pending",
        mp_preference_id: mpData.id,
        payment_link: checkoutUrl,
        reference_month: referenceMonth,
        metadata: {
          upgrade: true,
          target_plan_id: target_plan_id,
          target_plan_name: targetPlan.name,
          target_plan_tier: targetPlan.tier,
          target_monthly_value: targetValue,
          delta,
          days_remaining: daysRemaining,
        },
      })
      .select()
      .single();

    if (invErr) {
      return new Response(JSON.stringify({ error: invErr.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    await admin.from("audit_logs").insert({
      user_id: user.id,
      owner_id: user.id,
      user_email: user.email ?? "",
      user_name: user.email ?? "",
      action: "plan_upgrade_invoice_created",
      entity: "subscription_invoice",
      entity_id: invoice.id,
      details: { target_plan_id, target_plan_name: targetPlan.name, amount: proRated, days_remaining: daysRemaining },
    });

    return new Response(JSON.stringify({
      success: true,
      payment_link: checkoutUrl,
      amount: proRated,
      days_remaining: daysRemaining,
      invoice_id: invoice.id,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("request-plan-upgrade error:", msg);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
