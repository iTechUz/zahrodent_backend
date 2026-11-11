#!/usr/bin/env bash
#
# Fails when a NEW/CHANGED Prisma migration contains a destructive statement
# (DROP COLUMN, DROP TABLE, ALTER COLUMN ... TYPE) without the explicit marker
# comment "-- allow-destructive" somewhere in the same file. The marker means a
# human decided the data loss / table rewrite is intended (and the code that
# used the column was already released — see docs/DEPLOYMENT.md "Migratsiyalar").
#
# Usage:
#   scripts/check-migrations.sh [BASE_REF]      # default origin/dev; inspects only
#                                               # migrations added/changed vs merge-base
#   scripts/check-migrations.sh --files F...    # check the given files (tests)
#
# CI runs it on pull requests (.github/workflows/ci.yml, job "migrations").
set -Eeuo pipefail

MARKER='-- allow-destructive'

files=()
if [ "${1:-}" = "--files" ]; then
  shift
  files=("$@")
else
  base="${1:-origin/dev}"
  while IFS= read -r f; do
    [ -n "$f" ] && files+=("$f")
  done < <(git diff --name-only --diff-filter=AM "$base"...HEAD -- 'prisma/migrations/*/migration.sql')
fi

bad=0
for f in "${files[@]+"${files[@]}"}"; do
  [ -f "$f" ] || continue
  # Strip SQL line comments first so a commented-out DROP does not count.
  hits="$(sed -E 's/--.*$//' "$f" | grep -Ein 'DROP[[:space:]]+(COLUMN|TABLE)|ALTER[[:space:]]+COLUMN[^;]*[[:space:]]TYPE[[:space:]]' || true)"
  if [ -n "$hits" ] && ! grep -qF -- "$MARKER" "$f"; then
    echo "::error file=$f::destruktiv migratsiya ('$MARKER' izohi yo'q)"
    echo "$f:"
    echo "$hits" | sed 's/^/    /'
    bad=1
  fi
done

if [ "$bad" -ne 0 ]; then
  echo "Destruktiv statement bor. Ataylab bo'lsa, shu migration.sql ga '$MARKER' izohini qo'shing" >&2
  exit 1
fi
echo "Migratsiyalar: destruktiv statement topilmadi (${#files[@]} ta fayl tekshirildi)"
