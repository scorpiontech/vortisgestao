
## Objetivo
Mudar o modelo de negócio: Free dá acesso aos módulos básicos (Clientes, Estoque, Financeiro, OS, Relatórios + PDV sem nota). Pro libera o módulo de **NFC-e** com emissão real via provedor fiscal.

## 1. Reorganização dos planos (reaproveitando o que existe)

Hoje há 6 planos. Vou consolidar em **2 tiers** mantendo `subscription_plans` e `client_accounts.plan_id`:

| Plano | Valor | tier | nfe_quota | Inclui |
|---|---|---|---|---|
| **Free** | R$ 0,00 | `free` | 0 | Clientes, Estoque, Financeiro, OS, Relatórios, PDV (cupom não-fiscal) |
| **Pro** | R$ 79,90 | `pro` | NULL (ilimitado) | Tudo do Free + emissão NFC-e |

- Migration: adicionar valores `'free'` e `'pro'` ao enum de tier; inserir os 2 planos novos; marcar os 6 antigos como `active=false` (mantém histórico de faturas); migrar `client_accounts` existentes para o `Free` por padrão (todos novos cadastros também). Master que já paga continua até a próxima fatura, depois cai no Free se não der upgrade.
- Coluna nova `subscription_plans.features jsonb` (ex.: `{"nfce": true, "max_users": 5}`) — fonte da verdade pra gates de UI.

## 2. Gate de feature no frontend

Criar `src/hooks/usePlanFeatures.ts`:
- Lê `client_accounts` → `subscription_plans.features` + `tier`.
- Retorna `{ tier, isPro, isFree, canEmitNFCe, loading }`.
- Cache em React Query para evitar refetch a cada navegação.

Componente `<ProGate feature="nfce">` que envolve botões/cards e mostra CTA "Faça upgrade para emitir nota fiscal" no Free.

Aplicação:
- **PDV / Vendas**: continua aberto no Free. Botão "Finalizar venda" funciona normal (registra venda + cupom não-fiscal 80mm). Botão **"Emitir NFC-e"** aparece com cadeado no Free; clicar abre modal de upgrade.
- **Sidebar**: item "Configurações Fiscais" e a futura "Notas Fiscais" mostram badge "Pro" no Free, com link que leva à página de planos quando clicado.
- **`/configuracoes-fiscais`**: já existe — adicionar guard no topo: se Free, mostra hero "Disponível no plano Pro" + botão upgrade, esconde o form.

## 3. Página de Upgrade
Reaproveitar fluxo atual de `request-plan-upgrade` (Mercado Pago). Tela `/planos` simples: card Free (atual) vs card Pro (R$ 79,90/mês) com lista de recursos e botão "Fazer upgrade" → chama a edge function existente.

## 4. Módulo NFC-e (novo)

### 4a. Banco
Tabela `nfce_documents`:
- `owner_id`, `sale_id` (FK → sales, nullable se manual), `provider` (focusnfe/plugnotas), `provider_ref` (id retornado), `status` (`pending`, `authorized`, `rejected`, `cancelled`, `contingency`), `numero`, `serie`, `chave` (44 dígitos), `protocolo`, `xml_url`, `danfce_url`, `qrcode_url`, `motivo_rejeicao`, `valor_total`, `emitted_at`.
- RLS: owner-scoped (Master e vendedores via `get_effective_user_id`).
- Trigger: ao inserir authorized → incrementa `fiscal_quota_usage` (já existe, embora Pro seja ilimitado, mantém histórico).

### 4b. Edge functions
1. **`nfce-emit`** (verify_jwt=true)
   - Input: `{ sale_id }` ou payload manual.
   - Checa: `tier='pro'`, certificado válido em `fiscal_settings`, dados completos.
   - Monta payload no formato do provedor (`fiscal_settings.provider`).
   - POST autenticado ao provedor (Focus NFe: `https://api.focusnfe.com.br/v2/nfce`; PlugNotas: `https://api.plugnotas.com.br/nfce`).
   - Persiste resposta em `nfce_documents` com status `pending` e `provider_ref`.
   - Retorna `provider_ref` + status inicial.
2. **`nfce-status`** (verify_jwt=true)
   - Consulta status no provedor pelo `provider_ref`, atualiza linha.
   - Chamada pela UI em polling curto (2s × 30s) após emit.
3. **`nfce-cancel`** (verify_jwt=true)
   - Cancela nota autorizada (até 30 min Focus / regra estadual).
4. **`nfce-webhook`** (verify_jwt=false)
   - Recebe callback de autorização do provedor (quando suportado), atualiza status assincronamente.

Secret novo necessário: nada extra — `provider_token` já fica em `fiscal_settings` por owner (não centralizado).

### 4c. UI

- **Botão "Emitir NFC-e" no PDV**: após finalizar venda, se Pro + config fiscal OK, fica habilitado. Clica → chama `nfce-emit`, mostra spinner com polling, ao autorizar abre modal com QR Code + botão "Imprimir DANFCE 80mm" e "Baixar XML".
- **Nova página `/notas-fiscais`** (Master/vendedor): tabela com status, número, data, valor, chave, link XML/DANFCE, botões reemitir/cancelar. Filtros por status e período.
- **Impressão DANFCE 80mm**: novo template em `src/lib/printDanfce.ts` (cabeçalho do emitente, itens, totais, QR Code, chave formatada 4-em-4, mensagem "Consulte pela chave de acesso").

### 4d. Contingência
Se `nfce-emit` falhar (provedor offline / sem internet), salvar com status `contingency` e permitir retry manual. Não bloqueia a venda no PDV.

## 5. Configurações fiscais — ajuste mínimo
A tela já existe e está completa (CNPJ, IE, CSC, certificado A1, provider, token). Apenas adicionar guard de plano Pro no topo.

## 6. Documentação
Atualizar:
- `docs/modulos.md`: nova seção "Notas Fiscais" e ajustar "PDV" sobre cupom não-fiscal.
- `docs/manual-usuario.md`: passo a passo de upgrade + emissão.
- `docs/edge-functions.md`: 4 novas funções NFC-e.

## Arquivos a criar/editar

**Migrations** (1):
- Adiciona tiers `free`/`pro`, coluna `features jsonb`, planos novos, desativa antigos, cria `nfce_documents` + RLS + GRANTs.

**Edge functions** (4 novas): `nfce-emit`, `nfce-status`, `nfce-cancel`, `nfce-webhook` (+ entrada em `supabase/config.toml` para webhook sem JWT).

**Frontend**:
- `src/hooks/usePlanFeatures.ts` (novo)
- `src/components/ProGate.tsx` (novo)
- `src/pages/Planos.tsx` (novo) + rota
- `src/pages/NotasFiscais.tsx` (novo) + rota
- `src/lib/printDanfce.ts` (novo)
- `src/pages/Vendas.tsx` (editar — botão emitir + modal)
- `src/pages/ConfiguracoesFiscais.tsx` (guard Pro)
- `src/components/layout/AppSidebar.tsx` (badge "Pro" + item Notas Fiscais)

## Fora do escopo (perguntar depois)
- Emissão de **NF-e modelo 55** (B2B) — só NFC-e nesta entrega.
- Devolução/inutilização de numeração.
- Integração contábil (SPED).
- Período de trial automático no Pro.

## Decisões pendentes
- Confirmar valor do Plano Pro em R$ 79,90 (ou outro)?
- O que fazer com os 5 clientes Master que já estão em planos antigos pagos? Sugestão: manter no plano atual até o ciclo encerrar, depois migrar para Free (perguntando antes via e-mail/painel).
