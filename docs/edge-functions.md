# Edge Functions

Funções serverless em Deno, hospedadas no Lovable Cloud. Listadas em `supabase/functions/`.

| Função | Verify JWT | Disparo | O que faz |
|---|---|---|---|
| `create-company-user` | sim | UI Master | Cria sub-usuário vendedor vinculado ao Master. |
| `admin-create-user` | sim | Painel super admin | Cria conta de cliente Master + entrada em `client_accounts`. |
| `request-plan-upgrade` | sim | UI Master | Gera fatura para upgrade de plano. |
| `mp-create-invoice` | sim | Cron/UI | Cria preferência de pagamento Mercado Pago para fatura. |
| `mp-webhook` | **não** | Webhook MP | Recebe status do pagamento, atualiza `subscription_invoices` e desbloqueia `client_accounts` quando pago. |
| `generate-recurring-invoices` | **não** | Cron diário | Gera faturas mensais recorrentes para clientes ativos. |
| `check-overdue-subscriptions` | sim | Cron diário | Marca clientes como `blocked` quando fatura vence. |
| `fiscal-validate-certificate` | sim | UI Configurações fiscais | Valida certificado A1 (.pfx) + senha. |

## Configuração

`supabase/config.toml`:
```toml
[functions.mp-webhook]
verify_jwt = false

[functions.generate-recurring-invoices]
verify_jwt = false
```

## Secrets necessárias

- `MP_ACCESS_TOKEN` — token Mercado Pago (produção).
- `SUPABASE_SERVICE_ROLE_KEY` — automaticamente injetado.
- `SUPABASE_URL`, `SUPABASE_ANON_KEY` — automaticamente injetados.

## Cron (Postgres `pg_cron`)

```sql
-- Diariamente às 03:00 BRT
select cron.schedule('generate-invoices', '0 6 * * *', $$
  select net.http_post(
    url := '<SUPABASE_URL>/functions/v1/generate-recurring-invoices',
    headers := '{"Content-Type":"application/json"}'::jsonb
  );
$$);
```

## Fluxo Mercado Pago

```
fatura criada (status=pending)
  → mp-create-invoice gera preferência
    → cliente paga no MP
      → MP chama mp-webhook
        → atualiza status=paid + paid_at
        → desbloqueia client_account
        → se upgrade: aplica novo plano
```
