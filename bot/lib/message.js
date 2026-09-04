// Сборка сообщений бота: текст и клавиатура.
//
// Вынесено отдельно от цикла опроса, чтобы это можно было проверить тестом
// без сети и без Telegram.
'use strict';

const H = require('./habits');
const {esc} = require('./telegram');

const MON = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
             'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const DOW = ['воскресенье', 'понедельник', 'вторник', 'среда',
             'четверг', 'пятница', 'суббота'];

function dateLine(today) {
  return DOW[today.getDay()] + ', ' + today.getDate() + ' ' + MON[today.getMonth()];
}

// Правая часть строки привычки: прогресс для количественной, серия для
// остальных. Молчим, когда сказать нечего — короткий список читается легче.
function detail(h, marks, values, today) {
  const target = H.habitTarget(h);
  if (target) {
    const v = values[H.keyFor(today, h.id)];
    const val = typeof v === 'number' ? v : 0;
    return val > 0 ? val + ' из ' + target : 'цель ' + target;
  }
  const streak = H.getStreak(h, marks, today);
  if (streak >= 2) {
    const unit = H.habitSchedule(h).type === 'times_per_week'
      ? H.plural(streak, 'неделя', 'недели', 'недель')
      : H.plural(streak, 'день', 'дня', 'дней');
    return '🔥 ' + streak + ' ' + unit;
  }
  return H.scheduleLabel(h) === 'каждый день' ? '' : H.scheduleLabel(h);
}

// Основное сообщение: что осталось на сегодня.
function todayText(list, marks, values, today, {greeting} = {}) {
  const pending = H.pendingToday(list, marks, today);
  const planned = H.plannedToday(list, marks, today);
  const done = planned.length - pending.length;

  const head = (greeting ? greeting + '\n' : '') + '<b>' + esc(dateLine(today)) + '</b>';

  if (!planned.length) {
    return head + '\n\nНа сегодня ничего не запланировано.';
  }
  if (!pending.length) {
    return head + '\n\n✨ Всё закрыто: ' + done + ' из ' + planned.length + '. Отдыхайте.';
  }

  const lines = pending.map(h => {
    const d = detail(h, marks, values, today);
    return '• ' + esc(h.icon || '•') + ' ' + esc(h.name) + (d ? ' — <i>' + esc(d) + '</i>' : '');
  });

  return head + '\n\nОсталось на сегодня:\n' + lines.join('\n') +
         '\n\nГотово: ' + done + ' из ' + planned.length;
}

// Клавиатура: по кнопке на каждую невыполненную привычку плюс обновление.
// callback_data ограничена 64 байтами, поэтому в неё уходит только id.
function todayKeyboard(list, marks, today) {
  const pending = H.pendingToday(list, marks, today);
  const rows = pending.slice(0, 20).map(h => [{
    text: '✅ ' + (h.icon ? h.icon + ' ' : '') + trim(h.name, 28),
    callback_data: 'm:' + h.id
  }]);
  rows.push([{text: '🔄 Обновить', callback_data: 'r'}]);
  return rows;
}

// Сводка по каждой привычке: серия и процент за месяц — то же, что
// показывает экран приложения.
function statsText(list, marks, today) {
  const active = H.activeHabits(list);
  if (!active.length) return 'Привычек пока нет.';

  const lines = active.map(h => {
    const streak = H.getStreak(h, marks, today);
    const unit = H.habitSchedule(h).type === 'times_per_week'
      ? H.plural(streak, 'нед.', 'нед.', 'нед.')
      : H.plural(streak, 'день', 'дня', 'дней');
    const pct = H.getMonthPct(h, marks, today);
    return '• ' + esc(h.icon || '•') + ' ' + esc(h.name) +
           ' — ' + pct + '% за месяц' +
           (streak ? ', серия ' + streak + ' ' + unit : '');
  });

  return '<b>Как идут дела</b>\n' + esc(dateLine(today)) + '\n\n' + lines.join('\n');
}

function helpText() {
  return '<b>Трекер привычек</b>\n\n' +
    'Вечером присылаю список того, что осталось на сегодня — отметить можно прямо кнопкой.\n\n' +
    '/today — что осталось сейчас\n' +
    '/stats — серии и проценты за месяц\n' +
    '/help — эта справка\n\n' +
    'Отметки сразу уходят в трекер: https://tracker.fountaine.online';
}

function trim(s, n) {
  s = String(s || '');
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

module.exports = {todayText, todayKeyboard, statsText, helpText, dateLine};
