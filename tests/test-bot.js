// Проверка логики бота напоминаний.
//
// Главная часть — сверка с приложением: функции бота (bot/lib/habits.js)
// считают серии, проценты и недельную норму по тем же формулам, что и
// index.html. Чтобы они не разъехались при будущих правках, оригиналы
// вытаскиваются прямо из HTML и сравниваются с ботовскими на общих данных.
//
// Запуск: node tests/test-bot.js index.html
const fs = require('fs');
const os = require('os');
const path = require('path');

const js = require('./read-source')(process.argv[2] || 'app.js');

function grab(name){
  const re = new RegExp('function ' + name + '\\s*\\([^)]*\\)\\s*\\{');
  const m = js.match(re);
  if(!m) throw new Error('не найдена функция ' + name);
  let i = m.index + m[0].length, depth = 1;
  while(i < js.length && depth > 0){
    if(js[i] === '{') depth++; else if(js[i] === '}') depth--;
    i++;
  }
  return js.slice(m.index, i);
}

// Глобальные, от которых зависят оригинальные функции приложения.
let today = new Date(2026, 2, 1);
let ty = today.getFullYear(), tm = today.getMonth(), td = today.getDate();
let data = {}, HABITS = [];
const MON_S=['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'];

const names = ['dkey','habitSchedule','isPlannedDay','scheduleLabel','activeHabits',
               'habitTarget','dayObj','mondayOf','doneInWeek','getStreak',
               'getMonthPct','plural','habitById'];
eval(names.map(grab).join('\n') + '\nglobalThis.__app={' + names.join(',') + '};');
const app = globalThis.__app;

const H = require('../bot/lib/habits');
const M = require('../bot/lib/message');
const C = require('../bot/lib/config');
const {createLogger} = require('../bot/lib/logger');

let pass = 0, fail = 0;
function check(name, got, want){
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if(ok){ pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + '\n       получено: ' + JSON.stringify(got) +
                             '\n       ожидалось: ' + JSON.stringify(want)); }
}
function throws(name, fn, re){
  try { fn(); fail++; console.log('  FAIL ' + name + ': исключения не было'); }
  catch(e){
    if(re && !re.test(e.message)){
      fail++; console.log('  FAIL ' + name + ': неожиданное сообщение «' + e.message + '»');
    } else { pass++; console.log('  ok   ' + name); }
  }
}

// Набор привычек со всеми видами графика и с целью.
const HABITS_SET = [
  {id:'d1', name:'Медитация',  icon:'🧘', color:'#7F77DD'},
  {id:'w1', name:'Зал',        icon:'🏋️', color:'#E07A5F', schedule:{type:'weekdays', days:[1,3,5]}},
  {id:'t1', name:'Бег',        icon:'🏃', color:'#81B29A', schedule:{type:'times_per_week', n:3}},
  {id:'q1', name:'Вода',       icon:'💧', color:'#3D9BE9', target:8},
  {id:'a1', name:'Английский', icon:'🌍', color:'#F2CC8F', archived:true}
];

// Детерминированная «история»: тот же приём, что в демо-режиме приложения.
function seed(daysBack){
  const marks = {};
  const rnd = s => { const x = Math.sin(s) * 10000; return x - Math.floor(x); };
  HABITS_SET.forEach((h, hi)=>{
    const rate = 0.5 + rnd(hi + 1) * 0.4;
    const cur = new Date(ty, tm, td);
    cur.setDate(cur.getDate() - daysBack);
    for(let i = 0; i <= daysBack; i++){
      if(app.isPlannedDay(h, app.dayObj(cur)) && rnd(hi * 97 + i * 13 + 3) < rate){
        marks[H.keyFor(cur, h.id)] = true;
      }
      cur.setDate(cur.getDate() + 1);
    }
  });
  return marks;
}

console.log('\n1. Ключ отметки совпадает с приложением');
check('dkey', H.dkey(2026, 8, 3, 'legacy-0'), app.dkey(2026, 8, 3, 'legacy-0'));
check('keyFor от даты', H.keyFor(new Date(2026, 8, 3), 'legacy-0'), '2026/8/3/legacy-0');

console.log('\n2. Нормализация графика — как в приложении');
[{}, {schedule:{type:'weekdays',days:[]}}, {schedule:{type:'weekdays',days:[1,9,-2,5]}},
 {schedule:{type:'times_per_week',n:99}}, {schedule:{type:'times_per_week',n:0}},
 {schedule:{type:'ерунда'}}].forEach((h, i)=>{
  check('график #' + (i+1), H.habitSchedule(h), app.habitSchedule(h));
});
check('подпись графика (пн/ср/пт)', H.scheduleLabel(HABITS_SET[1]), app.scheduleLabel(HABITS_SET[1]));
check('подпись графика (3 раза в неделю)', H.scheduleLabel(HABITS_SET[2]), app.scheduleLabel(HABITS_SET[2]));
check('цель количественной', H.habitTarget(HABITS_SET[3]), app.habitTarget(HABITS_SET[3]));
check('цель 1 не считается целью', H.habitTarget({target:1}), app.habitTarget({target:1}));

