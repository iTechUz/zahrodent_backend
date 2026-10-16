#!/usr/bin/env bash
# External uptime monitor: site + API (/health/deps → DB) + Telegram bot.
# Run every few minutes (GitHub Actions cron: .github/workflows/uptime.yml, or
# server cron). Alerts only on a state CHANGE: 🔴 after FAIL_THRESHOLD
# consecutive failures, 🟢 once on recovery — no spam while it stays down.
#
# Env:
#   SITE_URL            public frontend URL            (required)
#   API_URL             API base, no trailing slash    (required)
#   TG_ALERT_BOT_TOKEN  bot token used to send alerts  (empty → print only)
#   TG_ALERT_CHAT_ID    admin chat/group id            (empty → print only)
#   STATE_DIR           persisted between runs (default .uptime-state)
#   FAIL_THRESHOLD      consecutive failures before 🔴 (default 2)
#   TG_API_BASE         default https://api.telegram.org (tests override)
set -uo pipefail

: "${SITE_URL:?SITE_URL required}"
: "${API_URL:?API_URL required}"
STATE_DIR="${STATE_DIR:-.uptime-state}"
FAIL_THRESHOLD="${FAIL_THRESHOLD:-2}"
TG_API_BASE="${TG_API_BASE:-https://api.telegram.org}"
mkdir -p "$STATE_DIR"

send_alert() {
  local text="$1"
  echo "ALERT: $text"
  if [ -z "${TG_ALERT_BOT_TOKEN:-}" ] || [ -z "${TG_ALERT_CHAT_ID:-}" ]; then
    echo "(TG_ALERT_* not set — not sent)"
    return 1
  fi
  curl -fsS -m 15 -o /dev/null "$TG_API_BASE/bot$TG_ALERT_BOT_TOKEN/sendMessage" \
    --data-urlencode "chat_id=$TG_ALERT_CHAT_ID" \
    --data-urlencode "text=$text"
}

# record <name> <ok|fail> <detail> — updates counters, alerts on transitions.
record() {
  local name="$1" result="$2" detail="$3"
  local ff="$STATE_DIR/$name.fails" af="$STATE_DIR/$name.alerted"
  local fails; fails=$(cat "$ff" 2>/dev/null || echo 0)
  if [ "$result" = ok ]; then
    echo 0 > "$ff"
    if [ -f "$af" ]; then
      send_alert "🟢 $name tiklandi ($detail)" && rm -f "$af"
    fi
  else
    fails=$((fails + 1)); echo "$fails" > "$ff"
    if [ "$fails" -ge "$FAIL_THRESHOLD" ] && [ ! -f "$af" ]; then
      send_alert "🔴 $name ishlamayapti: $detail" && : > "$af"
    fi
  fi
  echo "$name: $result ($detail) fails=$fails"
}

# 1) public site
code=$(curl -sS -m 15 -o /dev/null -w '%{http_code}' -L "$SITE_URL" 2>/dev/null || echo 000)
if [ "$code" = 200 ]; then record sayt ok "HTTP 200"; else record sayt fail "HTTP $code — $SITE_URL"; fi

# 2) API + DB (503 when the DB is down) and 3) bot (telegram field of the body)
body_file=$(mktemp); trap 'rm -f "$body_file"' EXIT
code=$(curl -sS -m 15 -o "$body_file" -w '%{http_code}' "$API_URL/health/deps" 2>/dev/null || echo 000)
if [ "$code" = 200 ]; then
  record api ok "HTTP 200"
else
  detail="HTTP $code — $API_URL/health/deps"
  [ "$code" = 503 ] && detail="$detail (baza ishlamayapti)"
  record api fail "$detail"
fi
# Bot state is only known when the API answered with JSON (200 or 503).
tg=$(jq -r '.telegram // empty' "$body_file" 2>/dev/null || true)
case "$tg" in
  down) record bot fail "Telegram bot to'xtagan (/health/deps telegram=down)" ;;
  ok | disabled) record bot ok "telegram=$tg" ;;
  *) echo "bot: unknown (API javob bermadi / telegram maydoni yo'q) — holat o'zgarmadi" ;;
esac
exit 0
