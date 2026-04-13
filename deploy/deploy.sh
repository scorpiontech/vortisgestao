#!/bin/bash
# Script de deploy - Vortis Gestão
# Uso: sudo bash deploy.sh

set -e

APP_DIR="/var/www/vortis"
NGINX_CONF="/etc/nginx/sites-available/vortis"
NGINX_ENABLED="/etc/nginx/sites-enabled/vortis"

echo "=== Deploy Vortis Gestão ==="

# 1. Instalar dependências do sistema (se necessário)
if ! command -v nginx &> /dev/null; then
    echo "[1/5] Instalando Nginx..."
    apt-get update && apt-get install -y nginx
else
    echo "[1/5] Nginx já instalado ✓"
fi

if ! command -v node &> /dev/null; then
    echo "[2/5] Instalando Node.js 20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
else
    echo "[2/5] Node.js já instalado ✓"
fi

# 2. Instalar dependências do projeto
echo "[3/5] Instalando dependências do projeto..."
npm install

# 3. Gerar build de produção
echo "[4/5] Gerando build de produção..."
npm run build

# 4. Copiar arquivos para o diretório do Nginx
echo "[5/5] Configurando Nginx..."
rm -rf "$APP_DIR"
mkdir -p "$APP_DIR"
cp -r dist/* "$APP_DIR/"

# Copiar config do Nginx
cp deploy/nginx.conf "$NGINX_CONF"

# Ativar site (remover default se existir)
rm -f /etc/nginx/sites-enabled/default
ln -sf "$NGINX_CONF" "$NGINX_ENABLED"

# Testar e recarregar Nginx
nginx -t
systemctl reload nginx
systemctl enable nginx

echo ""
echo "✅ Deploy concluído com sucesso!"
echo "📌 Acesse: http://$(hostname -I | awk '{print $1}')"
echo ""
echo "Para atualizar futuramente:"
echo "  1. git pull"
echo "  2. sudo bash deploy/deploy.sh"
