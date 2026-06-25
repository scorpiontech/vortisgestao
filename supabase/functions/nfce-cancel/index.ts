// Edge function: nfce-cancel — solicita cancelamento de uma NFC-e autorizada
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

    const { id, justificativa } = await req.json()
    if (!id || !justificativa || justificativa.length < 15) {
      return j({ error: 'id e justificativa (mín. 15 caracteres) obrigatórios' }, 400)
    }

    const { data: doc } = await admin.from('nfce_documents').select('*').eq('id', id).maybeSingle()
    if (!doc) return j({ error: 'Nota não encontrada' }, 404)
    if (doc.status !== 'authorized') return j({ error: 'Apenas notas autorizadas podem ser canceladas' }, 400)

    const { data: ownerData } = await admin.rpc('get_effective_user_id', { _user_id: userId })
    if (doc.owner_id !== (ownerData || userId)) return j({ error: 'forbidden' }, 403)

    const { data: fs } = await admin.from('fiscal_settings').select('provider, provider_token, ambiente').eq('owner_id', doc.owner_id).maybeSingle()
    if (!fs) return j({ error: 'Configuração fiscal ausente' }, 400)

    if (fs.provider === 'focusnfe') {
      const base = fs.ambiente === 'producao' ? 'https://api.focusnfe.com.br' : 'https://homologacao.focusnfe.com.br'
      const res = await fetch(`${base}/v2/nfce/${encodeURIComponent(doc.provider_ref)}`, {
        method: 'DELETE',
        headers: { Authorization: 'Basic ' + btoa(`${fs.provider_token}:`), 'Content-Type': 'application/json' },
        body: JSON.stringify({ justificativa }),
      })
      const body = await res.json().catch(() => ({}))
      const ok = body?.status === 'cancelado' || res.status === 200 || res.status === 202
      const update: any = { payload_response: body }
      if (ok) {
        update.status = 'cancelled'
        update.cancelled_at = new Date().toISOString()
      } else {
        update.motivo_rejeicao = body?.mensagem_sefaz || body?.mensagem || `HTTP ${res.status}`
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
