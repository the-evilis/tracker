/* app-habits.js — Привычки: графики, серии и проценты, отметки, виды
   «Сегодня», неделя, месяц и год, редактор и архив.
   Часть приложения. Файлы подключаются подряд и делят общую
   область видимости: сборки в проекте нет. */

// ── ГРАФИК ПРИВЫЧКИ ───────────────────────────────────────────────────────
// Привычка больше не обязана быть ежедневной. Раньше «тренировка 3 раза
// в неделю» обнуляла серию каждый вторник и показывала 43% — приложение
// наказывало за правильно составленный план.
//
//   {type:'daily'}                      — каждый день
//   {type:'weekdays', days:[1,3,5]}     — по дням недели (0 = воскресенье)
//   {type:'times_per_week', n:3}        — N раз в неделю, дни любые
function habitSchedule(h){
  const s = h && h.schedule;
  if(!s || !s.type) return {type:'daily'};
  if(s.type === 'weekdays'){
    const days = Array.isArray(s.days) ? s.days.filter(d=>d>=0&&d<=6) : [];
    return days.length ? {type:'weekdays', days} : {type:'daily'};
  }
  if(s.type === 'times_per_week'){
    const n = Math.min(7, Math.max(1, parseInt(s.n,10) || 1));
    return {type:'times_per_week', n};
  }
  return {type:'daily'};
}

// История графиков привычки. Раньше проценты и серии за прошлое считались
// по текущему расписанию: сменил «каждый день» на «3 раза в неделю» — и вся
// история задним числом становилась другой. Теперь каждая смена графика
// запоминается с датой, а прошлые дни считаются по тому графику, который
// действовал тогда.
//
// Формат: h.schedHistory = [{from:'ГГГГ-ММ-ДД', schedule:{...}}, ...] по
// возрастанию даты. Записи до первой даты считаются по h.schedule.
function scheduleAt(h, day){
  const hist = h && Array.isArray(h.schedHistory) ? h.schedHistory : null;
  if(!hist || !hist.length) return habitSchedule(h);

  const iso = day.y + '-' + String(day.m + 1).padStart(2, '0') + '-' +
              String(day.d).padStart(2, '0');
  let found = null;
  for(let i = 0; i < hist.length; i++){
    if(hist[i] && hist[i].from <= iso) found = hist[i]; else break;
  }
  return found ? habitSchedule({schedule: found.schedule}) : habitSchedule(h);
}

// Зафиксировать смену графика: вызывается при сохранении привычек, если
// расписание действительно изменилось.
function pushScheduleHistory(h, oldSchedule){
  const today = ty + '-' + String(tm + 1).padStart(2, '0') + '-' + String(td).padStart(2, '0');
  h.schedHistory = Array.isArray(h.schedHistory) ? h.schedHistory : [];

  // Первая запись описывает то, что действовало ДО сегодняшнего дня.
  if(!h.schedHistory.length){
    h.schedHistory.push({from: '0000-00-00', schedule: oldSchedule || {type:'daily'}});
  }
  // Правка графика дважды за день не должна плодить записи.
  const last = h.schedHistory[h.schedHistory.length - 1];
  if(last && last.from === today) last.schedule = h.schedule || {type:'daily'};
  else h.schedHistory.push({from: today, schedule: h.schedule || {type:'daily'}});
}

// Ждём ли мы отметку в этот день. Для «N раз в неделю» плановых дней нет —
// подходит любой, поэтому такие дни не помечаем как внеплановые.
function isPlannedDay(h, day){
  const s = scheduleAt(h, day);
  if(s.type === 'weekdays') return s.days.indexOf(day.date.getDay()) !== -1;
  return true;
}

function scheduleLabel(h){
  const s = habitSchedule(h);
  if(s.type === 'daily') return 'каждый день';
  if(s.type === 'times_per_week') return s.n + ' раз' + (s.n>=2&&s.n<=4?'а':'') + ' в неделю';
  const NM = ['вс','пн','вт','ср','чт','пт','сб'];
  return s.days.slice().sort().map(d=>NM[d]).join(', ');
}

function activeHabits(){ return HABITS.filter(h => !h.archived); }
function archivedHabits(){ return HABITS.filter(h => h.archived); }

// ── КОЛИЧЕСТВЕННЫЕ ПРИВЫЧКИ ───────────────────────────────────────────────
// У привычки может быть цель («8 стаканов», «20 страниц»). Само число живёт
// отдельно от галочек: колонка done в базе булева, менять её схему ради
// этого не пришлось. Значения синхронизируются как один JSON в user_settings.
let marksValues = {};

function habitTarget(h){
  const t = h && parseInt(h.target, 10);
  return (t && t > 1) ? t : 0;
}
function getValue(k){ const v = marksValues[k]; return typeof v === 'number' ? v : 0; }
function setValue(k, v){
  if(v > 0) marksValues[k] = v; else delete marksValues[k];
  try{ localStorage.setItem(valuesKey(), JSON.stringify(marksValues)); }catch(e){}
}
function valuesKey(){ return 'htv_'+((currentUser&&currentUser.id)||'anon'); }

// ── STATS ─────────────────────────────────────────────────────────────────
function dayObj(date){
  return {y:date.getFullYear(), m:date.getMonth(), d:date.getDate(), date:new Date(date)};
}

// Понедельник недели, сдвинутой на weeksAgo назад от сегодняшней.
function mondayOf(weeksAgo){
  const base = new Date(ty, tm, td);
  base.setDate(base.getDate() - weeksAgo * 7);
  const dow = base.getDay() || 7;
  base.setDate(base.getDate() - dow + 1);
  base.setHours(0,0,0,0);
  return base;
}

function doneInWeek(h, weeksAgo){
  const mon = mondayOf(weeksAgo);
  let n = 0;
  for(let i = 0; i < 7; i++){
    const c = new Date(mon); c.setDate(c.getDate() + i);
    if(data[dkey(c.getFullYear(), c.getMonth(), c.getDate(), h.id)]) n++;
  }
  return n;
}

// Серия. Для «N раз в неделю» считается в неделях, иначе в плановых днях.
// Незаконченный сегодняшний день (и текущая неделя) серию не обрывают.
function getStreak(hid){
  const h = typeof hid === 'object' ? hid : habitById(hid);
  if(!h) return 0;
  const s = habitSchedule(h);

  if(s.type === 'times_per_week'){
    let streak = 0;
    for(let w = 0; w < 105; w++){
      if(doneInWeek(h, w) >= s.n) streak++;
      else if(w === 0) continue;   // текущая неделя ещё идёт
      else break;
    }
    return streak;
  }

  let streak = 0;
  const cur = new Date(ty, tm, td);
  for(let i = 0; i < 400; i++){
    const day = dayObj(cur);
    if(isPlannedDay(h, day)){
      if(data[dkey(day.y, day.m, day.d, h.id)]) streak++;
      else if(i > 0) break;        // сегодняшний пропуск ещё не пропуск
    }
    cur.setDate(cur.getDate() - 1);
  }
  return streak;
}

