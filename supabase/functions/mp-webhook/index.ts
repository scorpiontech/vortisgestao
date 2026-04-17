import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-signature, x-request-id",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const mpToken = Deno.env.get("MP_ACCESS_TOKEN")!;
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const body = await req.json();
    console.log("MP Webhook received:", JSON.stringify(body));

    // MP envia { type: "payment", data: { id: "..." } }
    if (body.type !== "payment" || !body.data?.id) {
      return new Response(JSON.stringify({ ok: true, ignored: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const paymentId = body.data.id;

    // busca detalhes do pagamento
    const payRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { "Authorization": `Bearer ${mpToken}` },
    });
    const payment = await payRes.json();
    if (!payRes.ok) {
      console.error("Falha ao buscar pagamento:", payment);
      return new Response(JSON.stringify({ error: "MP fetch failed" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const externalRef: string = payment.external_reference || "";
    const [clientAccountId, referenceMonth] = externalRef.split("|");

    if (!clientAccountId) {
      console.log("Sem external_reference, ignorando");
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // localiza fatura pelo preference_id ou ref
    const prefId = payment.order?.id || payment.preference_id;
    let invoiceQuery = supabase.from("subscription_invoices").select("*").eq("client_account_id", clientAccountId);
    if (referenceMonth) invoiceQuery = invoiceQuery.eq("reference_month", referenceMonth);

    const { data: invoices } = await invoiceQuery.order("created_at", { ascending: false }).limit(1);
    const invoice = invoices?.[0];

    if (!invoice) {
      console.log("Fatura não encontrada para", externalRef);
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let newStatus = "pending";
    if (payment.status === "approved") newStatus = "paid";
    else if (payment.status === "rejected" || payment.status === "cancelled") newStatus = "failed";
    else if (payment.status === "in_process" || payment.status === "pending") newStatus = "pending";

    const updateData: Record<string, unknown> = {
      status: newStatus,
      mp_payment_id: String(paymentId),
    };
    if (newStatus === "paid") {
      updateData.paid_at = new Date().toISOString();
    }

    await supabase.from("subscription_invoices").update(updateData).eq("id", invoice.id);

    // se pago: desbloqueia conta
    if (newStatus === "paid") {
      await supabase.from("client_accounts").update({ blocked: false, blocked_at: null, status: "ativo" }).eq("id", clientAccountId);
    }

    return new Response(JSON.stringify({ ok: true, status: newStatus }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("Webhook error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
