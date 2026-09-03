#!/usr/bin/env bash
# Не даём бесплатному проекту Supabase уснуть.
# Free tier усыпляет проект после 7 дней без запросов; один лёгкий запрос
# в сутки считается активностью. Запускается по cron, см. README.
#
# Это не официальная гарантия от Supabase, а практика: если политику
# ужесточат, останется только тариф Pro.
set -uo pipefail

ENV_FILE="/opt/tracker/.env"
LOG="/var/log/tracker-keepalive.log"
TIMEOUT=25

log() { echo "[$(date '+%F %T')] $*" >> "$LOG"; }

if [ ! -f "$ENV_FILE" ]; then
    log "ОШИБКА: нет файла $ENV_FILE"
    exit 1
fi

# shellcheck disable=SC1090
set -a; . "$ENV_FILE"; set +a

: "${SUPABASE_URL:?нет SUPABASE_URL в .env}"
: "${SUPABASE_ANON_KEY:?нет SUPABASE_ANON_KEY в .env}"

# Уведомление в Telegram — только если заданы токен и chat_id.
notify() {
    [ -z "${TELEGRAM_BOT_TOKEN:-}" ] && return 0
    [ -z "${TELEGRAM_CHAT_ID:-}" ] && return 0
    curl -s --max-time 15 \
        -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
        -d "chat_id=${TELEGRAM_CHAT_ID}" \
        -d "text=$1" >/dev/null || true
}

# Лёгкий запрос: просим количество строк, а не сами данные.
CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time "$TIMEOUT" \
    -H "apikey: ${SUPABASE_ANON_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
    -H "Prefer: count=exact" \
    -H "Range: 0-0" \
    "${SUPABASE_URL}/rest/v1/habits?select=id" 2>/dev/null)

# 200/206 — ответ с данными, 401/403 — RLS отклонил анонима.
# Все они означают, что проект жив и активность засчитана.
case "$CODE" in
    200|206|401|403)
        log "OK (HTTP $CODE) — проект активен"
        ;;
    000)
        log "НЕДОСТУПЕН: соединение не установлено — вероятно, проект на паузе"
        notify "⚠️ Трекер привычек: Supabase недоступен (проект на паузе?). Разбудите его в дашборде: https://supabase.com/dashboard"
        ;;
    *)
        log "НЕОЖИДАННЫЙ ОТВЕТ: HTTP $CODE"
        notify "⚠️ Трекер привычек: Supabase ответил HTTP $CODE"
        ;;
esac

# Ротация лога: держим последние 500 строк.
if [ -f "$LOG" ] && [ "$(wc -l < "$LOG")" -gt 500 ]; then
    tail -n 500 "$LOG" > "$LOG.tmp" && mv "$LOG.tmp" "$LOG"
fi
