#!/bin/bash
# Instala o cron diário de backup do Vortis no servidor.
# Uso:  sudo bash deploy/setup-backup.sh

set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "✗ Execute como root (sudo)." >&2
  exit 1
fi

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$REPO_DIR/deploy/vortis-backup.sh"
DEST="/etc/cron.daily/vortis-backup"
BACKUP_DIR="${VORTIS_BACKUP_DIR:-/backup/vortis}"

if [ ! -f "$SRC" ]; then
  echo "✗ Não encontrei $SRC" >&2
  exit 1
fi

echo "→ Copiando script para $DEST"
install -m 0755 "$SRC" "$DEST"

echo "→ Criando diretório de destino: $BACKUP_DIR"
mkdir -p "$BACKUP_DIR"
chmod 0750 "$BACKUP_DIR"

echo "→ Testando execução agora (gera o primeiro backup)…"
if "$DEST"; then
  echo "✓ Primeiro backup OK. Arquivos em $BACKUP_DIR:"
  ls -lh "$BACKUP_DIR" | tail -n +2
else
  echo "✗ Falhou. Veja $BACKUP_DIR/backup.log" >&2
  exit 1
fi

cat <<EOF

✓ Cron instalado em $DEST (roda 1x por dia via /etc/cron.daily).
  Logs:        $BACKUP_DIR/backup.log
  Retenção:    ${VORTIS_BACKUP_RETENTION:-14} dias
  DB dump:     $BACKUP_DIR/db-YYYY-MM-DD-HHMM.sql.gz
  Storage:     $BACKUP_DIR/storage-YYYY-MM-DD-HHMM.tar.gz

Recomendado: configurar uma cópia semanal para fora do servidor
(rsync para outro host, S3, Backblaze B2, etc).
Exemplo no crontab do root (crontab -e):
  0 3 * * 0  rsync -az $BACKUP_DIR/ usuario@offsite:/backup/vortis/
EOF
