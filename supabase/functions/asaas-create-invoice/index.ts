import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { asaasCors, asaasFetch, json, onlyDigits } from "../_shared/asaas.ts";
import { dueDateInMonth } from "../_shared/subscription-dates.ts";

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

    const { action, invoice_id, client_account_id, due_date, reference_month, custom_amount } = await req.json();

    // Repair an existing unpaid invoice in place; never create a second charge.
    if (action === "repair_due_date") {
      if (typeof invoice_id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(invoice_id)) {
        return json({ error: "Fatura inválida" }, 400);
      }
      const { data: invoice, error: invoiceError } = await admin.from("subscription_invoices")
        .select("id,client_account_id,due_date,status,asaas_id") .eq("id", invoice_id).maybeSingle();
      if (invoiceError) throw invoiceError;
      if (!invoice) return json({ error: "Fatura não encontrada" }, 404);
      if (!["pending", "overdue"].includes(invoice.status) || !invoice.asaas_id) {
        return json({ error: "Somente faturas Asaas não pagas podem ter o vencimento corrigido" }, 400);
      }
      const { data: ownerAccount, error: ownerError } = await admin.from("client_accounts")
        .select("due_day,user_id").eq("id", invoice.client_account_id).single();
      if (ownerError || !ownerAccount) throw ownerError || new Error("Conta não encontrada");
      const [year, month] = invoice.due_date.split("-").map(Number);
      const correctedDate = dueDateInMonth(ownerAccount.due_day, year, month - 1).toISOString().slice(0, 10);
      const payment = await asaasFetch(settings, `/payments/${encodeURIComponent(invoice.asaas_id)}`);
      if (!["PENDING", "OVERDUE"].includes(payment.status) || payment.deleted || payment.externalReference !== invoice.client_account_id) {
        return json({ error: "Cobrança paga, cancelada ou não vinculada a esta conta" }, 409);
      }
      if (payment.dueDate !== correctedDate) {
        await asaasFetch(settings, `/payments/${encodeURIComponent(invoice.asaas_id)}`, {
          method: "POST", body: JSON.stringify({ dueDate: correctedDate }),
        });
      }
      const verified = await asaasFetch(settings, `/payments/${encodeURIComponent(invoice.asaas_id)}`);
      if (verified.dueDate !== correctedDate) throw new Error("Asaas não confirmou o novo vencimento");
      const { error: updateError, data: updated } = await admin.from("subscription_invoices")
        .update({ due_date: correctedDate }).eq("id", invoice.id).in("status", ["pending", "overdue"])
        .select("id,due_date").maybeSingle();
      if (updateError || !updated) throw updateError || new Error("Fatura mudou de status durante a correção");
      if (invoice.due_date !== correctedDate) {
        const { error: auditError } = await admin.from("audit_logs").insert({
          user_id: user.id, owner_id: ownerAccount.user_id, user_email: user.email || "",
          user_name: "Administrador", action: "update", entity: "subscription_invoices", entity_id: invoice.id,
          details: { reason: "Correção do limite incorreto de 28 dias", previous_due_date: invoice.due_date, due_date: correctedDate, asaas_id: invoice.asaas_id },
        });
        if (auditError) throw auditError;
      }
      return json({ success: true, invoice_id: invoice.id, due_date: correctedDate, asaas_due_date: verified.dueDate });
    }
    if (action !== undefined) return json({ error: "Ação inválida" }, 400);

    if (!client_account_id || !due_date || !reference_month) {
      return json({ error: "Dados incompletos" }, 400);
    }

    const { data: account, error: accErr } = await admin
      .from("client_accounts")
      .select("*, subscription_plans(id, name, monthly_value)")
      .eq("id", client_account_id)
      .maybeSingle();

    if (accErr || !account) return json({ error: "Conta não encontrada" }, 404);

    const isFreePlan = account.subscription_plans?.tier === "free" || 
                      account.plan?.toLowerCase().includes("free") ||
                      account.subscription_plans?.name?.toLowerCase().includes("free") ||
                      account.subscription_plans?.name?.toLowerCase().includes("gratuito") ||
                      account.plan?.toLowerCase().includes("gratuito");

    if (isFreePlan) {
      return json({ error: "Não é possível emitir cobrança para contas no plano Free." }, 400);
    }

    let amount = Number(custom_amount ?? account.subscription_plans?.monthly_value ?? account.monthly_value);
    const planName = account.subscription_plans?.name ?? account.plan ?? "Mensalidade";

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
    const existing = customers?.data?.[0];
    if (existing) {
      asaasCustomerId = existing.id;
      // Garante que o cliente já existente no Asaas tenha o documento correto
      if (onlyDigits(existing.cpfCnpj || "") !== document) {
        await asaasFetch(settings, `/customers/${asaasCustomerId}`, {
          method: "POST",
          body: JSON.stringify({ name: account.name, email: account.email, cpfCnpj: document }),
        });
      }
    }

    if (!asaasCustomerId) {
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
        payment_link: payment.invoiceUrl || payment.bankSlipUrl || payment.pixCopyPaste,
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
