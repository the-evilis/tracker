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
| `/opt/tracker/public` | Вебрут nginx: `index.html`, `app.js`, `styles.css`, `manifest.json`, `sw.js`, иконки |
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
| `/opt/tracker-bot/` | Бот напоминаний в Telegram (systemd-сервис `tracker-bot`) |
| `/opt/tracker-bot/.env` | Токен бота и ключ Supabase, права 600 |
| `/opt/tracker-bot/state.json` | Смещение опроса и день последнего напоминания |
| `/var/log/tracker-bot.log` | Лог бота (ротация: 1 МБ × 3 файла) |
| `/var/log/tracker-bot-deploy.log` | Лог обновлений бота (ротация: 500 строк) |

SSL: Let's Encrypt, продлевается автоматически таймером certbot.

## Обновить сайт после пуша в GitHub

```bash
ssh root@152.42.129.14
/opt/tracker/deploy.sh
```

Скрипт подтянет из ветки `index.html`, `app.js`, `styles.css`,
`manifest.json`, `sw.js` и иконки, разложит в вебрут и перезагрузит nginx.
Результат — в `/var/log/tracker-deploy.log`.

Первые три файла обязательны: без любого из них страница не работает, и
деплой прервётся с ошибкой, не тронув вебрут.

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

Логика приложения живёт в `app.js`, разметка в `index.html`, стили в
`styles.css`. Сборки нет: тесты берут код прямо из `app.js`, а деплой
копирует файлы как есть.

Что во что входит:

| Команда | Что проверяет |
|---|---|
| `npm run test:syntax` | Компилирует `<script>` из `index.html` — ловит опечатки до открытия страницы |
| `npm test` | Логика без DOM: миграция ключей, экранирование, графики, серии, проценты, архив, логика и сетевой слой бота (165 проверок) |
| `npm run test:e2e` | Smoke в настоящем Chromium: демо-режим, отметки, виды, модалка, тема, PWA, все пять разделов (23 теста в двух профилях) |

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

Служебные скрипты (`deploy.sh`, `keepalive.sh`, `backup.sh`) умеют сообщать
о проблемах в Telegram. Вписать в `/opt/tracker/.env` токен бота —
`TELEGRAM_BOT_TOKEN`; chat_id уже проставлен. Пока токен пустой, скрипты
просто пишут в лог.

## Бот напоминаний

Вечером присылает в Telegram список того, что осталось на сегодня, и даёт
отметить привычку кнопкой прямо в чате. Отметка уходит в ту же базу и тем же
ключом `год/месяц/день/<id привычки>`, что и из браузера, — приложение
подхватит её при следующей загрузке.

Живёт в `/opt/tracker-bot`, отдельный systemd-сервис `tracker-bot`.
**Порт не занимает** и в nginx не прописывается: бот сам ходит в Telegram
длинным опросом, входящих соединений не принимает.

Команды в чате: `/today` — что осталось сейчас, `/stats` — серии и проценты
за месяц, `/help` — справка. Любое другое сообщение боту равносильно `/today`.
Отвечает он только тем chat_id, которые перечислены в настройках.

### Что нужно приготовить