// Единица серии зависит от графика: недели или дни.
function streakUnit(h){ return habitSchedule(h).type === 'times_per_week' ? 'week' : 'day'; }

// Сколько отметок накоплено по привычке — нужно для честного
// предупреждения при удалении.
function countMarks(hid){
  const suffix = '/' + hid;
  return Object.keys(data).filter(k => k.endsWith(suffix) && data[k]).length;
}

// Процент за текущий месяц считается от ПЛАНОВЫХ дней, а не от всех.
function getMonthPct(hid){
  const h = typeof hid === 'object' ? hid : habitById(hid);
  if(!h) return 0;
  const s = habitSchedule(h);
  let done = 0, planned = 0;

  if(s.type === 'times_per_week'){
    // Норма за прошедшую часть месяца: n на каждую начатую неделю.
    for(let i = 1; i <= td; i++) if(data[dkey(ty, tm, i, h.id)]) done++;
    planned = Math.max(1, Math.round(td / 7 * s.n));
  } else {
    for(let i = 1; i <= td; i++){
      const day = dayObj(new Date(ty, tm, i));
      if(!isPlannedDay(h, day)) continue;
      planned++;
      if(data[dkey(ty, tm, i, h.id)]) done++;
    }
  }
  if(!planned) return 0;
  return Math.min(100, Math.round(done / planned * 100));
}

// «День закрыт» — выполнены все привычки, запланированные именно на сегодня.
function checkAllDone(days){
  const t = days.find(d => isToday(d));
  if(!t) return false;
  const due = activeHabits().filter(h => isPlannedDay(h, t));
  return due.length > 0 && due.every(h => data[dkey(t.y, t.m, t.d, h.id)]);
}

// Статистика с явной базой: «47 из 63» вместо «47», имя привычки-рекордсмена
// и понятная подпись периода — раньше числа не говорили, от чего считаются.
// «Хороший день» — не идеальный. Закрыть всё до единой привычки удаётся
// редко, и метрика «дней закрыто: 0 из 7» каждый вечер сообщает человеку,
// что он провалился. Поэтому день считается хорошим, если сделано не
// меньше двух третей запланированного на него.
const GOOD_DAY_RATIO = 0.67;

function dayScore(day){
  const due = activeHabits().filter(h => isPlannedDay(h, day));
  if(!due.length) return null;                       // плановых дел не было
  const done = due.filter(h => data[dkey(day.y, day.m, day.d, h.id)]).length;
  return {done, total: due.length, good: done / due.length >= GOOD_DAY_RATIO};
}

// Скользящее окно вместо «с начала месяца»: важно, как идут дела сейчас,
// а не насколько испорчено начало месяца.
function goodDaysWindow(n){
  let good = 0, counted = 0;
  for(let i = 0; i < n; i++){
    const d = new Date(ty, tm, td - i);
    const s = dayScore(dayObj(d));
    if(!s) continue;
    counted++;
    if(s.good) good++;
  }
  return {good, counted};
}

// Метрики вида «Сегодня» отвечают на один вопрос: что сейчас и как идёт
// эта неделя. Общий процент и длинные серии сюда намеренно не попадают.
function renderTodayStats(day){
  const s = dayScore(day) || {done: 0, total: 0};
  const w = goodDaysWindow(7);
  const marks7 = (()=>{
    let n = 0;
    for(let i = 0; i < 7; i++){
      const d = new Date(ty, tm, td - i);
      activeHabits().forEach(h=>{ if(data[dkey(d.getFullYear(), d.getMonth(), d.getDate(), h.id)]) n++; });
    }
    return n;
  })();

  const cards = [
    {num: s.done + '<span class="stat-of"> из ' + s.total + '</span>', label: 'Сегодня'},
    {num: w.good + '<span class="stat-of"> из ' + w.counted + '</span>', label: 'Хороших дней'},
    {num: marks7 + '', label: 'Отметок за 7 дней'},
    {num: (s.total - s.done) + '', label: s.total - s.done ? 'Осталось' : 'Всё закрыто'}
  ];

  document.getElementById('stats-row').innerHTML = cards.map(c=>
    '<div class="stat"><div class="stat-num">' + c.num + '</div>' +
    '<div class="stat-label">' + c.label + '</div></div>').join('');
}

function renderStats(days){
  if(view === 'today'){ renderTodayStats(days[0]); return; }

  const list = activeHabits();
  let done = 0, planned = 0, fullDays = 0, countedDays = 0;

  days.filter(d => !isFuture(d)).forEach(day=>{
    const due = list.filter(h => isPlannedDay(h, day));
    if(!due.length) return;
    countedDays++;
    let dayDone = 0;
    due.forEach(h=>{
      planned++;
      if(data[dkey(day.y, day.m, day.d, h.id)]){ done++; dayDone++; }
    });
    // Считаем хорошие дни, а не идеальные: требовать все привычки до
    // единой — верный способ показывать ноль каждую неделю.
    if(dayDone / due.length >= GOOD_DAY_RATIO) fullDays++;
  });

  let best = 0, bestName = '';
  list.forEach(h=>{
    const s = getStreak(h);
    if(s > best){ best = s; bestName = h.name; }
  });

  const pct = planned ? Math.round(done / planned * 100) : 0;
  const bestLabel = best
    ? (streakUnit(habitById2(bestName)) === 'week' ? 'нед.' : 'дн.')
    : '';

  const cards = [
    {num: done + '<span class="stat-of"> из ' + planned + '</span>', label: 'Выполнено'},
    {num: pct + '%',                                                 label: 'Процент'},
    {num: best + (bestLabel ? '<span class="stat-of"> ' + bestLabel + '</span>' : ''),
     label: best ? esc(trimName(bestName)) : 'Серия'},
    {num: fullDays + '<span class="stat-of"> из ' + countedDays + '</span>', label: 'Хороших дней'}
  ];
  document.getElementById('stats-row').innerHTML = cards.map(s=>
    '<div class="stat"><div class="stat-num">'+s.num+'</div><div class="stat-label">'+s.label+'</div></div>'
  ).join('');

  const per = document.getElementById('stats-period');
  if(per) per.textContent = view === 'today' ? 'сегодня'
                          : view === 'week' ? 'за эту неделю'
                          : view === 'month' ? 'за ' + MON_F[new Date(ty, tm+offset, 1).getMonth()].toLowerCase()
                          : 'за 12 месяцев';
}

function habitById2(name){ return HABITS.find(h => h.name === name) || null; }
function trimName(n){ return n && n.length > 14 ? n.slice(0, 13) + '…' : (n || 'Серия'); }

