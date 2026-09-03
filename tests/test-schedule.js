// Проверка логики графиков, серий и процентов, вынутой из приложения.
const fs = require('fs');
const src = fs.readFileSync(process.argv[2], 'utf8');
const js = src.match(/<script>([\s\S]*)<\/script>/)[1];

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

// Фиксируем «сегодня» = воскресенье 2026-03-01, чтобы недели были полными.
let today = new Date(2026, 2, 1);
let ty = today.getFullYear(), tm = today.getMonth(), td = today.getDate();
let data = {}, HABITS = [];
const MON_S=['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'];

const names = ['dkey','habitSchedule','isPlannedDay','scheduleLabel','activeHabits',
               'archivedHabits','habitTarget','dayObj','mondayOf','doneInWeek',
               'getStreak','streakUnit','countMarks','getMonthPct','checkAllDone',
               'plural','habitById','isToday','isFuture'];
eval(names.map(grab).join('\n') + '\nglobalThis.__f={' + names.join(',') + '};');
const f = globalThis.__f;

let pass = 0, fail = 0;
function check(name, got, want){
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if(ok){ pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + '\n       получено: ' + JSON.stringify(got) +
                             '\n       ожидалось: ' + JSON.stringify(want)); }
}
const D = (y,m,d)=>f.dayObj(new Date(y,m,d));
function mark(h, y,m,d){ data[f.dkey(y,m,d,h.id)] = true; }

console.log('\n1. Нормализация графика');
check('нет графика → ежедневно', f.habitSchedule({}), {type:'daily'});
check('пустые дни → ежедневно', f.habitSchedule({schedule:{type:'weekdays',days:[]}}), {type:'daily'});
check('мусорные дни отброшены', f.habitSchedule({schedule:{type:'weekdays',days:[1,9,-2,5]}}), {type:'weekdays',days:[1,5]});
check('n зажат в 1..7', f.habitSchedule({schedule:{type:'times_per_week',n:99}}), {type:'times_per_week',n:7});
check('n минимум 1', f.habitSchedule({schedule:{type:'times_per_week',n:0}}), {type:'times_per_week',n:1});

console.log('\n2. Плановые дни (пн/ср/пт)');
const wd = {id:'w', name:'Зал', color:'#000', schedule:{type:'weekdays', days:[1,3,5]}};
// 23 фев 2026 — понедельник
check('понедельник — плановый', f.isPlannedDay(wd, D(2026,1,23)), true);
check('вторник — нет',          f.isPlannedDay(wd, D(2026,1,24)), false);
check('среда — плановый',       f.isPlannedDay(wd, D(2026,1,25)), true);
check('суббота — нет',          f.isPlannedDay(wd, D(2026,1,28)), false);
check('ежедневная — любой день', f.isPlannedDay({id:'d'}, D(2026,1,24)), true);
check('N раз в неделю — любой день',
      f.isPlannedDay({id:'t',schedule:{type:'times_per_week',n:3}}, D(2026,1,24)), true);

console.log('\n3. Серия не рвётся из-за внеплановых дней');
HABITS = [wd]; data = {};
// пн/ср/пт двух недель: 16,18,20 и 23,25,27 февраля
[16,18,20,23,25,27].forEach(d=>mark(wd,2026,1,d));
check('шесть плановых подряд → серия 6', f.getStreak(wd), 6);
check('единица серии — дни', f.streakUnit(wd), 'day');
// пропускаем среду 25-го: серия должна оборваться после 27-го
delete data[f.dkey(2026,1,25,'w')];
check('пропуск среды обрывает серию на 27-м', f.getStreak(wd), 1);

console.log('\n4. Серия «N раз в неделю» считается неделями');
const tw = {id:'t', name:'Бег', color:'#000', schedule:{type:'times_per_week', n:3}};
HABITS = [tw]; data = {};
// текущая неделя (пн 23 фев – вс 1 мар): 3 отметки
[23,25,27].forEach(d=>mark(tw,2026,1,d));
// прошлая неделя (16–22 фев): 3 отметки в разные дни
[17,19,21].forEach(d=>mark(tw,2026,1,d));
// позапрошлая (9–15 фев): только 2 — серия должна остановиться
[10,12].forEach(d=>mark(tw,2026,1,d));
check('две полные недели → серия 2', f.getStreak(tw), 2);
check('единица серии — недели', f.streakUnit(tw), 'week');
check('в текущей неделе 3 отметки', f.doneInWeek(tw, 0), 3);
check('в позапрошлой 2 отметки', f.doneInWeek(tw, 2), 2);

