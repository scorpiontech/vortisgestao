import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { asaasCors, asaasFetch, json } from "../_shared/asaas.ts";
import { applyPaidInstallment } from "../_shared/asaas-settle.ts";

const PAID_STATUS = ["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"];

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

    const { data: ownerId } = await admin.rpc("get_effective_user_id", { _user_id: user.id });
    if (!ownerId) return json({ error: "Empresa não identificada" }, 400);

    // Validação de acesso ao módulo (Plano Pro requerido)
    const { data: accountData } = await admin
      .from("client_accounts")
      .select("subscription_plans(tier)")
      .eq("user_id", ownerId)
      .maybeSingle();
    
    const tier = (accountData as any)?.subscription_plans?.tier;
    if (!tier?.startsWith("pro") && tier !== "pro_custom") {
      return json({ error: "Módulo restrito ao Plano Pro. Entre em contato com o suporte para realizar o upgrade." }, 403);
    }
    const { charge_id, action } = await req.json();
    if (!charge_id) return json({ error: "charge_id obrigatório" }, 400);

    const { data: charge } = await admin
      .from("customer_charges")
      .select("*")
      .eq("id", charge_id)
      .eq("owner_id", ownerId)
      .maybeSingle();
    if (!charge) return json({ error: "Cobrança não encontrada" }, 404);

    const { data: settings } = await admin
      .from("asaas_settings")
      .select("*")
      .eq("owner_id", ownerId)
      .maybeSingle();
    if (!settings?.api_key) return json({ error: "Integração Asaas não configurada" }, 400);

    const { data: installments } = await admin
      .from("customer_charge_installments")
      .select("*")
      .eq("charge_id", charge_id)
      .order("installment_number");

    // ===== Cancelamento =====
    if (action === "cancel") {
      const { data: chargeData } = await admin.from("customer_charges").select("sale_id, source, items").eq("id", charge_id).single();
      
      for (const inst of installments || []) {
        if (inst.status === "paid" || !inst.asaas_payment_id) {
          // Se já estiver pago, talvez queira estornar? Por enquanto, cancelamos apenas pendentes no Asaas.
          continue;
        }
        try {
          await asaasFetch(settings, `/payments/${inst.asaas_payment_id}`, { method: "DELETE" });
        } catch (e) {
          console.error("Falha ao cancelar parcela", inst.asaas_payment_id, e);
        }
        await admin.from("customer_charge_installments").update({ status: "cancelled" }).eq("id", inst.id);
        if (inst.bill_id) await admin.from("bills").delete().eq("id", inst.bill_id).eq("paid", false);
      }

      // Estorno de Venda (PDV)
      if (chargeData?.sale_id && chargeData?.source === "pdv") {
        // Remove transações de entrada vinculadas
        await admin.from("transactions").delete().eq("user_id", ownerId).eq("description", `${charge.description || "Cobrança"} - ${charge.customer_name}`).eq("category", "Vendas");
        
        // Estorna estoque
        const items = chargeData.items || [];
        for (const i of items) {
          if (!i.product_id) continue;
          const { data: prod } = await admin.from("products").select("stock").eq("id", i.product_id).maybeSingle();
          if (prod) {
            await admin.from("products").update({ stock: Number(prod.stock) + Number(i.quantity) }).eq("id", i.product_id);
          }
        }
        
        // Remove os itens da venda e a venda em si
        await admin.from("sale_items").delete().eq("sale_id", chargeData.sale_id);
        await admin.from("sales").delete().eq("id", chargeData.sale_id);
      }

      await admin
        .from("customer_charges")
        .update({ status: "cancelled", cancelled_at: new Date().toISOString(), sale_id: null, finalized_at: null })
        .eq("id", charge_id);
        
      return json({ cancelled: true });
    }

    // ===== Sincronização de status =====
    const results: any[] = [];
    for (const inst of installments || []) {
      if (!inst.asaas_payment_id) continue;
      const p = await asaasFetch(settings, `/payments/${inst.asaas_payment_id}`);
      const update: Record<string, unknown> = {
        invoice_url: p.invoiceUrl || inst.invoice_url,
        bank_slip_url: p.bankSlipUrl || inst.bank_slip_url,
      };
      if (PAID_STATUS.includes(p.status)) {
        await applyPaidInstallment(admin, inst.asaas_payment_id, p.paymentDate || p.clientPaymentDate);
      } else if (p.status === "OVERDUE") {
        update.status = "overdue";
      } else if (p.status === "DELETED" || p.status === "REFUNDED") {
        update.status = "cancelled";
      }
      await admin.from("customer_charge_installments").update(update).eq("id", inst.id);
      results.push({ installment: inst.installment_number, status: p.status });
    }

    const { data: fresh } = await admin
      .from("customer_charge_installments")
      .select("status")
      .eq("charge_id", charge_id);
    const total = (fresh || []).length;
    const paid = (fresh || []).filter((i: any) => i.status === "paid").length;
    const overdue = (fresh || []).some((i: any) => i.status === "overdue");
    let status = charge.status;
    if (paid >= total && total > 0) status = "paid";
    else if (paid > 0) status = "partially_paid";
    else if (overdue) status = "overdue";
    await admin.from("customer_charges").update({ status }).eq("id", charge_id);

    return json({ synced: true, status, results });
  } catch (e) {
    console.error("[asaas-sync-charge]", e);
    return json({ error: e instanceof Error ? e.message : "Erro inesperado" }, 500);
  }
});
