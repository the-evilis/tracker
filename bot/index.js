// Бот напоминаний трекера привычек.
//
// Что делает:
//   * вечером в заданное время присылает список того, что осталось на сегодня;
//   * даёт отметить привычку кнопкой прямо в чате — отметка уходит в ту же
//     базу, что и из браузера, тем же ключом «год/месяц/день/<id привычки>»;
//   * отвечает на /today, /stats и /help.
//
// Отдельного порта и nginx не нужно: бот работает длинным опросом (getUpdates),
// входящих соединений не принимает.
//
// Запуск на сервере — systemd-юнит tracker-bot.service, локально:
//   node --env-file=bot/.env bot/index.js
'use strict';

const fs = require('fs');
const path = require('path');

const {load} = require('./lib/config');
const {createLogger} = require('./lib/logger');
const {createTelegram, sleep, esc} = require('./lib/telegram');
const {createSupabase} = require('./lib/supabase');
const H = require('./lib/habits');
const M = require('./lib/message');

let cfg, log, tg, db, state, stopping = false;

// ── СОСТОЯНИЕ ────────────────────────────────────────────────────────────────
// Хранится между перезапусками: смещение опроса (чтобы не обрабатывать
// обновления дважды) и день последнего напоминания по каждому чату
// (чтобы не прислать его два раза).
function loadState() {
  try {
    const raw = fs.readFileSync(cfg.stateFile, 'utf8');
    const s = JSON.parse(raw);
    return {offset: s.offset || 0, lastRemind: s.lastRemind || {}};
  } catch (e) {
    return {offset: 0, lastRemind: {}};
  }
}

function saveState() {
  try {
    const dir = path.dirname(cfg.stateFile);
    if (dir && !fs.existsSync(dir)) fs.mkdirSync(dir, {recursive: true});
    fs.writeFileSync(cfg.stateFile, JSON.stringify(state, null, 2));
  } catch (e) {
    log.fail('Не удалось сохранить состояние в ' + cfg.stateFile, e);
  }
}

// ── ВРЕМЯ ────────────────────────────────────────────────────────────────────
// Сервер живёт в UTC, а напоминание должно приходить по московскому времени,
// поэтому «сегодня» считаем строго в настроенном часовом поясе.
function zonedNow(timeZone) {
  const parts = {};
  new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false
  }).formatToParts(new Date()).forEach(p => { parts[p.type] = p.value; });

  const hour = parseInt(parts.hour, 10) % 24;   // полночь в некоторых локалях — «24»
  return {
    date: new Date(parseInt(parts.year, 10), parseInt(parts.month, 10) - 1, parseInt(parts.day, 10)),
    hour,
    minute: parseInt(parts.minute, 10),
    isoDay: parts.year + '-' + parts.month + '-' + parts.day
  };
}

// ── ДАННЫЕ ───────────────────────────────────────────────────────────────────
async function fetchUserData(userId) {
  const [habits, marks, values] = await Promise.all([
    db.getHabits(userId),
    db.getMarks(userId),
    db.getValues(userId)
  ]);
  return {habits, marks, values};
}

function userByChat(chatId) {
  return cfg.users.find(u => u.chatId === String(chatId)) || null;
}

// Отметить привычку так же, как это делает приложение: строка в habits и,
// для количественной привычки, значение, равное цели.
async function markHabit(user, habit, today, values) {
  const key = H.keyFor(today, habit.id);
  await db.mark(user.userId, key);

  const target = H.habitTarget(habit);
  if (target) {
    const next = Object.assign({}, values, {[key]: target});
    await db.setValues(user.userId, next);
  }
  return key;
}

// ── ОТПРАВКА ─────────────────────────────────────────────────────────────────
async function sendToday(user, {greeting} = {}) {
  const {habits, marks, values} = await fetchUserData(user.userId);
  const today = zonedNow(cfg.timeZone).date;
  const text = M.todayText(habits, marks, values, today, {greeting});
  const keyboard = M.todayKeyboard(habits, marks, today);
  return tg.sendMessage(user.chatId, text, keyboard);
}

