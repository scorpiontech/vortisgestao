// Edge function: nfce-emit
// Emite uma NFC-e a partir de uma venda (sale_id), enviando ao provedor fiscal
// configurado (Focus NFe ou PlugNotas). Cria registro em nfce_documents.
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface EmitBody {
  sale_id: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return json({ error: 'Unauthorized' }, 401)
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const token = authHeader.replace('Bearer ', '')
    const { data: claims, error: claimsError } = await supabase.auth.getClaims(token)
    if (claimsError || !claims?.claims) return json({ error: 'Unauthorized' }, 401)
    const userId = claims.claims.sub as string

    const body: EmitBody = await req.json().catch(() => ({} as any))
    if (!body.sale_id) return json({ error: 'sale_id é obrigatório' }, 400)

    // resolver owner efetivo
    const { data: ownerData } = await admin.rpc('get_effective_user_id', { _user_id: userId })
    const ownerId = (ownerData as string) || userId

    // Verificar plano permite NFC-e
    const { data: canEmit } = await admin.rpc('can_emit_nfce', { _owner_id: ownerId })
    if (!canEmit) {
      return json({ error: 'Seu plano não permite emissão de NFC-e. Faça upgrade para o plano Pro.' }, 403)
    }

    // Configuração fiscal
    const { data: fs } = await admin.from('fiscal_settings').select('*').eq('owner_id', ownerId).maybeSingle()
    if (!fs) return json({ error: 'Configuração fiscal não encontrada. Acesse Configurações Fiscais.' }, 400)
    if (!fs.cnpj || !fs.ie) return json({ error: 'CNPJ/IE não configurados.' }, 400)
    if (!fs.certificate_valid) return json({ error: 'Certificado A1 ausente ou inválido.' }, 400)
    if (!fs.provider_token) return json({ error: 'Token do provedor fiscal não configurado.' }, 400)

    // Dados da empresa
    const { data: company } = await admin.from('company_registrations').select('*').eq('user_id', ownerId).maybeSingle()
    if (!company) return json({ error: 'Cadastro da empresa não encontrado.' }, 400)

    // Venda + itens
    const { data: sale } = await admin.from('sales').select('*').eq('id', body.sale_id).maybeSingle()
    if (!sale) return json({ error: 'Venda não encontrada' }, 404)
    if (sale.user_id !== ownerId) return json({ error: 'Venda não pertence a este usuário' }, 403)

    const { data: items } = await admin.from('sale_items').select('*').eq('sale_id', body.sale_id)
    if (!items?.length) return json({ error: 'Venda sem itens' }, 400)

    // Evitar emissão duplicada
    const { data: existing } = await admin
      .from('nfce_documents')
      .select('id, status')
      .eq('sale_id', body.sale_id)
      .in('status', ['authorized', 'pending', 'processing'])
      .maybeSingle()
    if (existing) {
      return json({ error: `Já existe nota fiscal para esta venda (status: ${existing.status})`, id: existing.id }, 409)
    }

    // Montar payload Focus NFe (formato simplificado)
    const refId = `nfce-${body.sale_id.slice(0, 8)}-${Date.now()}`
    const payload = buildFocusPayload({ sale, items, company, fs })

    // Criar doc preliminar
    const { data: doc, error: docErr } = await admin.from('nfce_documents').insert({
      owner_id: ownerId,
      created_by: userId,
      sale_id: body.sale_id,
      provider: fs.provider,
      provider_ref: refId,
      status: 'pending',
      ambiente: fs.ambiente,
      valor_total: sale.total,
      customer_name: sale.customer_name,
      payload_request: payload,
    }).select().single()
    if (docErr) return json({ error: 'Erro ao registrar nota: ' + docErr.message }, 500)

    // Chamar provedor
    const result = await callProvider(fs.provider, fs.ambiente, fs.provider_token, refId, payload)

    const update: Record<string, any> = {
      payload_response: result.body,
      status: result.status,
    }
    if (result.error) update.motivo_rejeicao = result.error
    if (result.status === 'authorized') {
      update.numero = result.numero
      update.serie = result.serie
      update.chave = result.chave
      update.protocolo = result.protocolo
      update.xml_url = result.xml_url
      update.danfce_url = result.danfce_url
      update.qrcode_url = result.qrcode_url
      update.emitted_at = new Date().toISOString()
    }

    await admin.from('nfce_documents').update(update).eq('id', doc.id)

    return json({ id: doc.id, provider_ref: refId, ...update })
  } catch (e: any) {
    return json({ error: e.message || 'Erro inesperado' }, 500)
  }
})

