// Чтение и проверка настроек бота. Всё приходит из окружения — на сервере
// его наполняет systemd через EnvironmentFile=/opt/tracker-bot/.env,
// локально удобно запускать через `node --env-file=bot/.env bot/index.js`.
//
// Ошибку в настройках лучше поймать на старте, чем в три часа ночи в цикле
// опроса, поэтому здесь всё проверяется строго и с понятными сообщениями.
'use strict';

function required(name) {
  const v = (process.env[name] || '').trim();
  if (!v) throw new Error('В .env не задан ' + name);
  return v;
}

// Пары «chat_id:user_id» через запятую: бот отвечает только этим людям.
// user_id — идентификатор из Supabase Auth (UUID), его видно в дашборде
// в Authentication → Users.
function parseUsers(raw) {
  const users = [];
  raw.split(',').map(s => s.trim()).filter(Boolean).forEach(pair => {
    const i = pair.indexOf(':');
    if (i === -1) throw new Error('TRACKER_USERS: ожидается «chat_id:user_id», получено «' + pair + '»');
    const chatId = pair.slice(0, i).trim();
    const userId = pair.slice(i + 1).trim();
    if (!/^-?\d+$/.test(chatId)) throw new Error('TRACKER_USERS: chat_id должен быть числом, получено «' + chatId + '»');
    if (!userId) throw new Error('TRACKER_USERS: пустой user_id для chat_id ' + chatId);
    users.push({chatId, userId});
  });
  if (!users.length) throw new Error('TRACKER_USERS пуст — некому напоминать');
  return users;
}

// «21:00» → {hour: 21, minute: 0}
function parseTime(raw, name) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(raw.trim());
  if (!m) throw new Error(name + ': ожидается время вида ЧЧ:ММ, получено «' + raw + '»');
  const hour = parseInt(m[1], 10), minute = parseInt(m[2], 10);
  if (hour > 23 || minute > 59) throw new Error(name + ': недопустимое время «' + raw + '»');
  return {hour, minute};
}

function num(name, def, min, max) {
  const raw = (process.env[name] || '').trim();
  if (!raw) return def;
  const v = parseInt(raw, 10);
  if (isNaN(v) || v < min || v > max) {
    throw new Error(name + ': ожидается число от ' + min + ' до ' + max + ', получено «' + raw + '»');
  }
  return v;
}

function load() {
  const cfg = {
    token: required('TELEGRAM_BOT_TOKEN'),
    supabaseUrl: required('SUPABASE_URL').replace(/\/+$/, ''),
    serviceKey: required('SUPABASE_SERVICE_ROLE_KEY'),
    users: parseUsers(required('TRACKER_USERS')),

    remindAt: parseTime(process.env.REMIND_AT || '21:00', 'REMIND_AT'),
    timeZone: (process.env.TIMEZONE || 'Europe/Moscow').trim(),
    // Если бот был выключен ровно в момент напоминания, он всё ещё пришлёт
    // его при старте — но только в пределах этого окна, чтобы не будить
    // человека сообщением за вчера.
    catchUpMinutes: num('CATCH_UP_MINUTES', 120, 0, 720),

    logFile: (process.env.LOG_FILE || '/var/log/tracker-bot.log').trim(),
    logMaxBytes: num('LOG_MAX_BYTES', 1024 * 1024, 64 * 1024, 64 * 1024 * 1024),
    logKeep: num('LOG_KEEP', 3, 1, 20),
    stateFile: (process.env.STATE_FILE || '/opt/tracker-bot/state.json').trim(),

    httpTimeoutMs: num('HTTP_TIMEOUT_MS', 15000, 1000, 60000),
    pollTimeoutSec: num('POLL_TIMEOUT_SEC', 30, 1, 60)
  };

  // Проверяем часовой пояс сразу: опечатка вида «Europe/Moskow» иначе
  // всплывёт только при первом расчёте времени напоминания.
  try {
    new Intl.DateTimeFormat('ru-RU', {timeZone: cfg.timeZone});
  } catch (e) {
    throw new Error('TIMEZONE: неизвестный часовой пояс «' + cfg.timeZone + '»');
  }

  return cfg;
}

module.exports = {load, parseUsers, parseTime};
