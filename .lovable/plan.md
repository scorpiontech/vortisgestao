# Plano de execução

## 1. Linter de segurança Supabase

Os warnings remanescentes do linter (`SECURITY DEFINER executável por authenticated`, `extension in public`) já foram avaliados como necessários ao funcionamento das RLS. Vou aplicar o que ainda pode ser endurecido sem quebrar nada:

- Recriar as funções `get_effective_user_id`, `is_client_blocked`, `get_member_role`, `has_role` mantendo `SECURITY DEFINER` mas com `REVOKE EXECUTE ... FROM PUBLIC` reforçado e `SET search_path = public, pg_temp` (evita hijack de search_path).
- Garantir que `cleanup_old_barcode_scan_logs` não tem nenhum GRANT a `anon`/`authenticated`.
- Mover a extensão `pg_net` / `pg_cron` (se instaladas em `public`) para o schema `extensions` quando possível; caso a extensão não suporte, documentar no security memory.
- Marcar como fixed/ignored o que sobrar com justificativa.

## 2. Configuração fiscal completa (provedor + parâmetros)

A tabela `fiscal_settings` já existe. Falta:

- Tela `ConfiguracoesFiscais.tsx`: adicionar seção "Provedor Fiscal" com seletor (Focus NFe, PlugNotas, NFe.io, eNotas), campo `provider_token`, ambiente (homologação/produção), `csc_id`, `csc_token`, CFOP padrão, CSOSN padrão.
- Validação obrigatória antes de habilitar emissão: CNPJ válido + IE + certificado válido + CSC + token do provedor.
- Badge de status "Pronto para emitir" / "Pendente" no topo da tela.
- Bloquear botão "Salvar" se CNPJ inválido (usar `validators.ts` existente).

## 3. Validação de cota mensal NFC-e

Criar tabela `fiscal_quota_usage`:
- `owner_id`, `year_month` (text `YYYY-MM`), `authorized_count` (int)
- Unique `(owner_id, year_month)`
- RLS: owner lê/atualiza própria linha; service_role total.

Função `public.check_nfce_quota(_owner_id uuid)` (SECURITY DEFINER):
- Lê `client_accounts.plan_id` → `subscription_plans.nfe_quota`
- Lê `fiscal_quota_usage` do mês corrente
- Retorna `{ allowed boolean, used int, quota int, remaining int }`
- Quando `quota IS NULL` (tier `pro_custom`), retorna `allowed = true` sem limite.

Hook React `useFiscalQuota()`:
- Consulta a função RPC e expõe `quota`, `used`, `remaining`, `blocked`.
- Banner de aviso ao atingir 80% e bloqueio em 100%.

Antes da emissão (futura edge function `fiscal-emit-nfce`): primeira validação consulta `check_nfce_quota`; se `allowed = false`, retorna 402 com mensagem clara e registra em `audit_logs`.

## 4. Fatura proporcional automática no upgrade

Hoje o upgrade só registra `audit_logs`. Vou trocar por:

- Edge function `request-plan-upgrade` (verify_jwt=true):
  - Recebe `target_plan_id`.
  - Lê `client_accounts` do usuário + plano atual + plano alvo.
  - Calcula dias restantes do ciclo (`due_day` define o vencimento).
  - Diferença mensal: `delta = (plano_alvo.monthly_value - plano_atual.monthly_value)`
  - Valor proporcional: `delta * (dias_restantes / dias_do_ciclo)`, arredondado a 2 casas, mínimo R$5 (limite Mercado Pago).
  - Cria preferência no Mercado Pago reutilizando a mesma lógica de `mp-create-invoice` e insere em `subscription_invoices` com `reference_month` = ciclo atual + sufixo `-upgrade`.
  - Quando a fatura for paga, o webhook já existente (`mp-webhook`) atualiza `client_accounts.plan_id` para o `target_plan_id` (vou adicionar metadata `target_plan_id` na fatura via nova coluna `metadata jsonb` em `subscription_invoices`).
- Frontend `Cobrancas.tsx`: trocar "Solicitar upgrade" por "Fazer upgrade agora", chamando a edge function e abrindo o `payment_link` em nova aba.
- Pro Custom continua sendo tratamento manual (mostra "Falar com vendas").

## Detalhes técnicos

- Migrations:
  1. Hardening de search_path nas funções SECURITY DEFINER.
  2. Tabela `fiscal_quota_usage` + função `check_nfce_quota` + GRANTs/RLS.
  3. Coluna `subscription_invoices.metadata jsonb default '{}'`.

- Arquivos novos: `supabase/functions/request-plan-upgrade/index.ts`, `src/hooks/useFiscalQuota.ts`.
- Arquivos editados: `src/pages/ConfiguracoesFiscais.tsx`, `src/pages/Cobrancas.tsx`, `supabase/functions/mp-webhook/index.ts` (aplicar `target_plan_id` no pagamento), `src/integrations/supabase/types.ts` (auto).

## Ordem de entrega

1. Migrations (linter + fiscal_quota + metadata).
2. UI da Configuração Fiscal completa.
3. Hook + banner de cota.
4. Edge function `request-plan-upgrade` + ajuste do webhook + botão no Cobranças.

Confirma para eu iniciar?
