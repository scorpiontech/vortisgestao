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
# Tenta a instalação normal; se falhar por conflito de peer dependency
# (ex.: versão incorreta do Vite num node_modules antigo), limpa
# node_modules e package-lock.json e reinstala com --legacy-peer-deps.
# Para forçar a limpeza manualmente: sudo FORCE_CLEAN_INSTALL=1 bash deploy.sh
echo "[3/5] Instalando dependências do projeto..."

install_deps() {
    if [ "$FORCE_CLEAN_INSTALL" = "1" ]; then
        echo "  Modo forçado (FORCE_CLEAN_INSTALL=1): limpando node_modules e package-lock.json..."
        rm -rf node_modules package-lock.json
        npm install --legacy-peer-deps
        return
    fi

    if npm install; then
        echo "  Dependências instaladas ✓"
    else
        echo ""
        echo "  ⚠️  Instalação normal falhou — possível conflito de peer dependency."
        echo "  Limpando node_modules e package-lock.json..."
        rm -rf node_modules package-lock.json
        echo "  Reinstalando com --legacy-peer-deps..."
        npm install --legacy-peer-deps
    fi
}

install_deps

# 3. Gerar build de produção
echo "[4/5] Gerando build de produção..."
npm run build

# 4. Copiar arquivos para o diretório do Nginx
echo "[5/5] Configurando Nginx..."

# Validar que o build gerou index.html antes de apagar o diretório atual
if [ ! -f "dist/index.html" ]; then
    echo "❌ ERRO: dist/index.html não encontrado. O build falhou."
    echo "   Verifique a saída de 'npm run build' acima."
    exit 1
fi

rm -rf "$APP_DIR"
mkdir -p "$APP_DIR"
cp -r dist/. "$APP_DIR/"

# Permissões para o Nginx (www-data) conseguir ler os arquivos.
# Sem isso, o Nginx retorna 403 Forbidden mesmo com a config correta.
chown -R www-data:www-data "$APP_DIR"
find "$APP_DIR" -type d -exec chmod 755 {} \;
find "$APP_DIR" -type f -exec chmod 644 {} \;

# Garantir que os diretórios pai sejam atravessáveis pelo www-data
chmod o+x /var/www 2>/dev/null || true


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
echo ""
echo "Em caso de erro de peer dependency, force a reinstalação limpa:"
echo "  sudo FORCE_CLEAN_INSTALL=1 bash deploy/deploy.sh"
