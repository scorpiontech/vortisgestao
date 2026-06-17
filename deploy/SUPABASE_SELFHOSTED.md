# Supabase self-hosted — Vortis Gestão

Guia para migrar o backend do Lovable Cloud para uma instalação **Supabase self-hosted**, em Docker, no mesmo servidor Ubuntu/Proxmox que já hospeda o app. O sistema continua usando o SDK `@supabase/supabase-js`, as mesmas RLS e as mesmas edge functions — só muda a URL e as chaves.

> Esta migração começa com **banco zerado**. Nenhum dado do Cloud é transferido.

---

## 0. Pré-requisitos

- Ubuntu 22.04+ com pelo menos **4 GB de RAM livres** (Supabase usa ~2 GB em idle).
- Acesso root.
- Subdomínio `supabase.vortisgestao.com.br` apontando para o mesmo IP do `app.vortisgestao.com.br`.
- Provider SMTP escolhido (Resend, Brevo, Amazon SES, Gmail SMTP…). Sem SMTP, signup com confirmação e reset de senha não funcionam.

---

## 1. Instalar a stack

Tudo já foi roteirizado em `deploy/supabase-install.sh`:

```bash
cd /opt/vortis           # ou onde o repo está
sudo bash deploy/supabase-install.sh
```

O script:

1. Instala Docker se faltar.
2. Clona `github.com/supabase/supabase` em `/opt/supabase`.
3. Gera `POSTGRES_PASSWORD`, `JWT_SECRET`, `ANON_KEY`, `SERVICE_ROLE_KEY` e senha do Studio (admin) — **imprime no console uma vez só, copie agora**.
4. Sobe os containers (`docker compose up -d`).
5. Aguarda o Postgres ficar saudável.
6. Aplica o schema do Vortis a partir de `deploy/supabase-schema.sql` (todas as 27 migrações consolidadas).

Validação rápida:

```bash
curl -I http://127.0.0.1:8000/rest/v1/
docker compose -f /opt/supabase/docker/docker-compose.yml ps
```

---

## 2. Expor com HTTPS

```bash
sudo cp deploy/nginx-supabase.conf /etc/nginx/sites-available/supabase
sudo ln -s /etc/nginx/sites-available/supabase /etc/nginx/sites-enabled/supabase
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d supabase.vortisgestao.com.br
```

Depois disso o Studio fica em `https://supabase.vortisgestao.com.br/` (usuário `admin` e a senha que o script imprimiu).

---

## 3. Configurar SMTP

Edite `/opt/supabase/docker/.env`:

```env
SMTP_HOST=smtp.resend.com
SMTP_PORT=465
SMTP_USER=resend
SMTP_PASS=<sua_api_key>
SMTP_ADMIN_EMAIL=contato@vortisgestao.com.br
SMTP_SENDER_NAME=Vortis Gestão
```

E recarregue:

```bash
cd /opt/supabase/docker && docker compose up -d
```

---

## 4. Apontar o app pra nova URL

No servidor, dentro do repo do Vortis, edite o `.env`:

```env
VITE_SUPABASE_URL=https://supabase.vortisgestao.com.br
VITE_SUPABASE_PUBLISHABLE_KEY=<ANON_KEY gerado>
VITE_SUPABASE_PROJECT_ID=self-hosted
```

Rebuild:

```bash
sudo bash deploy/deploy.sh
```

> O `deploy.sh` agora detecta quando o `.env` aponta para self-hosted e mostra um aviso, pra você não rebuildar com a configuração errada por engano.

---

## 5. Edge Functions

```bash
# Instalar CLI do Supabase
curl -fsSL https://supabase.com/install.sh | sh

cd /opt/vortis
supabase functions deploy mp-webhook \
  --project-ref local \
  --no-verify-jwt \
  --workdir .

# Repita para: mp-create-invoice, generate-recurring-invoices,
# check-overdue-subscriptions, admin-create-user, create-company-user,
# fiscal-validate-certificate, request-plan-upgrade
```

Secrets das funções (defina no `.env` do edge-runtime, em `/opt/supabase/docker/volumes/functions/.env`):

```env
MP_ACCESS_TOKEN=...
MP_WEBHOOK_SECRET=...
LOVABLE_API_KEY=...        # opcional, se mantiver o gateway de IA da Lovable
```

Atualize o webhook do Mercado Pago para:
`https://supabase.vortisgestao.com.br/functions/v1/mp-webhook`

---

## 6. Primeiro usuário

1. Acesse `https://app.vortisgestao.com.br` e crie a conta pela tela de signup (ou crie via Studio em **Authentication → Users → Add user**).
2. No Studio → **SQL Editor**, promova o usuário a admin:
   ```sql
   insert into public.user_roles (user_id, role)
   values ('<UUID_DO_USUARIO>', 'admin');
   ```
3. Faça login e teste o fluxo: criar produto, abrir caixa, lançar venda, gerar PDF de orçamento.

---

## 7. Backup

Instalado por um único comando:

```bash
sudo bash deploy/setup-backup.sh
```

O script:

- Copia `deploy/vortis-backup.sh` para `/etc/cron.daily/vortis-backup` (roda 1×/dia).
- Cria `/backup/vortis` (configurável por `VORTIS_BACKUP_DIR`).
- Roda o primeiro backup na hora pra validar.

O que é gerado por execução:

| Arquivo | Conteúdo |
|---|---|
| `db-YYYY-MM-DD-HHMM.sql.gz` | `pg_dumpall` de todo o Postgres (inclui `auth`, `storage`, `public`) |
| `storage-YYYY-MM-DD-HHMM.tar.gz` | Volume `/opt/supabase/docker/volumes/storage` (certificados fiscais etc.) |
| `backup.log` | Log incremental de todas as execuções |

Retenção padrão: **14 dias** (ajuste com `VORTIS_BACKUP_RETENTION=30 sudo bash deploy/setup-backup.sh`).

### Cópia externa (recomendado)

Adicione no crontab do root (`sudo crontab -e`) — toda madrugada de domingo manda pra outro host:

```cron
0 3 * * 0 rsync -az /backup/vortis/ usuario@offsite:/backup/vortis/
```

Alternativas: AWS S3 (`aws s3 sync`), Backblaze B2 (`rclone sync`), Wasabi, ou qualquer destino com SSH.

---

## 8. Operação contínua

| O que | Como |
|---|---|
| Ver logs de um container | `docker logs -f supabase-auth` (ou `-db`, `-rest`, `-realtime`, `-kong`…) |
| Reiniciar tudo | `cd /opt/supabase/docker && docker compose restart` |
| Atualizar versão do Supabase | `cd /opt/supabase && git pull && cd docker && docker compose pull && docker compose up -d` (faça backup antes!) |
| Voltar pro Cloud em emergência | Reverta `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` no `.env`, rebuild com `deploy.sh`. Os dados do Cloud continuam intactos. |

---

## Custos x responsabilidades

| Antes (Cloud) | Agora (self-hosted) |
|---|---|
| Mensalidade Lovable Cloud | Só o servidor |
| Backup gerenciado | **Você** mantém o cron + storage externo |
| Updates de segurança do Supabase | **Você** acompanha releases do GitHub |
| SMTP/observabilidade incluídos | **Você** contrata provider de SMTP e monitora |
| RTO/RPO definidos pela plataforma | **Você** define e testa |
