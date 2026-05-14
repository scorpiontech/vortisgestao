# Estratégia: Plano Pro com emissão de NFC-e

## Visão geral
Lançar um módulo de **NFC-e** (modelo 65, para vendas no PDV) integrado a um provedor terceirizado (Focus NFe / NFe.io / PlugNotas), disponível apenas em planos "Pro". O plano atual de cada cliente vira "Básico" (sem nota); o cliente faz upgrade manual para Pro escolhendo um tier por faixa de cota mensal.

## Estrutura comercial dos planos

| Tier | Cota mensal | Mensalidade |
|------|-------------|-------------|
| Pro 6 | 1 a 6 notas | R$ 99,90 |
| Pro 12 | 7 a 12 notas | R$ 139,90 |
| Pro 20 | 13 a 20 notas | R$ 199,90 |
| Pro+ | acima de 20 | negociado (cadastro manual pelo admin) |

**Regras da cota:**
- Conta cada NFC-e **autorizada** pela SEFAZ (rejeitada/cancelada não consome).
- Ciclo = mês de calendário (zera dia 1, 00:00 BRT).
- Atingiu o limite → PDV bloqueia o botão "Emitir NFC-e" e mostra aviso "cota esgotada — faça upgrade ou aguarde o próximo ciclo". A venda continua funcionando normalmente, só não emite a nota.
- Ao chegar em 80% da cota, banner de aviso no topo do PDV.

## Provedor fiscal — recomendação

Sugiro **Focus NFe** ou **PlugNotas** (ambos tem sandbox grátis, REST simples, custo ~R$0,15-0,30 por NFC-e autorizada). Decisão final pode ficar para o momento da implementação após comparar pricing atual.

**O que cada cliente precisa fornecer 1x:**
- Certificado digital A1 (.pfx) + senha
- CNPJ, IE, CSC + ID CSC (token NFC-e da SEFAZ do estado)
- Regime tributário, CFOP padrão de venda, CSOSN/CST padrão

Esses dados ficam em uma nova tela "Configurações Fiscais" (só Master).

## Arquitetura técnica

### 1. Banco de dados (migrations)

**Atualizar `subscription_plans`:**
- `tier` (text): `'basico' | 'pro_6' | 'pro_12' | 'pro_20' | 'pro_custom'`
- `nfe_quota` (integer, nullable) — null = sem NF-e, 0 = ilimitado (Pro+)
- `features` (jsonb) — `{ nfe: true/false, ... }` para futuras features

**Nova tabela `fiscal_settings`** (1 por owner/empresa):
```
id, owner_id, cnpj, ie, regime_tributario,
csc_id, csc_token, certificate_path (storage),
certificate_password (criptografado), cfop_default,
csosn_default, ambiente ('homologacao'|'producao'),
provider ('focusnfe'|'plugnotas'), provider_token
```

**Nova tabela `fiscal_invoices`** (registro de cada NFC-e):
```
id, owner_id, sale_id (FK para sales), status
('pending'|'authorized'|'rejected'|'cancelled'),
numero, serie, chave_acesso, protocolo, xml_url,
pdf_url (DANFE), provider_ref, error_message,
issued_at, cancelled_at, created_at
```

**Nova tabela `fiscal_quota_usage`** (denormalizada para performance):
```
id, owner_id, year_month (text 'AAAA-MM'),
authorized_count, last_updated
UNIQUE(owner_id, year_month)
```
Trigger: ao inserir `fiscal_invoices` com status `authorized`, incrementa o counter do mês corrente.

**RLS:** todas as tabelas seguem padrão `get_effective_user_id(auth.uid())`.

### 2. Edge functions

- **`fiscal-emit-nfce`** — recebe `sale_id`, valida cota disponível, monta payload, chama provedor, grava resultado em `fiscal_invoices`. Retorna PDF/XML.
- **`fiscal-cancel-nfce`** — cancela na SEFAZ via provedor (até 30min após emissão).
- **`fiscal-webhook`** — recebe callbacks do provedor (autorização assíncrona) e atualiza status.

