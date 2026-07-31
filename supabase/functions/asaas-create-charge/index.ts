import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { asaasCors, asaasFetch, json, onlyDigits } from "../_shared/asaas.ts";

interface Body {
  customer_id?: string | null;
  customer_name?: string;
  customer_document?: string;
  customer_email?: string;
  customer_phone?: string;
  description?: string;
  billing_type?: "BOLETO" | "PIX";
  total_amount?: number;
  installment_count?: number;
  due_date?: string;
  source?: "manual" | "pdv" | "bill";
  bill_id?: string | null;
  items?: Array<{
    product_id: string | null;
    product_name: string;
    quantity: number;
    unit_price: number;
    total: number;
  }>;
  discount?: number;
  payment_method?: string;
  create_receivables?: boolean;
}

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

    const { data: settings } = await admin
      .from("asaas_settings")
      .select("*")
      .eq("owner_id", ownerId)
      .maybeSingle();

    if (!settings || !settings.api_key || !settings.active) {
      return json({ error: "Integração Asaas não configurada. Cadastre a chave de API em Configurações > Cobranças (Asaas)." }, 400);
    }

    const body = (await req.json()) as Body;

    const billingType = body.billing_type === "PIX" ? "PIX" : "BOLETO";
    const amount = Math.round(Number(body.total_amount || 0) * 100) / 100;
    const installmentCount = Math.max(1, Math.floor(Number(body.installment_count || 1)));
    const source = body.source || "manual";

    if (!amount || amount <= 0) return json({ error: "Informe um valor válido" }, 400);
    if (amount < 5) return json({ error: "O valor mínimo aceito pelo Asaas é R$ 5,00" }, 400);

    let customerName = (body.customer_name || "").trim();
    let document = onlyDigits(body.customer_document || "");
    let email = (body.customer_email || "").trim();
    let phone = onlyDigits(body.customer_phone || "");

    // Completa dados a partir do cadastro de clientes
    if (body.customer_id) {
      const { data: c } = await admin
        .from("customers")
        .select("name, document, email, phone")
        .eq("id", body.customer_id)
        .eq("user_id", ownerId)
        .maybeSingle();
      if (c) {
        customerName = customerName || c.name || "";
        document = document || onlyDigits(c.document || "");
        email = email || c.email || "";
        phone = phone || onlyDigits(c.phone || "");
      }
    }

    if (!customerName) return json({ error: "Informe o nome do cliente" }, 400);
    if (document.length !== 11 && document.length !== 14) {
      return json({ error: "Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido para o cliente" }, 400);
    }

    // 1) Cliente no Asaas (busca por documento, cria se não existir)
    let asaasCustomerId: string | null = null;
    const found = await asaasFetch(settings, `/customers?cpfCnpj=${document}&limit=1`);
    if (found?.data?.length) asaasCustomerId = found.data[0].id;

    if (!asaasCustomerId) {
      const created = await asaasFetch(settings, "/customers", {
        method: "POST",
        body: JSON.stringify({
          name: customerName,
          cpfCnpj: document,
          email: email || undefined,
          mobilePhone: phone || undefined,
          externalReference: body.customer_id || undefined,
        }),
      });
      asaasCustomerId = created.id;
    }

    // 2) Cobrança
    const dueDate = body.due_date ||
      new Date(Date.now() + (settings.boleto_days || 5) * 86400000).toISOString().slice(0, 10);
    const description = (body.description || "Cobrança").slice(0, 500);

    const paymentPayload: Record<string, unknown> = {
      customer: asaasCustomerId,
      billingType,
      dueDate,
      description,
    };
    if (installmentCount > 1) {
      paymentPayload.installmentCount = installmentCount;
      paymentPayload.totalValue = amount;
    } else {
      paymentPayload.value = amount;
    }

    const payment = await asaasFetch(settings, "/payments", {
      method: "POST",
      body: JSON.stringify(paymentPayload),
    });

    // 3) Lista de parcelas geradas
    let payments: any[] = [payment];
    if (installmentCount > 1 && payment.installment) {
      const list = await asaasFetch(settings, `/payments?installment=${payment.installment}&limit=100`);
      if (list?.data?.length) {
        payments = list.data.sort((a: any, b: any) => String(a.dueDate).localeCompare(String(b.dueDate)));
      }
    }

    // 4) QR Code PIX quando aplicável
    const pixByPayment: Record<string, { payload?: string; image?: string }> = {};
    if (billingType === "PIX") {
      for (const p of payments) {
        try {
          const qr = await asaasFetch(settings, `/payments/${p.id}/pixQrCode`);
          pixByPayment[p.id] = { payload: qr?.payload, image: qr?.encodedImage };
        } catch (e) {
          console.error("Falha ao obter QR Code PIX", e);
        }
      }
    }

    // 5) Persiste cobrança
    const { data: charge, error: chargeErr } = await admin
      .from("customer_charges")
      .insert({
        owner_id: ownerId,
        created_by: user.id,
        provider: "asaas",
        source,
        customer_id: body.customer_id || null,
        customer_name: customerName,
        customer_document: document,
        customer_email: email,
        customer_phone: phone,
        asaas_customer_id: asaasCustomerId,
        asaas_installment_id: payment.installment || null,
        description,
        billing_type: billingType,
        total_amount: amount,
        installment_count: installmentCount,
        status: "pending",
        ambiente: settings.ambiente,
        bill_id: body.bill_id || null,
        items: body.items || [],
        discount: Number(body.discount || 0),
        payment_method: body.payment_method || (billingType === "PIX" ? "PIX" : "Boleto"),
      })
      .select()
      .single();

    if (chargeErr || !charge) {
      console.error(chargeErr);
      return json({ error: "Cobrança criada no Asaas, mas houve erro ao salvar localmente: " + chargeErr?.message }, 500);
    }

    const createReceivables = body.create_receivables !== false && source !== "bill";

    const installmentRows: any[] = [];
    for (let i = 0; i < payments.length; i++) {
      const p = payments[i];
      let billId: string | null = body.bill_id || null;

      if (createReceivables) {
        const { data: bill } = await admin
          .from("bills")
          .insert({
            user_id: ownerId,
            type: "receber",
            description: payments.length > 1
              ? `${description} (${i + 1}/${payments.length}) - ${customerName}`
              : `${description} - ${customerName}`,
            amount: Number(p.value),
            due_date: p.dueDate,
            payment_method: billingType === "PIX" ? "PIX" : "Boleto",
            paid: false,
            charge_id: charge.id,
            customer_id: body.customer_id || null,
          })
          .select("id")
          .single();
        billId = bill?.id || null;
      }

      installmentRows.push({
        charge_id: charge.id,
        owner_id: ownerId,
        installment_number: i + 1,
        amount: Number(p.value),
        due_date: p.dueDate,
        status: "pending",
        asaas_payment_id: p.id,
        invoice_url: p.invoiceUrl || null,
        bank_slip_url: p.bankSlipUrl || null,
        barcode: p.identificationField || p.nossoNumero || null,
        pix_payload: pixByPayment[p.id]?.payload || null,
        pix_qrcode_image: pixByPayment[p.id]?.image || null,
        bill_id: billId,
      });
    }

    const { data: inserted, error: instErr } = await admin
      .from("customer_charge_installments")
      .insert(installmentRows)
      .select();

    if (instErr) console.error(instErr);

    if (body.bill_id) {
      await admin.from("bills").update({ charge_id: charge.id }).eq("id", body.bill_id);
    }

    return json({ charge, installments: inserted || [] });
  } catch (e) {
    console.error("[asaas-create-charge]", e);
    return json({ error: e instanceof Error ? e.message : "Erro inesperado" }, 500);
  }
});
