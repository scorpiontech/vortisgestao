
# Migrar Vortis para Supabase self-hosted (mesmo servidor, banco zerado)

## Objetivo
Substituir o Lovable Cloud por uma instalação **Supabase self-hosted** rodando em Docker no servidor Proxmox/Ubuntu que já hospeda o app. O sistema continua usando o mesmo SDK (`@supabase/supabase-js`), as mesmas RLS, as mesmas edge functions — só muda a URL e as chaves. Sem migrar dados — começa do zero.

---

## Visão geral

```text
┌──────────────────────────────────────────────────────────┐
│  Servidor Ubuntu (Proxmox)                               │
│                                                          │
│   Nginx ──► /var/www/vortis    (SPA React, já existe)    │
│     │                                                    │
│     └─► proxy /supabase/* ──► Kong (porta 8000)          │
│                                  │                       │
│                                  ├─► GoTrue (Auth)       │
│                                  ├─► PostgREST (Data)    │
│                                  ├─► Storage             │
│                                  ├─► Realtime            │
│                                  └─► Edge Runtime (Deno) │
│                                                          │
│   Postgres 15 (container, volume persistente)            │
└──────────────────────────────────────────────────────────┘
```

Tudo em containers Docker, isolado do app, com Nginx fazendo proxy reverso HTTPS.

---

## Etapas

### 1. Preparar o servidor
- Instalar Docker + docker-compose-plugin (se ainda não tiver).
- Reservar um subdomínio: `supabase.vortisgestao.com.br` apontando pro mesmo IP do `app.vortisgestao.com.br`.
- Liberar nada de portas externas novas — só 80/443 já abertos. Kong fica em `127.0.0.1:8000`, Nginx faz o proxy.

### 2. Subir a stack do Supabase
- Clonar `https://github.com/supabase/supabase` em `/opt/supabase`.
- Copiar `docker/.env.example` → `docker/.env` e gerar:
  - `POSTGRES_PASSWORD` (senha forte)
  - `JWT_SECRET` (32+ chars aleatórios)
  - `ANON_KEY` e `SERVICE_ROLE_KEY` (gerados a partir do JWT_SECRET via supabase/cli ou jwt.io)
  - `DASHBOARD_USERNAME` / `DASHBOARD_PASSWORD` (Studio)
  - `SITE_URL=https://app.vortisgestao.com.br`
  - `SMTP_*` (provider de e-mail — Resend, Brevo, Amazon SES, ou um Gmail SMTP pra começar)
- `docker compose up -d` em `/opt/supabase/docker`.
- Validar: `curl http://127.0.0.1:8000/rest/v1/` deve responder.

### 3. Nginx — expor Supabase com HTTPS
Adicionar um server block em `/etc/nginx/sites-available/supabase`:
- `server_name supabase.vortisgestao.com.br`
- `proxy_pass http://127.0.0.1:8000`
- Headers: `Host`, `X-Real-IP`, `X-Forwarded-Proto`, `Upgrade`/`Connection` (Realtime usa WebSocket).
- `sudo certbot --nginx -d supabase.vortisgestao.com.br` pra emitir o certificado.
- O Studio fica em `https://supabase.vortisgestao.com.br/` (com basic-auth do Kong).

### 4. Recriar o schema do Vortis no novo Postgres
Como vamos zerar, é só rodar **todas as migrações que hoje existem no Lovable Cloud** no novo banco:
- Tabelas: `profiles`, `company_members`, `user_roles`, `products`, `categories`, `units`, `customers`, `suppliers`, `transactions`, `bills`, `sales`, `sale_items`, `quotes`, `quote_items`, `service_orders`, `service_order_materials`, `cash_registers`, `audit_logs`, `client_accounts`, `subscription_invoices`, `subscription_plans`, `fiscal_settings`, `fiscal_quota_usage`, `invoice_generation_logs`, `barcode_scan_logs`, `barcode_scan_log_settings`, `company_registrations`.
- Funções: `get_effective_user_id`, `get_member_role`, `is_client_blocked`, `has_role`, `handle_new_user`, `handle_new_client_account`, `update_updated_at_column`, `cleanup_old_barcode_scan_logs`, `check_nfce_quota`.
- Triggers de `updated_at` e auto-criação de profile/client_account em `auth.users`.
- Todas as RLS policies + GRANTs.
- Bucket de storage `fiscal-certificates` (privado).

