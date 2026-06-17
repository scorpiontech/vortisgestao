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

echo "[2/5] Verificando Node.js..."
echo "  PATH atual: $PATH"

# Remover versões antigas do NodeSource se existirem
apt-get remove -y nodejs 2>/dev/null || true

# Instalar Node.js 20 via NodeSource
echo "  Instalando Node.js 20 via NodeSource..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# Limpar cache de binários do shell
hash -r

NODE_BIN=$(command -v node || true)
NODE_VERSION=$("$NODE_BIN" -v 2>/dev/null | sed 's/^v//' | cut -d. -f1)

echo "  Node detectado: $("$NODE_BIN" -v 2>/dev/null || echo 'não encontrado') em ${NODE_BIN:-desconhecido}"

if [ -z "$NODE_VERSION" ] || [ "$NODE_VERSION" -lt 20 ]; then
    echo ""
    echo "❌ ERRO: Node.js 20+ não foi instalado corretamente."
    echo "  Versão detectada: $("$NODE_BIN" -v 2>/dev/null || echo 'nenhuma')"
    echo ""
    echo "Tente manualmente:"
    echo "  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -"
    echo "  sudo apt-get install -y nodejs"
    echo "  node -v"
    echo ""
    echo "Se o problema persistir, remova versões conflitantes:"
    echo "  sudo apt-get purge -y nodejs npm"
    echo "  sudo rm -rf /usr/local/bin/node /usr/local/bin/npm"
    echo "  Depois execute o deploy novamente."
    exit 1
fi

echo "[2/5] Usando Node $("$NODE_BIN" -v) ✓"

# 2. Instalar dependências do projeto
# Aviso: backend self-hosted vs Lovable Cloud
if [ -f .env ] && grep -q "^VITE_SUPABASE_URL=" .env; then
    SUPA_URL=$(grep "^VITE_SUPABASE_URL=" .env | head -1 | cut -d= -f2- | tr -d '"')
    case "$SUPA_URL" in
        *supabase.co*)
            echo "  ⚠  .env aponta para Lovable Cloud ($SUPA_URL)."
            echo "     Se você instalou o Supabase self-hosted, edite .env antes do build."
            ;;
        *)
            echo "  ℹ  Backend self-hosted detectado: $SUPA_URL"
            ;;
    esac
fi

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

# Copiar config do Nginx APENAS na primeira instalação.
# Se já existir (provavelmente já modificada pelo Certbot com o bloco HTTPS),
# preservamos para não perder a configuração SSL.
if [ ! -f "$NGINX_CONF" ]; then
    echo "  Instalando nginx.conf pela primeira vez..."
    cp deploy/nginx.conf "$NGINX_CONF"
else
    echo "  nginx.conf já existe — preservando configuração atual (HTTPS/Certbot)."
    echo "  Para forçar a reinstalação: sudo rm $NGINX_CONF && sudo bash deploy/deploy.sh"
fi

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
