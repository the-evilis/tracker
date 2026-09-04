# Трекер привычек — tracker.fountaine.online

Статичное одностраничное приложение (PWA) из репозитория
[the-evilis/tracker](https://github.com/the-evilis/tracker).

**Базы данных на сервере нет.** Данные (`habits`, `user_settings`) и авторизация
(email-код + Google OAuth) живут во внешнем облачном Supabase —
`bjqcjktdbjgmwxcddppq.supabase.co`. Сервер отдаёт только статику через nginx,
процесса и systemd-сервиса у проекта нет.

## Где что лежит

| Путь | Что это |
|---|---|
| `/opt/tracker/repo` | Клон GitHub-репозитория (обновляется `git fetch`) |
| `/opt/tracker/public` | Вебрут nginx: `index.html`, `manifest.json`, `sw.js`, иконки |
| `/opt/tracker/deploy.sh` | Деплой: тянет свежую версию из GitHub |
| `/opt/tracker/keepalive.sh` | Не даёт проекту Supabase уснуть (cron, 04:17) |
| `/opt/tracker/backup.sh` | Ночной бэкап базы (cron, 03:40) |
| `/opt/tracker/.env` | Настройки скриптов, права 600, в git не попадает |
| `/opt/tracker/.env.example` | Шаблон настроек |
| `/opt/tracker/backups/` | Архивы бэкапов, хранятся 30 дней |
| `/etc/nginx/sites-available/tracker.fountaine.online` | Конфиг nginx |
| `/var/log/tracker-deploy.log` | Лог деплоев (ротация: 500 строк) |
| `/var/log/tracker-keepalive.log` | Лог keep-alive (ротация: 500 строк) |
| `/var/log/tracker-backup.log` | Лог бэкапов (ротация: 500 строк) |

SSL: Let's Encrypt, продлевается автоматически таймером certbot.

## Обновить сайт после пуша в GitHub

```bash
ssh root@152.42.129.14
/opt/tracker/deploy.sh
```

Скрипт подтянет из ветки `index.html`, `manifest.json`, `sw.js` и иконки,
разложит в вебрут и перезагрузит nginx. Результат — в
`/var/log/tracker-deploy.log`.

> **Важно.** `deploy.sh` делает `git reset --hard`, то есть перетирает всё,
> чего нет в GitHub. Правки, залитые в `public/` напрямую, он сотрёт —
> сначала пушим в репозиторий, потом деплоим.

## Проверить, что всё живо

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://tracker.fountaine.online/
tail -20 /var/log/tracker-deploy.log
tail -5  /var/log/tracker-keepalive.log
nginx -t
```

## Тесты перед пушем

Всё гоняется локально, на машине с Node 18+ (в проекте нет сборки — зависимости
нужны только тестам).

```bash
npm ci                      # один раз: ставит @playwright/test
npx playwright install chromium   # один раз: браузер для smoke-тестов
npm run test:all            # синтаксис + логика + браузер
```

Что во что входит:

| Команда | Что проверяет |
|---|---|
| `npm run test:syntax` | Компилирует `<script>` из `index.html` — ловит опечатки до открытия страницы |
| `npm test` | Логика без DOM: миграция ключей, экранирование, графики, серии, проценты, архив (79 проверок) |
| `npm run test:e2e` | Smoke в настоящем Chromium: демо-режим, отметки, виды, модалка, тема, PWA |

Smoke-тесты поднимают `tests/serve.js` (та же статика, что уходит в вебрут),
подменяют SDK Supabase заглушкой и **блокируют любые запросы на `*.supabase.co`**
— прогон физически не может задеть боевую базу. Отдельный тест следит за тем,
чтобы демо-режим не ходил в сеть.

Те же три шага выполняет GitHub Actions на каждый пуш и пул-реквест в `main`
(`.github/workflows/ci.yml`). При падении отчёт Playwright прикладывается
к запуску артефактом `playwright-report`.

```bash
npm run serve               # открыть приложение локально: http://127.0.0.1:4173
npx playwright test --ui    # разобраться, почему тест упал
```

## Включить бэкапы базы

Бэкап уже стоит в cron, но пропускается, пока не задана строка подключения.
`postgresql-client` на сервере уже установлен.

### Быстрый способ — нужен только пароль базы

Всё остальное уже определено и зашито в помощник: проект, регион
(`ap-northeast-1`, Токио) и режим подключения.

```bash
ssh root@152.42.129.14
/opt/tracker/set-db-password.sh
```

Скрипт спросит пароль (ввод скрыт, в историю команд не попадает),
закодирует спецсимволы, проверит подключение и сразу сделает пробный бэкап.
Если пароль не подойдёт — скажет об этом и `.env` не тронет.

Пароль базы: дашборд проекта → кнопка **Connect** вверху → вкладка
**Session pooler**. Там же ссылка на сброс, если пароль забыт.

### Если делать руками

В новом интерфейсе Supabase раздела «Settings → Database» больше нет —
строка подключения живёт за кнопкой **Connect** в верхней панели проекта.
В диалоге несколько вкладок, и вариант важен:

| Вариант | Порт | Годится? |
|---|---|---|
| Direct connection | 5432 | **Нет.** На бесплатном тарифе только по IPv6, а у этого VPS IPv6 нет вообще |
| Session pooler | 5432 | **Да, берём этот.** По IPv4 и с длинными сессиями, которые нужны `pg_dump` |
| Transaction pooler | 6543 | Нет, `pg_dump` с ним не работает |

Для этого проекта строка выглядит так:

```
postgresql://postgres.bjqcjktdbjgmwxcddppq:<пароль>@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres
```

Спецсимволы в пароле (`@ : / ? #`) нужно закодировать — иначе строка
развалится. Помощник выше делает это сам.

```bash
nano /opt/tracker/.env          # SUPABASE_DB_URL=...
/opt/tracker/backup.sh
tail -5 /var/log/tracker-backup.log
ls -lh /opt/tracker/backups/
```

Восстановление из архива:

```bash
gunzip -c /opt/tracker/backups/tracker-ГГГГММДД-ЧЧММСС.sql.gz | psql "$SUPABASE_DB_URL"
```

## Уведомления в Telegram (необязательно)

Скрипты умеют сообщать о проблемах в Telegram. Вписать в `/opt/tracker/.env`
токен бота — `TELEGRAM_BOT_TOKEN`; chat_id уже проставлен. Пока токен пустой,
скрипты просто пишут в лог.

## Настройка Supabase под этот домен

Чтобы вход по email-коду и через Google работал, в
[дашборде Supabase](https://supabase.com/dashboard) →
**Authentication → URL Configuration**:

1. **Site URL** — `https://tracker.fountaine.online`
2. **Redirect URLs** — добавить `https://tracker.fountaine.online/**`

Google OAuth в Google Cloud Console трогать не нужно: там прописан callback
самого Supabase, он не менялся.

### Проверка защиты данных (RLS)

Проверено 3 сентября 2026 — **RLS включён и работает**: анонимный запрос
возвращает пустой массив, попытка записи отклоняется с
`new row violates row-level security policy`.

Повторить проверку в любой момент:

```bash
set -a; . /opt/tracker/.env; set +a
curl -s -H "apikey: $SUPABASE_ANON_KEY" -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
     "$SUPABASE_URL/rest/v1/habits?select=*&limit=5"
# Ожидаем [] — если придут чужие строки, RLS отключился и это дыра.
```

Если когда-нибудь понадобится восстановить политики (SQL Editor в дашборде):

```sql
alter table habits        enable row level security;
alter table user_settings enable row level security;

create policy "own rows" on habits
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own rows" on user_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

Проверить, что составной уникальный ключ на месте (без него `upsert`
с `onConflict: 'id,user_id'` не работает):

```sql
select indexname, indexdef from pg_indexes
where schemaname='public' and tablename='habits';
-- нужен уникальный индекс по паре (id, user_id)
```

## Формат данных

Отметка хранится строкой в таблице `habits`:

- `id` — ключ вида `год/месяц/день/<id привычки>`, например `2026/8/3/legacy-0`
  (месяц с нуля, как в JavaScript);
- `user_id` — владелец;
- `done` — всегда `true`. Снятая галочка **удаляет строку**, а не пишет `false`.

Список привычек лежит в `user_settings` под ключом `habits` как JSON.
У каждой привычки есть постоянный `id`: у перенесённых со старой версии —
`legacy-N` по прежнему номеру в списке, у новых — `h-<время>-<случайное>`.

**Почему это важно:** раньше в ключе стоял номер привычки в списке, поэтому
удаление или перетаскивание сдвигало всю историю на соседнюю привычку.
Перенос старых ключей делается приложением автоматически при первой загрузке,
он идемпотентен и работает даже без сети.

## Ресурсы

Проект занимает меньше мегабайта на диске и 0 МБ RAM — отдельного процесса нет,
отдаёт уже запущенный nginx. На нагрузку сервера не влияет.

## Восстановление с нуля

```bash
git clone https://github.com/the-evilis/tracker.git /opt/tracker/repo
mkdir -p /opt/tracker/public
ln -sfn /etc/nginx/sites-available/tracker.fountaine.online \
        /etc/nginx/sites-enabled/tracker.fountaine.online
/opt/tracker/deploy.sh
certbot --nginx -d tracker.fountaine.online
cp /opt/tracker/.env.example /opt/tracker/.env && chmod 600 /opt/tracker/.env
nano /opt/tracker/.env
```