async function refreshMessage(user, chatId, messageId) {
  const {habits, marks, values} = await fetchUserData(user.userId);
  const today = zonedNow(cfg.timeZone).date;
  const text = M.todayText(habits, marks, values, today);
  const keyboard = M.todayKeyboard(habits, marks, today);
  try {
    await tg.editMessage(chatId, messageId, text, keyboard);
  } catch (e) {
    // «message is not modified» — не ошибка: человек нажал кнопку дважды.
    if (!/not modified/i.test(String(e.message))) throw e;
  }
}

// ── НАПОМИНАНИЕ ПО РАСПИСАНИЮ ────────────────────────────────────────────────
async function maybeRemind() {
  const now = zonedNow(cfg.timeZone);
  const nowMin = now.hour * 60 + now.minute;
  const targetMin = cfg.remindAt.hour * 60 + cfg.remindAt.minute;

  // Окно догона: если бот лежал в момент напоминания, он всё равно пришлёт
  // его при старте — но не глубокой ночью, а лишь в пределах CATCH_UP_MINUTES.
  if (nowMin < targetMin || nowMin > targetMin + cfg.catchUpMinutes) return;

  for (const user of cfg.users) {
    if (state.lastRemind[user.chatId] === now.isoDay) continue;
    try {
      const {habits, marks, values} = await fetchUserData(user.userId);
      const pending = H.pendingToday(habits, marks, now.date);

      if (!pending.length) {
        // Всё уже закрыто — дёргать человека незачем, но день отмечаем
        // как обработанный, чтобы не проверять его в каждом цикле.
        state.lastRemind[user.chatId] = now.isoDay;
        saveState();
        log.info('Напоминание для ' + user.chatId + ' не нужно: на сегодня всё закрыто');
        continue;
      }

      const text = M.todayText(habits, marks, values, now.date, {greeting: '🌙 Вечерняя сверка'});
      await tg.sendMessage(user.chatId, text, M.todayKeyboard(habits, marks, now.date));

      state.lastRemind[user.chatId] = now.isoDay;
      saveState();
      log.info('Напоминание отправлено в чат ' + user.chatId + ', осталось привычек: ' + pending.length);
    } catch (e) {
      // День не помечаем — попробуем ещё раз на следующем тике, пока
      // не вышло окно догона.
      log.fail('Не удалось отправить напоминание в чат ' + user.chatId, e);
    }
  }
}

// ── ОБРАБОТКА ОБНОВЛЕНИЙ ─────────────────────────────────────────────────────
async function handleMessage(msg) {
  const chatId = msg.chat && msg.chat.id;
  const user = userByChat(chatId);

  if (!user) {
    log.warn('Сообщение из чужого чата ' + chatId + ' — игнорируем');
    await tg.sendMessage(chatId, 'Это личный бот трекера привычек. Доступа нет.').catch(() => {});
    return;
  }

  const text = (msg.text || '').trim().toLowerCase();

  if (text.startsWith('/start') || text.startsWith('/help')) {
    await tg.sendMessage(chatId, M.helpText());
    return;
  }
  if (text.startsWith('/today')) {
    await sendToday(user);
    return;
  }
  if (text.startsWith('/stats')) {
    const {habits, marks} = await fetchUserData(user.userId);
    await tg.sendMessage(chatId, M.statsText(habits, marks, zonedNow(cfg.timeZone).date));
    return;
  }
  // Любое другое сообщение — показываем, что осталось: это чаще всего то,
  // зачем человек и открыл чат.
  await sendToday(user);
}

