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
    if (!payment?.id) return json({ received: true, ignored: "no_payment" });

    console.log(`[asaas-webhook] event=${event} payment=${payment.id} status=${payment.status}`);

    const { data: inst } = await admin
      .from("customer_charge_installments")
      .select("id, owner_id, charge_id")
      .eq("asaas_payment_id", payment.id)
      .maybeSingle();

    if (!inst) return json({ received: true, ignored: "unknown_payment" });

    // Valida o token do webhook configurado na empresa (quando definido)
    const token = req.headers.get("asaas-access-token") || "";
    const { data: settings } = await admin
      .from("asaas_settings")
      .select("webhook_token")
      .eq("owner_id", inst.owner_id)
      .maybeSingle();

    if (settings?.webhook_token && settings.webhook_token !== token) {
      console.warn("[asaas-webhook] token inválido");
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

    return json({ received: true, ignored: event });
  } catch (e) {
    console.error("[asaas-webhook]", e);
    return json({ error: e instanceof Error ? e.message : "Erro inesperado" }, 500);
  }
});
