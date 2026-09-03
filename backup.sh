#!/usr/bin/env bash
# Ночной бэкап данных трекера из Supabase на этот VPS.
# Своя копия — единственная защита от случайного удаления и от потери
# доступа к аккаунту Supabase.
#
# Требует строку подключения SUPABASE_DB_URL в /opt/tracker/.env
# (дашборд: Project Settings → Database → Connection string → URI).
set -uo pipefail

ENV_FILE="/opt/tracker/.env"
BACKUP_DIR="/opt/tracker/backups"
LOG="/var/log/tracker-backup.log"
KEEP_DAYS=30
TIMEOUT=300

log() { echo "[$(date '+%F %T')] $*" >> "$LOG"; }

notify() {
    [ -z "${TELEGRAM_BOT_TOKEN:-}" ] && return 0
    [ -z "${TELEGRAM_CHAT_ID:-}" ] && return 0
    curl -s --max-time 15 \
        -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
        -d "chat_id=${TELEGRAM_CHAT_ID}" -d "text=$1" >/dev/null || true
}

if [ ! -f "$ENV_FILE" ]; then
    log "ОШИБКА: нет файла $ENV_FILE"
    exit 1
fi
# shellcheck disable=SC1090
set -a; . "$ENV_FILE"; set +a

if [ -z "${SUPABASE_DB_URL:-}" ]; then
    log "ПРОПУСК: SUPABASE_DB_URL не задан в .env — бэкап не делается"
    exit 0
fi

if ! command -v pg_dump >/dev/null 2>&1; then
    log "ОШИБКА: не установлен pg_dump (apt install -y postgresql-client)"
    notify "⚠️ Трекер: бэкап не сделан — нет pg_dump на сервере"
    exit 1
fi

mkdir -p "$BACKUP_DIR"
STAMP="$(date '+%Y%m%d-%H%M%S')"
OUT="$BACKUP_DIR/tracker-$STAMP.sql.gz"

# Выгружаем только таблицы приложения — служебные схемы Supabase
# анониму всё равно не отдаст, да и восстанавливать их не нужно.
if timeout "$TIMEOUT" pg_dump "$SUPABASE_DB_URL" \
        --table=public.habits \
        --table=public.user_settings \
        --data-only --column-inserts --no-owner --no-privileges \
        2>>"$LOG" | gzip -9 > "$OUT"; then

    SIZE="$(du -h "$OUT" | cut -f1)"
    # Пустой архив — почти наверняка признак проблемы, а не отсутствия данных.
    if [ "$(stat -c%s "$OUT")" -lt 200 ]; then
        log "ВНИМАНИЕ: архив подозрительно мал ($SIZE) — проверьте доступ к базе"
        notify "⚠️ Трекер: бэкап получился пустым ($SIZE)"
    else
        log "OK: $OUT ($SIZE)"
    fi
else
    log "ОШИБКА: pg_dump завершился неудачно"
    rm -f "$OUT"
    notify "⚠️ Трекер: ночной бэкап Supabase не удался"
    exit 1
fi

# Чистим архивы старше KEEP_DAYS дней.
DELETED="$(find "$BACKUP_DIR" -name 'tracker-*.sql.gz' -mtime +"$KEEP_DAYS" -print -delete | wc -l)"
[ "$DELETED" -gt 0 ] && log "Удалено старых архивов: $DELETED"

# Ротация лога.
if [ -f "$LOG" ] && [ "$(wc -l < "$LOG")" -gt 500 ]; then
    tail -n 500 "$LOG" > "$LOG.tmp" && mv "$LOG.tmp" "$LOG"
fi
