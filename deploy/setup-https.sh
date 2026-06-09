#!/bin/bash
# Configura HTTPS para app.vortisgestao.com.br via Let's Encrypt (Certbot).
# Uso: sudo bash deploy/setup-https.sh
#
# Pré-requisitos:
#  - DNS público de app.vortisgestao.com.br apontando para o IP desta máquina
#    (ou para o IP público com port-forward 80/443 → esta VM).
#  - Porta 80 e 443 liberadas no UFW e no roteador.

set -e

DOMAIN="app.vortisgestao.com.br"
EMAIL="${CERTBOT_EMAIL:-admin@vortisgestao.com.br}"
WEBROOT="/var/www/certbot"

if [ "$EUID" -ne 0 ]; then
  echo "❌ Execute com sudo."
  exit 1
fi

echo "=== Configurando HTTPS para $DOMAIN ==="

# 1. Garantir webroot do ACME
mkdir -p "$WEBROOT/.well-known/acme-challenge"
chown -R www-data:www-data "$WEBROOT"

# 2. Certbot instalado?
if ! command -v certbot >/dev/null 2>&1; then
  echo "[1/4] Instalando Certbot..."
  apt-get update -y
  apt-get install -y certbot python3-certbot-nginx
else
  echo "[1/4] Certbot já instalado ✓"
fi

# 3. Validar resolução DNS antes de pedir o cert (evita rate limit do LE)
echo "[2/4] Verificando DNS de $DOMAIN..."
RESOLVED=$(getent hosts "$DOMAIN" | awk '{print $1}' | head -n1 || true)
PUBLIC_IP=$(curl -fsS https://api.ipify.org || echo "desconhecido")
echo "  DNS responde:    ${RESOLVED:-nada}"
echo "  IP público daqui: $PUBLIC_IP"
if [ -z "$RESOLVED" ]; then
  echo "❌ O domínio $DOMAIN não resolve. Ajuste o registro A antes de continuar."
  exit 1
fi
if [ "$RESOLVED" != "$PUBLIC_IP" ] && [ "$PUBLIC_IP" != "desconhecido" ]; then
  echo "⚠️  Aviso: DNS aponta para $RESOLVED, mas o IP público desta máquina é $PUBLIC_IP."
  echo "   Sem port-forward 80/443 para cá, o desafio HTTP-01 vai falhar."
  read -r -p "Continuar mesmo assim? [y/N] " ANS
  [ "$ANS" = "y" ] || [ "$ANS" = "Y" ] || exit 1
fi

# 4. Testar e recarregar Nginx (config já contém o location do ACME)
echo "[3/4] Validando Nginx..."
nginx -t
systemctl reload nginx

# 5. Emitir o certificado pelo plugin nginx (gera o bloco 443 automaticamente)
echo "[4/4] Solicitando certificado Let's Encrypt..."
certbot --nginx \
  --non-interactive --agree-tos \
  --email "$EMAIL" \
  --redirect \
  -d "$DOMAIN"

echo ""
echo "✅ HTTPS ativo em https://$DOMAIN"
echo "   Renovação automática: systemctl list-timers | grep certbot"