console.log('\n5. Незаконченная текущая неделя не обнуляет серию');
data = {};
[17,19,21].forEach(d=>mark(tw,2026,1,d));   // прошлая неделя полная
mark(tw,2026,1,23);                          // в этой пока только одна
check('текущая неполная → серия 1 (за прошлую)', f.getStreak(tw), 1);

console.log('\n6. Сегодняшний пропуск не обрывает серию (ежедневная)');
const dl = {id:'d', name:'Чтение', color:'#000'};
HABITS = [dl]; data = {};
[25,26,27,28].forEach(d=>mark(dl,2026,1,d));  // по 28 фев, сегодня 1 мар не отмечено
check('серия 4, сегодня ещё не отмечено', f.getStreak(dl), 4);
mark(dl,2026,2,1);
check('отметили сегодня → серия 5', f.getStreak(dl), 5);

console.log('\n7. Процент считается от плановых дней, а не от всех');
HABITS = [wd]; data = {};
// март 2026: сегодня 1-е (вс). Плановых пн/ср/пт до 1 марта включительно — нет.
check('нет плановых дней в периоде → 0%', f.getMonthPct(wd), 0);
// Проверим на ежедневной: 1 марта отмечено из 1 дня = 100%
HABITS = [dl]; data = {}; mark(dl,2026,2,1);
check('ежедневная, 1 из 1 → 100%', f.getMonthPct(dl), 100);
data = {};
check('ежедневная, 0 из 1 → 0%', f.getMonthPct(dl), 0);

console.log('\n8. «День закрыт» учитывает только запланированное на сегодня');
// сегодня воскресенье: зал (пн/ср/пт) не в плане, чтение — в плане
HABITS = [wd, dl]; data = {};
mark(dl,2026,2,1);
check('чтение закрыто, зал не в плане → день закрыт',
      f.checkAllDone([D(2026,2,1)]), true);
data = {};
check('чтение не закрыто → день не закрыт', f.checkAllDone([D(2026,2,1)]), false);

console.log('\n9. Архив исключает привычку из активных');
HABITS = [dl, Object.assign({}, wd, {archived:true})];
check('активных 1', f.activeHabits().length, 1);
check('в архиве 1', f.archivedHabits().length, 1);
check('активная — чтение', f.activeHabits()[0].id, 'd');

console.log('\n10. Цель привычки');
check('цель 8', f.habitTarget({target:8}), 8);
check('цель 1 не считается целью', f.habitTarget({target:1}), 0);
check('без цели', f.habitTarget({}), 0);
check('мусор в цели', f.habitTarget({target:'abc'}), 0);

console.log('\n11. Подписи графика');
check('ежедневно', f.scheduleLabel({}), 'каждый день');
check('дни недели', f.scheduleLabel(wd), 'пн, ср, пт');
check('3 раза', f.scheduleLabel(tw), '3 раза в неделю');
check('5 раз', f.scheduleLabel({schedule:{type:'times_per_week',n:5}}), '5 раз в неделю');

console.log('\n12. Склонения');
check('1 неделя',  f.plural(1,'неделя','недели','недель'), 'неделя');
check('3 недели',  f.plural(3,'неделя','недели','недель'), 'недели');
check('11 недель', f.plural(11,'неделя','недели','недель'), 'недель');
check('21 неделя', f.plural(21,'неделя','недели','недель'), 'неделя');
check('1 отметка', f.plural(1,'отметка','отметки','отметок'), 'отметка');
check('5 отметок', f.plural(5,'отметка','отметки','отметок'), 'отметок');

console.log('\n' + (fail ? 'ПРОВАЛЕНО: ' + fail + ', пройдено: ' + pass
                          : 'Все проверки пройдены: ' + pass));
process.exit(fail ? 1 : 0);
