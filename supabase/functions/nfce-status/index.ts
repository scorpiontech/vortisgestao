// Edge function: nfce-status — consulta status de uma NFC-e no provedor
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) return j({ error: 'Unauthorized' }, 401)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    const { data: claims } = await supabase.auth.getClaims(authHeader.replace('Bearer ', ''))
    if (!claims?.claims) return j({ error: 'Unauthorized' }, 401)
    const userId = claims.claims.sub as string

    const { id } = await req.json()
    if (!id) return j({ error: 'id obrigatório' }, 400)

    const { data: doc } = await admin.from('nfce_documents').select('*').eq('id', id).maybeSingle()
    if (!doc) return j({ error: 'Nota não encontrada' }, 404)

    const { data: ownerData } = await admin.rpc('get_effective_user_id', { _user_id: userId })
    if (doc.owner_id !== (ownerData || userId)) return j({ error: 'forbidden' }, 403)

    const { data: fs } = await admin.from('fiscal_settings').select('provider, provider_token, ambiente').eq('owner_id', doc.owner_id).maybeSingle()
    if (!fs) return j({ error: 'Configuração fiscal ausente' }, 400)

    if (fs.provider === 'focusnfe') {
      const base = fs.ambiente === 'producao' ? 'https://api.focusnfe.com.br' : 'https://homologacao.focusnfe.com.br'
      const res = await fetch(`${base}/v2/nfce/${encodeURIComponent(doc.provider_ref)}`, {
        headers: { Authorization: 'Basic ' + btoa(`${fs.provider_token}:`) },
      })
      const body = await res.json().catch(() => ({}))
      const update: any = { payload_response: body }
      if (body?.status === 'autorizado') {
        update.status = 'authorized'
        update.numero = body.numero
        update.serie = body.serie
        update.chave = body.chave_nfe
        update.protocolo = body.protocolo
        update.xml_url = body.caminho_xml_nota_fiscal
        update.danfce_url = body.caminho_danfe
        update.qrcode_url = body.qrcode_url
        update.emitted_at = doc.emitted_at || new Date().toISOString()
      } else if (body?.status === 'cancelado') {
        update.status = 'cancelled'
        update.cancelled_at = new Date().toISOString()
      } else if (body?.status === 'erro_autorizacao' || body?.status === 'denegado') {
        update.status = 'rejected'
        update.motivo_rejeicao = body?.mensagem_sefaz || body?.mensagem
      } else {
        update.status = 'processing'
      }
      await admin.from('nfce_documents').update(update).eq('id', id)
      return j({ id, ...update })
    }

    return j({ error: 'provedor não suportado' }, 400)
  } catch (e: any) {
    return j({ error: e.message }, 500)
  }
})

function j(o: any, s = 200) {
  return new Response(JSON.stringify(o), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}
