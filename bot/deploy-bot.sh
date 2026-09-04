#!/usr/bin/env bash
# Обновление бота напоминаний из GitHub. Запуск: /opt/tracker-bot/deploy-bot.sh
#
# Работает по тому же принципу, что и deploy.sh у статики: свежий код берётся
# из клона репозитория, раскладывается в рабочий каталог и сервис
# перезапускается. Файл настроек (.env) и состояние (state.json) не трогаются.
set -euo pipefail

REPO_DIR="/opt/tracker/repo"
BOT_DIR="/opt/tracker-bot"
SERVICE="tracker-bot"
LOG="/var/log/tracker-bot-deploy.log"

log() { echo "[$(date '+%F %T')] $*" | tee -a "$LOG"; }

log "=== Обновление бота начато ==="

if [ ! -d "$REPO_DIR/.git" ]; then
    log "ОШИБКА: нет клона репозитория в $REPO_DIR"
    exit 1
fi

cd "$REPO_DIR"
OLD_REV="$(git rev-parse --short HEAD)"

# Таймаут, чтобы скрипт не висел вечно, если GitHub недоступен.
if ! timeout 60 git fetch --quiet origin; then
    log "ОШИБКА: не удалось получить обновления из GitHub"
    exit 1
fi
git reset --hard --quiet "origin/$(git rev-parse --abbrev-ref HEAD)"
NEW_REV="$(git rev-parse --short HEAD)"

if [ ! -f "$REPO_DIR/bot/index.js" ]; then
    log "ОШИБКА: в репозитории нет bot/index.js, обновление отменено"
    exit 1
fi

# Настройки должны существовать до запуска: без них сервис просто упадёт.
if [ ! -f "$BOT_DIR/.env" ]; then
    log "ОШИБКА: нет $BOT_DIR/.env — скопируйте bot/env.example и заполните"
    exit 1
fi

mkdir -p "$BOT_DIR/lib"
install -m 0644 "$REPO_DIR/bot/index.js" "$BOT_DIR/index.js"
install -m 0644 "$REPO_DIR"/bot/lib/*.js "$BOT_DIR/lib/"
install -m 0755 "$REPO_DIR/bot/deploy-bot.sh" "$BOT_DIR/deploy-bot.sh"

# Юнит обновляем, только если он изменился — иначе лишний daemon-reload.
if ! cmp -s "$REPO_DIR/bot/tracker-bot.service" "/etc/systemd/system/$SERVICE.service"; then
    install -m 0644 "$REPO_DIR/bot/tracker-bot.service" "/etc/systemd/system/$SERVICE.service"
    systemctl daemon-reload
    log "Юнит systemd обновлён"
fi

systemctl restart "$SERVICE"
sleep 2

if systemctl is-active --quiet "$SERVICE"; then
    log "Обновлено: $OLD_REV -> $NEW_REV, сервис работает"
else
    log "ОШИБКА: сервис не поднялся, смотрите journalctl -u $SERVICE -n 50"
    exit 1
fi

log "=== Обновление бота завершено ==="

# Ротация лога: держим последние 500 строк.
if [ "$(wc -l < "$LOG")" -gt 500 ]; then
    tail -n 500 "$LOG" > "$LOG.tmp" && mv "$LOG.tmp" "$LOG"
fi