1. **Токен бота** — написать [@BotFather](https://t.me/BotFather), команда
   `/newbot`, скопировать выданный токен.
2. **chat_id** — свой можно узнать у [@userinfobot](https://t.me/userinfobot).
3. **user_id** — UUID в дашборде Supabase → **Authentication → Users**
   (колонка UID у своего аккаунта).
4. **Ключ `service_role`** — дашборд Supabase → **Project Settings → API Keys**.
   Он обходит RLS: человек в момент напоминания не сидит в браузере, обычной
   пользовательской сессии нет. Ключ хранится только в `/opt/tracker-bot/.env`
   с правами `600` и никуда больше не попадает.

### Установка

Нужен Node.js 18 или новее — проверить `node -v`. Если его нет:

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs
```

Дальше — под копипасту:

```bash
ssh root@152.42.129.14

# свежий код в клоне репозитория
cd /opt/tracker/repo && git fetch origin && git reset --hard origin/main

# рабочий каталог бота
mkdir -p /opt/tracker-bot/lib
install -m 0644 /opt/tracker/repo/bot/index.js      /opt/tracker-bot/index.js
install -m 0644 /opt/tracker/repo/bot/lib/*.js      /opt/tracker-bot/lib/
install -m 0755 /opt/tracker/repo/bot/deploy-bot.sh /opt/tracker-bot/deploy-bot.sh

# настройки
cp /opt/tracker/repo/bot/env.example /opt/tracker-bot/.env
chmod 600 /opt/tracker-bot/.env
nano /opt/tracker-bot/.env     # токен, service_role, TRACKER_USERS=chat_id:user_id

# сервис
install -m 0644 /opt/tracker/repo/bot/tracker-bot.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now tracker-bot
systemctl status tracker-bot --no-pager
```

Проверка: написать боту `/today` — он должен ответить списком. Первое
напоминание придёт в ближайшие `REMIND_AT` (по умолчанию 21:00 по Москве).

```bash
journalctl -u tracker-bot -n 30 --no-pager   # что происходит
tail -20 /var/log/tracker-bot.log            # свой лог, ротация по 1 МБ
```

### Обновление после пуша

```bash
/opt/tracker-bot/deploy-bot.sh
```

Скрипт подтянет код из GitHub, разложит в `/opt/tracker-bot`, при
необходимости обновит юнит и перезапустит сервис. `.env` и `state.json`
не трогаются. Результат — в `/var/log/tracker-bot-deploy.log`.

### Настройки (`/opt/tracker-bot/.env`)

| Переменная | Что задаёт |
|---|---|
| `TELEGRAM_BOT_TOKEN` | Токен от @BotFather |
| `SUPABASE_URL` | Адрес проекта Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Ключ доступа в обход RLS |
| `TRACKER_USERS` | Кому напоминать: `chat_id:user_id` через запятую |
| `REMIND_AT` | Время вечерней сверки, по умолчанию `21:00` |
| `TIMEZONE` | Часовой пояс, по умолчанию `Europe/Moscow` |
| `CATCH_UP_MINUTES` | Окно догона, если бот лежал в момент напоминания |
| `LOG_FILE`, `LOG_MAX_BYTES`, `LOG_KEEP` | Лог и ротация |
| `STATE_FILE` | Смещение опроса и день последнего напоминания |
| `HTTP_TIMEOUT_MS`, `POLL_TIMEOUT_SEC` | Таймауты сети |

Ошибка в настройках останавливает бота сразу на старте с понятным сообщением
в `journalctl` — молча работать с половиной конфигурации он не станет.

### Как бот решает, о чём напоминать

Так же, как приложение рисует экран: берёт список привычек из
`user_settings`, отметки из `habits` и оставляет те, что сегодня в плане и
ещё не закрыты. Архивные пропускаются; для «N раз в неделю» — если недельная
норма уже выполнена, бот молчит. Если на сегодня не осталось ничего,
напоминание не приходит вовсе.

Формулы серий и процентов продублированы из `index.html`, поэтому
`tests/test-bot.js` вытаскивает оригиналы прямо из HTML и сверяет их с
ботовскими — разъехаться незаметно они не могут.

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

## Разделы приложения

Внизу пять вкладок, выбор запоминается между запусками:

| Вкладка | Что внутри | Где хранится |
|---|---|---|
| **Focus** | Цели с задачами и список «100» отдельной карточкой | `user_settings`, ключи `goals` и `list100` |
| **Money** | Доходы, расходы, графики по категориям и месяцам | таблица `transactions` |
| **Tracker** | Привычки по дням — прежний основной экран | `habits` + `user_settings` |
| **Credo** | Принципы, принцип дня, отметка «следовал сегодня» | `user_settings`, ключ `credo`; отметки — в `habits` |
| **Quotes** | Цитата дня и своя подборка | `user_settings`, ключ `quotes` |

Отметки принципов кладутся в ту же таблицу `habits` и тем же ключом
`год/месяц/день/<id>`, что и привычки: очередь офлайн-отправки, серии и
синхронизация заработали даром. В список привычек принципы не попадают,
поэтому статистику трекера они не искажают.

### Таблица для раздела «Деньги»

Раздел появился позже остальных, поэтому таблицу нужно создать один раз
руками — в дашборде Supabase, **SQL Editor**. Пока её нет, вкладка Money
показывает инструкцию вместо операций, остальное приложение работает.

```sql
create table if not exists transactions (
  id          text        not null,
  user_id     uuid        not null references auth.users(id) on delete cascade,
  ts          date        not null,
  -- Сумма целыми копейками: во float дробные рубли дают ошибку округления,
  -- и итог месяца перестаёт сходиться с суммой строк.
  amount      bigint      not null check (amount > 0),
  kind        text        not null check (kind in ('income','expense')),
  category    text,
  note        text,
  updated_at  timestamptz not null default now(),
  primary key (id, user_id)
);

alter table transactions enable row level security;

create policy "own rows" on transactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists transactions_user_ts on transactions (user_id, ts desc);
```

Проверить, что политика работает (должен вернуться пустой массив):

```bash
set -a; . /opt/tracker/.env; set +a
curl -s -H "apikey: $SUPABASE_ANON_KEY" -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
     "$SUPABASE_URL/rest/v1/transactions?select=*&limit=5"
```

Категории операций заданы в коде (`MONEY_CATS` в `app.js`), валюта одна —
рубль. Счета и бюджеты по категориям намеренно не делались: без них ввод
операции остаётся в два касания.

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