Secret necessário (será solicitado quando implementarmos): `FOCUSNFE_TOKEN` (ou equivalente).

### 3. Frontend

**Telas novas:**
- `/admin/planos` — adicionar campos `tier`, `nfe_quota`, badge "Pro" e cadastrar os 4 tiers iniciais.
- `/configuracoes-fiscais` (Master only) — formulário de dados fiscais + upload do certificado.
- `/fiscal/notas` — listagem de NFC-e emitidas, filtros por status/mês, download de DANFE/XML, botão cancelar.

**Alterações:**
- **PDV (`Vendas.tsx`)**: após finalizar venda, se cliente é Pro e tem cota → botão "Emitir NFC-e" + impressão do DANFE 80mm. Indicador de cota usada/total no header (`12/20 notas este mês`).
- **AdminDashboard**: card com receita por tier.
- **Cobranças/Cobrancas (cliente)**: mostra plano atual e botão "Fazer upgrade".

### 4. Cota e bloqueio

Hook `useNfeQuota()` no frontend lê `fiscal_quota_usage` do mês corrente vs `subscription_plans.nfe_quota` da conta. Validação dupla: frontend (UX) + edge function (segurança real, nunca confiar no front).

### 5. Upgrade de plano (fluxo do cliente)

1. Cliente Básico clica "Fazer upgrade" em `/cobrancas`.
2. Vê os 3 tiers Pro com features (cota + NFC-e).
3. Escolhe → admin recebe notificação OU geração automática de fatura proporcional do upgrade no Mercado Pago (mesma engine de `mp-create-invoice`).
4. Após pagamento confirmado pelo webhook, `client_accounts.plan_id` é atualizado para o novo tier; cota libera imediatamente.
5. Pro+ (negociado) é cadastrado manualmente pelo admin no painel.

## Fases de entrega

**Fase 1 — Estrutura comercial (sem fiscal real, ~rápido):**
- Migrations dos planos com `tier` e `nfe_quota`
- Cadastro dos 4 tiers em `subscription_plans`
- Tela de upgrade para o cliente
- Badge "Pro" no menu/dashboard

**Fase 2 — Configuração fiscal:**
- Tabela `fiscal_settings` + tela de configuração
- Upload de certificado para storage criptografado
- Validação de CNPJ/IE

**Fase 3 — Emissão NFC-e (sandbox/homologação):**
- Edge function `fiscal-emit-nfce` em ambiente de homologação
- Listagem `/fiscal/notas`
- Botão emitir no PDV + DANFE 80mm
- Contador de cota

**Fase 4 — Produção e cancelamento:**
- Toggle homologação→produção
- Cancelamento + webhook do provedor
- Bloqueio por cota esgotada

**Fase 5 — Cobrança automática integrada:**
- Conectar upgrade de plano ao Mercado Pago (proporcional)
- Painel de receita por tier no admin

## Pontos de atenção

- **Custo do provedor por nota** (~R$0,15-0,30) precisa ser absorvido na margem dos R$99,90 — em Pro 6 ainda dá folga; em Pro+ negociar valor mínimo que cubra o volume.
- **Certificado A1** vence em 1 ano: criar lembrete 30 dias antes do vencimento.
- **Contingência SEFAZ**: o provedor cuida automaticamente, mas precisamos exibir status no painel.
- **Cancelamento** só é permitido pela SEFAZ até **30 minutos** após autorização; após isso o cliente precisa emitir uma nota de devolução.
- **LGPD**: senha do certificado deve ser criptografada (não em plaintext nem em jsonb visível).

## Próximo passo sugerido
Aprovar este plano e começar pela **Fase 1** (estrutura de planos + tela de upgrade), que já entrega valor visível e prepara o terreno para a integração fiscal nas fases seguintes.