function json(obj: any, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function buildFocusPayload({ sale, items, company, fs }: any) {
  const today = new Date().toISOString().slice(0, 19) + '-03:00'
  return {
    cnpj_emitente: fs.cnpj.replace(/\D/g, ''),
    indicador_inscricao_estadual_destinatario: '9',
    natureza_operacao: 'Venda ao consumidor',
    data_emissao: today,
    tipo_documento: '1',
    finalidade_emissao: '1',
    consumidor_final: '1',
    presenca_comprador: '1',
    modalidade_frete: '9',
    local_destino: '1',
    items: items.map((it: any, idx: number) => ({
      numero_item: idx + 1,
      codigo_produto: it.product_id || `SKU-${idx + 1}`,
      descricao: it.product_name,
      cfop: fs.cfop_default,
      unidade_comercial: 'UN',
      quantidade_comercial: it.quantity,
      valor_unitario_comercial: Number(it.unit_price).toFixed(4),
      valor_bruto: Number(it.total).toFixed(2),
      unidade_tributavel: 'UN',
      quantidade_tributavel: it.quantity,
      valor_unitario_tributavel: Number(it.unit_price).toFixed(4),
      icms_origem: '0',
      icms_situacao_tributaria: fs.csosn_default,
      pis_situacao_tributaria: '49',
      cofins_situacao_tributaria: '49',
    })),
    formas_pagamento: [{
      forma_pagamento: mapPayment(sale.payment_method),
      valor_pagamento: Number(sale.total).toFixed(2),
    }],
  }
}

function mapPayment(method: string): string {
  const m = (method || '').toLowerCase()
  if (m.includes('pix')) return '17'
  if (m.includes('crédito') || m.includes('credito')) return '03'
  if (m.includes('débito') || m.includes('debito')) return '04'
  if (m.includes('dinheiro')) return '01'
  return '99'
}

async function callProvider(provider: string, ambiente: string, token: string, ref: string, payload: any) {
  if (provider === 'focusnfe') {
    const baseUrl = ambiente === 'producao'
      ? 'https://api.focusnfe.com.br'
      : 'https://homologacao.focusnfe.com.br'
    const url = `${baseUrl}/v2/nfce?ref=${encodeURIComponent(ref)}`
    const auth = 'Basic ' + btoa(`${token}:`)
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const body = await res.json().catch(() => ({}))
    // Focus retorna 202 e a NFC-e é processada de forma assíncrona
    if (res.status === 202 || body?.status === 'processando_autorizacao') {
      return { status: 'processing', body }
    }
    if (body?.status === 'autorizado') {
      return {
        status: 'authorized',
        body,
        numero: body.numero,
        serie: body.serie,
        chave: body.chave_nfe,
        protocolo: body.protocolo,
        xml_url: body.caminho_xml_nota_fiscal,
        danfce_url: body.caminho_danfe,
        qrcode_url: body.qrcode_url,
      }
    }
    return { status: 'rejected', body, error: body?.mensagem_sefaz || body?.mensagem || `HTTP ${res.status}` }
  }

  if (provider === 'plugnotas') {
    // PlugNotas: payload diferente — TODO no próximo turno
    return { status: 'error', body: { provider }, error: 'PlugNotas ainda não implementado neste release' }
  }

  return { status: 'error', body: { provider }, error: `Provedor não suportado: ${provider}` }
}
