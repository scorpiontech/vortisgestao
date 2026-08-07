import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { asaasCors, asaasFetch, json, onlyDigits } from "../_shared/asaas.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: asaasCors });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Não autorizado" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    
    // Auth check
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Não autenticado" }, 401);

    // Admin role check
    const { data: roleData } = await admin.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (!roleData) return json({ error: "Apenas administradores" }, 403);

    // Configuração do Asaas administrativo: primeiro a tela de configuração
    // do painel admin (asaas_settings do usuário admin), depois o secret global.
    let settings: { api_key: string; ambiente: string } | null = null;

    const { data: adminSettings } = await admin
      .from("asaas_settings")
      .select("api_key, ambiente, active")
      .eq("owner_id", user.id)
      .maybeSingle();

    if (adminSettings?.api_key && adminSettings.active !== false) {
      settings = { api_key: adminSettings.api_key, ambiente: adminSettings.ambiente || "sandbox" };
    } else {
      const asaasKey = Deno.env.get("ASAAS_ADMIN_KEY");
      if (asaasKey) {
        settings = { api_key: asaasKey, ambiente: Deno.env.get("ASAAS_ADMIN_ENV") || "sandbox" };
      }
    }

    if (!settings) {
      return json({
        error: "Integração Asaas não configurada. Acesse Painel Administrativo > Asaas Admin e informe a chave de API.",
      }, 400);
    }

    const { client_account_id, due_date, reference_month, custom_amount } = await req.json();

    if (!client_account_id || !due_date || !reference_month) {
      return json({ error: "Dados incompletos" }, 400);
    }

    const { data: account, error: accErr } = await admin
      .from("client_accounts")
      .select("*, subscription_plans(id, name, monthly_value)")
      .eq("id", client_account_id)
      .maybeSingle();

    if (accErr || !account) return json({ error: "Conta não encontrada" }, 404);

    let amount = Number(custom_amount ?? account.subscription_plans?.monthly_value ?? account.monthly_value);
    const planName = account.subscription_plans?.name ?? account.plan ?? "Mensalidade";

    if (amount < 5) amount = 5;
    amount = Math.round(amount * 100) / 100;

    // Documento (CPF/CNPJ) obrigatório no Asaas: conta -> empresa cadastrada (master) -> fiscal
    let document = onlyDigits(account.document || "");

    // Resolve o master efetivo (sub-usuários herdam a empresa do proprietário)
    let masterId = account.user_id;
    const { data: member } = await admin
      .from("company_members")
      .select("owner_id")
      .eq("user_id", account.user_id)
      .eq("active", true)
      .maybeSingle();
    if (member?.owner_id) masterId = member.owner_id;

    if (!document) {
      const { data: reg } = await admin
        .from("company_registrations")
        .select("document")
        .eq("user_id", masterId)
        .maybeSingle();
      if (reg?.document) document = onlyDigits(reg.document);
    }
    if (!document) {
      const { data: fSettings } = await admin
        .from("fiscal_settings")
        .select("cnpj")
        .eq("owner_id", masterId)
        .maybeSingle();
      if (fSettings?.cnpj) document = onlyDigits(fSettings.cnpj);
    }

    // Persiste o vínculo encontrado para as próximas cobranças
    if (document && document !== onlyDigits(account.document || "")) {
      await admin.from("client_accounts").update({ document }).eq("id", account.id);
    }

    if (!document || (document.length !== 11 && document.length !== 14)) {
      return json({
        error:
          "Conta sem empresa vinculada: informe um CPF/CNPJ válido na edição da conta ou use o botão 'Vincular Contas' para importar o documento da empresa do master.",
      }, 400);
    }

    
    // 1) Find/Create Customer in Admin Asaas
    let asaasCustomerId: string | null = null;
    const customers = await asaasFetch(settings, `/customers?email=${encodeURIComponent(account.email)}&limit=1`);
    if (customers?.data?.length) asaasCustomerId = customers.data[0].id;

    if (!asaasCustomerId) {
      const created = await asaasFetch(settings, "/customers", {
        method: "POST",
        body: JSON.stringify({
          name: account.name,
          email: account.email,
          cpfCnpj: document || undefined,
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
        billingType: "UNDEFINED", // Allows user to choose Pix/Boleto/Card
        dueDate: due_date,
        value: amount,
        description: `${planName} - ${reference_month}`,
        externalReference: account.id,
      }),
    });

    // 3) Record Invoice
    const { data: invoice, error: invErr } = await admin
      .from("subscription_invoices")
      .insert({
        client_account_id,
        plan_id: account.plan_id,
        amount,
        due_date,
        status: "pending",
        asaas_id: payment.id,
        payment_link: payment.invoiceUrl,
        reference_month,
      })
      .select()
      .single();

    if (invErr) return json({ error: invErr.message }, 500);

    return json({ success: true, invoice, payment_link: payment.invoiceUrl });
  } catch (err) {
    console.error(err);
    return json({ error: err instanceof Error ? err.message : "Erro inesperado" }, 500);
  }
});