// ── TOGGLE ────────────────────────────────────────────────────────────────
function habitById(hid){ return HABITS.find(h => h.id === hid) || null; }

// Единая отрисовка состояния точки: выполнено, частично (для привычек
// с целью), день вне графика. Раньше состояний было два и логика жила
// в трёх местах разом.
function paintDot(el, h, k){
  const done = !!data[k];
  const target = habitTarget(h);
  const val = target ? getValue(k) : 0;
  const partial = !done && target > 0 && val > 0;

  el.classList.toggle('done', done);
  el.classList.toggle('partial', partial);
  el.style.background = done ? h.color : '';
  el.style.setProperty('--fill', partial ? Math.round(val / target * 100) + '%' : '0%');
  el.setAttribute('aria-checked', done ? 'true' : 'false');

  if(done) el.innerHTML = target ? '<span class="dot-num">'+target+'</span>' : '✓';
  else if(partial) el.innerHTML = '<span class="dot-num">'+val+'</span>';
  else el.innerHTML = '';
}

function applyDotState(k, hid){
  const h = habitById(hid);
  if(!h) return;
  document.querySelectorAll('[data-k="'+k+'"]').forEach(el=>paintDot(el, h, k));
}

// Процент и серия в карточке конкретной привычки.
function refreshHabitMeta(hid){
  const h = habitById(hid);
  if(!h) return;
  const pct = getMonthPct(h), streak = getStreak(h);
  document.querySelectorAll('[data-habit="'+hid+'"]').forEach(card=>{
    const fill = card.querySelector('.progress-fill');
    if(fill) fill.style.width = pct + '%';
    card.querySelectorAll('.progress-pct, .month-pct').forEach(el=>{ el.textContent = pct + '%'; });
    const meta = card.querySelector('.habit-meta');
    if(meta) meta.innerHTML = streak >= 1 ? streakLabel(streak, h.color, streakUnit(h)) : '';
  });
}

function toggle(y,m,d,hid){
  const h = habitById(hid);
  if(!h) return;
  const k = dkey(y,m,d,hid);
  const target = habitTarget(h);
  let on;

  if(target){
    // Привычка с целью: каждое нажатие прибавляет единицу, на цели
    // засчитывается день, следующее нажатие обнуляет.
    if(data[k]){ setValue(k, 0); on = false; }
    else {
      const val = getValue(k) + 1;
      on = val >= target;
      setValue(k, on ? target : val);
    }
    if(on) data[k] = true; else delete data[k];
    saveEntry(k, on);
    scheduleValuesSync();
  } else {
    on = !data[k];
    if(on) data[k] = true; else delete data[k];
    saveEntry(k, on);
  }

  applyDotState(k, hid);
  refreshHabitMeta(hid);
  const days = getViewDays();
  renderStats(days);

  // Праздник — за настоящий повод: закрытый целиком день.
  // Обычная галочка получает короткую ненавязчивую анимацию.
  if(on && !REDUCED_MOTION){
    if(checkAllDone(days)) launchConfetti(true);
    else launchConfetti(false);
  }
}

// Клики по точкам обрабатываем делегированием: обработчик один на список,
// а не inline-атрибут у каждой из сотен точек.
document.getElementById('habits-list').addEventListener('click', e=>{
  const dot = e.target.closest('[data-k]');
  if(!dot || dot.classList.contains('future')) return;
  toggle(+dot.dataset.y, +dot.dataset.m, +dot.dataset.d, dot.dataset.h);
});

// ── STREAK LABEL ─────────────────────────────────────────────────────────
// Map hex color to hue-rotate degrees for fire emoji
function colorToHueRotate(hex){
  if(!hex) return 190;
  const r=parseInt(hex.slice(1,3),16)/255, g=parseInt(hex.slice(3,5),16)/255, b=parseInt(hex.slice(5,7),16)/255;
  const max=Math.max(r,g,b), min=Math.min(r,g,b), d=max-min;
  if(d===0) return 190;
  let h = max===r ? ((g-b)/d)%6 : max===g ? (b-r)/d+2 : (r-g)/d+4;
  h = Math.round(h*60); if(h<0) h+=360;
  return (h - 30 + 360) % 360;
}

// Вариант A: эмодзи 🔥 с цветовым фильтром (~85-90% точности к цвету привычки)
function flameVariantA(color){
  // Спец-случай: графитовая молния (для 'Лучшая серия')
  if(color === '#GRAPHITE'){
    return '<span style="display:inline-block;font-size:16px;line-height:1;'+
      'filter:grayscale(1) brightness(0.55) contrast(1.1);'+
      'transform:translateY(-1px)">⚡</span>';
  }
  const deg = colorToHueRotate(color);
  return '<span style="display:inline-block;font-size:16px;line-height:1;'+
    'filter:hue-rotate('+deg+'deg) saturate(2.2) brightness(1.05) '+
    'drop-shadow(0 0 2px '+color+'88);'+
    'transform:translateY(-1px)">🔥</span>';
}

// Русские окончания: 1 день, 2–4 дня, 5–20 дней, 21 день, 22 дня…
function plural(n, one, few, many){
  const t = n % 100, u = n % 10;
  if(t >= 11 && t <= 14) return many;
  if(u === 1) return one;
  if(u >= 2 && u <= 4) return few;
  return many;
}

// unit='week' для привычек «N раз в неделю»: там серия измеряется неделями,
// иначе «3 дня» врало бы про график из трёх тренировок.
function streakLabel(s, color, unit){
  if(!s || s < 1) return '';
  const n = Math.floor(s);
  const suffix = unit === 'week'
    ? plural(n, 'неделя', 'недели', 'недель')
    : plural(n, 'день', 'дня', 'дней');
  return flameVariantA(color) + ' ' + n + ' ' + suffix;
}

// ── RENDER ────────────────────────────────────────────────────────────────
function render(){
  const days = getViewDays();
  document.getElementById('nav-title').textContent = navTitle(days);
  ['today','week','month','year'].forEach(v=>{
    const b = document.getElementById('btn-'+v);
    if(!b) return;
    b.className = 'view-btn' + (view===v ? ' active' : '');
    b.setAttribute('aria-selected', view===v ? 'true' : 'false');
  });
  // У годового вида окно всегда одно — последние 12 месяцев, листать нечего;
  // у «сегодня» листать тем более некуда.
  const fixed = view === 'year' || view === 'today';
  document.getElementById('btn-prev').style.visibility = fixed ? 'hidden' : '';
  document.getElementById('btn-next').style.visibility = fixed ? 'hidden' : '';

  const DN=['Воскресенье','Понедельник','Вторник','Среда','Четверг','Пятница','Суббота'];
  document.getElementById('date-sub').textContent = DN[today.getDay()]+', '+td+' '+MON_S[tm];
  renderStats(days);

  // Пустое состояние: раньше при удалении всех привычек оставался
  // голый экран без единой подсказки, что делать дальше.
  if(!activeHabits().length){
    document.getElementById('week-header').style.display = 'none';
    document.getElementById('habits-list').innerHTML =
      '<div class="empty">'+
        '<div class="empty-emoji">🌱</div>'+
        '<h3>Пока ни одной привычки</h3>'+
        '<p>Добавьте первую — начать лучше с одной-двух, чтобы они успели закрепиться.</p>'+
        '<button class="btn btn-primary" data-act="openModal">Добавить привычку</button>'+
      '</div>';
    return;
  }

  if(view==='today') renderToday(days[0]);
  else if(view==='week') renderWeek(days);
  else if(view==='month') renderMonth(days);
  else renderYear();
}

