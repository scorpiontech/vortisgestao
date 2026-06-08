#!/bin/bash
# Provisionamento inicial - Vortis Gestão em Ubuntu 22.04 (Proxmox VM/LXC)
# Uso: sudo bash deploy/provision-ubuntu22.sh
#
# Executa uma só vez, antes do primeiro `deploy.sh`. Configura:
#  - timezone America/Sao_Paulo
#  - swap de 2GB (se não houver)
#  - firewall UFW (libera 22, 80, 443)
#  - pacotes base, Node.js 20 e Nginx
#  - unattended-upgrades (segurança)

set -e

if [ "$EUID" -ne 0 ]; then
  echo "❌ Execute com sudo: sudo bash deploy/provision-ubuntu22.sh"
  exit 1
fi

. /etc/os-release 2>/dev/null || true
if [ "$ID" != "ubuntu" ]; then
  echo "⚠️  Este script foi feito para Ubuntu. Detectado: ${ID:-desconhecido}. Prosseguindo mesmo assim..."
fi

echo "=== Provisionamento Vortis Gestão (Ubuntu 22.04 / Proxmox) ==="

echo "[1/7] Atualizando pacotes do sistema..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get upgrade -y

echo "[2/7] Instalando pacotes base..."
apt-get install -y curl ca-certificates git ufw nginx unattended-upgrades tzdata htop

echo "[3/7] Configurando timezone America/Sao_Paulo..."
timedatectl set-timezone America/Sao_Paulo || true

echo "[4/7] Configurando swap (2GB) se necessário..."
if ! swapon --show | grep -q .; then
  if [ ! -f /swapfile ]; then
    fallocate -l 2G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
    echo "  Swap de 2GB criado em /swapfile ✓"
  else
    swapon /swapfile || true
    echo "  /swapfile já existia, ativado ✓"
  fi
else
  echo "  Swap já configurado ✓"
fi

echo "[5/7] Configurando firewall UFW..."
ufw --force reset >/dev/null
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment 'SSH'
ufw allow 80/tcp comment 'HTTP'
ufw allow 443/tcp comment 'HTTPS'
ufw --force enable
ufw status

echo "[6/7] Instalando Node.js 20 (NodeSource)..."
if ! command -v node >/dev/null 2>&1 || [ "$(node -v | sed 's/^v//' | cut -d. -f1)" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
echo "  Node $(node -v) / npm $(npm -v) ✓"

echo "[7/7] Habilitando atualizações de segurança automáticas..."
dpkg-reconfigure -f noninteractive unattended-upgrades || true
systemctl enable --now unattended-upgrades || true

# Ajuste de permissões padrão do Nginx
systemctl enable --now nginx

echo ""
echo "✅ Provisionamento concluído!"
echo ""
echo "Próximo passo: gerar o build e publicar o site."
echo "  cd $(pwd)"
echo "  sudo bash deploy/deploy.sh"
echo ""
echo "IP atual da máquina: $(hostname -I | awk '{print $1}')"
