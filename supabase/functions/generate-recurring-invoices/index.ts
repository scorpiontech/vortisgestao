import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { asaasFetch } from "../_shared/asaas.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MONTHS_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function computeNextDueDate(dueDay: number, today: Date): Date {
  const year = today.getFullYear();
  const month = today.getMonth();
  const day = Math.min(Math.max(dueDay || 10, 1), 28);

  // próxima data >= hoje
  let candidate = new Date(year, month, day);
  if (candidate < new Date(year, month, today.getDate())) {
    candidate = new Date(year, month + 1, day);
  }
  return candidate;
}

function referenceMonthLabel(d: Date): string {
  return `${MONTHS_PT[d.getMonth()]} de ${d.getFullYear()}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Configuração do Asaas administrativo: primeiro a tela Painel Admin > Asaas Admin
    // (asaas_settings do usuário admin), depois o secret global como fallback.
    let settings: { api_key: string; ambiente: string } | null = null;

    const { data: admins } = await supabase.from("user_roles").select("user_id").eq("role", "admin");
    const adminIds = (admins || []).map((a: any) => a.user_id);
    if (adminIds.length) {
      const { data: adminSettings } = await supabase
        .from("asaas_settings")
        .select("api_key, ambiente, active")
        .in("owner_id", adminIds)
        .eq("active", true)
        .limit(1)
        .maybeSingle();
      if (adminSettings?.api_key) {
        settings = { api_key: adminSettings.api_key, ambiente: adminSettings.ambiente || "sandbox" };
      }
    }

    if (!settings) {
      const asaasKey = Deno.env.get("ASAAS_ADMIN_KEY");
      if (asaasKey) settings = { api_key: asaasKey, ambiente: Deno.env.get("ASAAS_ADMIN_ENV") || "sandbox" };
    }

    if (!settings) {
      return new Response(JSON.stringify({
        error: "Integração Asaas não configurada. Acesse Painel Administrativo > Asaas Admin e informe a chave de API.",
      }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }



    // Refinamento SQL para buscar apenas planos pagantes (tier pro)
    const { data: accounts, error: accErr } = await supabase
      .from("client_accounts")
      .select("*, subscription_plans!inner(id, name, monthly_value, tier)")
      .eq("status", "ativo")
      .eq("blocked", false)
      .neq("subscription_plans.tier", "free");

    if (accErr) throw accErr;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const summary = { generated: 0, skipped: 0, errors: [] as string[] };

    for (const acc of accounts || []) {
      const isFree = acc.subscription_plans?.tier === "free" || 
                     acc.plan?.toLowerCase().includes("free") ||
                     acc.subscription_plans?.name?.toLowerCase().includes("free") ||
                     acc.subscription_plans?.name?.toLowerCase().includes("gratuito");
      
      if (isFree) {
        summary.skipped++;
        continue;
      }

      try {
        const dueDate = computeNextDueDate(acc.due_day || 10, today);
        const daysUntil = Math.floor((dueDate.getTime() - today.getTime()) / 86400000);

        if (daysUntil > 10) { summary.skipped++; continue; }

        const refMonth = referenceMonthLabel(dueDate);

        // Idempotência: verifica se já existe fatura
        const { data: existing } = await supabase
          .from("subscription_invoices")
          .select("id")
          .eq("client_account_id", acc.id)
          .eq("reference_month", refMonth)
          .maybeSingle();

        if (existing) { summary.skipped++; continue; }

        // Valor SEMPRE vindo do plano Pro configurado (nunca de valores padrão da conta)
        const planValue = Number(acc.subscription_plans?.monthly_value);
        let amount = planValue;

        if (!acc.plan_id || !acc.subscription_plans?.id || !Number.isFinite(planValue) || planValue <= 0) {
          console.warn(`[gen] Conta ${acc.id} sem plano pago válido — emissão bloqueada`);
          summary.skipped++;
          continue;
        }


        amount = Math.round(amount * 100) / 100;

        const planName = acc.subscription_plans?.name ?? acc.plan ?? "Mensalidade";
        const dueDateStr = dueDate.toISOString().slice(0, 10);

        let document = acc.document || "";
        if (!document) {
          const { data: fSettings } = await supabase.from("fiscal_settings").select("cnpj").eq("owner_id", acc.user_id).maybeSingle();
          if (fSettings?.cnpj) document = fSettings.cnpj;
        }
        document = document.replace(/\D/g, "");

        if (!document || (document.length !== 11 && document.length !== 14)) {
          summary.errors.push(`${acc.name}: sem documento válido`);
          continue;
        }

        let asaasCustomerId: string | null = null;
        let payment: any = null;
        try {
          const customers = await asaasFetch(settings, `/customers?email=${encodeURIComponent(acc.email)}&limit=1`);
          const existing = customers?.data?.[0];
          if (existing) {
            asaasCustomerId = existing.id;
          } else {
            const created = await asaasFetch(settings, "/customers", {
              method: "POST",
              body: JSON.stringify({
                name: acc.name,
                email: acc.email,
                cpfCnpj: document,
                externalReference: acc.id,
              }),
            });
            asaasCustomerId = created.id;
          }

          payment = await asaasFetch(settings, "/payments", {
            method: "POST",
            body: JSON.stringify({
              customer: asaasCustomerId,
              billingType: "UNDEFINED",
              dueDate: dueDateStr,
              value: amount,
              description: `${planName} - ${refMonth}`,
              externalReference: acc.id,
            }),
          });

        } catch (asaasErr) {
          const msg = (asaasErr as Error).message;
          console.error(`[gen] Asaas error acc=${acc.id} name=${acc.name}:`, msg);
          await supabase.from("invoice_generation_logs").insert({
            client_account_id: acc.id,
            client_name: acc.name || "",
            reference_month: refMonth,
            amount,
            status: "error",
            error_message: `Falha ao gerar cobrança no Asaas: ${msg}`,
            error_details: { stage: "asaas_integration", error: msg },
            source: "auto",
          });
          summary.errors.push(`${acc.name}: ${msg}`);
          continue;
        }


        const { data: insertedInv, error: invErr } = await supabase.from("subscription_invoices").insert({
          client_account_id: acc.id,
          plan_id: acc.plan_id,
          amount,
          due_date: dueDateStr,
          status: "pending",
          asaas_id: payment.id,
          payment_link: payment.invoiceUrl || payment.bankSlipUrl || payment.pixCopyPaste,
          reference_month: refMonth,
        }).select().single();

        if (invErr) {
          console.error(`[gen] DB insert error acc=${acc.id}:`, invErr.message);
          await supabase.from("invoice_generation_logs").insert({
            client_account_id: acc.id,
            client_name: acc.name || "",
            reference_month: refMonth,
            amount,
            status: "error",
            error_message: `Cobrança criada no Asaas, mas falhou ao salvar fatura: ${invErr.message}`,
            error_details: { stage: "db_insert", asaas_id: payment.id, db_error: invErr.message },
            source: "auto",
          });
          summary.errors.push(`${acc.name}: ${invErr.message}`);
          continue;
        }

        await supabase.from("invoice_generation_logs").insert({
          client_account_id: acc.id,
          client_name: acc.name || "",
          reference_month: refMonth,
          amount,
          status: "success",
          error_message: "",
          error_details: { asaas_id: payment.id, due_date: dueDateStr },
          source: "auto",
          acknowledged: true,
        });

        summary.generated++;
        console.log(`[gen] fatura criada acc=${acc.id} ref=${refMonth} due=${dueDateStr}`);
      } catch (e) {
        const msg = (e as Error).message;
        console.error(`[gen] unexpected error acc=${acc.id}:`, msg);
        await supabase.from("invoice_generation_logs").insert({
          client_account_id: acc.id,
          client_name: acc.name || "",
          reference_month: "",
          amount: 0,
          status: "error",
          error_message: `Erro inesperado: ${msg}`,
          error_details: { stage: "unexpected", error: msg },
          source: "auto",
        });
        summary.errors.push(`${acc.name || acc.id}: ${msg}`);
      }
    }

    return new Response(JSON.stringify({ ok: true, ...summary }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