// ── ВИД «СЕГОДНЯ» ─────────────────────────────────────────────────────────
// Только то, что ждут сегодня: крупные строки, которые закрываются одним
// касанием. Сделанное уезжает вниз и гаснет — список тает на глазах.
function renderToday(day){
  document.getElementById('week-header').style.display = 'none';

  const due = activeHabits().filter(h => isPlannedDay(h, day));
  const rest = activeHabits().filter(h => !isPlannedDay(h, day));

  const habitsHtml = due.length
    ? (()=>{
        const undone = due.filter(h => !data[dkey(day.y, day.m, day.d, h.id)]);
        const done = due.filter(h => data[dkey(day.y, day.m, day.d, h.id)]);
        return '<div class="today-head">' +
            (undone.length
              ? '<b>Осталось ' + undone.length + '</b> из ' + due.length
              : '<b>Всё закрыто</b> · ' + due.length + ' из ' + due.length) +
          '</div>' +
          todayRows(undone, day) +
          (done.length ? '<div class="today-sep">Сделано</div>' + todayRows(done, day) : '');
      })()
    : '<div class="empty"><div class="empty-emoji">🌤</div>' +
      '<h3>На сегодня ничего не запланировано</h3>' +
      '<p>По графику сегодня свободный день.</p></div>';

  document.getElementById('habits-list').innerHTML =
    dueGoalHtml() +
    habitsHtml +
    (rest.length ? '<div class="today-sep">Не по графику</div>' + todayRows(rest, day, true) : '') +
    credoTodayHtml() +
    moneyTodayHtml();
}

// Ближайший горящий срок из Focus. Показываем только то, что действительно
// требует внимания: просрочено или осталось меньше недели.
function dueGoalHtml(){
  const soon = activeGoals()
    .filter(g => g.due && daysLeft(g.due) !== null && daysLeft(g.due) <= 7)
    .sort((a, b) => daysLeft(a.due) - daysLeft(b.due))[0];
  if(!soon) return '';

  const overdue = daysLeft(soon.due) < 0;
  return '<button class="today-goal' + (overdue ? ' overdue' : '') + '"' +
    ' data-act="open-goal" data-id="' + esc(soon.id) + '">' +
    '<span class="tg-ico">' + esc(soon.icon || '🎯') + '</span>' +
    '<span class="tg-mid"><b>' + esc(soon.name) + '</b>' +
    '<span class="tg-sub">' + esc(dueLabel(soon.due)) + '</span></span>' +
    '<span class="tg-arrow">›</span>' +
  '</button>';
}

// Принцип дня прямо на экране дня: заходить ради одной галочки в Credo
// человек не станет.
function credoTodayHtml(){
  const c = credoOfDay();
  if(!c) return '';
  const k = credoKey(c);
  const done = !!data[k];
  return '<div class="today-sep">Принцип дня</div>' +
    '<div class="today-row' + (done ? ' done' : '') + '">' +
      '<div class="habit-icon" style="--habit:var(--accent);--habit-bg:var(--surface2)">🧭</div>' +
      '<div class="today-mid">' +
        '<div class="habit-name">' + esc(c.text) + '</div>' +
        '<div class="today-meta">' + (done ? 'сегодня удержан' : 'отметьте вечером') + '</div>' +
      '</div>' +
      '<button type="button" class="today-check" role="checkbox"' +
        ' aria-checked="' + (done ? 'true' : 'false') + '"' +
        ' aria-label="Следовал принципу сегодня"' +
        ' data-act="toggle-credo" data-id="' + esc(c.id) + '">' + (done ? '✓' : '') + '</button>' +
    '</div>';
}

// Деньги за сегодня и строка быстрого ввода: записывать трату нужно в тот
// же момент, когда о ней вспомнил, а не «когда дойду до раздела».
function moneyTodayHtml(){
  if(moneyTableMissing) return '';
  const iso = isoDate(new Date(ty, tm, td));
  const todayTx = txs.filter(t => t.ts === iso);
  const spent = todayTx.filter(t => t.kind === 'expense').reduce((s, t) => s + t.amount, 0);

  return '<div class="today-sep">Деньги за сегодня</div>' +
    '<div class="today-money">' +
      '<div class="tm-sum">' + (spent ? fmtMoney(spent) : 'трат нет') +
        (todayTx.length ? '<span class="tm-count"> · ' + todayTx.length + ' ' +
          plural(todayTx.length, 'операция', 'операции', 'операций') + '</span>' : '') +
      '</div>' +
      '<div class="quick-row">' +
        '<input class="add-input quick-input" id="quick-tx" placeholder="850 кафе"' +
          ' autocomplete="off" inputmode="text"' +
          ' data-enter="quick-tx">' +
        '<button class="btn btn-primary" data-act="quickAddTx">Записать</button>' +
      '</div>' +
      '<div class="quick-hint" id="quick-hint">Сумма и слово: «850 кафе», «-180 кофе», «+50000 клиент»</div>' +
    '</div>';
}

function todayRows(list, day, offplan){
  return list.map(h=>{
    const k = dkey(day.y, day.m, day.d, h.id);
    const done = !!data[k];
    const target = habitTarget(h);
    const val = target ? getValue(k) : 0;
    const streak = getStreak(h);

    return '<div class="today-row' + (done ? ' done' : '') + (offplan ? ' offplan' : '') + '"' +
      ' data-habit="' + esc(h.id) + '" style="--habit:' + esc(h.color) + '">' +
      '<div class="habit-icon" style="--habit:' + esc(h.color) + ';--habit-bg:' +
        esc(h.bg || '#EEEDFE') + '">' + esc(h.icon) + '</div>' +
      '<div class="today-mid">' +
        '<div class="habit-name">' + esc(h.name) + '</div>' +
        '<div class="today-meta">' +
          (target ? (done ? target + ' из ' + target : val + ' из ' + target) + ' · ' : '') +
          (streak >= 1 ? '🔥 ' + streak + ' ' + (streakUnit(h) === 'week'
              ? plural(streak, 'неделя', 'недели', 'недель')
              : plural(streak, 'день', 'дня', 'дней'))
            : esc(scheduleLabel(h))) +
        '</div>' +
      '</div>' +
      '<button type="button" class="today-check" role="checkbox"' +
        ' aria-checked="' + (done ? 'true' : 'false') + '"' +
        ' aria-label="' + esc(h.name) + ', сегодня"' +
        dotAttrs(day, h, false) + '>' + (done ? '✓' : (target ? '+' : '')) + '</button>' +
    '</div>';
  }).join('');
}

