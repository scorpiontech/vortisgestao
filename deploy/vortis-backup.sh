#!/bin/bash
# Vortis Gestão — backup diário do Supabase self-hosted
# Instalado em /etc/cron.daily/vortis-backup (sem extensão) por setup-backup.sh

set -euo pipefail

DEST="${VORTIS_BACKUP_DIR:-/backup/vortis}"
RETENTION_DAYS="${VORTIS_BACKUP_RETENTION:-14}"
STORAGE_DIR="${VORTIS_STORAGE_DIR:-/opt/supabase/docker/volumes/storage}"
DB_CONTAINER="${VORTIS_DB_CONTAINER:-supabase-db}"
DATE=$(date +%F-%H%M)
LOG="$DEST/backup.log"

mkdir -p "$DEST"

{
  echo "===== $(date -Is) — iniciando backup ====="

  # Dump do Postgres (todas as databases para preservar auth/storage/realtime)
  if docker ps --format '{{.Names}}' | grep -q "^${DB_CONTAINER}$"; then
    docker exec "$DB_CONTAINER" pg_dumpall -U postgres \
      | gzip > "$DEST/db-$DATE.sql.gz"
    echo "✓ db-$DATE.sql.gz ($(du -h "$DEST/db-$DATE.sql.gz" | cut -f1))"
  else
    echo "✗ Container $DB_CONTAINER não está rodando — pulando dump do banco"
    exit 1
  fi

  # Volume de storage (arquivos enviados — ex.: certificados fiscais)
  if [ -d "$STORAGE_DIR" ]; then
    tar -czf "$DEST/storage-$DATE.tar.gz" -C "$(dirname "$STORAGE_DIR")" "$(basename "$STORAGE_DIR")"
    echo "✓ storage-$DATE.tar.gz ($(du -h "$DEST/storage-$DATE.tar.gz" | cut -f1))"
  else
    echo "ℹ Diretório de storage $STORAGE_DIR não existe — pulando"
  fi

  # Retenção
  find "$DEST" -maxdepth 1 -type f \( -name 'db-*.sql.gz' -o -name 'storage-*.tar.gz' \) \
    -mtime +"$RETENTION_DAYS" -print -delete | sed 's/^/✗ removido (expirado): /'

  echo "===== $(date -Is) — backup concluído ====="
  echo
} >> "$LOG" 2>&1
