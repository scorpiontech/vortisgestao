#!/usr/bin/env bash
# Instala o Supabase self-hosted (Docker) no servidor.
# Uso: sudo bash deploy/supabase-install.sh
#
# Pré-requisitos: Ubuntu 22.04+, acesso root, portas 80/443 livres para o Nginx
# do app principal. O Supabase fica em 127.0.0.1:8000 (Kong) e é exposto via
# Nginx em https://supabase.vortisgestao.com.br.

set -euo pipefail

SUPABASE_DIR="/opt/supabase"
DOMAIN="${SUPABASE_DOMAIN:-supabase.vortisgestao.com.br}"
SITE_URL="${SITE_URL:-https://app.vortisgestao.com.br}"

echo "=== Supabase self-hosted — Vortis ==="
echo "Domínio: $DOMAIN"
echo "SITE_URL (app): $SITE_URL"
echo

# 1. Docker
if ! command -v docker &>/dev/null; then
  echo "[1/6] Instalando Docker..."
  curl -fsSL https://get.docker.com | sh
  apt-get install -y docker-compose-plugin
else
  echo "[1/6] Docker já instalado ✓"
fi

# 2. Clonar repositório do Supabase
if [ ! -d "$SUPABASE_DIR" ]; then
  echo "[2/6] Clonando Supabase em $SUPABASE_DIR..."
  git clone --depth 1 https://github.com/supabase/supabase "$SUPABASE_DIR"
else
  echo "[2/6] Repo Supabase já presente em $SUPABASE_DIR ✓"
fi

cd "$SUPABASE_DIR/docker"

# 3. .env
if [ ! -f .env ]; then
  echo "[3/6] Gerando .env com segredos aleatórios..."
  cp .env.example .env

  POSTGRES_PASSWORD=$(openssl rand -hex 24)
  JWT_SECRET=$(openssl rand -hex 32)
  DASHBOARD_PASSWORD=$(openssl rand -hex 12)

  # Gerar ANON_KEY e SERVICE_ROLE_KEY a partir do JWT_SECRET
  IAT=$(date +%s)
  EXP=$((IAT + 60*60*24*365*10))  # 10 anos

  b64url() { openssl base64 -A | tr '+/' '-_' | tr -d '='; }
  HEADER=$(printf '{"alg":"HS256","typ":"JWT"}' | b64url)
  ANON_PAYLOAD=$(printf '{"role":"anon","iss":"supabase","iat":%s,"exp":%s}' "$IAT" "$EXP" | b64url)
  SVC_PAYLOAD=$(printf '{"role":"service_role","iss":"supabase","iat":%s,"exp":%s}' "$IAT" "$EXP" | b64url)
  sign() { printf '%s' "$1" | openssl dgst -sha256 -hmac "$JWT_SECRET" -binary | b64url; }
  ANON_KEY="$HEADER.$ANON_PAYLOAD.$(sign "$HEADER.$ANON_PAYLOAD")"
  SERVICE_ROLE_KEY="$HEADER.$SVC_PAYLOAD.$(sign "$HEADER.$SVC_PAYLOAD")"

  sed -i \
    -e "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$POSTGRES_PASSWORD|" \
    -e "s|^JWT_SECRET=.*|JWT_SECRET=$JWT_SECRET|" \
    -e "s|^ANON_KEY=.*|ANON_KEY=$ANON_KEY|" \
    -e "s|^SERVICE_ROLE_KEY=.*|SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY|" \
    -e "s|^DASHBOARD_USERNAME=.*|DASHBOARD_USERNAME=admin|" \
    -e "s|^DASHBOARD_PASSWORD=.*|DASHBOARD_PASSWORD=$DASHBOARD_PASSWORD|" \
    -e "s|^SITE_URL=.*|SITE_URL=$SITE_URL|" \
    -e "s|^API_EXTERNAL_URL=.*|API_EXTERNAL_URL=https://$DOMAIN|" \
    -e "s|^SUPABASE_PUBLIC_URL=.*|SUPABASE_PUBLIC_URL=https://$DOMAIN|" \
    .env

  echo
  echo "=== CREDENCIAIS — GUARDE EM LOCAL SEGURO ==="
  echo "POSTGRES_PASSWORD=$POSTGRES_PASSWORD"
  echo "JWT_SECRET=$JWT_SECRET"
  echo "ANON_KEY=$ANON_KEY"
  echo "SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY"
  echo "Studio: https://$DOMAIN  (admin / $DASHBOARD_PASSWORD)"
  echo "============================================"
  echo
else
  echo "[3/6] .env já existe — mantendo configuração atual ✓"
fi

# 4. Subir stack
echo "[4/6] Subindo containers (docker compose pull + up -d)..."
docker compose pull
docker compose up -d

# 5. Aguardar Postgres
echo "[5/6] Aguardando Postgres ficar saudável..."
for i in {1..60}; do
  if docker exec supabase-db pg_isready -U postgres &>/dev/null; then
    echo "  Postgres OK ✓"
    break
  fi
  sleep 2
done

# 6. Aplicar schema do Vortis
SCHEMA_FILE="$(dirname "$(readlink -f "$0")")/supabase-schema.sql"
if [ -f "$SCHEMA_FILE" ]; then
  echo "[6/6] Aplicando schema do Vortis ($SCHEMA_FILE)..."
  docker exec -i supabase-db psql -U postgres -d postgres < "$SCHEMA_FILE" \
    > /tmp/vortis-schema.log 2>&1 || {
      echo "  ⚠ Houve erros — veja /tmp/vortis-schema.log (alguns podem ser benignos em re-execução)"
    }
else
  echo "[6/6] ⚠ Arquivo $SCHEMA_FILE não encontrado — pule este passo se o schema já foi aplicado."
fi

echo
echo "✅ Supabase self-hosted instalado."
echo
echo "Próximos passos:"
echo "  1. Configure DNS: $DOMAIN → IP deste servidor"
echo "  2. Copie deploy/nginx-supabase.conf para /etc/nginx/sites-available/ e habilite"
echo "  3. sudo certbot --nginx -d $DOMAIN"
echo "  4. Edite SMTP_* em $SUPABASE_DIR/docker/.env e rode 'docker compose up -d'"
echo "  5. Atualize o .env do app Vortis com VITE_SUPABASE_URL=https://$DOMAIN e o ANON_KEY"
echo "  6. Rebuild do app: sudo bash deploy/deploy.sh"