// data-атрибуты точки: по ним обработчик-делегат понимает, что переключать.
function dotAttrs(day, h, fut){
  if(fut) return ' disabled';
  return ' data-k="'+esc(dkey(day.y,day.m,day.d,h.id))+'"'+
         ' data-y="'+day.y+'" data-m="'+day.m+'" data-d="'+day.d+'"'+
         ' data-h="'+esc(h.id)+'"';
}

// Одна точка-переключатель. Это настоящая <button role="checkbox"> с
// подписью: раньше был div, в который нельзя попасть табом и который
// программа чтения с экрана объявляла пустым блоком.
function dotHtml(day, h, baseClass, extraStyle){
  const k = dkey(day.y, day.m, day.d, h.id);
  const fut = isFuture(day), tod = isToday(day);
  const done = !!data[k];
  const target = habitTarget(h);
  const val = target ? getValue(k) : 0;
  const partial = !done && target > 0 && val > 0;
  const offplan = !isPlannedDay(h, day);

  const cls = baseClass +
    (done ? ' done' : '') +
    (fut ? ' future' : '') +
    (partial ? ' partial' : '') +
    (offplan ? ' offplan' : '') +
    (tod && !done ? ' today-hl' : '');

  const label = h.name + ', ' + day.d + ' ' + MON_S[day.m] +
    (target ? ', цель ' + target : '') +
    (offplan ? ', не по графику' : '');

  const inner = done ? (target ? '<span class="dot-num">'+target+'</span>' : '✓')
              : partial ? '<span class="dot-num">'+val+'</span>' : '';

  return '<button type="button" class="'+cls+'" role="checkbox"'+
    ' aria-checked="'+(done?'true':'false')+'"'+
    ' aria-label="'+esc(label)+'"'+
    ' style="--habit:'+esc(h.color)+';--fill:'+(partial?Math.round(val/target*100):0)+'%;'+
      (done?'background:'+esc(h.color)+';':'')+(extraStyle||'')+'"'+
    dotAttrs(day, h, fut)+'>'+inner+'</button>';
}

// Шапка карточки привычки — одинаковая в неделе и месяце.
function habitHeadHtml(h){
  const streak = getStreak(h);
  return '<div class="habit-icon" style="--habit:'+esc(h.color)+';--habit-bg:'+esc(h.bg||'#EEEDFE')+';flex-shrink:0">'+esc(h.icon)+'</div>'+
    '<div style="min-width:0">'+
      '<div class="habit-name">'+esc(h.name)+'</div>'+
      '<div class="habit-meta">'+(streak>=1?streakLabel(streak,h.color,streakUnit(h)):esc(scheduleLabel(h)))+'</div>'+
    '</div>';
}

function renderWeek(days){
  const isMobile = window.innerWidth <= 600;
  const hdr = document.getElementById('week-header');
  const list = activeHabits();

  if(isMobile){
    hdr.style.display = 'none';
    document.getElementById('habits-list').innerHTML = list.map(h=>{
      const pct = getMonthPct(h);
      const cols = days.map(day=>{
        const tod = isToday(day);
        const ac = tod ? 'var(--accent)' : 'var(--text3)';
        return '<div style="display:flex;flex-direction:column;align-items:center;gap:3px">'+
          '<div style="font-size:10px;font-weight:'+(tod?600:400)+';color:'+ac+'">'+day.d+'</div>'+
          '<div style="font-size:9px;color:'+ac+';text-transform:uppercase">'+DOW[day.date.getDay()]+'</div>'+
          dotHtml(day, h, 'dot-btn', 'width:32px;height:32px;')+
        '</div>';
      }).join('');
      return '<div class="habit-card-week" data-habit="'+esc(h.id)+'">'+
        '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">'+habitHeadHtml(h)+'</div>'+
        '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px">'+cols+'</div>'+
        '<div class="progress-wrap">'+
          '<div class="progress-bar"><div class="progress-fill" style="width:'+pct+'%;background:'+esc(h.color)+'"></div></div>'+
          '<div class="progress-pct">'+pct+'%</div>'+
        '</div>'+
      '</div>';
    }).join('');

  } else {
    const COLS = 'minmax(140px, 180px) repeat(7,44px)';
    hdr.style.display = 'grid';
    hdr.style.gridTemplateColumns = COLS;
    hdr.style.gap = '12px';
    hdr.style.padding = '0 14px';
    hdr.style.margin = '0 0 2px 0';
    hdr.innerHTML = '<div></div>' + days.map(day=>{
      const t = isToday(day);
      return '<div style="text-align:center">'+
        '<div style="font-size:12px;font-weight:500;color:'+(t?'var(--accent)':'var(--text)')+'">'+ day.d +'</div>'+
        '<div style="font-size:10px;color:'+(t?'var(--accent)':'var(--text3)')+';text-transform:uppercase;letter-spacing:.04em">'+DOW[day.date.getDay()]+'</div>'+
      '</div>';
    }).join('');

    document.getElementById('habits-list').innerHTML = list.map(h=>{
      const pct = getMonthPct(h);
      const dots = days.map(day=>
        '<div style="display:flex;justify-content:center;align-items:center">'+
          dotHtml(day, h, 'dot-btn')+
        '</div>'
      ).join('');
      return '<div class="habit-card-week" data-habit="'+esc(h.id)+'">'+
        '<div style="display:grid;grid-template-columns:'+COLS+';column-gap:12px;row-gap:6px;align-items:center">'+
          '<div style="display:flex;align-items:center;gap:8px;min-width:0">'+habitHeadHtml(h)+'</div>'+
          dots+
        '</div>'+
        '<div class="progress-wrap">'+
          '<div class="progress-bar"><div class="progress-fill" style="width:'+pct+'%;background:'+esc(h.color)+'"></div></div>'+
          '<div class="progress-pct">'+pct+'%</div>'+
        '</div>'+
      '</div>';
    }).join('');
  }
}

