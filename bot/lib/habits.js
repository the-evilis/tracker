// Логика привычек для бота: что сегодня в плане, что осталось, какая серия.
//
// Формулы намеренно повторяют приложение (index.html) один в один — иначе
// бот и экран разошлись бы в цифрах. Чтобы расхождение не появилось со
// временем, tests/test-bot.js вытаскивает оригинальные функции прямо из
// index.html и сверяет их с этими на общих наборах данных.
//
// Все функции чистые: состояние (список привычек, отметки, сегодняшняя дата)
// передаётся аргументами.
'use strict';

// Ключ отметки: год/месяц/день/<id привычки>, месяц с нуля — как в JavaScript.
function dkey(y, m, d, hid) {
  return y + '/' + m + '/' + d + '/' + hid;
}

function keyFor(date, hid) {
  return dkey(date.getFullYear(), date.getMonth(), date.getDate(), hid);
}

// Нормализация графика: мусор в поле schedule превращается в «каждый день».
function habitSchedule(h) {
  const s = h && h.schedule;
  if (!s || !s.type) return {type: 'daily'};
  if (s.type === 'weekdays') {
    const days = Array.isArray(s.days) ? s.days.filter(d => d >= 0 && d <= 6) : [];
    return days.length ? {type: 'weekdays', days} : {type: 'daily'};
  }
  if (s.type === 'times_per_week') {
    const n = Math.min(7, Math.max(1, parseInt(s.n, 10) || 1));
    return {type: 'times_per_week', n};
  }
  return {type: 'daily'};
}

// Ждём ли отметку в этот день. Для «N раз в неделю» подходит любой день.
function isPlannedDay(h, date) {
  const s = habitSchedule(h);
  if (s.type === 'weekdays') return s.days.indexOf(date.getDay()) !== -1;
  return true;
}

function scheduleLabel(h) {
  const s = habitSchedule(h);
  if (s.type === 'daily') return 'каждый день';
  if (s.type === 'times_per_week') return s.n + ' раз' + (s.n >= 2 && s.n <= 4 ? 'а' : '') + ' в неделю';
  const NM = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
  return s.days.slice().sort().map(d => NM[d]).join(', ');
}

function activeHabits(list) {
  return (list || []).filter(h => h && h.name && !h.archived);
}

// Цель количественной привычки («8 стаканов»). Единица целью не считается.
function habitTarget(h) {
  const t = h && parseInt(h.target, 10);
  return (t && t > 1) ? t : 0;
}

// Понедельник недели, сдвинутой на weeksAgo назад от today.
function mondayOf(today, weeksAgo) {
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  base.setDate(base.getDate() - weeksAgo * 7);
  const dow = base.getDay() || 7;
  base.setDate(base.getDate() - dow + 1);
  base.setHours(0, 0, 0, 0);
  return base;
}

function doneInWeek(h, marks, today, weeksAgo) {
  const mon = mondayOf(today, weeksAgo);
  let n = 0;
  for (let i = 0; i < 7; i++) {
    const c = new Date(mon);
    c.setDate(c.getDate() + i);
    if (marks[keyFor(c, h.id)]) n++;
  }
  return n;
}

// Серия: для «N раз в неделю» — в неделях, иначе в плановых днях.
// Незакрытый сегодняшний день (и текущая неделя) серию не обрывают.
function getStreak(h, marks, today) {
  if (!h) return 0;
  const s = habitSchedule(h);

  if (s.type === 'times_per_week') {
    let streak = 0;
    for (let w = 0; w < 105; w++) {
      if (doneInWeek(h, marks, today, w) >= s.n) streak++;
      else if (w === 0) continue;      // текущая неделя ещё идёт
      else break;
    }
    return streak;
  }

  let streak = 0;
  const cur = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  for (let i = 0; i < 400; i++) {
    if (isPlannedDay(h, cur)) {
      if (marks[keyFor(cur, h.id)]) streak++;
      else if (i > 0) break;           // сегодняшний пропуск ещё не пропуск
    }
    cur.setDate(cur.getDate() - 1);
  }
  return streak;
}

// Процент за текущий месяц — от плановых дней, а не от всех.
function getMonthPct(h, marks, today) {
  if (!h) return 0;
  const s = habitSchedule(h);
  const ty = today.getFullYear(), tm = today.getMonth(), td = today.getDate();
  let done = 0, planned = 0;

  if (s.type === 'times_per_week') {
    for (let i = 1; i <= td; i++) if (marks[dkey(ty, tm, i, h.id)]) done++;
    planned = Math.max(1, Math.round(td / 7 * s.n));
  } else {
    for (let i = 1; i <= td; i++) {
      const day = new Date(ty, tm, i);
      if (!isPlannedDay(h, day)) continue;
      planned++;
      if (marks[dkey(ty, tm, i, h.id)]) done++;
    }
  }
  if (!planned) return 0;
  return Math.min(100, Math.round(done / planned * 100));
}

// Привычки, которых сегодня ждут: активные, по графику и ещё не отмеченные.
// Для «N раз в неделю» недельная норма может быть уже выполнена — тогда
// дёргать человека незачем.
function pendingToday(list, marks, today) {
  return activeHabits(list).filter(h => {
    if (marks[keyFor(today, h.id)]) return false;
    const s = habitSchedule(h);
    if (s.type === 'weekdays') return isPlannedDay(h, today);
    if (s.type === 'times_per_week') return doneInWeek(h, marks, today, 0) < s.n;
    return true;
  });
}

// Что сегодня уже сделано — из тех привычек, что были в плане.
function doneToday(list, marks, today) {
  return activeHabits(list).filter(h => marks[keyFor(today, h.id)]);
}

// Сколько привычек стояло в плане на сегодня (для строки «3 из 7»).
function plannedToday(list, marks, today) {
  return activeHabits(list).filter(h => {
    const s = habitSchedule(h);
    if (s.type === 'weekdays') return isPlannedDay(h, today);
    if (s.type === 'times_per_week') {
      // Уже отмеченная сегодня привычка в плане была по определению.
      return marks[keyFor(today, h.id)] || doneInWeek(h, marks, today, 0) < s.n;
    }
    return true;
  });
}

function habitById(list, hid) {
  return (list || []).find(h => h && h.id === hid) || null;
}

// Русские окончания: 1 день, 2–4 дня, 5–20 дней.
function plural(n, one, few, many) {
  const t = n % 100, u = n % 10;
  if (t >= 11 && t <= 14) return many;
  if (u === 1) return one;
  if (u >= 2 && u <= 4) return few;
  return many;
}

module.exports = {
  dkey, keyFor, habitSchedule, isPlannedDay, scheduleLabel, activeHabits,
  habitTarget, mondayOf, doneInWeek, getStreak, getMonthPct,
  pendingToday, doneToday, plannedToday, habitById, plural
};