console.log('\n3. Плановые дни совпадают на 60 днях подряд');
{
  let mismatch = 0;
  const cur = new Date(ty, tm, td);
  cur.setDate(cur.getDate() - 59);
  for(let i = 0; i < 60; i++){
    HABITS_SET.forEach(h=>{
      if(H.isPlannedDay(h, cur) !== app.isPlannedDay(h, app.dayObj(cur))) mismatch++;
    });
    cur.setDate(cur.getDate() + 1);
  }
  check('расхождений нет', mismatch, 0);
}

console.log('\n4. Серии и проценты совпадают с приложением');
{
  // Проверяем на нескольких «сегодня»: воскресенье, будни, конец месяца.
  const DAYS = [new Date(2026, 2, 1), new Date(2026, 8, 4), new Date(2026, 0, 31)];
  let streakBad = 0, pctBad = 0, weekBad = 0;

  DAYS.forEach(day=>{
    today = day; ty = day.getFullYear(); tm = day.getMonth(); td = day.getDate();
    HABITS = HABITS_SET;
    const marks = seed(120);
    data = Object.assign({}, marks);

    HABITS_SET.forEach(h=>{
      if(H.getStreak(h, marks, day) !== app.getStreak(h)) streakBad++;
      if(H.getMonthPct(h, marks, day) !== app.getMonthPct(h)) pctBad++;
      for(let w = 0; w < 4; w++){
        if(H.doneInWeek(h, marks, day, w) !== app.doneInWeek(h, w)) weekBad++;
      }
    });
  });

  check('серии совпадают', streakBad, 0);
  check('проценты за месяц совпадают', pctBad, 0);
  check('отметки за неделю совпадают', weekBad, 0);
}

console.log('\n5. Что осталось на сегодня');
{
  const day = new Date(2026, 8, 4);          // пятница
  const marks = {};
  check('пусто — ждём все, кроме архивной и невыпавшей по графику',
        H.pendingToday(HABITS_SET, marks, day).map(h=>h.id), ['d1','w1','t1','q1']);

  marks[H.keyFor(day, 'd1')] = true;
  check('отмеченная уходит из списка',
        H.pendingToday(HABITS_SET, marks, day).map(h=>h.id), ['w1','t1','q1']);
  check('и попадает в сделанные',
        H.doneToday(HABITS_SET, marks, day).map(h=>h.id), ['d1']);

  const wed = new Date(2026, 8, 2);          // среда — «Зал» по графику
  const thu = new Date(2026, 8, 3);          // четверг — не по графику
  check('зал ждут в среду', H.pendingToday(HABITS_SET, {}, wed).map(h=>h.id).includes('w1'), true);
  check('зал не ждут в четверг', H.pendingToday(HABITS_SET, {}, thu).map(h=>h.id).includes('w1'), false);

  // «3 раза в неделю»: когда норма закрыта, напоминать не о чем.
  const week = {};
  const mon = H.mondayOf(day, 0);
  for(let i = 0; i < 3; i++){
    const c = new Date(mon); c.setDate(c.getDate() + i);
    week[H.keyFor(c, 't1')] = true;
  }
  check('норма 3 из 3 закрыта — бег не напоминаем',
        H.pendingToday(HABITS_SET, week, day).map(h=>h.id).includes('t1'), false);
  delete week[H.keyFor(mon, 't1')];
  check('норма 2 из 3 — напоминаем',
        H.pendingToday(HABITS_SET, week, day).map(h=>h.id).includes('t1'), true);

  check('в плане на сегодня четыре привычки',
        H.plannedToday(HABITS_SET, {}, day).length, 4);
}