Forma prática: extrair o SQL consolidado a partir do projeto Lovable Cloud atual (eu posso gerar um único `schema.sql` no momento da execução) e rodar via `psql` dentro do container do Postgres.

### 5. Edge Functions
Copiar `supabase/functions/*` para o servidor e deployar com o CLI do Supabase apontando pro self-hosted:
- `mp-webhook`, `mp-create-invoice`, `generate-recurring-invoices`, `check-overdue-subscriptions`, `admin-create-user`, `create-company-user`, `fiscal-validate-certificate`, `request-plan-upgrade`.
- Configurar as secrets no `.env` do edge-runtime: `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, `LOVABLE_API_KEY` (se quiser manter a IA da Lovable) ou trocar por OpenAI/Anthropic direto.
- Atualizar o webhook do Mercado Pago pra apontar pra `https://supabase.vortisgestao.com.br/functions/v1/mp-webhook`.

### 6. Apontar o app pra nova URL
No `.env` do build do Vortis (no servidor, antes de rodar `deploy.sh`):
```
VITE_SUPABASE_URL=https://supabase.vortisgestao.com.br
VITE_SUPABASE_PUBLISHABLE_KEY=<ANON_KEY gerado no passo 2>
VITE_SUPABASE_PROJECT_ID=self-hosted
```
Rebuild + reload Nginx. O `src/integrations/supabase/client.ts` não muda — ele lê do `.env`.

### 7. Validação
- Criar o primeiro usuário Master via Studio (ou signup pela tela do app).
- Inserir em `user_roles` o role `admin` pra esse user pra acessar `/admin/*`.
- Smoke test: login, criar produto, abrir caixa, lançar venda, gerar PDF de orçamento.

### 8. Backup
- Cron diário: `docker exec supabase-db pg_dump -U postgres postgres | gzip > /backup/vortis-$(date +%F).sql.gz`.
- Reter 14 dias e mandar 1 cópia semanal pra storage externo (S3/Backblaze/rsync pra outro host).
- Backup do volume de storage também.

---

## Detalhes técnicos / pontos de atenção

| Tema | Observação |
|---|---|
| **JWT compatibility** | A chave anon/service-role do self-hosted é assinada com **outro `JWT_SECRET`**. Todos os usuários terão de fazer login novamente (mas como vamos zerar, ok). |
| **SMTP** | Sem SMTP configurado, signup com confirmação de e-mail e reset de senha **não funcionam**. Precisa decidir o provider antes do go-live. |
| **Recursos do servidor** | Stack completa do Supabase usa ~2GB de RAM em idle. Confirmar que a VM tem folga (recomendo 4GB+ pra app + Supabase). |
| **Lovable AI Gateway** | Hoje algumas funções podem usar `LOVABLE_API_KEY`. Self-hosted **não tem** isso — ou mantém o secret (continua chamando a API da Lovable de fora), ou troca o provider de IA. |
| **Lovable Cloud no projeto** | O projeto continua "conectado" ao Cloud do ponto de vista do editor Lovable, mas o app em produção ignora isso e só fala com o seu servidor. Em desenvolvimento dentro do Lovable, ele continua usando o Cloud — então **dev = Cloud, prod = self-hosted**. |
| **Custo** | Você passa a pagar só o servidor. Some o custo do Cloud, mas ganha responsabilidade total por backup, updates de segurança do Supabase, monitoramento e SMTP. |
| **Reversão** | Se der errado, basta reverter o `.env` no servidor pros valores antigos do Cloud e rebuildar. Sem risco de perder dados do Cloud. |

---

## Entregáveis desta tarefa
1. Documento `deploy/SUPABASE_SELFHOSTED.md` com passo a passo completo (comandos prontos pra copiar/colar).
2. Script `deploy/supabase-install.sh` que automatiza passos 1–3.
3. Arquivo `deploy/supabase-schema.sql` consolidado com todo o schema + RLS + funções + triggers do Vortis pra subir num banco vazio.
4. Bloco Nginx pronto em `deploy/nginx-supabase.conf`.
5. Ajuste no `deploy/deploy.sh` pra avisar quando o `.env` aponta pro self-hosted.

Posso aprovar e implementar?
