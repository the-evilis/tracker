// Проверка чистой логики, вынутой из приложения: миграция ключей,
// присвоение id и склонение дней. DOM здесь не нужен.
const fs = require('fs');
const src = fs.readFileSync(process.argv[2], 'utf8');
const js = src.match(/<script>([\s\S]*)<\/script>/)[1];

// Вытаскиваем нужные функции по имени, не запуская остальной файл.
function grab(name){
  const re = new RegExp('function ' + name + '\\s*\\([^)]*\\)\\s*\\{');
  const m = js.match(re);
  if(!m) throw new Error('не найдена функция ' + name);
  let i = m.index + m[0].length, depth = 1;
  while(i < js.length && depth > 0){
    if(js[i] === '{') depth++;
    else if(js[i] === '}') depth--;
    i++;
  }
  return js.slice(m.index, i);
}

let data = {}, HABITS = [];
const localStorage = { store:{}, getItem(k){ return this.store[k] ?? null; },
                       setItem(k,v){ this.store[k]=String(v); } };
function cacheKey(){ return 'ht_test'; }
const code = [grab('isLegacyKey'), grab('migrateLocalKeys'), grab('ensureHabitIds'),
              grab('streakLabel'), grab('plural'), grab('dkey'), grab('esc'),
              grab('countMarks')].join('\n');
eval(code + '\nglobalThis.__f = {isLegacyKey,migrateLocalKeys,ensureHabitIds,streakLabel,plural,dkey,esc,countMarks};');
const f = globalThis.__f;
globalThis.flameVariantA = () => '[fire]';

let pass = 0, fail = 0;
function check(name, got, want){
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if(ok){ pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + '\n       получено: ' + JSON.stringify(got) +
                             '\n       ожидалось: ' + JSON.stringify(want)); }
}

console.log('\n1. Распознавание старых ключей');
check('старый ключ', f.isLegacyKey('2026/8/3/0'), true);
check('новый ключ', f.isLegacyKey('2026/8/3/legacy-0'), false);
check('ключ с uuid', f.isLegacyKey('2026/8/3/h-abc-123'), false);
check('мусор', f.isLegacyKey('что-то'), false);

console.log('\n2. Миграция ключей — история не съезжает');
data = {'2026/8/3/0':true, '2026/8/2/0':true, '2026/8/3/4':true, '2025/11/30/8':true};
let r = f.migrateLocalKeys();
check('старых ключей не осталось', Object.keys(data).filter(f.isLegacyKey).length, 0);
check('привычка 0 сохранила обе отметки',
      [data['2026/8/3/legacy-0'], data['2026/8/2/legacy-0']], [true, true]);
check('привычка 4 не перепуталась с 0', data['2026/8/3/legacy-4'], true);
check('старый год перенесён', data['2025/11/30/legacy-8'], true);
check('перенесено ровно 4', Object.keys(r.moved).length, 4);

console.log('\n3. Повторный запуск ничего не портит (идемпотентность)');
const before = JSON.stringify(data);
check('второй прогон возвращает null', f.migrateLocalKeys(), null);
check('данные не изменились', JSON.stringify(data), before);

console.log('\n4. id привычкам: legacy-N по позиции');
HABITS = [{name:'A'},{name:'B'},{name:'C'}];
check('изменения были', f.ensureHabitIds(), true);
check('id по индексу', HABITS.map(h=>h.id), ['legacy-0','legacy-1','legacy-2']);
check('повторно — без изменений', f.ensureHabitIds(), false);
HABITS = [{id:'h-custom',name:'A'},{name:'B'}];
f.ensureHabitIds();
check('готовый id не перезаписан', HABITS.map(h=>h.id), ['h-custom','legacy-1']);

console.log('\n5. Ключ отметки строится по id, а не по позиции');
check('ключ', f.dkey(2026,8,3,'legacy-4'), '2026/8/3/legacy-4');
const h = {id:'legacy-4'};
HABITS = [{id:'legacy-0'}, h];
check('перестановка не меняет ключ', f.dkey(2026,8,3,h.id), '2026/8/3/legacy-4');

console.log('\n6. Склонение дней');
[[1,'1 день'],[2,'2 дня'],[4,'4 дня'],[5,'5 дней'],[11,'11 дней'],[12,'12 дней'],
 [14,'14 дней'],[21,'21 день'],[22,'22 дня'],[25,'25 дней'],[101,'101 день'],
 [111,'111 дней'],[102,'102 дня']].forEach(([n,want])=>{
  check(n + ' →  ' + want, f.streakLabel(n,'#000').replace('[fire] ',''), want);
});

console.log('\n7. Экранирование');
check('угловые скобки', f.esc('<img src=x onerror=alert(1)>'),
      '&lt;img src=x onerror=alert(1)&gt;');
check('кавычки', f.esc('a"b\'c&d'), 'a&quot;b&#39;c&amp;d');
check('пустое', f.esc(null), '');

console.log('\n8. Подсчёт отметок привычки (для предупреждения при удалении)');
data = {'2026/8/1/legacy-0':true,'2026/8/2/legacy-0':true,'2026/8/1/legacy-1':true};
check('у привычки 0 — две', f.countMarks('legacy-0'), 2);
check('у привычки 1 — одна', f.countMarks('legacy-1'), 1);
check('у несуществующей — ноль', f.countMarks('legacy-9'), 0);

console.log('\n' + (fail ? 'ПРОВАЛЕНО: ' + fail + ', пройдено: ' + pass
                          : 'Все проверки пройдены: ' + pass));
process.exit(fail ? 1 : 0);
