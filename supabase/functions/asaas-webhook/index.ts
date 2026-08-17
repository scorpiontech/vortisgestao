import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { asaasCors, json } from "../_shared/asaas.ts";
import { applyPaidInstallment } from "../_shared/asaas-settle.ts";

const PAID_EVENTS = ["PAYMENT_RECEIVED", "PAYMENT_CONFIRMED"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: asaasCors });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json();
    const event: string = body?.event || "";
    const payment = body?.payment;
    
    // Log do webhook para auditoria
    await admin.from("asaas_webhook_logs").insert({
      event,
      payment_id: payment?.id,
      payload: body,
      status: "received"
    });

    if (!payment?.id) return json({ received: true, ignored: "no_payment" });

    console.log(`[asaas-webhook] event=${event} payment=${payment.id} status=${payment.status}`);

    // 1) Check if it's a customer charge (B2C)
    const { data: inst } = await admin
      .from("customer_charge_installments")
      .select("id, owner_id, charge_id")
      .eq("asaas_payment_id", payment.id)
      .maybeSingle();

    if (inst) {
      // Logic for customer charge (B2C)
      const token = req.headers.get("asaas-access-token") || "";
      const { data: settings } = await admin
        .from("asaas_settings")
        .select("webhook_token")
        .eq("owner_id", inst.owner_id)
        .maybeSingle();

      if (settings?.webhook_token && settings.webhook_token !== token) {
        console.warn("[asaas-webhook] token inválido para B2C");
        return json({ error: "Token inválido" }, 401);
      }

      if (PAID_EVENTS.includes(event)) {
        const result = await applyPaidInstallment(admin, payment.id, payment.paymentDate || payment.clientPaymentDate);
        return json({ received: true, result });
      }

      if (event === "PAYMENT_OVERDUE") {
        await admin.from("customer_charge_installments").update({ status: "overdue" }).eq("id", inst.id);
        await admin.from("customer_charges").update({ status: "overdue" }).eq("id", inst.charge_id).neq("status", "paid");
        return json({ received: true });
      }

      if (event === "PAYMENT_DELETED" || event === "PAYMENT_REFUNDED") {
        await admin.from("customer_charge_installments").update({ status: "cancelled" }).eq("id", inst.id);
        return json({ received: true });
      }
    }

    // 2) Check if it's a subscription invoice (B2B - Admin)
    const { data: subInvoice } = await admin
      .from("subscription_invoices")
      .select("id, client_account_id")
      .eq("asaas_id", payment.id)
      .maybeSingle();

    if (subInvoice) {
      // Verify admin webhook token if defined in env
      const adminToken = Deno.env.get("ASAAS_ADMIN_WEBHOOK_TOKEN");
      const receivedToken = req.headers.get("asaas-access-token") || "";
      
      if (adminToken && adminToken !== receivedToken) {
        console.warn("[asaas-webhook] token inválido para B2B admin");
        return json({ error: "Token inválido" }, 401);
      }

      if (PAID_EVENTS.includes(event)) {
        await admin.from("subscription_invoices").update({
          status: "paid",
          paid_at: new Date().toISOString()
        }).eq("id", subInvoice.id);

        // Update account status if paid
        await admin.from("client_accounts").update({
          status: "ativo",
          blocked: false,
          blocked_at: null
        }).eq("id", subInvoice.client_account_id);

        return json({ received: true, type: "b2b_paid" });
      }

      if (event === "PAYMENT_OVERDUE") {
        await admin.from("subscription_invoices").update({ status: "overdue" }).eq("id", subInvoice.id);
        return json({ received: true, type: "b2b_overdue" });
      }
    }

    if (!inst && !subInvoice) return json({ received: true, ignored: "unknown_payment" });

    return json({ received: true, ignored: event });
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : "Erro inesperado";
    console.error("[asaas-webhook]", e);
    
    try {
      await admin.from("asaas_webhook_logs").insert({
        status: "error",
        error_message: errorMsg
      });
    } catch (logErr) {
      console.error("[asaas-webhook] falha ao logar erro:", logErr);
    }

    return json({ error: errorMsg }, 500);
  }
});
