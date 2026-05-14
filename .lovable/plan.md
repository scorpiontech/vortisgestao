# Cobrança recorrente automática

## Objetivo
Gerar automaticamente, todos os dias, as faturas mensais dos clientes ativos cujo vencimento está a **10 dias** de distância — sem intervenção do administrador.

## Como vai funcionar

1. Uma rotina diária (cron) roda 1x por dia.
2. Para cada conta de cliente ativa (não bloqueada), o sistema calcula o próximo vencimento com base no `due_day` da conta (ex: dia 10).
3. Se faltarem **10 dias ou menos** para esse vencimento e ainda **não existir fatura** para o mês de referência, o sistema:
   - Cria a fatura no Mercado Pago (gera link de pagamento)
   - Salva em `subscription_invoices` com status `pending`
4. O cliente vê a fatura em "Cobranças" e pode pagar antes do vencimento.
5. O fluxo de bloqueio por inadimplência (já existente) continua funcionando: vence → vira `overdue` → após `tolerance_days` (15 dias) bloqueia a conta.

## O que será criado

### 1. Nova edge function `generate-recurring-invoices`
- Roda sem autenticação (chamada apenas pelo cron interno)
- Lê todas as contas ativas (`status = 'ativo'`, `blocked = false`)
- Para cada conta:
  - Calcula próxima `due_date` usando `due_day` (mês corrente ou próximo, dependendo de já ter passado)
  - Define `reference_month` no formato "Mês de AAAA" (ex: "Junho de 2026")
  - Verifica se já existe fatura para essa conta + mês — se existir, pula
  - Se faltam ≤ 10 dias para o vencimento, reaproveita a lógica da `mp-create-invoice` para criar a preferência no Mercado Pago e gravar a fatura
- Retorna resumo: quantas faturas geradas, quantas puladas, erros

### 2. Cron job diário no banco
- Habilitar extensões `pg_cron` e `pg_net`
- Agendar execução diária (sugestão: **08:00 UTC = 05:00 BRT**) chamando a edge function via `net.http_post`

### 3. Pequeno ajuste na função existente
- Extrair a lógica de criação de preferência MP em código compartilhado (ou duplicar de forma controlada na nova função) para garantir consistência entre criação manual (admin) e automática (cron).

## Detalhes técnicos

**Cálculo do próximo vencimento:**
```
hoje = data atual
mês_alvo = mês atual
se hoje.dia > due_day: mês_alvo = próximo mês
due_date = primeiro dia válido do mês_alvo no due_day
```

**Janela de geração:**
```
dias_até_vencimento = due_date - hoje
gerar se: 0 <= dias_até_vencimento <= 10
```

**Idempotência:**  
A checagem `WHERE client_account_id = X AND reference_month = Y` evita duplicatas mesmo se o cron rodar várias vezes ou for reexecutado manualmente.

**Não altera:**
- Tabelas existentes (schema permanece igual)
- Lógica de bloqueio por inadimplência (`check-overdue-subscriptions`)
- Webhook do Mercado Pago (`mp-webhook`)
- Fluxo de pagamento do cliente

## Configuração necessária após implementar
Nenhuma do seu lado — o cron é configurado automaticamente. Apenas garanta que `MP_ACCESS_TOKEN` esteja configurado (já está).
