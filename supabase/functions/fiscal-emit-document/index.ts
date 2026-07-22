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
// Nunca usa data futura enviada pelo navegador: campos datetime-local podem chegar em UTC
// quando montados com toISOString(), o que adianta a emissão em 3h no Brasil.
function brtEmissionDateTime(input?: string, driftMs = 0) {
  const safeNowMs = Date.now() - driftMs - 120_000;
  const parsedMs = input ? new Date(input).getTime() : NaN;
  const baseMs = Number.isFinite(parsedMs) && parsedMs <= safeNowMs ? parsedMs : safeNowMs;
  // Converte para horário de Brasília (UTC-3, sem horário de verão desde 2019)
  const brt = new Date(baseMs - 3 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  const y = brt.getUTCFullYear();
  const mo = pad(brt.getUTCMonth() + 1);
  const d = pad(brt.getUTCDate());
  const h = pad(brt.getUTCHours());
  const mi = pad(brt.getUTCMinutes());
  const s = pad(brt.getUTCSeconds());
  return `${y}-${mo}-${d}T${h}:${mi}:${s}-03:00`;
}

// Consulta NTP.br para calcular o desvio do relógio do runtime da função.
// driftMs = serverNow - referenceNow (positivo = servidor adiantado). Retorna 0 se falhar.
async function getServerDriftMs(): Promise<number> {
  const attempts = ["https://ntp.br", "https://www.ntp.br"];
  for (const url of attempts) {
    try {
      const startedAt = Date.now();
      const r = await fetch(`${url}?_=${startedAt}`, {
        method: "HEAD",
        headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
        signal: AbortSignal.timeout(3000),
      });
      const finishedAt = Date.now();
      const dateHeader = r.headers.get("date");
      if (!r.ok || !dateHeader) continue;

      const headerMs = new Date(dateHeader).getTime();
      if (!Number.isFinite(headerMs)) continue;

      const referenceMs = headerMs + Math.round(Math.max(0, finishedAt - startedAt) / 2);
      return Date.now() - referenceMs;
    } catch (_) { /* try next */ }
  }
  return 0;
}

const SIMPLES_REGIMES = new Set(["simples_nacional", "simples_excesso"]);
const CSOSN_SET = new Set(["101","102","103","201","202","203","300","400","500","900"]);
const CST_SET = new Set(["00","10","20","30","40","41","50","51","60","70","90"]);
// CSTs de ICMS que exigem cálculo (base + alíquota + valor)
const CST_ICMS_TRIBUTADO = new Set(["00","10","20","70","90"]);
// CSOSN que geram crédito no Simples e exigem alíquota de crédito
const CSOSN_COM_CREDITO = new Set(["101","201"]);
// CSTs de PIS/COFINS que exigem base e alíquota
const CST_PIS_COFINS_TRIBUTADO = new Set(["01","02","05"]);

function resolveIcmsCode(itemCode: string | undefined, settings: any): { code: string; error?: string } {
  const simples = SIMPLES_REGIMES.has(settings.regime_tributario);
  const raw = (itemCode ?? settings.csosn_default ?? (simples ? "102" : "00")).toString().trim();
  if (simples) {
    if (CST_SET.has(raw) && !CSOSN_SET.has(raw)) {
      return { code: raw, error: `Código ${raw} é CST e não pode ser usado no Simples Nacional. Configure um CSOSN (ex.: 102) nas Configurações Fiscais.` };
    }
    return { code: CSOSN_SET.has(raw) ? raw : "102" };
  }
  if (CSOSN_SET.has(raw) && !CST_SET.has(raw)) {
    return { code: raw, error: `Código ${raw} é CSOSN e só vale para Simples Nacional. Configure um CST de ICMS (ex.: 00) nas Configurações Fiscais, pois o regime informado é ${settings.regime_tributario}.` };
  }
  return { code: CST_SET.has(raw) ? raw : "00" };
}

function round2(v: number) { return Math.round(v * 100) / 100; }

// Monta bloco fiscal do item conforme regime tributário e CST/CSOSN
function buildItemTaxes(it: any, settings: any, valorBruto: number) {
  const simples = SIMPLES_REGIMES.has(settings.regime_tributario);
  const icms = resolveIcmsCode(it.cst || it.csosn, settings);
  if (icms.error) throw new Error(icms.error);

  const taxes: Record<string, any> = {
    icms_origem: String(it.icms_origem ?? "0"),
    icms_situacao_tributaria: icms.code,
  };

  const icmsAliq = Number(it.icms_aliquota ?? settings.icms_aliquota ?? 0);
  const modBc = String(it.icms_modalidade_base_calculo ?? settings.icms_modalidade_base_calculo ?? "3");

  if (simples) {
    if (CSOSN_COM_CREDITO.has(icms.code) && icmsAliq > 0) {
      taxes.icms_aliquota_credito_simples = icmsAliq;
      taxes.icms_valor_credito_simples = round2(valorBruto * icmsAliq / 100);
    }
    // CSOSN 102, 103, 300, 400, 500, 900 → sem campos de base/alíquota
  } else {
    if (CST_ICMS_TRIBUTADO.has(icms.code)) {
      const base = round2(valorBruto);
      taxes.icms_modalidade_base_calculo = modBc;
      taxes.icms_base_calculo = base;
      taxes.icms_aliquota = icmsAliq;
      taxes.icms_valor = round2(base * icmsAliq / 100);
    }
    // CST 40/41/50/60 → apenas origem e situação
  }

  // PIS / COFINS — obrigatórios em todos os regimes
  const pisCst = String(it.pis_cst ?? settings.pis_cst_default ?? (simples ? "49" : "01"));
  const cofinsCst = String(it.cofins_cst ?? settings.cofins_cst_default ?? (simples ? "49" : "01"));
  const pisAliq = Number(it.pis_aliquota ?? settings.pis_aliquota ?? 0);
  const cofinsAliq = Number(it.cofins_aliquota ?? settings.cofins_aliquota ?? 0);

  taxes.pis_situacao_tributaria = pisCst;
  if (CST_PIS_COFINS_TRIBUTADO.has(pisCst)) {
    const base = round2(valorBruto);
    taxes.pis_base_calculo = base;
    taxes.pis_aliquota_porcentual = pisAliq;
    taxes.pis_valor = round2(base * pisAliq / 100);
  }

  taxes.cofins_situacao_tributaria = cofinsCst;
  if (CST_PIS_COFINS_TRIBUTADO.has(cofinsCst)) {
    const base = round2(valorBruto);
    taxes.cofins_base_calculo = base;
    taxes.cofins_aliquota_porcentual = cofinsAliq;
    taxes.cofins_valor = round2(base * cofinsAliq / 100);
  }

  return taxes;
}

// Build Focus NFe payload — same shape works for NF-e (55) and NFC-e (65)
function buildFocusPayload(doc: any, settings: any, numero: number, driftMs = 0) {
  const modelo = doc.modelo === "55" ? "55" : "65";
  const serie = modelo === "55" ? settings.serie_nfe : settings.serie_nfce;
  const items = (doc.items || []).map((it: any, idx: number) => {
    const qtd = Number(it.quantidade || 1);
    const vun = Number(it.valor_unitario || 0);
    const valorBruto = round2(qtd * vun);
    return {
      numero_item: idx + 1,
      codigo_produto: it.codigo || it.product_id || String(idx + 1),
      descricao: it.descricao || it.name || "Item",
      cfop: it.cfop || settings.cfop_default || "5102",
      unidade_comercial: it.unidade || "UN",
      quantidade_comercial: qtd,
      valor_unitario_comercial: vun,
      valor_unitario_tributavel: vun,
      unidade_tributavel: it.unidade || "UN",
      codigo_ncm: it.ncm || "00000000",
      quantidade_tributavel: qtd,
      valor_bruto: valorBruto,
      ...buildItemTaxes(it, settings, valorBruto),
    };
  });

  const dest = doc.destinatario || null;
  const total_produtos = Number(doc.total_produtos || 0);
  const total_frete = Number(doc.total_frete || 0);
  const outras = Number(doc.outras_despesas || 0);
  const desconto = Number(doc.desconto || 0);
  const total_nota = Math.max(0, total_produtos + total_frete + outras - desconto);

  const payload: any = {
    natureza_operacao: doc.natureza_operacao || "Venda",
    data_emissao: brtEmissionDateTime(doc.data_emissao, driftMs),
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

    // Corrige desvio de relógio do servidor consultando fonte externa antes de montar a data
    const driftMs = await getServerDriftMs();
    let payload: any; let total_nota = 0;
    try {
      ({ payload, total_nota } = buildFocusPayload(doc, settings, numero, driftMs));
    } catch (buildErr) {
      return json(400, { error: buildErr instanceof Error ? buildErr.message : String(buildErr) });
    }

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
      data_emissao: brtEmissionDateTime(doc.data_emissao, driftMs),
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
