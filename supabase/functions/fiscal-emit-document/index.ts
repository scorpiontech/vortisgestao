import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function focusBaseUrl(ambiente: string) {
  return ambiente === "producao"
    ? "https://api.focusnfe.com.br"
    : "https://homologacao.focusnfe.com.br";
}

// Data/hora de emissão no formato exigido pela SEFAZ (horário de Brasília com offset -03:00).
// Enviar em UTC (sufixo Z) faz a SEFAZ interpretar a emissão 3h no futuro em relação ao
// horário de recebimento, gerando a rejeição "Data-Hora de Emissão posterior ao horário de recebimento".
function brtEmissionDateTime(input?: string) {
  // Base: se veio uma data do cliente respeita, senão usa "agora" menos 60s de margem
  const base = input ? new Date(input) : new Date(Date.now() - 60_000);
  // Converte para horário de Brasília (UTC-3, sem horário de verão desde 2019)
  const brt = new Date(base.getTime() - 3 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  const y = brt.getUTCFullYear();
  const mo = pad(brt.getUTCMonth() + 1);
  const d = pad(brt.getUTCDate());
  const h = pad(brt.getUTCHours());
  const mi = pad(brt.getUTCMinutes());
  const s = pad(brt.getUTCSeconds());
  return `${y}-${mo}-${d}T${h}:${mi}:${s}-03:00`;
}

// Build Focus NFe payload — same shape works for NF-e (55) and NFC-e (65)
function buildFocusPayload(doc: any, settings: any, numero: number) {
  const modelo = doc.modelo === "55" ? "55" : "65";
  const serie = modelo === "55" ? settings.serie_nfe : settings.serie_nfce;
  const items = (doc.items || []).map((it: any, idx: number) => ({
    numero_item: idx + 1,
    codigo_produto: it.codigo || it.product_id || String(idx + 1),
    descricao: it.descricao || it.name || "Item",
    cfop: it.cfop || settings.cfop_default || "5102",
    unidade_comercial: it.unidade || "UN",
    quantidade_comercial: Number(it.quantidade || 1),
    valor_unitario_comercial: Number(it.valor_unitario || 0),
    valor_unitario_tributavel: Number(it.valor_unitario || 0),
    unidade_tributavel: it.unidade || "UN",
    codigo_ncm: it.ncm || "00000000",
    quantidade_tributavel: Number(it.quantidade || 1),
    valor_bruto: Number(it.quantidade || 1) * Number(it.valor_unitario || 0),
    icms_origem: "0",
    icms_situacao_tributaria: settings.csosn_default || "102",
  }));

  const dest = doc.destinatario || null;
  const total_produtos = Number(doc.total_produtos || 0);
  const total_frete = Number(doc.total_frete || 0);
  const outras = Number(doc.outras_despesas || 0);
  const desconto = Number(doc.desconto || 0);
  const total_nota = Math.max(0, total_produtos + total_frete + outras - desconto);

  const payload: any = {
    natureza_operacao: doc.natureza_operacao || "Venda",
    data_emissao: brtEmissionDateTime(doc.data_emissao),
    tipo_documento: doc.tipo_documento || "1",
    finalidade_emissao: doc.finalidade || "1",
    consumidor_final: doc.consumidor_final || "1",
    presenca_comprador: doc.indicador_presenca || "0",
    modalidade_frete: doc.frete_modalidade || "9",
    numero,
    serie,
    local_destino: "1",
    cnpj_emitente: (settings.cnpj || "").replace(/\D/g, ""),
    items,
    valor_produtos: total_produtos,
    valor_frete: total_frete,
    valor_outras_despesas: outras,
    valor_desconto: desconto,
    valor_total: total_nota,
    formas_pagamento: (doc.payments || []).map((p: any) => ({
      forma_pagamento: p.forma || "01",
      valor_pagamento: Number(p.valor || 0),
    })),
    informacoes_adicionais_contribuinte: doc.informacoes_complementares || undefined,
    informacoes_adicionais_fisco: doc.informacoes_fisco || settings.informacoes_fisco || undefined,
  };

  if (modelo === "55" && dest) {
    payload.nome_destinatario = dest.nome;
    payload.cnpj_destinatario = dest.tipo === "cnpj" ? String(dest.documento || "").replace(/\D/g, "") : undefined;
    payload.cpf_destinatario = dest.tipo === "cpf" ? String(dest.documento || "").replace(/\D/g, "") : undefined;
    payload.email_destinatario = dest.email || undefined;
    payload.telefone_destinatario = dest.telefone || undefined;
    payload.logradouro_destinatario = dest.logradouro;
    payload.numero_destinatario = dest.numero;
    payload.bairro_destinatario = dest.bairro;
    payload.municipio_destinatario = dest.municipio;
    payload.uf_destinatario = dest.uf;
    payload.cep_destinatario = String(dest.cep || "").replace(/\D/g, "");
  }

  return { payload, modelo, total_nota };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json(401, { error: "Não autenticado" });

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json(401, { error: "Sessão inválida" });

    const body = await req.json();
    const { doc, preview } = body ?? {};
    if (!doc) return json(400, { error: "Documento é obrigatório" });

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Resolve effective owner (support vendedor)
    const { data: member } = await admin
      .from("company_members")
      .select("owner_id, role")
      .eq("user_id", user.id)
      .eq("active", true)
      .maybeSingle();
    const ownerId = member?.role === "vendedor" ? member.owner_id : user.id;

    // Quota check
    const { data: quotaData } = await admin.rpc("check_nfce_quota", { _owner_id: ownerId });
    if (quotaData && !(quotaData as any).allowed) {
      return json(403, { error: "Cota mensal de notas atingida. Faça upgrade do plano." });
    }

    const { data: settings } = await admin
      .from("fiscal_settings")
      .select("*")
      .eq("owner_id", ownerId)
      .maybeSingle();
    if (!settings) return json(400, { error: "Configurações fiscais não encontradas" });
    if (!settings.certificate_valid) return json(400, { error: "Certificado digital A1 inválido ou ausente" });
    if (!settings.provider_token) return json(400, { error: "Token do provedor fiscal não configurado" });

    const modelo = doc.modelo === "55" ? "55" : "65";
    const numero = modelo === "55" ? Number(settings.proximo_numero_nfe) : Number(settings.proximo_numero_nfce);

    const { payload, total_nota } = buildFocusPayload(doc, settings, numero);

    if (preview) {
      return json(200, { preview: true, numero, payload });
    }

    // Persist as pending first
    const ref = `${modelo}-${ownerId.substring(0, 8)}-${Date.now()}`;
    const { data: nf, error: insErr } = await admin.from("nfce_documents").insert({
      owner_id: ownerId,
      created_by: user.id,
      provider: settings.provider,
      provider_ref: ref,
      status: "pending",
      modelo,
      numero: String(numero),
      serie: modelo === "55" ? settings.serie_nfe : settings.serie_nfce,
      ambiente: settings.ambiente,
      natureza_operacao: doc.natureza_operacao || "Venda",
      finalidade: doc.finalidade || "1",
      tipo_documento: doc.tipo_documento || "1",
      consumidor_final: doc.consumidor_final || "1",
      indicador_presenca: doc.indicador_presenca || "0",
      data_emissao: doc.data_emissao || new Date().toISOString(),
      data_saida: doc.data_saida || null,
      movimenta_estoque: !!doc.movimenta_estoque,
      enviar_email: !!doc.enviar_email,
      chave_referencia: doc.chave_referencia || null,
      frete_modalidade: doc.frete_modalidade || "9",
      informacoes_complementares: doc.informacoes_complementares || null,
      informacoes_fisco: doc.informacoes_fisco || settings.informacoes_fisco,
      items: doc.items || [],
      payments: doc.payments || [],
      destinatario: doc.destinatario || null,
      total_produtos: Number(doc.total_produtos || 0),
      total_frete: Number(doc.total_frete || 0),
      outras_despesas: Number(doc.outras_despesas || 0),
      desconto: Number(doc.desconto || 0),
      total_pago: Number(doc.total_pago || 0),
      troco: Number(doc.troco || 0),
      valor_total: total_nota,
      customer_name: doc.destinatario?.nome ?? null,
      customer_doc: doc.destinatario?.documento ?? null,
      payload_request: payload,
    }).select().single();
    if (insErr || !nf) return json(500, { error: `Falha ao registrar documento: ${insErr?.message}` });

    // Call Focus NFe
    const endpoint = modelo === "55" ? "/v2/nfe" : "/v2/nfce";
    const url = `${focusBaseUrl(settings.ambiente)}${endpoint}?ref=${encodeURIComponent(ref)}`;
    const basic = btoa(`${settings.provider_token}:`);

    let providerResponse: any = null;
    let providerStatus = 0;
    try {
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Authorization": `Basic ${basic}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      providerStatus = resp.status;
      const text = await resp.text();
      try { providerResponse = JSON.parse(text); } catch { providerResponse = { raw: text }; }
    } catch (err) {
      providerResponse = { error: err instanceof Error ? err.message : String(err) };
    }

    // Interpret response
    const authorized = providerResponse?.status === "autorizado";
    const rejected = providerResponse?.status === "cancelado" || providerResponse?.status === "erro_autorizacao" || providerStatus >= 400;
    const finalStatus = authorized ? "authorized" : rejected ? "rejected" : "pending";

    const updates: any = {
      status: finalStatus,
      payload_response: providerResponse,
      motivo_rejeicao: rejected ? (providerResponse?.mensagem_sefaz || providerResponse?.erros?.[0]?.mensagem || "Rejeitado pelo provedor") : null,
      chave: providerResponse?.chave_nfe || null,
      protocolo: providerResponse?.protocolo || null,
      xml_url: providerResponse?.caminho_xml_nota_fiscal
        ? `${focusBaseUrl(settings.ambiente)}${providerResponse.caminho_xml_nota_fiscal}` : null,
      danfce_url: providerResponse?.caminho_danfe
        ? `${focusBaseUrl(settings.ambiente)}${providerResponse.caminho_danfe}` : null,
      qrcode_data: providerResponse?.qrcode_url || null,
      emitted_at: authorized ? new Date().toISOString() : null,
    };
    await admin.from("nfce_documents").update(updates).eq("id", nf.id);

    // Increment numero only if authorized/pending (not on hard reject)
    if (!rejected) {
      const col = modelo === "55" ? "proximo_numero_nfe" : "proximo_numero_nfce";
      await admin.from("fiscal_settings").update({ [col]: numero + 1 }).eq("owner_id", ownerId);
    }

    // Update quota usage
    if (authorized) {
      const ym = new Date().toISOString().slice(0, 7);
      const { data: existing } = await admin.from("fiscal_quota_usage")
        .select("*").eq("owner_id", ownerId).eq("year_month", ym).maybeSingle();
      if (existing) {
        await admin.from("fiscal_quota_usage")
          .update({ authorized_count: ((existing as any).authorized_count || 0) + 1 })
          .eq("owner_id", ownerId).eq("year_month", ym);
      } else {
        await admin.from("fiscal_quota_usage").insert({
          owner_id: ownerId, year_month: ym, authorized_count: 1,
        } as any);
      }
    }

    return json(200, {
      id: nf.id,
      status: finalStatus,
      provider_ref: ref,
      numero,
      chave: updates.chave,
      danfce_url: updates.danfce_url,
      xml_url: updates.xml_url,
      motivo_rejeicao: updates.motivo_rejeicao,
      provider_response: providerResponse,
    });
  } catch (err) {
    return json(500, { error: err instanceof Error ? err.message : String(err) });
  }
});
