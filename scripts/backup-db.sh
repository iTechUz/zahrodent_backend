#!/usr/bin/env bash
#
# Zahro Dental — PostgreSQL backup (pg_dump custom format, gzip, rotation).
#
# Usage:
#   scripts/backup-db.sh                 # settings from env / .env below
#
# Two modes (pick one):
#   1) PG_CONTAINER=zahro_db    — runs pg_dump inside that Docker container
#                                 (Postgres runs in Docker on this server).
#      PGUSER / PGDATABASE      — default postgres / zahro_dental.
#   2) DATABASE_URL=postgresql://user:pass@host:5432/db?schema=public
#                               — uses the host's pg_dump (managed DB or a
#                                 port published on 127.0.0.1).
#   If neither is set, DATABASE_URL is read from ENV_FILE.
#
# Other settings:
#   BACKUP_DIR      default /home/ubuntu/backups/zahro_dental
#   RETENTION_DAYS  default 14 (older *.dump.gz files are deleted)
#   ENV_FILE        default /home/ubuntu/projects/zaxro_dent/backend/zahrodent_backend/.env
#
# Cron (daily 03:15, Asia/Tashkent server time):
#   15 3 * * * /home/ubuntu/projects/zaxro_dent/backend/zahrodent_backend/scripts/backup-db.sh >> /home/ubuntu/backups/zahro_dental/backup.log 2>&1
#
# Restore: see docs/DEPLOYMENT.md ("Backup va restore").

set -Eeuo pipefail
umask 077

BACKUP_DIR="${BACKUP_DIR:-/home/ubuntu/backups/zahro_dental}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
ENV_FILE="${ENV_FILE:-/home/ubuntu/projects/zaxro_dent/backend/zahrodent_backend/.env}"
PG_CONTAINER="${PG_CONTAINER:-}"
PGUSER="${PGUSER:-postgres}"
PGDATABASE="${PGDATABASE:-zahro_dental}"

log() { printf '%s [backup] %s\n' "$(date '+%Y-%m-%dT%H:%M:%S%z')" "$*"; }
die() { log "XATO: $*"; exit 1; }

if ! [[ "$RETENTION_DAYS" =~ ^[0-9]+$ ]] || [ "$RETENTION_DAYS" -lt 1 ]; then
  die "RETENTION_DAYS musbat butun son bo'lishi kerak (hozir: $RETENTION_DAYS)"
fi

# DATABASE_URL from the app's env file when no mode is configured.
if [ -z "$PG_CONTAINER" ] && [ -z "${DATABASE_URL:-}" ] && [ -f "$ENV_FILE" ]; then
  DATABASE_URL="$(grep -E '^DATABASE_URL=' "$ENV_FILE" | tail -n 1 | cut -d= -f2- | sed -e 's/^["'\'']//' -e 's/["'\'']$//')"
fi

mkdir -p "$BACKUP_DIR"

# One backup at a time.
LOCK_FILE="$BACKUP_DIR/.backup.lock"
if command -v flock >/dev/null 2>&1; then
  exec 9>"$LOCK_FILE"
  flock -n 9 || die "boshqa backup jarayoni ishlayapti"
fi

STAMP="$(date '+%Y%m%d_%H%M%S')"
TARGET="$BACKUP_DIR/${PGDATABASE}_${STAMP}.dump.gz"
TMP="$TARGET.partial"
trap 'rm -f "$TMP"' EXIT

if [ -n "$PG_CONTAINER" ]; then
  command -v docker >/dev/null 2>&1 || die "docker topilmadi"
  log "pg_dump: konteyner=$PG_CONTAINER db=$PGDATABASE"
  # -Z0: no compression inside the dump — gzip does it once.
  docker exec "$PG_CONTAINER" pg_dump -U "$PGUSER" -d "$PGDATABASE" -Fc -Z0 --no-owner \
    | gzip -9 > "$TMP"
elif [ -n "${DATABASE_URL:-}" ]; then
  command -v pg_dump >/dev/null 2>&1 || die "pg_dump topilmadi (apt install postgresql-client)"
  # libpq rejects Prisma's ?schema=... parameter → strip the query string.
  PG_URL="${DATABASE_URL%%\?*}"
  log "pg_dump: DATABASE_URL (host pg_dump)"
  pg_dump --dbname="$PG_URL" -Fc -Z0 --no-owner | gzip -9 > "$TMP"
else
  die "PG_CONTAINER yoki DATABASE_URL berilmagan (ENV_FILE=$ENV_FILE topilmadi)"
fi

gzip -t "$TMP" || die "arxiv buzilgan: $TMP"
SIZE="$(wc -c < "$TMP" | tr -d ' ')"
[ "$SIZE" -gt 100 ] || die "backup juda kichik ($SIZE bayt) — pg_dump xatosi?"
mv "$TMP" "$TARGET"
trap - EXIT
log "tayyor: $TARGET ($SIZE bayt)"

# Rotation: delete backups older than RETENTION_DAYS days.
DELETED="$(find "$BACKUP_DIR" -maxdepth 1 -type f -name '*.dump.gz' -mtime +"$RETENTION_DAYS" -print -delete | wc -l | tr -d ' ')"
log "rotatsiya: ${DELETED} ta eski backup o'chirildi (> ${RETENTION_DAYS} kun)"