async function handleCallback(cb) {
  const chatId = cb.message && cb.message.chat && cb.message.chat.id;
  const messageId = cb.message && cb.message.message_id;
  const user = userByChat(chatId);

  if (!user) {
    await tg.answerCallback(cb.id, 'Нет доступа').catch(() => {});
    return;
  }

  const payload = String(cb.data || '');

  if (payload === 'r') {
    await refreshMessage(user, chatId, messageId);
    await tg.answerCallback(cb.id, 'Обновлено');
    return;
  }

  if (payload.startsWith('m:')) {
    const hid = payload.slice(2);
    const {habits, marks, values} = await fetchUserData(user.userId);
    const habit = H.habitById(habits, hid);

    if (!habit) {
      await tg.answerCallback(cb.id, 'Привычка не найдена — возможно, удалена');
      await refreshMessage(user, chatId, messageId);
      return;
    }

    const today = zonedNow(cfg.timeZone).date;
    if (marks[H.keyFor(today, hid)]) {
      await tg.answerCallback(cb.id, 'Уже отмечено');
    } else {
      await markHabit(user, habit, today, values);
      await tg.answerCallback(cb.id, 'Отмечено: ' + habit.name);
      log.info('Отметка из чата ' + chatId + ': ' + habit.name + ' (' + H.keyFor(today, hid) + ')');
    }
    await refreshMessage(user, chatId, messageId);
    return;
  }

  await tg.answerCallback(cb.id);
}

async function pollOnce() {
  const updates = await tg.getUpdates(state.offset, cfg.pollTimeoutSec);
  for (const u of updates || []) {
    state.offset = u.update_id + 1;
    try {
      if (u.message) await handleMessage(u.message);
      else if (u.callback_query) await handleCallback(u.callback_query);
    } catch (e) {
      log.fail('Ошибка обработки обновления ' + u.update_id, e);
    }
    saveState();
  }
}

// ── ЗАПУСК ───────────────────────────────────────────────────────────────────
async function main() {
  cfg = load();
  log = createLogger({file: cfg.logFile, maxBytes: cfg.logMaxBytes, keep: cfg.logKeep});
  tg = createTelegram({token: cfg.token, timeoutMs: cfg.httpTimeoutMs, log});
  db = createSupabase({url: cfg.supabaseUrl, serviceKey: cfg.serviceKey, timeoutMs: cfg.httpTimeoutMs, log});
  state = loadState();

  const me = await tg.call('getMe');
  log.info('Бот @' + me.username + ' запущен: напоминание в ' +
           String(cfg.remindAt.hour).padStart(2, '0') + ':' +
           String(cfg.remindAt.minute).padStart(2, '0') + ' (' + cfg.timeZone + '), ' +
           'подписчиков: ' + cfg.users.length);

  await tg.setMyCommands([
    {command: 'today', description: 'что осталось на сегодня'},
    {command: 'stats', description: 'серии и проценты за месяц'},
    {command: 'help', description: 'справка'}
  ]).catch(e => log.fail('Не удалось задать список команд', e));

  // Расписание проверяем раз в полминуты: точность до минуты нам достаточна,
  // а нагрузки такой опрос не создаёт.
  const timer = setInterval(() => {
    maybeRemind().catch(e => log.fail('Сбой планировщика', e));
  }, 30_000);
  maybeRemind().catch(e => log.fail('Сбой планировщика при старте', e));

  const shutdown = signal => {
    if (stopping) return;
    stopping = true;
    clearInterval(timer);
    log.info('Получен ' + signal + ' — завершаемся');
    saveState();
    // Даём текущему длинному опросу закрыться самому.
    setTimeout(() => process.exit(0), 1000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('unhandledRejection', e => log.fail('Необработанное отклонение промиса', e));

  while (!stopping) {
    try {
      await pollOnce();
    } catch (e) {
      log.fail('Сбой опроса Telegram', e);
      await sleep(5000);      // не долбим API в цикле при сетевой аварии
    }
  }
}

main().catch(e => {
  // Логгер может быть ещё не создан — например, при ошибке в .env.
  const msg = 'Бот не запустился: ' + (e && e.message ? e.message : e);
  if (log) log.fail('Бот не запустился', e); else console.error(msg);
  process.exit(1);
});
