#!/usr/bin/env bash
# Деплой трекера привычек: подтягивает свежие файлы из GitHub
# и выкладывает их в вебрут. Запуск: /opt/tracker/deploy.sh
set -euo pipefail

REPO_DIR="/opt/tracker/repo"
PUBLIC_DIR="/opt/tracker/public"
LOG="/var/log/tracker-deploy.log"

# Файлы приложения. index.html обязателен, остальные — по возможности
# (иконки и service worker появились вместе с PWA).
REQUIRED="index.html"
OPTIONAL="manifest.json sw.js icon-192.png icon-512.png icon-maskable-512.png"

log() { echo "[$(date '+%F %T')] $*" | tee -a "$LOG"; }

log "=== Деплой начат ==="

cd "$REPO_DIR"
OLD_REV="$(git rev-parse --short HEAD)"

# Таймаут, чтобы скрипт не висел вечно, если GitHub недоступен.
if ! timeout 60 git fetch --quiet origin; then
    log "ОШИБКА: не удалось получить обновления из GitHub"
    exit 1
fi

git reset --hard --quiet "origin/$(git rev-parse --abbrev-ref HEAD)"
NEW_REV="$(git rev-parse --short HEAD)"

for f in $REQUIRED; do
    if [ ! -f "$REPO_DIR/$f" ]; then
        log "ОШИБКА: $f в репозитории не найден, деплой отменён"
        exit 1
    fi
done

for f in $REQUIRED; do
    install -m 0644 "$REPO_DIR/$f" "$PUBLIC_DIR/$f"
done

MISSING=""
for f in $OPTIONAL; do
    if [ -f "$REPO_DIR/$f" ]; then
        install -m 0644 "$REPO_DIR/$f" "$PUBLIC_DIR/$f"
    else
        MISSING="$MISSING $f"
    fi
done
[ -n "$MISSING" ] && log "ВНИМАНИЕ: нет в репозитории:$MISSING"

if [ "$OLD_REV" = "$NEW_REV" ]; then
    log "Изменений нет (ревизия $NEW_REV), файлы переразложены"
else
    log "Обновлено: $OLD_REV -> $NEW_REV"
fi

nginx -t >/dev/null 2>&1 && systemctl reload nginx
log "=== Деплой завершён ==="

# Ротация лога: держим последние 500 строк.
if [ "$(wc -l < "$LOG")" -gt 500 ]; then
    tail -n 500 "$LOG" > "$LOG.tmp" && mv "$LOG.tmp" "$LOG"
fi
