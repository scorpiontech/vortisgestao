// Baixa de cobranças Asaas: liquida parcela, contas a receber e finaliza a venda do PDV
export async function applyPaidInstallment(admin: any, paymentId: string, paidDate?: string) {
  const { data: inst } = await admin
    .from("customer_charge_installments")
    .select("*")
    .eq("asaas_payment_id", paymentId)
    .maybeSingle();

  if (!inst) return { ok: false, reason: "installment_not_found" };

  const { data: charge } = await admin
    .from("customer_charges")
    .select("*")
    .eq("id", inst.charge_id)
    .maybeSingle();

  if (!charge) return { ok: false, reason: "charge_not_found" };

  const paidAt = paidDate ? new Date(paidDate + "T12:00:00").toISOString() : new Date().toISOString();

  if (inst.status !== "paid") {
    await admin
      .from("customer_charge_installments")
      .update({ status: "paid", paid_at: paidAt })
      .eq("id", inst.id);

    if (inst.bill_id) {
      await admin.from("bills").update({ paid: true, paid_at: paidAt }).eq("id", inst.bill_id);
    }

    await admin.from("transactions").insert({
      user_id: charge.owner_id,
      type: "entrada",
      description: `${charge.description || "Cobrança"} - ${charge.customer_name}` +
        (charge.installment_count > 1 ? ` (${inst.installment_number}/${charge.installment_count})` : ""),
      amount: Number(inst.amount),
      category: charge.source === "pdv" ? "Vendas" : "Cobranças",
      payment_method: charge.billing_type === "PIX" ? "PIX" : "Boleto",
    });
  }

  // Recalcula status da cobrança
  const { data: allInst } = await admin
    .from("customer_charge_installments")
    .select("status")
    .eq("charge_id", charge.id);

  const total = (allInst || []).length;
  const paidCount = (allInst || []).filter((i: any) => i.status === "paid").length;
  const chargeUpdate: Record<string, unknown> = {
    status: paidCount >= total ? "paid" : "partially_paid",
  };
  if (paidCount >= total) chargeUpdate.paid_at = paidAt;

  // Finaliza a venda do PDV na primeira confirmação de pagamento
  if (charge.source === "pdv" && !charge.finalized_at) {
    const items: any[] = Array.isArray(charge.items) ? charge.items : [];

    const { data: sale } = await admin
      .from("sales")
      .insert({
        user_id: charge.owner_id,
        customer_name: charge.customer_name || null,
        payment_method: charge.payment_method || (charge.billing_type === "PIX" ? "PIX" : "Boleto"),
        total: Number(charge.total_amount),
        discount: Number(charge.discount || 0),
        installments: charge.installment_count || 1,
      })
      .select("id")
      .single();

    if (sale) {
      if (items.length) {
        await admin.from("sale_items").insert(
          items.map((i) => ({
            sale_id: sale.id,
            product_id: i.product_id ?? null,
            product_name: i.product_name,
            quantity: Math.max(1, Math.floor(Number(i.quantity) || 1)),
            unit_price: Number(i.unit_price),
            total: Number(i.total),
          })),
        );

        for (const i of items) {
          if (!i.product_id) continue;
          const { data: prod } = await admin
            .from("products")
            .select("stock")
            .eq("id", i.product_id)
            .maybeSingle();
          if (prod) {
            await admin
              .from("products")
              .update({ stock: Math.max(0, Number(prod.stock) - Number(i.quantity)) })
              .eq("id", i.product_id);
          }
        }
      }
      chargeUpdate.sale_id = sale.id;
      chargeUpdate.finalized_at = paidAt;
    }
  }

  await admin.from("customer_charges").update(chargeUpdate).eq("id", charge.id);

  // Envia notificações para o PDV e Financeiro
  const paymentLink = `https://www.asaas.com/payment/${paymentId}/view`;
  
  if (charge.source === "pdv") {
    await admin.from("notifications").insert({
      owner_id: charge.owner_id,
      title: "Pagamento PDV Recebido",
      message: `O pagamento da venda de ${charge.customer_name} via ${charge.billing_type} foi confirmado.`,
      type: "pdv",
      link: paymentLink
    });
  }

  await admin.from("notifications").insert({
    owner_id: charge.owner_id,
    title: "Cobrança Recebida",
    message: `Recebimento de ${charge.customer_name} confirmado no valor de R$ ${Number(inst.amount).toFixed(2)}.`,
    type: "financeiro",
    link: "/financeiro/contas-receber" // Ou link direto se houver página de detalhes
  });

  return { ok: true, charge_id: charge.id };
}