function renderMonth(days){
  document.getElementById('week-header').style.display='none';
  document.getElementById('habits-list').innerHTML = activeHabits().map(h=>{
    const pct = getMonthPct(h);
    const cols = days.map(day=>
      '<div class="month-day-col'+(isToday(day)?' today-col':'')+'">'+
        '<div class="month-day-num">'+day.d+'</div>'+
        '<div class="month-day-dow">'+DOW[day.date.getDay()]+'</div>'+
        dotHtml(day, h, 'month-dot')+
      '</div>'
    ).join('');
    return '<div class="month-card" data-habit="'+esc(h.id)+'">'+
      '<div class="month-card-header">'+habitHeadHtml(h)+
      '<span class="month-pct" style="font-size:12px;color:var(--text3);flex-shrink:0;margin-left:auto">'+pct+'%</span></div>'+
      '<div class="month-scroll"><div class="month-days-wrap">'+cols+'</div></div>'+
      '<div class="progress-wrap" style="margin-top:8px"><div class="progress-bar">'+
        '<div class="progress-fill" style="width:'+pct+'%;background:'+esc(h.color)+'"></div></div></div></div>';
  }).join('');

  syncMonthScrolls();
}

// Горизонтальные прокрутки месяца связываются между собой: раньше каждая
// карточка ездила сама по себе, и сравнить один день по всем привычкам
// было невозможно — а это и есть смысл месячного вида.
let monthScrollLock = false;
function syncMonthScrolls(){
  const boxes = Array.from(document.querySelectorAll('.month-scroll'));
  if(boxes.length < 2) { scrollMonthToToday(boxes); return; }
  boxes.forEach(box=>{
    box.addEventListener('scroll', ()=>{
      if(monthScrollLock) return;
      monthScrollLock = true;
      boxes.forEach(other=>{ if(other !== box) other.scrollLeft = box.scrollLeft; });
      requestAnimationFrame(()=>{ monthScrollLock = false; });
    }, {passive:true});
  });
  scrollMonthToToday(boxes);
}

// При открытии месяца показываем сегодняшний день, а не 1-е число.
function scrollMonthToToday(boxes){
  if(!boxes || !boxes.length) return;
  const inner = boxes[0].querySelector('.month-days-wrap');
  if(!inner) return;
  const base = new Date(ty, tm+offset, 1);
  if(base.getMonth() !== tm || base.getFullYear() !== ty) return;
  const step = inner.scrollWidth / Math.max(1, inner.children.length);
  const left = Math.max(0, step * (td - 1) - boxes[0].clientWidth / 2 + step / 2);
  boxes.forEach(b=>{ b.scrollLeft = left; });
}

// ── ГОДОВОЙ ВИД ───────────────────────────────────────────────────────────
// Плитка на 53 недели: неделя показывает дисциплину, месяц — динамику,
// а год показывает человека, который изменился. Данные уже были, не хватало
// только отрисовки.
function yearStart(){
  const end = new Date(ty, tm, td);
  const start = new Date(end);
  start.setDate(start.getDate() - 364);
  const dow = start.getDay() || 7;      // выравниваем на понедельник
  start.setDate(start.getDate() - dow + 1);
  start.setHours(0,0,0,0);
  return start;
}

function renderYear(){
  document.getElementById('week-header').style.display = 'none';
  const start = yearStart();
  const end = new Date(ty, tm, td);
  const list = activeHabits();

  document.getElementById('habits-list').innerHTML = list.map(h=>{
    let cells = '', months = '', prevMonth = -1, weekCount = 0;
    const cur = new Date(start);

    while(cur <= end || cur.getDay() !== 1){
      if(cur > end && cur.getDay() === 1) break;
      const day = dayObj(cur);
      const after = cur > end;
      const k = dkey(day.y, day.m, day.d, h.id);
      const done = !!data[k];

      // Подпись месяца ставим в начале каждой новой недели месяца.
      if(cur.getDay() === 1){
        weekCount++;
        months += '<span>' + (cur.getMonth() !== prevMonth ? MON_S[cur.getMonth()] : '') + '</span>';
        prevMonth = cur.getMonth();
      }

      if(after){
        cells += '<span class="year-dot out"></span>';
      } else {
        const title = day.d + ' ' + MON_S[day.m] + ' ' + day.y + (done ? ' — выполнено' : '');
        cells += '<button type="button" class="year-dot'+(done?' done':'')+'"'+
          ' role="checkbox" aria-checked="'+(done?'true':'false')+'"'+
          ' aria-label="'+esc(h.name+', '+title)+'" title="'+esc(title)+'"'+
          ' style="'+(done?'background:'+esc(h.color):'')+'"'+
          dotAttrs(day, h, false)+'></button>';
      }
      cur.setDate(cur.getDate() + 1);
    }

    const total = countMarks(h.id);
    const streak = getStreak(h);
    return '<div class="year-card" data-habit="'+esc(h.id)+'">'+
      '<div class="year-head">'+habitHeadHtml(h)+
        '<span style="margin-left:auto;font-size:12px;color:var(--text3);flex-shrink:0">'+
          total+' '+plural(total,'отметка','отметки','отметок')+'</span>'+
      '</div>'+
      '<div class="year-scroll">'+
        '<div class="year-months" style="grid-template-columns:repeat('+weekCount+',11px)">'+months+'</div>'+
        '<div class="year-grid">'+cells+'</div>'+
      '</div>'+
      '<div class="year-legend">'+
        (streak?'<span style="margin-right:auto">'+streakLabel(streak,h.color,streakUnit(h))+'</span>':'')+
        '<span>меньше</span>'+
        '<i style="background:var(--surface2)"></i>'+
        '<i style="background:'+esc(h.color)+';opacity:.45"></i>'+
        '<i style="background:'+esc(h.color)+'"></i>'+
        '<span>больше</span>'+
      '</div>'+
    '</div>';
  }).join('');
}

// ── EDIT MODAL ────────────────────────────────────────────────────────────
let lastFocused = null;

// Копия должна быть глубокой: schedule — объект, и при плоском копировании
// правка графика меняла бы привычку сразу, в обход кнопки «Отмена».
function cloneHabit(h){
  const c = Object.assign({}, h);
  if(h.schedule) c.schedule = Object.assign({}, h.schedule,
    Array.isArray(h.schedule.days) ? {days: h.schedule.days.slice()} : {});
  return c;
}

function openModal(){
  lastFocused = document.activeElement;
  editBuffer = HABITS.map(cloneHabit);
  renderEditor();
  const m = document.getElementById('edit-modal');
  m.classList.add('open');
  m.setAttribute('aria-modal','true');
  m.setAttribute('role','dialog');
  const first = m.querySelector('.edit-input, .add-input');
  if(first) first.focus();
}

function closeModal(){
  document.getElementById('edit-modal').classList.remove('open');
  closeEmojiPicker();
  if(lastFocused && lastFocused.focus) lastFocused.focus();
}

