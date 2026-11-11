#!/usr/bin/env bash
#
# Universal "make a backup and ship it to S3" runner (PoC) — not tied to Zahro.
# The thing being backed up is described by ONE command that writes the data to stdout
# (pg_dump, mysqldump, tar, mongodump --archive ...). The script gzips it, uploads it to
# S3 under <PREFIX>/<YYYY>/<MM>/<DD>/<NAME>_<timestamp>.gz, verifies the upload and
# optionally keeps a local copy for N days (the "2 copies on different media" part of 3-2-1).
#
# Config (env or ENV_FILE):
#   BACKUP_NAME        short id, e.g. zahro_dental                     (required)
#   BACKUP_CMD         command printing the backup to stdout           (required)
#                      e.g. 'docker exec zahro_db pg_dump -U postgres -d zahro_dental -Fc -Z0 --no-owner'
#   S3_BUCKET          bucket name                                     (required)
#   S3_PREFIX          key prefix, default "backups/$BACKUP_NAME"
#   AWS_PROFILE / AWS_REGION   standard AWS CLI settings (prefer an instance role / profile; no keys in this file)
#   S3_STORAGE_CLASS   default STANDARD_IA
#   S3_SSE             default aws:kms (use AES256 if no KMS key); S3_KMS_KEY_ID optional
#   LOCAL_DIR          keep a local copy here (default: none)
#   LOCAL_RETENTION_DAYS   default 3 (only with LOCAL_DIR). Remote retention = S3 lifecycle rules, see docs/BACKUP_S3.md.
#   MIN_BYTES          fail if the archive is smaller, default 100
#   HEARTBEAT_URL      optional URL to GET after a successful run (healthchecks.io style dead-man switch)
#
# Hourly cron:  0 * * * * /path/scripts/s3-backup.sh >> /var/log/s3-backup.log 2>&1
set -Eeuo pipefail
umask 077

ENV_FILE="${ENV_FILE:-}"
# shellcheck disable=SC1090
[ -n "$ENV_FILE" ] && [ -f "$ENV_FILE" ] && { set -a; . "$ENV_FILE"; set +a; }

log() { printf '%s [s3-backup] %s\n' "$(date '+%Y-%m-%dT%H:%M:%S%z')" "$*"; }
die() { log "XATO: $*"; exit 1; }

: "${BACKUP_NAME:?BACKUP_NAME kerak}"
: "${BACKUP_CMD:?BACKUP_CMD kerak}"
: "${S3_BUCKET:?S3_BUCKET kerak}"
[[ "$BACKUP_NAME" =~ ^[A-Za-z0-9_.-]+$ ]] || die "BACKUP_NAME faqat harf/raqam/_.- bo'lishi kerak"
S3_PREFIX="${S3_PREFIX:-backups/$BACKUP_NAME}"
S3_STORAGE_CLASS="${S3_STORAGE_CLASS:-STANDARD_IA}"
S3_SSE="${S3_SSE:-aws:kms}"
MIN_BYTES="${MIN_BYTES:-100}"
LOCAL_RETENTION_DAYS="${LOCAL_RETENTION_DAYS:-3}"

command -v aws >/dev/null 2>&1 || die "aws cli topilmadi"
command -v gzip >/dev/null 2>&1 || die "gzip topilmadi"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

# one run at a time (cron overlap protection)
if command -v flock >/dev/null 2>&1; then
  exec 9>"${TMPDIR:-/tmp}/s3-backup-$BACKUP_NAME.lock"
  flock -n 9 || die "boshqa backup jarayoni ishlayapti"
fi

STAMP="$(date -u '+%Y%m%dT%H%M%SZ')"
FILE="${BACKUP_NAME}_${STAMP}.gz"
ARCHIVE="$WORK/$FILE"

log "boshlandi: $BACKUP_NAME"
bash -o pipefail -c "$BACKUP_CMD" | gzip -9 > "$ARCHIVE" || die "backup buyrug'i xato bilan tugadi"
gzip -t "$ARCHIVE" || die "arxiv buzilgan"
SIZE="$(wc -c < "$ARCHIVE" | tr -d ' ')"
[ "$SIZE" -ge "$MIN_BYTES" ] || die "arxiv juda kichik ($SIZE bayt)"
SHA="$(shasum -a 256 "$ARCHIVE" 2>/dev/null | cut -d' ' -f1 || sha256sum "$ARCHIVE" | cut -d' ' -f1)"

KEY="$S3_PREFIX/${STAMP:0:4}/${STAMP:4:2}/${STAMP:6:2}/$FILE"
SSE_ARGS=(--sse "$S3_SSE")
[ -n "${S3_KMS_KEY_ID:-}" ] && SSE_ARGS+=(--sse-kms-key-id "$S3_KMS_KEY_ID")

aws s3 cp "$ARCHIVE" "s3://$S3_BUCKET/$KEY" --only-show-errors \
  --storage-class "$S3_STORAGE_CLASS" "${SSE_ARGS[@]}" \
  --metadata "sha256=$SHA,source=$BACKUP_NAME" || die "S3 ga yuklab bo'lmadi"

# verify: object exists with the same size
REMOTE_SIZE="$(aws s3api head-object --bucket "$S3_BUCKET" --key "$KEY" --query ContentLength --output text)"
[ "$REMOTE_SIZE" = "$SIZE" ] || die "S3 dagi hajm ($REMOTE_SIZE) lokal hajmga ($SIZE) teng emas"
log "yuklandi: s3://$S3_BUCKET/$KEY ($SIZE bayt, sha256=$SHA)"

if [ -n "${LOCAL_DIR:-}" ]; then
  mkdir -p "$LOCAL_DIR"
  cp "$ARCHIVE" "$LOCAL_DIR/$FILE"
  find "$LOCAL_DIR" -maxdepth 1 -type f -name "${BACKUP_NAME}_*.gz" -mtime +"$LOCAL_RETENTION_DAYS" -delete
  log "lokal nusxa: $LOCAL_DIR/$FILE (${LOCAL_RETENTION_DAYS} kundan eskilari o'chiriladi)"
fi

[ -n "${HEARTBEAT_URL:-}" ] && { curl -fsS -m 10 "$HEARTBEAT_URL" >/dev/null || log "ogohlantirish: heartbeat yuborilmadi"; }
log "tayyor"
