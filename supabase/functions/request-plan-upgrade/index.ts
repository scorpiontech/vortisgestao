import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { asaasCors, asaasFetch, json, onlyDigits } from "../_shared/asaas.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: asaasCors });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Não autorizado" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Não autenticado" }, 401);

    const { target_plan_id } = await req.json();
    if (!target_plan_id) return json({ error: "Plano alvo não informado" }, 400);

    // Get current account and plan
    const { data: account } = await admin
      .from("client_accounts")
      .select("*, subscription_plans(*)")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!account) return json({ error: "Conta não encontrada" }, 404);

    const { data: targetPlan } = await admin
      .from("subscription_plans")
      .select("*")
      .eq("id", target_plan_id)
      .maybeSingle();

    if (!targetPlan) return json({ error: "Plano alvo não encontrado" }, 404);

    // If it's the same plan, do nothing
    if (account.plan_id === target_plan_id) {
      return json({ message: "Você já está neste plano" });
    }

    // Determine amount (simplified logic: full amount of target plan for this month)
    const amount = Number(targetPlan.monthly_value);
    const reference_month = new Date().toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
    const due_date = new Date(new Date().setDate(new Date().getDate() + 3)).toISOString().split('T')[0];

    // Asaas admin settings
    let settings: { api_key: string; ambiente: string } | null = null;
    const asaasKey = Deno.env.get("ASAAS_ADMIN_KEY");
    if (asaasKey) {
      settings = { api_key: asaasKey, ambiente: Deno.env.get("ASAAS_ADMIN_ENV") || "sandbox" };
    }

    if (!settings) return json({ error: "Configuração de faturamento não disponível" }, 500);

    let document = onlyDigits(account.document || "");
    if (!document) {
      return json({ error: "Por favor, configure o CPF/CNPJ da sua empresa antes de realizar o upgrade." }, 400);
    }

    // 1) Find/Create Customer
    let asaasCustomerId: string | null = null;
    const customers = await asaasFetch(settings, `/customers?email=${encodeURIComponent(account.email)}&limit=1`);
    const existing = customers?.data?.[0];
    if (existing) {
      asaasCustomerId = existing.id;
    } else {
      const created = await asaasFetch(settings, "/customers", {
        method: "POST",
        body: JSON.stringify({
          name: account.name,
          email: account.email,
          cpfCnpj: document,
          externalReference: account.id,
        }),
      });
      asaasCustomerId = created.id;
    }

    // 2) Create Payment
    const payment = await asaasFetch(settings, "/payments", {
      method: "POST",
      body: JSON.stringify({
        customer: asaasCustomerId,
        billingType: "UNDEFINED",
        dueDate: due_date,
        value: amount,
        description: `Upgrade para ${targetPlan.name} - ${reference_month}`,
        externalReference: account.id,
      }),
    });

    // 3) Record Invoice with asaas_id
    const { data: invoice, error: invErr } = await admin
      .from("subscription_invoices")
      .insert({
        client_account_id: account.id,
        plan_id: targetPlan.id,
        amount,
        due_date,
        status: "pending",
        asaas_id: payment.id,
        payment_link: payment.invoiceUrl || payment.bankSlipUrl || payment.pixCopyPaste,
        reference_month,
        metadata: { target_plan_id: targetPlan.id }
      })
      .select()
      .single();

    if (invErr) throw invErr;

    return json({ success: true, payment_link: payment.invoiceUrl || payment.bankSlipUrl || payment.pixCopyPaste, amount });
  } catch (err) {
    console.error(err);
    return json({ error: err instanceof Error ? err.message : "Erro inesperado" }, 500);
  }
});