console.log('\n6. Текст сообщения');
{
  const day = new Date(2026, 8, 4);
  const marks = {}, values = {};

  const text = M.todayText(HABITS_SET, marks, values, day, {greeting:'🌙 Вечерняя сверка'});
  check('есть приветствие', text.includes('🌙 Вечерняя сверка'), true);
  check('есть дата', text.includes('4 сентября'), true);
  check('есть привычка', text.includes('Медитация'), true);
  check('архивной нет', text.includes('Английский'), false);
  check('есть счётчик', text.includes('Готово: 0 из 4'), true);

  // Прогресс количественной показывается числом.
  values[H.keyFor(day, 'q1')] = 3;
  check('прогресс по цели', M.todayText(HABITS_SET, marks, values, day).includes('3 из 8'), true);

  // Когда всё закрыто — отдельный текст без списка.
  const allDone = {};
  H.plannedToday(HABITS_SET, {}, day).forEach(h=>{ allDone[H.keyFor(day, h.id)] = true; });
  const doneText = M.todayText(HABITS_SET, allDone, {}, day);
  check('всё закрыто', doneText.includes('Всё закрыто: 4 из 4'), true);

  // Пустой список привычек не должен превращаться в пустое сообщение.
  check('нет привычек', M.todayText([], {}, {}, day).includes('ничего не запланировано'), true);

  // HTML в названии экранируется: сообщение уходит с parse_mode=HTML.
  const evil = [{id:'x', name:'<b>взлом</b> & co', icon:'😈'}];
  const evilText = M.todayText(evil, {}, {}, day);
  check('угловые скобки экранированы', evilText.includes('&lt;b&gt;взлом&lt;/b&gt;'), true);
  check('амперсанд экранирован', evilText.includes('&amp; co'), true);
}

console.log('\n7. Клавиатура');
{
  const day = new Date(2026, 8, 4);
  const kb = M.todayKeyboard(HABITS_SET, {}, day);
  check('кнопок по числу невыполненных плюс обновление', kb.length, 5);
  check('в callback_data лежит id привычки', kb[0][0].callback_data, 'm:d1');
  check('последняя кнопка — обновить', kb[kb.length-1][0].callback_data, 'r');
  check('callback_data укладывается в 64 байта',
        kb.every(row => Buffer.byteLength(row[0].callback_data) <= 64), true);

  const many = [];
  for(let i = 0; i < 30; i++) many.push({id:'h'+i, name:'Привычка '+i});
  check('больше 20 кнопок не шлём', M.todayKeyboard(many, {}, day).length, 21);
}

console.log('\n8. Сводка /stats');
{
  const day = new Date(2026, 8, 4);
  today = day; ty = 2026; tm = 8; td = 4; HABITS = HABITS_SET;
  const marks = seed(60);
  data = Object.assign({}, marks);

  const text = M.statsText(HABITS_SET, marks, day);
  check('есть заголовок', text.includes('Как идут дела'), true);
  check('есть проценты', /\d+% за месяц/.test(text), true);
  check('архивная не показывается', text.includes('Английский'), false);
  check('пустой список', M.statsText([], {}, day), 'Привычек пока нет.');
}

console.log('\n9. Разбор настроек');
{
  check('пара chat:user', C.parseUsers('123:abc-def'), [{chatId:'123', userId:'abc-def'}]);
  check('несколько пар через запятую',
        C.parseUsers('123:a, 456:b').map(u=>u.chatId), ['123','456']);
  check('user_id с двоеточием не ломается',
        C.parseUsers('123:a:b').map(u=>u.userId), ['a:b']);
  check('отрицательный chat_id (группа)', C.parseUsers('-100500:x')[0].chatId, '-100500');
  throws('без двоеточия — ошибка', ()=>C.parseUsers('12345'), /chat_id:user_id/);
  throws('нечисловой chat_id — ошибка', ()=>C.parseUsers('abc:def'), /числом/);
  throws('пустой user_id — ошибка', ()=>C.parseUsers('123:'), /пустой user_id/);
  throws('пустой список — ошибка', ()=>C.parseUsers('  '), /пуст/);

  check('время 21:00', C.parseTime('21:00', 'REMIND_AT'), {hour:21, minute:0});
  check('время 7:05', C.parseTime('7:05', 'REMIND_AT'), {hour:7, minute:5});
  throws('25:00 — ошибка', ()=>C.parseTime('25:00', 'REMIND_AT'), /недопустимое/);
  throws('без минут — ошибка', ()=>C.parseTime('21', 'REMIND_AT'), /ЧЧ:ММ/);
}

console.log('\n10. Ротация лога');
{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tracker-bot-log-'));
  const file = path.join(dir, 'bot.log');
  const log = createLogger({file, maxBytes: 2048, keep: 2, echo: false});

  for(let i = 0; i < 200; i++) log.info('строка ' + i + ' '.repeat(50));

  check('текущий лог не превышает лимит с запасом', fs.statSync(file).size < 4096, true);
  check('есть первый архив', fs.existsSync(file + '.1'), true);
  check('старше keep не хранится', fs.existsSync(file + '.3'), false);

  const tail = fs.readFileSync(file, 'utf8');
  check('последняя строка на месте', tail.includes('строка 199'), true);

  fs.rmSync(dir, {recursive: true, force: true});
}

console.log('\n' + (fail ? 'ПРОВАЛЕНО проверок: ' + fail + ' из ' + (pass + fail)
                         : 'Все проверки пройдены: ' + pass));
process.exit(fail ? 1 : 0);