// Esc закрывает модалку и выбор эмодзи — раньше ни одного обработчика
// Escape в файле не было, выйти можно было только мышью.
document.addEventListener('keydown', e=>{
  if(e.key !== 'Escape') return;
  if(document.getElementById('emoji-picker').classList.contains('open')){ closeEmojiPicker(); return; }
  if(document.getElementById('edit-modal').classList.contains('open')){ closeModal(); return; }
  // Модалки разделов закрываются тем же Esc: каждая знает, как убраться
  // за собой, поэтому вызываем её собственный обработчик.
  const closers = {'goal-modal': closeGoalModal, 'tx-modal': closeTxModal,
                   'text-modal': closeTextModal, 'rules-modal': closeRulesModal,
                   'budget-modal': closeBudgetModal};
  for(const id in closers){
    if(document.getElementById(id).classList.contains('open')){ closers[id](); return; }
  }
  const crop = document.getElementById('crop-overlay');
  if(crop) crop.remove();
});

// Фокус не уходит из открытой модалки: иначе табом попадаешь на элементы
// под ней, не понимая, где находишься.
document.addEventListener('keydown', e=>{
  if(e.key !== 'Tab') return;
  // Ловушка работает для любой открытой модалки, а не только для редактора
  // привычек: разделов стало пять, модалок — четыре.
  const m = document.querySelector('.modal-overlay.open');
  if(!m) return;
  const items = m.querySelectorAll('button:not([style*="display:none"]), input, select, textarea, [tabindex]:not([tabindex="-1"])');
  if(!items.length) return;
  const first = items[0], last = items[items.length-1];
  if(e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
  else if(!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
});

const DOW_SHORT = ['вс','пн','вт','ср','чт','пт','сб'];

function renderEditor(){
  document.getElementById('habit-editor').innerHTML = editBuffer.map((h,i)=>{
    const s = habitSchedule(h);
    const target = habitTarget(h);

    // Настройка графика: либо дни недели, либо «N раз в неделю».
    let extra = '<select class="edit-select" data-change="sched-type" data-idx="'+i+'" aria-label="Как часто">'+
        '<option value="daily"'         +(s.type==='daily'?' selected':'')+         '>каждый день</option>'+
        '<option value="weekdays"'      +(s.type==='weekdays'?' selected':'')+      '>по дням недели</option>'+
        '<option value="times_per_week"'+(s.type==='times_per_week'?' selected':'')+'>раз в неделю</option>'+
      '</select>';

    if(s.type === 'weekdays'){
      extra += '<span class="dow-pick">' + [1,2,3,4,5,6,0].map(d=>
        '<button type="button" class="dow-btn'+(s.days.indexOf(d)!==-1?' on':'')+'"'+
        ' data-act="toggle-dow" data-idx="'+i+'" data-day="'+d+'" aria-pressed="'+(s.days.indexOf(d)!==-1?'true':'false')+'"'+
        ' aria-label="'+DOW_SHORT[d]+'">'+DOW_SHORT[d]+'</button>'
      ).join('') + '</span>';
    } else if(s.type === 'times_per_week'){
      extra += '<input class="edit-num" type="number" min="1" max="7" value="'+s.n+'"'+
        ' data-change="sched-times" data-idx="'+i+'" aria-label="Сколько раз в неделю">'+
        '<span class="hint">раз в неделю</span>';
    }

    extra += '<input class="edit-num" type="number" min="0" max="999" value="'+(target||'')+'"'+
      ' placeholder="цель" data-change="set-target" data-idx="'+i+'" aria-label="Цель за день">'+
      '<span class="hint">цель за день, если есть</span>';

    return '<div class="edit-row" draggable="true" data-idx="'+i+'" '+
         'ondragstart="dragStart(event,'+i+')" '+
         'ondragover="dragOver(event)" '+
         'ondrop="dragDrop(event,'+i+')" '+
         'ondragend="dragEnd(event)" '+
         'ondragleave="dragLeave(event)">'+
      '<span class="drag-handle" title="Перетащи чтобы изменить порядок">⋮⋮</span>'+
      '<button class="edit-icon-btn" data-act="emoji-open" data-idx="'+i+'" title="Выбрать эмодзи" aria-label="Выбрать эмодзи">'+esc(h.icon)+'</button>'+
      '<input class="edit-input" value="'+esc(h.name)+'" data-input="habit-name" data-idx="'+i+'" maxlength="30" aria-label="Название привычки">'+
      '<button class="arch-btn" data-act="archive-habit" data-idx="'+i+'" title="Убрать в архив вместе с историей">В архив</button>'+
      '<button class="del-btn" data-act="remove-habit" data-idx="'+i+'" title="Удалить" aria-label="Удалить привычку">✕</button>'+
      '<div class="edit-extra">'+extra+'</div>'+
    '</div>';
  }).join('');

  renderArchive();
}

function setSchedType(i, type){
  const h = editBuffer[i]; if(!h) return;
  if(type === 'daily') h.schedule = {type:'daily'};
  else if(type === 'weekdays') h.schedule = {type:'weekdays', days:[1,3,5]};
  else h.schedule = {type:'times_per_week', n:3};
  renderEditor();
}
function toggleDow(i, d){
  const h = editBuffer[i]; if(!h) return;
  const s = habitSchedule(h);
  if(s.type !== 'weekdays') return;
  const days = s.days.slice();
  const at = days.indexOf(d);
  if(at === -1) days.push(d); else days.splice(at, 1);
  // Пустой список превратил бы привычку в невыполнимую — оставляем как было.
  if(!days.length){ toast('Хотя бы один день нужно оставить', true); return; }
  h.schedule = {type:'weekdays', days};
  renderEditor();
}
function setSchedTimes(i, v){
  const h = editBuffer[i]; if(!h) return;
  h.schedule = {type:'times_per_week', n: Math.min(7, Math.max(1, parseInt(v,10)||1))};
  renderEditor();
}
function setTarget(i, v){
  const h = editBuffer[i]; if(!h) return;
  const n = parseInt(v, 10);
  if(n && n > 1) h.target = n; else delete h.target;
  renderEditor();
}

// ── АРХИВ ─────────────────────────────────────────────────────────────────
// Человек бросил бегать зимой — раньше единственным инструментом было
// удаление вместе со всей историей за лето.
function renderArchive(){
  const box = document.getElementById('archive-block');
  if(!box) return;
  const arch = editBuffer.filter(h => h.archived);
  if(!arch.length){ box.innerHTML = ''; return; }
  box.innerHTML = '<div class="arch-head">В архиве</div>' + arch.map(h=>{
    const i = editBuffer.indexOf(h);
    const n = countMarks(h.id);
    return '<div class="arch-row">'+
      '<span>'+esc(h.icon)+'</span>'+
      '<span class="nm">'+esc(h.name)+'</span>'+
      '<span class="hint">'+n+' '+plural(n,'отметка','отметки','отметок')+'</span>'+
      '<button class="arch-btn" data-act="unarchive-habit" data-idx="'+i+'">Вернуть</button>'+
    '</div>';
  }).join('');
}

function archiveHabit(i){
  const h = editBuffer[i]; if(!h) return;
  h.archived = true;
  renderEditor();
  toast('«' + h.name + '» в архиве — история сохранена');
}
function unarchiveHabit(i){
  const h = editBuffer[i]; if(!h) return;
  delete h.archived;
  renderEditor();
}

// ── DRAG REORDER ───────────────────────────────────────────────────────
let dragSrcIdx=null;
function dragStart(e,i){
  dragSrcIdx=i;
  e.dataTransfer.effectAllowed='move';
  e.dataTransfer.setData('text/plain', String(i));
  e.currentTarget.classList.add('dragging');
}
function dragOver(e){
  e.preventDefault();
  e.dataTransfer.dropEffect='move';
  const row=e.currentTarget;
  if(!row.classList.contains('drop-target')) row.classList.add('drop-target');
}
function dragLeave(e){ e.currentTarget.classList.remove('drop-target'); }
function dragDrop(e,toIdx){
  e.preventDefault();
  e.currentTarget.classList.remove('drop-target');
  if(dragSrcIdx===null || dragSrcIdx===toIdx) return;
  const moved=editBuffer.splice(dragSrcIdx,1)[0];
  editBuffer.splice(toIdx,0,moved);
  dragSrcIdx=null;
  renderEditor();
}
function dragEnd(e){
  e.currentTarget.classList.remove('dragging');
  document.querySelectorAll('.edit-row.drop-target').forEach(r=>r.classList.remove('drop-target'));
  dragSrcIdx=null;
}
// Удаление осиротит всю историю привычки, поэтому спрашиваем, показываем,
// сколько отметок будет потеряно, и даём отменить.
function removeHabit(i){
  const h = editBuffer[i];
  if(!h) return;
  const marks = h.id ? countMarks(h.id) : 0;
  const question = marks > 0
    ? 'Удалить привычку «' + h.name + '»?\n\nВместе с ней потеряется история: ' +
      marks + ' ' + plural(marks, 'отметка', 'отметки', 'отметок') + '.\n\n' +
      'Если нужен перерыв — лучше «В архив»: там история сохранится.'
    : 'Удалить привычку «' + h.name + '»?';
  if(!confirm(question)) return;

  const removed = Object.assign({}, h);
  editBuffer.splice(i,1);
  renderEditor();
  toast('«' + removed.name + '» удалена', false, ()=>{
    editBuffer.splice(Math.min(i, editBuffer.length), 0, removed);
    renderEditor();
  });
}

async function addHabit(){
  const inp=document.getElementById('new-habit-input');
  const name=inp.value.trim(); if(!name) return;
  const btn=document.getElementById('add-habit-btn');
  btn.disabled=true; btn.textContent='Подбираю...';
  const icon=guessEmoji(name);
  const idx=editBuffer.length%COLOR_POOL.length;
  // id присваивается сразу и больше никогда не меняется.
  editBuffer.push({id:newHabitId(),name,icon,color:COLOR_POOL[idx],bg:BG_POOL[idx]});
  inp.value=''; btn.disabled=false; btn.textContent='+ Добавить';
  renderEditor();
}

// ── СИНХРОНИЗАЦИЯ ЗНАЧЕНИЙ ────────────────────────────────────────────────
// Числа количественных привычек («6 стаканов из 8») лежат отдельным JSON
// в user_settings: колонка done в базе булева, и менять её схему ради
// этого не понадобилось. Пишем с задержкой, чтобы серия быстрых нажатий
// не превратилась в серию запросов.
let valuesSyncTimer = null;
function scheduleValuesSync(){
  clearTimeout(valuesSyncTimer);
  valuesSyncTimer = setTimeout(saveValuesToServer, 2500);
}

async function saveValuesToServer(){
  if(!currentUser || isDemoMode) return;
  try{
    const res = await sbFetchWithTimeout(()=>
      sb.from('user_settings').upsert(
        {user_id: currentUser.id, key:'values', value: JSON.stringify(marksValues),
         updated_at: new Date().toISOString()},
        {onConflict:'user_id,key'}
      )
    );
    if(res.error) throw new Error(res.error.message);
  }catch(e){
    // Значения останутся локальными; следующая правка попробует снова.
    setSyncStatus('прогресс сохранён локально', false);
  }
}

async function loadValuesFromServer(){
  try{ marksValues = JSON.parse(localStorage.getItem(valuesKey()) || '{}'); }
  catch(e){ marksValues = {}; }
  if(!currentUser || isDemoMode) return;
  try{
    const res = await sbFetchWithTimeout(()=>
      sb.from('user_settings').select('value').eq('user_id', currentUser.id).eq('key','values').maybeSingle()
    );
    if(res.data && res.data.value){
      const server = JSON.parse(res.data.value);
      if(server && typeof server === 'object'){
        marksValues = server;
        try{ localStorage.setItem(valuesKey(), JSON.stringify(marksValues)); }catch(e){}
      }
    }
  }catch(e){ /* останутся локальные значения */ }
}

// Отправка списка привычек на сервер. Клиент Supabase не бросает исключение
// при ошибке запроса, а возвращает её в res.error — проверяем именно его,
// иначе неудачное сохранение выглядело бы как успешное.
async function saveHabitsToServer(){
  if(!currentUser || isDemoMode) return true;
  try{
    const res = await sbFetchWithTimeout(()=>
      sb.from('user_settings').upsert(
        {user_id: currentUser.id, key:'habits', value: JSON.stringify(HABITS), updated_at: new Date().toISOString()},
        {onConflict:'user_id,key'}
      )
    );
    if(res.error){
      setSyncStatus('привычки не сохранены: ' + res.error.message, false);
      return false;
    }
    return true;
  }catch(e){
    setSyncStatus(e.message === 'timeout'
      ? 'привычки не сохранены: таймаут'
      : 'привычки не сохранены: нет сети', false);
    return false;
  }
}

async function saveHabits(){
  // Смену графика фиксируем в истории привычки — иначе прошлые серии и
  // проценты пересчитались бы по новому расписанию и история соврала бы.
  const before = {};
  HABITS.forEach(h=>{ before[h.id] = JSON.stringify(habitSchedule(h)); });

  const next = editBuffer.map(cloneHabit);
  next.forEach(h=>{
    if(!h.id || !(h.id in before)) return;                 // новая привычка
    const now = JSON.stringify(habitSchedule(h));
    if(now === before[h.id]) return;                        // график не менялся
    const old = HABITS.find(x => x.id === h.id);
    pushScheduleHistory(h, old ? habitSchedule(old) : {type:'daily'});
  });

  HABITS = next;
  ensureHabitIds();
  localStorage.setItem('customHabits',JSON.stringify(HABITS));
  closeModal(); render();
  if(currentUser && !isDemoMode){
    const ok = await saveHabitsToServer();
    if(ok){
      setSyncStatus('привычки сохранены ✓', true);
      setTimeout(()=>setSyncStatus('',false), 2000);
    }else{
      toast('Список привычек сохранён только на этом устройстве', true);
    }
  }
}
