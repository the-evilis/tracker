#!/usr/bin/env bash
# Включение бэкапов: собирает строку подключения к Supabase из пароля базы.
#
# Всё, кроме пароля, уже известно: проект, регион (ap-northeast-1, Токио)
# и режим подключения. Session pooler выбран потому, что direct connection
# на бесплатном тарифе работает только по IPv6, а у этого VPS IPv6 нет.
#
# Запуск:  /opt/tracker/set-db-password.sh
# Пароль вводится скрыто и в историю команд не попадает.
set -uo pipefail

ENV_FILE="/opt/tracker/.env"
REF="bjqcjktdbjgmwxcddppq"
HOST="aws-1-ap-northeast-1.pooler.supabase.com"
PORT="5432"

if [ ! -f "$ENV_FILE" ]; then
    echo "ОШИБКА: нет файла $ENV_FILE"
    exit 1
fi

echo "Пароль базы Supabase."
echo "Взять: дашборд проекта -> кнопка Connect вверху -> вкладка Session pooler."
echo "Там же есть ссылка на сброс пароля, если он забыт."
echo
printf 'Пароль (ввод скрыт): '
read -rs DBPASS
echo

if [ -z "$DBPASS" ]; then
    echo "Пароль пустой — ничего не меняю."
    exit 1
fi

# Пароль идёт внутрь URL, поэтому спецсимволы нужно закодировать:
# без этого @ / : ? # в пароле ломают строку подключения.
ENCODED=$(printf '%s' "$DBPASS" | python3 -c \
    'import sys,urllib.parse; print(urllib.parse.quote(sys.stdin.read(), safe=""))' 2>/dev/null)
if [ -z "$ENCODED" ]; then
    echo "ОШИБКА: не удалось закодировать пароль (нет python3?)"
    exit 1
fi

URL="postgresql://postgres.$REF:$ENCODED@$HOST:$PORT/postgres"

echo "Проверяю подключение..."
if ! PGCONNECT_TIMEOUT=15 timeout 30 psql "$URL" -c 'select 1' >/dev/null 2>/tmp/dbtest.err; then
    echo
    echo "НЕ ПОДКЛЮЧИЛОСЬ. Ответ сервера:"
    tail -2 /tmp/dbtest.err
    echo
    echo "Если написано «password authentication failed» — пароль другой."
    echo "Файл .env не изменён."
    rm -f /tmp/dbtest.err
    exit 1
fi
rm -f /tmp/dbtest.err
echo "Подключение работает."

# Пишем строку в .env. Значение может содержать &, поэтому sed здесь
# не годится — заменяем строку через временный файл.
TMP=$(mktemp)
grep -v '^SUPABASE_DB_URL=' "$ENV_FILE" > "$TMP"
printf 'SUPABASE_DB_URL=%s\n' "$URL" >> "$TMP"
cat "$TMP" > "$ENV_FILE"
rm -f "$TMP"
chmod 600 "$ENV_FILE"
echo "Строка записана в $ENV_FILE (права 600)."

echo
echo "Пробный бэкап..."
/opt/tracker/backup.sh
tail -3 /var/log/tracker-backup.log
echo
ls -lh /opt/tracker/backups/ 2>/dev/null | tail -5
echo
echo "Готово. Дальше бэкап делается сам каждую ночь в 03:40."
