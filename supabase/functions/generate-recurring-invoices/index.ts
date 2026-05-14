import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

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
    const mpToken = Deno.env.get("MP_ACCESS_TOKEN");
    if (!mpToken) {
      return new Response(JSON.stringify({ error: "MP_ACCESS_TOKEN não configurado" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey);
    const isTestToken = mpToken.startsWith("TEST-");

    const { data: accounts, error: accErr } = await supabase
      .from("client_accounts")
      .select("*, subscription_plans(id, name, monthly_value)")
      .eq("status", "ativo")
      .eq("blocked", false);

    if (accErr) throw accErr;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const summary = { generated: 0, skipped: 0, errors: [] as string[] };

    for (const acc of accounts || []) {
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

        let amount = Number(acc.subscription_plans?.monthly_value ?? acc.monthly_value);
        if (amount < 5) amount = 5;
        amount = Math.round(amount * 100) / 100;

        const planName = acc.subscription_plans?.name ?? acc.plan ?? "Mensalidade";
        const dueDateStr = dueDate.toISOString().slice(0, 10);

        const preferencePayload = {
          items: [{
            id: String(acc.id).slice(0, 12),
            title: `${planName} - ${refMonth}`.slice(0, 250),
            description: `Mensalidade ${planName}`.slice(0, 250),
            category_id: "services",
            quantity: 1,
            currency_id: "BRL",
            unit_price: amount,
          }],
          external_reference: `${acc.id}|${refMonth}`,
          notification_url: `${supabaseUrl}/functions/v1/mp-webhook`,
          statement_descriptor: "VORTISGESTAO",
          back_urls: {
            success: "https://vortisgestao.lovable.app/cobrancas",
            pending: "https://vortisgestao.lovable.app/cobrancas",
            failure: "https://vortisgestao.lovable.app/cobrancas",
          },
          payment_methods: { installments: 12 },
          binary_mode: false,
        };

        let mpRes: Response;
        let mpData: any;
        try {
          mpRes = await fetch("https://api.mercadopago.com/checkout/preferences", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${mpToken}`,
              "Content-Type": "application/json",
              "X-Idempotency-Key": `${acc.id}-${refMonth}-auto`,
            },
            body: JSON.stringify(preferencePayload),
          });
          mpData = await mpRes.json();
        } catch (fetchErr) {
          const msg = (fetchErr as Error).message;
          console.error(`[gen] MP fetch failed acc=${acc.id} name=${acc.name}:`, msg);
          await supabase.from("invoice_generation_logs").insert({
            client_account_id: acc.id,
            client_name: acc.name || "",
            reference_month: refMonth,
            amount,
            status: "error",
            error_message: `Falha de rede ao contatar Mercado Pago: ${msg}`,
            error_details: { stage: "mp_fetch", error: msg },
            source: "auto",
          });
          summary.errors.push(`${acc.name}: falha de rede`);
          continue;
        }

        if (!mpRes.ok) {
          const errMsg = mpData?.message || mpData?.error || `HTTP ${mpRes.status}`;
          console.error(`[gen] MP error acc=${acc.id} name=${acc.name} status=${mpRes.status}:`, JSON.stringify(mpData));
          await supabase.from("invoice_generation_logs").insert({
            client_account_id: acc.id,
            client_name: acc.name || "",
            reference_month: refMonth,
            amount,
            status: "error",
            error_message: `Mercado Pago rejeitou a criação da preferência: ${errMsg}`,
            error_details: {
              stage: "mp_create_preference",
              http_status: mpRes.status,
              mp_response: mpData,
              mp_cause: mpData?.cause,
            },
            source: "auto",
          });
          summary.errors.push(`${acc.name}: ${errMsg}`);
          continue;
        }

        const checkoutUrl = isTestToken ? mpData.sandbox_init_point : mpData.init_point;

        const { data: insertedInv, error: invErr } = await supabase.from("subscription_invoices").insert({
          client_account_id: acc.id,
          plan_id: acc.plan_id,
          amount,
          due_date: dueDateStr,
          status: "pending",
          mp_preference_id: mpData.id,
          payment_link: checkoutUrl,
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
            error_message: `Preferência criada no MP, mas falhou ao salvar fatura: ${invErr.message}`,
            error_details: { stage: "db_insert", mp_preference_id: mpData.id, db_error: invErr.message },
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
          error_details: { mp_preference_id: mpData.id, due_date: dueDateStr },
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
