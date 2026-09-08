/* app-sections.js — Разделы: общее хранилище и слияние, вкладки, Focus
   со списком «100», Credo, Quotes, общая модалка ввода.
   Часть приложения. Файлы подключаются подряд и делят общую
   область видимости: сборки в проекте нет. */

/* ═══════════════════════════════════════════════════════════════════════
   РАЗДЕЛЫ ПРИЛОЖЕНИЯ
   Focus (цели и список из ста пунктов), Credo, Quotes и Money.
   Первые три хранятся так же, как список привычек: одним JSON в
   user_settings — схему базы менять не пришлось. Деньги живут в
   отдельной таблице transactions: операций много, их нужно фильтровать
   по датам и складывать, а JSON-строка перезаписывается целиком и две
   открытые вкладки затирали бы друг друга.
   ═══════════════════════════════════════════════════════════════════════ */

// Данные разделов. Пустые массивы — валидное состояние: раздел покажет
// пустое состояние с кнопкой действия, а не сломанный экран.
// money_rules — повторяющиеся операции (аренда, подписки), budgets —
// лимиты по категориям. Оба списка ведут себя как остальные разделы,
// поэтому хранятся тем же способом.
let sections = {goals: [], list100: [], credo: [], quotes: [], money_rules: [], budgets: []};
const SECTION_KEYS = ['goals', 'list100', 'credo', 'quotes', 'money_rules', 'budgets'];

function sectionKey(key){ return 'sec_' + key + '_' + ((currentUser && currentUser.id) || 'anon'); }

function readSectionLocal(key){
  try{
    const raw = localStorage.getItem(sectionKey(key));
    const v = raw ? JSON.parse(raw) : null;
    return Array.isArray(v) ? v : [];
  }catch(e){ return []; }
}

function writeSectionLocal(key){
  try{ localStorage.setItem(sectionKey(key), JSON.stringify(sections[key])); }catch(e){}
}

/* ── СЛИЯНИЕ РАЗДЕЛОВ ПО ЭЛЕМЕНТАМ ────────────────────────────────────────
   Раньше раздел уходил на сервер целым массивом, и правка с телефона
   затирала правку с ноутбука: побеждал тот, кто сохранил последним.
   Теперь у каждой записи есть отметка времени `u`, при загрузке списки
   сливаются поэлементно, а удаления помнятся отдельно — иначе запись,
   удалённая на одном устройстве, воскресала бы со второго.

   Слияние работает на верхнем уровне списка. Задачи внутри цели правятся
   вместе с самой целью: конфликт «двое одновременно правят одну цель с
   разных устройств» для личного приложения не стоит усложнения. */

// У бюджета нет id — его личность это категория.
function itemKey(it){ return it && (it.id || it.cat); }

// Удалённые записи: ключ → время удаления. Хранятся 90 дней, потом чистятся,
// иначе список тумбстоунов растёт вечно.
const TOMB_TTL = 90 * 86400000;
let tombs = {goals: {}, list100: {}, credo: {}, quotes: {}, money_rules: {}, budgets: {}};

function tombKey(){ return 'sec_tomb_' + ((currentUser && currentUser.id) || 'anon'); }

function readTombs(){
  try{
    const v = JSON.parse(localStorage.getItem(tombKey()) || '{}');
    SECTION_KEYS.forEach(k=>{ if(!v[k] || typeof v[k] !== 'object') v[k] = {}; });
    return v;
  }catch(e){
    const empty = {};
    SECTION_KEYS.forEach(k=>{ empty[k] = {}; });
    return empty;
  }
}

function writeTombs(){
  const now = Date.now();
  SECTION_KEYS.forEach(k=>{
    Object.keys(tombs[k] || {}).forEach(id=>{
      if(now - tombs[k][id] > TOMB_TTL) delete tombs[k][id];
    });
  });
  try{ localStorage.setItem(tombKey(), JSON.stringify(tombs)); }catch(e){}
}

// Пометить запись удалённой (вызывается там же, где элемент убирают из списка).
function markDeleted(key, id){
  if(!id) return;
  tombs[key] = tombs[key] || {};
  tombs[key][id] = Date.now();
  writeTombs();
}

// Отменили удаление — снимаем пометку, иначе запись исчезнет при следующей
// загрузке уже с сервера.
function unmarkDeleted(key, id){
  if(tombs[key]) delete tombs[key][id];
  writeTombs();
}

// Снимок последнего сохранённого состояния: по нему видно, какие записи
// изменились, и только им проставляется новое время. Без снимка пришлось бы
// вручную ставить отметку в полусотне мест, где список правится.
const snapshots = {};

function stampChanges(key){
  const prev = snapshots[key] || {};
  const next = {};
  const now = Date.now();
  (sections[key] || []).forEach(item=>{
    const k = itemKey(item);
    if(!k) return;
    const clean = Object.assign({}, item);
    delete clean.u;
    const json = JSON.stringify(clean);
    if(prev[k] !== json) item.u = now;
    next[k] = json;
  });
  snapshots[key] = next;
}

function refreshSnapshot(key){
  const map = {};
  (sections[key] || []).forEach(item=>{
    const k = itemKey(item);
    if(!k) return;
    const clean = Object.assign({}, item);
    delete clean.u;
    map[k] = JSON.stringify(clean);
  });
  snapshots[key] = map;
}

// Слияние локального списка с серверным: побеждает более свежая запись,
// удалённые не воскресают.
function mergeSection(key, serverItems, serverDel){
  tombs[key] = Object.assign({}, tombs[key] || {}, serverDel || {});

  const byKey = {};
  (sections[key] || []).forEach(it=>{ const k = itemKey(it); if(k) byKey[k] = it; });

  (serverItems || []).forEach(s=>{
    const k = itemKey(s);
    if(!k) return;
    const local = byKey[k];
    if(!local || (s.u || 0) > (local.u || 0)) byKey[k] = s;
  });

  sections[key] = Object.keys(byKey).map(k => byKey[k]).filter(it=>{
    const t = tombs[key][itemKey(it)];
    // Удаление старше последней правки — значит запись успели вернуть.
    return !t || t < (it.u || 0);
  });

  writeTombs();
  writeSectionLocal(key);
  refreshSnapshot(key);
}

// Разделы, изменённые локально и ещё не ушедшие на сервер. Список живёт в
// localStorage: без него неотправленная правка молча терялась при следующей
// загрузке — серверная версия накатывалась поверх локальной.
function dirtyKey(){ return 'sec_dirty_' + ((currentUser && currentUser.id) || 'anon'); }

function readDirty(){
  try{
    const v = JSON.parse(localStorage.getItem(dirtyKey()) || '[]');
    return Array.isArray(v) ? v : [];
  }catch(e){ return []; }
}

function markDirty(key, on){
  const set = new Set(readDirty());
  if(on) set.add(key); else set.delete(key);
  try{ localStorage.setItem(dirtyKey(), JSON.stringify(Array.from(set))); }catch(e){}
  updatePendingBadge();
}

// Сохранение с задержкой: правка списка задач — это серия быстрых
// изменений, и каждое незачем отправлять отдельным запросом.
const sectionTimers = {};
function saveSection(key){
  stampChanges(key);           // изменённым записям — новое время
  writeSectionLocal(key);
  if(!currentUser || isDemoMode) return;
  markDirty(key, true);
  clearTimeout(sectionTimers[key]);
  sectionTimers[key] = setTimeout(()=>pushSection(key), 1200);
}

async function pushSection(key){
  if(!currentUser || isDemoMode) return;
  try{
    // Формат 2: вместе со списком уходят удаления. Старые записи в базе —
    // просто массив, он читается как формат 1.
    const payload = JSON.stringify({v: 2, items: sections[key], del: tombs[key] || {}});
    const res = await sbFetchWithTimeout(()=>
      sb.from('user_settings').upsert(
        {user_id: currentUser.id, key: key, value: payload,
         updated_at: new Date().toISOString()},
        {onConflict:'user_id,key'}
      )
    );
    // Клиент Supabase не бросает исключение — ошибку возвращает в res.error.
    if(res.error) throw new Error(res.error.message);
    markDirty(key, false);
    setSyncStatus('синхронизировано ✓', true);
    setTimeout(()=>setSyncStatus('', false), 1500);
  }catch(e){
    // Пометка остаётся: досылка произойдёт при следующей правке, возврате
    // сети или следующем запуске.
    setSyncStatus('раздел сохранён локально', false);
  }
}

// Досылка всего, что не уехало. Вызывается при возврате сети и на старте.
async function flushSections(){
  const pending = readDirty();
  for(const key of pending){
    if(SECTION_KEYS.indexOf(key) !== -1) await pushSection(key);
  }
}

async function loadSections(){
  SECTION_KEYS.forEach(k=>{ sections[k] = readSectionLocal(k); refreshSnapshot(k); });
  tombs = readTombs();
  if(!currentUser || isDemoMode) return;

  try{
    const res = await sbFetchWithTimeout(()=>
      sb.from('user_settings').select('key,value').eq('user_id', currentUser.id).in('key', SECTION_KEYS)
    );
    if(res.error) return;                       // остаются локальные данные
    (res.data || []).forEach(row=>{
      if(SECTION_KEYS.indexOf(row.key) === -1 || !row.value) return;
      try{
        const parsed = JSON.parse(row.value);
        // Формат 1 — голый массив, формат 2 — {items, del}.
        const items = Array.isArray(parsed) ? parsed
                    : (parsed && Array.isArray(parsed.items) ? parsed.items : null);
        if(!items) return;
        const del = (parsed && parsed.del && typeof parsed.del === 'object') ? parsed.del : {};
        // Сливаем всегда, даже если есть неотправленные правки: слияние
        // поэлементное, локальное новее — оно и победит.
        mergeSection(row.key, items, del);
      }catch(e){ /* битую запись игнорируем, локальная версия важнее */ }
    });
  }catch(e){ /* нет сети — работаем с локальными */ }

  await flushSections();
}

function newId(prefix){
  return prefix + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
}

// Идентификатор из внешнего источника (файл импорта, чужая выгрузка) может
// содержать что угодно, а он попадает в разметку и в data-атрибуты. Всё,
// что не похоже на наш id, заменяем своим.
function safeId(v, prefix){
  return (typeof v === 'string' && /^[A-Za-z0-9_.:-]{1,64}$/.test(v)) ? v : newId(prefix || 'x');
}

// ── ОБРАБОТЧИК ДЕЙСТВИЙ РАЗДЕЛОВ ─────────────────────────────────────────
// Один делегат вместо inline-onclick у каждой строки. Так идентификатор
// не попадает внутрь кода на странице: он остаётся значением data-атрибута
// и не может из него «выпрыгнуть».
const SECTION_ACTIONS = {
  'open-goal':    el => openGoal(el.dataset.id),
  'open-hundred': ()  => openHundred(),
  'new-goal':     ()  => openGoalModal(),
  'edit-goal':    el => openGoalModal(el.dataset.id),
  'del-goal':     el => deleteGoal(el.dataset.id),
  'unarchive-goal': el => unarchiveGoal(el.dataset.id),
  'edit-item':    el => editHundredItem(el.dataset.id),
  'filter-100':   el => setHundredFilter(el.dataset.cat),
  'add-task':     ()  => addTask(),
  'toggle-task':  el => toggleTask(el.dataset.id),
  'edit-task':    el => editTask(el.dataset.id),
  'del-task':     el => deleteTask(el.dataset.id),
  'new-credo':    ()  => openCredoModal(),
  'toggle-credo': el => toggleCredo(el.dataset.id),
  'edit-credo':   el => editCredo(el.dataset.id),
  'note-credo':   el => noteCredo(el.dataset.id),
  'new-quote':    ()  => openQuoteModal(),
  'edit-quote':   el => editQuote(el.dataset.id),
  'fav-quote':    el => toggleFavQuote(el.dataset.id),
  'open-tx':      el => openTxModal(el.dataset.kind, el.dataset.id),
  'apply-rule':   el => applyRule(el.dataset.id),
  'apply-all-rules': () => applyAllRules(),
  'del-rule':     el => deleteRule(el.dataset.id)
};

// Действия статической разметки. Раньше это были inline-onclick: они
// требуют 'unsafe-inline' в CSP и ломаются при переходе на ES-модули, где
// функции не попадают в window. Список намеренно явный — так data-act не
// может вызвать произвольную функцию приложения.
const STATIC_ACTIONS = {
  // вход
  switchAuthTab:      el => switchAuthTab(el.dataset.arg),
  sendMagicLink:      () => sendMagicLink(),
  signInWithGoogle:   () => signInWithGoogle(),
  enterDemo:          () => enterDemo(),
  leaveDemo:          () => leaveDemo(),

  // шапка и меню пользователя
  openModal:          () => openModal(),
  closeModal:         () => closeModal(),
  saveHabits:         () => saveHabits(),
  addHabit:           () => addHabit(),
  toggleSound:        () => toggleSound(),
  toggleTheme:        () => toggleTheme(),
  toggleUserMenu:     (el, e) => toggleUserMenu(e),
  exportData:         () => exportData(),

  // трекер
  navigate:           el => navigate(parseInt(el.dataset.arg, 10)),
  setView:            el => setView(el.dataset.arg),
  setTab:             el => setTab(el.dataset.arg),

  // цели
  openGoalModal:      () => openGoalModal(),
  closeGoalModal:     () => closeGoalModal(),
  saveGoalModal:      () => saveGoalModal(),
  clearGoalDue:       () => clearGoalDue(),
  toggleGoalArchive:  () => toggleGoalArchive(),
  openGoalEmoji:      el => openGoalEmoji(el),
  closeGoal:          () => closeGoal(),

  // деньги
  openTxModal:        el => openTxModal(el.dataset.arg),
  closeTxModal:       () => closeTxModal(),
  saveTxModal:        () => saveTxModal(),
  deleteTxFromModal:  () => deleteTxFromModal(),
  moneyNavigate:      el => moneyNavigate(parseInt(el.dataset.arg, 10)),
  quickAddTxFrom:     el => quickAddTx(el.dataset.arg),
  repeatYesterday:    () => repeatYesterday(),
  openRulesModal:     () => openRulesModal(),
  closeRulesModal:    () => closeRulesModal(),
  addRuleFromCurrent: () => addRuleFromCurrent(),
  openBudgetModal:    () => openBudgetModal(),
  closeBudgetModal:   () => closeBudgetModal(),
  saveBudgets:        () => saveBudgets(),

  // принципы и цитаты
  openCredoModal:     () => openCredoModal(),
  openQuoteModal:     () => openQuoteModal(),
  nextQuote:          () => nextQuote(),
  saveCurrentQuote:   () => saveCurrentQuote(),

  // общая модалка ввода
  closeTextModal:     () => closeTextModal(),
  saveTextModal:      () => saveTextModal(),
  deleteFromTextModal:() => deleteFromTextModal(),

  // элементы, которые рисует сам код
  quickAddTx:         () => quickAddTx(),
  'pick-emoji':       el => pickEmoji(el.dataset.arg),
  'emoji-open':       el => openEmojiPicker(parseInt(el.dataset.idx, 10), el),
  'toggle-dow':       el => toggleDow(parseInt(el.dataset.idx, 10), parseInt(el.dataset.day, 10)),
  'archive-habit':    el => archiveHabit(parseInt(el.dataset.idx, 10)),
  'unarchive-habit':  el => unarchiveHabit(parseInt(el.dataset.idx, 10)),
  'remove-habit':     el => removeHabit(parseInt(el.dataset.idx, 10)),
  'pick-goal-color':  el => pickGoalColor(el.dataset.arg),
  'toggle-goal-habit':el => toggleGoalHabit(el.dataset.arg),
  'pick-text-cat':    el => pickTextModalCat(el.dataset.arg),
  'pick-tx-cat':      el => pickTxCat(el.dataset.arg),
  'crop-save':        () => cropAndSave(),
  'crop-cancel':      () => { const c = document.getElementById('crop-overlay'); if(c) c.remove(); }
};

// Поля ввода: изменение значения и Enter. Тоже вынесены из разметки —
// инлайновые обработчики требуют 'unsafe-inline' в политике безопасности.
const CHANGE_ACTIONS = {
  'sched-type':  (el, i) => setSchedType(i, el.value),
  'sched-times': (el, i) => setSchedTimes(i, el.value),
  'set-target':  (el, i) => setTarget(i, el.value)
};

document.addEventListener('change', e=>{
  const el = e.target.closest('[data-change]');
  if(el){
    const fn = CHANGE_ACTIONS[el.dataset.change];
    if(fn) fn(el, parseInt(el.dataset.idx, 10));
    return;
  }
  // Загрузка файлов: аватар, импорт данных, импорт выписки.
  if(e.target.id === 'avatar-upload') uploadAvatar(e);
  else if(e.target.id === 'import-file') importData(e);
  else if(e.target.id === 'csv-file') importCsv(e);
});

document.addEventListener('input', e=>{
  const el = e.target.closest('[data-input="habit-name"]');
  if(!el) return;
  const i = parseInt(el.dataset.idx, 10);
  if(editBuffer[i]) editBuffer[i].name = el.value;
});

// Enter в однострочных полях: где раньше стояло onkeydown в разметке.
const ENTER_ACTIONS = {
  'auth-email':        () => sendMagicLink(),
  'new-habit-input':   () => addHabit(),
  'quick-tx':          () => quickAddTx('quick-tx'),
  'quick-tx-money':    () => quickAddTx('quick-tx-money')
};

document.addEventListener('keydown', e=>{
  if(e.key !== 'Enter') return;
  const id = e.target && e.target.id;
  const fn = id && ENTER_ACTIONS[id];
  if(fn){ e.preventDefault(); fn(); }
});

document.addEventListener('click', e=>{
  const el = e.target.closest('[data-act]');
  if(!el) return;
  const act = el.dataset.act;
  const fn = SECTION_ACTIONS[act] || STATIC_ACTIONS[act];
  if(fn){ e.preventDefault(); fn(el, e); }
});

// ── ВКЛАДКИ ───────────────────────────────────────────────────────────────
// Пять разделов внизу. Экран одной цели — не вкладка, а вложенный экран:
// в меню он не показывается, но по нему работает та же механика панелей.
const TABS = {
  focus:   {title:'Focus',   panel:'panel-focus',   render:()=>renderFocus()},
  money:   {title:'Money',   panel:'panel-money',   render:()=>renderMoney()},
  tracker: {title:'Tracker', panel:'panel-tracker', render:()=>render()},
  credo:   {title:'Credo',   panel:'panel-credo',   render:()=>renderCredo()},
  quotes:  {title:'Quotes',  panel:'panel-quotes',  render:()=>renderQuotes()}
};
let currentTab = 'tracker';
let openGoalId = null;      // если не null — открыт экран конкретной цели

function setTab(name, opts){
  if(!TABS[name]) name = 'tracker';
  currentTab = name;
  openGoalId = null;
  try{ localStorage.setItem('tab', name); }catch(e){}

  Object.keys(TABS).forEach(k=>{
    document.getElementById(TABS[k].panel).hidden = (k !== name);
    const btn = document.getElementById('tab-' + k);
    btn.classList.toggle('active', k === name);
    btn.setAttribute('aria-selected', k === name ? 'true' : 'false');
  });
  document.getElementById('panel-goal').hidden = true;
  document.getElementById('screen-title').textContent = TABS[name].title;

  // Шестерёнка правит привычки и на других разделах бессмысленна.
  document.getElementById('edit-btn').style.display = (name === 'tracker') ? '' : 'none';

  TABS[name].render();
  if(!opts || !opts.keepScroll) window.scrollTo(0, 0);
}

function initTabs(){
  document.getElementById('tabbar').style.display = 'flex';
  let saved = null;
  try{ saved = localStorage.getItem('tab'); }catch(e){}
  setTab(TABS[saved] ? saved : 'tracker');
}

// Перерисовать текущий раздел, не трогая остальные.
function renderCurrent(){
  if(openGoalId){ renderGoalDetail(); return; }
  const t = TABS[currentTab];
  if(t) t.render();
}

// ── ОБЩИЕ ЭЛЕМЕНТЫ РАЗДЕЛОВ ───────────────────────────────────────────────
function emptyBlock(emoji, title, text, btnLabel, action){
  return '<div class="empty-section">' +
    '<div class="empty-emoji">' + emoji + '</div>' +
    '<h3>' + esc(title) + '</h3>' +
    '<p>' + esc(text) + '</p>' +
    (btnLabel ? '<button class="btn btn-primary" style="margin-top:16px" data-act="' + esc(action) + '">' +
                esc(btnLabel) + '</button>' : '') +
    '</div>';
}

/* ═══════════════ FOCUS: цели и список из ста пунктов ═══════════════ */

const HUNDRED_ID = '__100__';   // список ста живёт как особая «цель»

// Категории пунктов: после полусотни записей плоский список превращается
// в кашу, а по этим группам его видно с одного взгляда.
const HUNDRED_CATS = [
  {id:'travel',  icon:'✈️', name:'Путешествия'},
  {id:'skill',   icon:'🧠', name:'Навыки'},
  {id:'body',    icon:'💪', name:'Тело'},
  {id:'people',  icon:'🤝', name:'Люди'},
  {id:'work',    icon:'💼', name:'Дело'},
  {id:'thing',   icon:'🎁', name:'Вещи'},
  {id:'other',   icon:'🔸', name:'Разное'}
];
let hundredFilter = 'all';

function hundredCat(id){
  return HUNDRED_CATS.find(c => c.id === id) || HUNDRED_CATS[HUNDRED_CATS.length - 1];
}

function setHundredFilter(cat){
  hundredFilter = cat || 'all';
  renderGoalDetail();
}

// Дата выполнения человеческим языком: «сегодня», «вчера», «12 мар 2026».
function doneDateLabel(iso){
  if(!iso) return '';
  const d = new Date(iso);
  if(isNaN(d)) return '';
  const diff = Math.round((new Date(ty, tm, td) - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 86400000);
  if(diff === 0) return 'сегодня';
  if(diff === 1) return 'вчера';
  return d.getDate() + ' ' + MON_S[d.getMonth()] + (d.getFullYear() !== ty ? ' ' + d.getFullYear() : '');
}

function goalById(id){ return sections.goals.find(g => g.id === id) || null; }

function goalProgress(g){
  const tasks = (g && g.tasks) || [];
  const done = tasks.filter(t => t.done).length;
  return {done, total: tasks.length, pct: tasks.length ? Math.round(done / tasks.length * 100) : 0};
}

function activeGoals(){ return sections.goals.filter(g => !g.archived); }
function archivedGoals(){ return sections.goals.filter(g => g.archived); }

// Сколько дней осталось до срока. Отрицательное — срок прошёл.
function daysLeft(due){
  if(!due) return null;
  const d = new Date(due + 'T00:00:00');
  if(isNaN(d)) return null;
  return Math.round((d - new Date(ty, tm, td)) / 86400000);
}

// Подпись срока человеческим языком: «осталось 12 дней», «сегодня»,
// «просрочено на 3 дня» — голая дата требует считать в уме.
function dueLabel(due){
  const n = daysLeft(due);
  if(n === null) return '';
  if(n === 0) return 'срок сегодня';
  if(n < 0) return 'просрочено на ' + Math.abs(n) + ' ' + plural(Math.abs(n), 'день', 'дня', 'дней');
  if(n === 1) return 'остался 1 день';
  return 'осталось ' + n + ' ' + plural(n, 'день', 'дня', 'дней');
}

// Средний процент за месяц по привычкам, привязанным к цели. Так карточка
// показывает не только «сколько задач закрыто», но и живёт ли цель вообще.
function goalHabitPct(g){
  const ids = (g && g.habitIds) || [];
  const linked = activeHabits().filter(h => ids.indexOf(h.id) !== -1);
  if(!linked.length) return null;
  const sum = linked.reduce((s, h) => s + getMonthPct(h), 0);
  return {pct: Math.round(sum / linked.length), count: linked.length};
}

function renderFocus(){
  // Карточка списка ста — всегда первая: это самая длинная цель.
  const list = sections.list100;
  const done = list.filter(i => i.done).length;
  const dots = [];
  for(let i = 0; i < 100; i++){
    dots.push('<span class="' + (i < done ? 'done' : '') + '"></span>');
  }
  // Последнее закрытое — самая живая строчка на карточке: она показывает,
  // что список не музейный экспонат.
  const last = list.filter(i => i.done && i.doneAt)
                   .sort((a, b) => (a.doneAt < b.doneAt ? 1 : -1))[0];

  document.getElementById('hundred-card').innerHTML =
    '<button class="hundred-card" data-act="open-hundred">' +
      '<h3>100</h3>' +
      '<div class="hundred-sub">' + (list.length
        ? done + ' из ' + list.length + ' сделано'
        : 'список того, что стоит успеть') + '</div>' +
      '<div class="hundred-dots">' + dots.join('') + '</div>' +
      (last ? '<div class="hundred-last">Последнее: ' + esc(last.text) +
              ' · ' + esc(doneDateLabel(last.doneAt)) + '</div>' : '') +
    '</button>';

  const grid = document.getElementById('goals-grid');
  const active = activeGoals();

  if(!active.length){
    grid.innerHTML = emptyBlock('🎯', 'Целей пока нет',
      'Направление — это несколько задач с общим смыслом: спорт, бизнес, язык. Начните с одного.',
      '+ Новая цель', 'new-goal');
  } else {
    grid.innerHTML = active.map(g=>{
      const p = goalProgress(g);
      const hp = goalHabitPct(g);
      const due = dueLabel(g.due);
      const overdue = daysLeft(g.due) !== null && daysLeft(g.due) < 0;

      // Вторая строка подписи — то, что важнее прямо сейчас: горящий срок
      // важнее процента по привычкам, а он важнее пустоты.
      const sub = due
        ? (overdue ? '⚠ ' : '⏳ ') + due
        : hp ? '📈 привычки: ' + hp.pct + '% за месяц'
             : (p.total ? p.done + ' из ' + p.total + ' задач' : 'нет задач');

      return '<button class="goal-card" style="background:' + esc(g.color || '#7F77DD') + '"' +
        ' data-act="open-goal" data-id="' + esc(g.id) + '">' +
        '<div class="goal-ico">' + esc(g.icon || '🎯') + '</div>' +
        '<div>' +
          '<div class="goal-name">' + esc(g.name) + '</div>' +
          '<div class="goal-sub">' + esc(sub) + '</div>' +
          (due && p.total ? '<div class="goal-sub">' + p.done + ' из ' + p.total + ' задач</div>' : '') +
        '</div>' +
        '<div class="goal-bar"><i style="width:' + p.pct + '%"></i></div>' +
      '</button>';
    }).join('');
  }

  // Архив: завершённые цели не удаляются, но и не мозолят глаза.
  const arch = archivedGoals();
  document.getElementById('goals-archive').innerHTML = arch.length
    ? '<details class="archive-block"><summary>Архив целей (' + arch.length + ')</summary>' +
      arch.map(g=>{
        const p = goalProgress(g);
        return '<div class="arch-row">' +
          '<span class="arch-ico">' + esc(g.icon || '🎯') + '</span>' +
          '<span class="arch-name" data-act="open-goal" data-id="' + esc(g.id) + '">' +
            esc(g.name) + '</span>' +
          '<span class="arch-sub">' + p.done + ' из ' + p.total + '</span>' +
          '<button class="btn btn-secondary arch-btn" data-act="unarchive-goal"' +
            ' data-id="' + esc(g.id) + '">Вернуть</button>' +
        '</div>';
      }).join('') + '</details>'
    : '';
}

// ── Экран одной цели ──────────────────────────────────────────────────────
function openGoal(id){
  openGoalId = id;
  Object.keys(TABS).forEach(k=>{ document.getElementById(TABS[k].panel).hidden = true; });
  document.getElementById('panel-goal').hidden = false;
  document.getElementById('edit-btn').style.display = 'none';
  renderGoalDetail();
  window.scrollTo(0, 0);
}

function closeGoal(){ setTab('focus'); }

function renderGoalDetail(){
  const box = document.getElementById('goal-detail');
  const hundred = openGoalId === HUNDRED_ID;
  const g = hundred ? null : goalById(openGoalId);

  if(!hundred && !g){ setTab('focus'); return; }

  const all = hundred ? sections.list100 : (g.tasks || []);
  const items = (hundred && hundredFilter !== 'all')
    ? all.filter(i => (i.cat || 'other') === hundredFilter)
    : all;
  const done = all.filter(t => t.done).length;
  const title = hundred ? '100' : g.name;
  const icon = hundred ? '💯' : (g.icon || '🎯');
  const sub = hundred
    ? done + ' из ' + (all.length || 100) + ' сделано'
    : (all.length ? done + ' из ' + all.length + ' задач' : 'нет задач');

  document.getElementById('screen-title').textContent = hundred ? '100' : 'Focus';

  // Фильтр по категориям — только в списке ста: у задач цели его незачем.
  const filterRow = hundred
    ? '<div class="cat-row filter-row">' +
        ['all'].concat(HUNDRED_CATS.map(c => c.id)).map(id=>{
          const c = id === 'all' ? {icon:'∗', name:'Все'} : hundredCat(id);
          const n = id === 'all' ? all.length : all.filter(i => (i.cat || 'other') === id).length;
          if(id !== 'all' && !n) return '';       // пустые категории не показываем
          return '<button class="cat-chip" data-act="filter-100" data-cat="' + id + '"' +
            ' aria-pressed="' + (hundredFilter === id ? 'true' : 'false') + '">' +
            esc(c.icon) + ' ' + esc(c.name) + ' ' + n + '</button>';
        }).join('') +
      '</div>'
    : '';

  const rows = items.map(t=>{
    const cat = hundred ? hundredCat(t.cat) : null;
    const meta = [];
    if(t.done && t.doneAt) meta.push('✓ ' + doneDateLabel(t.doneAt));
    if(t.note) meta.push(t.note);

    return '<div class="task-row' + (t.done ? ' done' : '') + '">' +
      '<button type="button" class="task-check" role="checkbox"' +
        ' aria-checked="' + (t.done ? 'true' : 'false') + '"' +
        ' aria-label="' + esc(t.text) + '"' +
        ' data-act="toggle-task" data-id="' + esc(t.id) + '">' + (t.done ? '✓' : '') + '</button>' +
      (cat ? '<span class="task-cat" title="' + esc(cat.name) + '">' + esc(cat.icon) + '</span>' : '') +
      '<span class="task-mid" data-act="' + (hundred ? 'edit-item' : 'edit-task') + '"' +
        ' data-id="' + esc(t.id) + '">' +
        '<span class="task-text">' + esc(t.text) + '</span>' +
        (meta.length ? '<span class="task-meta">' + esc(meta.join(' · ')) + '</span>' : '') +
      '</span>' +
      '<button class="task-del" data-act="del-task" data-id="' + esc(t.id) + '"' +
        ' aria-label="Удалить">✕</button>' +
    '</div>';
  }).join('');

  // Срок и привычки цели — прямо в шапке экрана.
  const due = hundred ? '' : dueLabel(g.due);
  const overdue = !hundred && daysLeft(g.due) !== null && daysLeft(g.due) < 0;
  const hp = hundred ? null : goalHabitPct(g);
  const linked = hundred ? [] : activeHabits().filter(h => (g.habitIds || []).indexOf(h.id) !== -1);

  box.innerHTML =
    '<div class="goal-head">' +
      '<div class="goal-ico">' + esc(icon) + '</div>' +
      '<div style="flex:1">' +
        '<h2>' + esc(title) + '</h2>' +
        '<div class="goal-sub">' + esc(sub) +
          (due ? ' · <span class="' + (overdue ? 'due-bad' : 'due-ok') + '">' + esc(due) + '</span>' : '') +
        '</div>' +
      '</div>' +
      (hundred ? '' :
        '<button class="icon-btn" data-act="edit-goal" data-id="' + esc(g.id) + '"' +
        ' aria-label="Изменить цель">✏️</button>') +
    '</div>' +
    // Привычки цели: сразу видно, чем именно она поддержана в трекере.
    (linked.length
      ? '<div class="goal-habits-row">' +
          (hp ? '<span class="gh-pct">' + hp.pct + '%</span>' : '') +
          linked.map(h => '<span class="gh-chip" style="--habit:' + esc(h.color) + '">' +
            esc(h.icon || '•') + ' ' + esc(h.name) + ' · ' + getMonthPct(h) + '%</span>').join('') +
        '</div>'
      : '') +
    filterRow +
    (items.length ? rows : emptyBlock(hundred ? '💯' : '📝',
        hundred ? (hundredFilter === 'all' ? 'Список пуст' : 'В этой категории пусто')
                : 'Задач пока нет',
        hundred ? 'Сто пунктов пишутся годами. Первый — прямо сейчас.'
                : 'Разбейте цель на шаги, которые можно закрыть за раз.',
        '', '')) +
    '<div class="section-actions">' +
      '<button class="btn btn-primary" data-act="add-task">+ ' +
        (hundred ? 'Новый пункт' : 'Новая задача') + '</button>' +
      (hundred ? '' :
        '<button class="btn btn-danger" data-act="del-goal" data-id="' + esc(g.id) + '">Удалить цель</button>') +
    '</div>';
}

// Задачи цели и пункты списка ста устроены одинаково, поэтому и код общий.
function currentItems(){
  return openGoalId === HUNDRED_ID ? sections.list100 : ((goalById(openGoalId) || {}).tasks || []);
}
function currentSectionName(){ return openGoalId === HUNDRED_ID ? 'list100' : 'goals'; }

function toggleTask(id){
  const t = currentItems().find(x => x.id === id);
  if(!t) return;
  t.done = !t.done;
  t.doneAt = t.done ? new Date().toISOString() : null;
  saveSection(currentSectionName());
  renderGoalDetail();
  if(t.done && !REDUCED_MOTION) launchConfetti(false);
}

function addTask(){
  const hundred = openGoalId === HUNDRED_ID;
  openTextModal({
    title: hundred ? 'Новый пункт' : 'Новая задача',
    placeholder: hundred ? 'Что стоит успеть' : 'Что нужно сделать',
    cats: hundred ? HUNDRED_CATS : null,
    cat: hundred && hundredFilter !== 'all' ? hundredFilter : null,
    withNote: hundred,
    onSave: (text, note, cat)=>{
      const list = currentItems();
      const item = {id: newId('t'), text: text, done: false};
      if(hundred){ item.cat = cat || 'other'; if(note) item.note = note; }
      list.push(item);
      saveSection(currentSectionName());
      renderGoalDetail();
    }
  });
}

// Пункт списка ста правится вместе с категорией и заметкой — у задач цели
// ни того, ни другого нет, поэтому редактор отдельный.
function editHundredItem(id){
  const t = sections.list100.find(x => x.id === id);
  if(!t) return;
  openTextModal({
    title: 'Пункт списка',
    value: t.text,
    note: t.note || '',
    withNote: true,
    cats: HUNDRED_CATS,
    cat: t.cat || 'other',
    onSave: (text, note, cat)=>{
      t.text = text;
      t.cat = cat || 'other';
      if(note) t.note = note; else delete t.note;
      saveSection('list100');
      renderGoalDetail();
    },
    onDelete: ()=>deleteTask(id)
  });
}

function editTask(id){
  const t = currentItems().find(x => x.id === id);
  if(!t) return;
  openTextModal({
    title: 'Изменить',
    value: t.text,
    onSave: text=>{ t.text = text; saveSection(currentSectionName()); renderGoalDetail(); },
    onDelete: ()=>deleteTask(id)
  });
}

function deleteTask(id){
  const list = currentItems();
  const i = list.findIndex(x => x.id === id);
  if(i === -1) return;
  const removed = list.splice(i, 1)[0];
  // Пункты списка ста — записи верхнего уровня, их удаление нужно помнить,
  // иначе оно не доедет до второго устройства.
  if(currentSectionName() === 'list100') markDeleted('list100', removed.id);
  saveSection(currentSectionName());
  renderGoalDetail();
  // Удаление без отмены — самая частая причина потерянных данных.
  toast('Удалено: ' + removed.text, false, ()=>{
    list.splice(i, 0, removed);
    if(currentSectionName() === 'list100') unmarkDeleted('list100', removed.id);
    saveSection(currentSectionName());
    renderGoalDetail();
  });
}

function openHundred(){ openGoal(HUNDRED_ID); }

// ── Модалка цели ──────────────────────────────────────────────────────────
let goalDraft = null;

function openGoalModal(id){
  lastFocused = document.activeElement;
  const g = id ? goalById(id) : null;
  goalDraft = g
    ? {id: g.id, name: g.name, icon: g.icon || '🎯', color: g.color || COLOR_POOL[0],
       due: g.due || '', habitIds: (g.habitIds || []).slice(), archived: !!g.archived}
    : {id: null, name: '', icon: '🎯', color: COLOR_POOL[sections.goals.length % COLOR_POOL.length],
       due: '', habitIds: [], archived: false};

  document.getElementById('goal-modal-title').textContent = g ? 'Изменить цель' : 'Новая цель';
  document.getElementById('goal-name').value = goalDraft.name;
  document.getElementById('goal-due').value = goalDraft.due;
  document.getElementById('goal-icon-btn').textContent = goalDraft.icon;

  const archBtn = document.getElementById('goal-archive-btn');
  archBtn.style.display = g ? '' : 'none';
  archBtn.textContent = goalDraft.archived ? 'Вернуть из архива' : 'В архив';
  renderGoalHabits();
  document.getElementById('goal-colors').innerHTML = COLOR_POOL.map(c=>
    '<button class="color-dot" style="background:' + c + '"' +
    ' aria-pressed="' + (c === goalDraft.color ? 'true' : 'false') + '"' +
    ' aria-label="Цвет"' +
    ' data-act="pick-goal-color" data-arg="' + c + '"></button>').join('');

  const m = document.getElementById('goal-modal');
  m.classList.add('open');
  m.setAttribute('aria-modal','true');
  m.setAttribute('role','dialog');
  document.getElementById('goal-name').focus();
}

function pickGoalColor(c){
  goalDraft.color = c;
  Array.from(document.getElementById('goal-colors').children).forEach(b=>{
    b.setAttribute('aria-pressed', b.style.backgroundColor === hexToRgb(c) ? 'true' : 'false');
  });
  // Сравнение цветов через style ненадёжно, поэтому перерисовываем честно.
  document.getElementById('goal-colors').innerHTML = COLOR_POOL.map(x=>
    '<button class="color-dot" style="background:' + x + '"' +
    ' aria-pressed="' + (x === goalDraft.color ? 'true' : 'false') + '"' +
    ' aria-label="Цвет"' +
    ' data-act="pick-goal-color" data-arg="' + x + '"></button>').join('');
}

function hexToRgb(hex){
  const n = parseInt(hex.slice(1), 16);
  return 'rgb(' + ((n >> 16) & 255) + ', ' + ((n >> 8) & 255) + ', ' + (n & 255) + ')';
}

function openGoalEmoji(btn){
  // Переиспользуем общий выбор эмодзи: индекс -1 означает «цель».
  openEmojiPicker(-1, btn);
}

// Привычки, привязанные к цели. Это и есть связка двух разделов: цель
// перестаёт быть списком задач и начинает показывать, живёт ли она.
function renderGoalHabits(){
  const box = document.getElementById('goal-habits');
  const list = activeHabits();
  if(!list.length){
    box.innerHTML = '<div class="hint">Сначала добавьте привычки в разделе Tracker.</div>';
    return;
  }
  box.innerHTML = list.map(h=>
    '<button type="button" class="cat-chip"' +
      ' aria-pressed="' + (goalDraft.habitIds.indexOf(h.id) !== -1 ? 'true' : 'false') + '"' +
      ' data-act="toggle-goal-habit" data-arg="' + esc(h.id) + '">' +
      esc(h.icon || '•') + ' ' + esc(h.name) + '</button>').join('');
}

function toggleGoalHabit(id){
  if(!goalDraft) return;
  const i = goalDraft.habitIds.indexOf(id);
  if(i === -1) goalDraft.habitIds.push(id); else goalDraft.habitIds.splice(i, 1);
  renderGoalHabits();
}

function clearGoalDue(){
  document.getElementById('goal-due').value = '';
}

// Архивирование прямо из модалки: цель, которую закрыли, не нужно удалять —
// её приятно видеть в списке завершённых.
function toggleGoalArchive(){
  if(!goalDraft || !goalDraft.id) return;
  const g = goalById(goalDraft.id);
  if(!g) return;
  g.archived = !g.archived;
  g.archivedAt = g.archived ? new Date().toISOString() : null;
  saveSection('goals');
  closeGoalModal();
  setTab('focus');
  toast(g.archived ? 'Цель в архиве: ' + g.name : 'Цель возвращена: ' + g.name);
}

function unarchiveGoal(id){
  const g = goalById(id);
  if(!g) return;
  g.archived = false;
  saveSection('goals');
  renderFocus();
  toast('Цель возвращена: ' + g.name);
}

function closeGoalModal(){
  document.getElementById('goal-modal').classList.remove('open');
  goalDraft = null;
  if(lastFocused && lastFocused.focus) lastFocused.focus();
}

function saveGoalModal(){
  const name = document.getElementById('goal-name').value.trim();
  if(!name){ toast('Название цели не может быть пустым', true); return; }

  const due = document.getElementById('goal-due').value || '';

  if(goalDraft.id){
    const g = goalById(goalDraft.id);
    if(g){
      g.name = name; g.icon = goalDraft.icon; g.color = goalDraft.color;
      g.due = due; g.habitIds = goalDraft.habitIds.slice();
    }
  } else {
    sections.goals.push({id: newId('g'), name: name, icon: goalDraft.icon,
                         color: goalDraft.color, tasks: [], due: due,
                         habitIds: goalDraft.habitIds.slice()});
  }
  saveSection('goals');
  closeGoalModal();
  if(openGoalId) renderGoalDetail(); else renderFocus();
}

function deleteGoal(id){
  const i = sections.goals.findIndex(g => g.id === id);
  if(i === -1) return;
  const g = sections.goals[i];
  const count = (g.tasks || []).length;
  if(count && !confirm('Удалить цель «' + g.name + '» вместе с ' + count + ' задачами?')) return;

  const removed = sections.goals.splice(i, 1)[0];
  markDeleted('goals', removed.id);
  saveSection('goals');
  setTab('focus');
  toast('Цель удалена: ' + removed.name, false, ()=>{
    sections.goals.splice(i, 0, removed);
    unmarkDeleted('goals', removed.id);
    saveSection('goals');
    renderFocus();
  });
}

/* ═══════════════ CREDO: принципы ═══════════════ */

// Отметка «сегодня следовал» кладётся в ту же таблицу habits тем же ключом
// год/месяц/день/<id>, что и привычки: очередь офлайн-отправки, серии и
// синхронизация начинают работать даром. В список привычек принципы не
// попадают, поэтому статистику трекера они не искажают.
function credoKey(c, date){
  const d = date || new Date(ty, tm, td);
  return dkey(d.getFullYear(), d.getMonth(), d.getDate(), c.id);
}

function credoOfDay(){
  const list = sections.credo;
  if(!list.length) return null;
  // Детерминированный выбор по дате: один и тот же принцип весь день.
  const seed = ty * 10000 + tm * 100 + td;
  return list[seed % list.length];
}

// Как принцип держался последние семь дней: по дню на точку. Без такой
// строки принцип остаётся декларацией — видно только сегодняшнюю галочку.
function credoWeek(c){
  const days = [];
  for(let i = 6; i >= 0; i--){
    const d = new Date(ty, tm, td - i);
    days.push({
      d: d.getDate(),
      dow: DOW_SHORT[d.getDay()],
      done: !!data[credoKey(c, d)],
      note: (c.notes && c.notes[credoKey(c, d)]) || ''
    });
  }
  return days;
}

function renderCredo(){
  const box = document.getElementById('credo-list');
  const today = credoOfDay();

  // Итог недели по всем принципам: одна честная цифра вместо ощущений.
  const list = sections.credo;
  let kept = 0, total = 0;
  list.forEach(c=>{
    credoWeek(c).forEach(day=>{ total++; if(day.done) kept++; });
  });
  const weekPct = total ? Math.round(kept / total * 100) : 0;

  document.getElementById('credo-today').innerHTML = today
    ? '<div class="credo-today">' +
        '<div class="ct-label">Принцип дня</div>' +
        '<div class="ct-text">' + esc(today.text) + '</div>' +
        (total ? '<div class="ct-week">За неделю принципы удержаны на <b>' + weekPct + '%</b>' +
                 ' · ' + kept + ' из ' + total + '</div>' : '') +
      '</div>'
    : '';

  if(!sections.credo.length){
    box.innerHTML = emptyBlock('🧭', 'Принципов пока нет',
      'Правила, по которым вы живёте. Каждый вечер можно отметить, следовали ли вы им сегодня.',
      '+ Новый принцип', 'new-credo');
    return;
  }

  box.innerHTML = sections.credo.map(c=>{
    const k = credoKey(c);
    const done = !!data[k];
    const streak = getStreak({id: c.id, name: c.text, color: '#000'});
    const week = credoWeek(c);
    const todayNote = (c.notes && c.notes[k]) || '';

    // Привычка, поддерживающая принцип: «Сначала неприятное» ↔ «Лягушка».
    const habit = c.habitId ? activeHabits().find(h => h.id === c.habitId) : null;

    return '<div class="credo-row">' +
      '<button type="button" class="task-check" role="checkbox"' +
        ' aria-checked="' + (done ? 'true' : 'false') + '"' +
        ' aria-label="Следовал сегодня: ' + esc(c.text) + '"' +
        ' data-act="toggle-credo" data-id="' + esc(c.id) + '">' + (done ? '✓' : '') + '</button>' +
      '<div style="flex:1;min-width:0">' +
        '<div class="cr-text" data-act="edit-credo" data-id="' + esc(c.id) + '">' + esc(c.text) + '</div>' +

        '<div class="cr-week" aria-label="Последние семь дней">' +
          week.map(d => '<span class="cw-day' + (d.done ? ' on' : '') + '"' +
            ' title="' + d.d + ' ' + d.dow + (d.note ? ': ' + esc(d.note) : '') + '">' +
            '<i></i><em>' + d.dow.slice(0, 1) + '</em></span>').join('') +
        '</div>' +

        (streak >= 2
          ? '<div class="cr-streak">🔥 ' + streak + ' ' + plural(streak, 'день', 'дня', 'дней') + ' подряд</div>'
          : '') +
        (habit
          ? '<div class="cr-habit">🔗 ' + esc(habit.icon || '•') + ' ' + esc(habit.name) +
            ' · ' + getMonthPct(habit) + '% за месяц</div>'
          : '') +
        (todayNote
          ? '<div class="cr-note" data-act="note-credo" data-id="' + esc(c.id) + '">✎ ' +
            esc(todayNote) + '</div>'
          : '<button class="cr-note-btn" data-act="note-credo" data-id="' + esc(c.id) + '">' +
            (done ? '✎ заметка за сегодня' : '✎ почему не вышло') + '</button>') +
      '</div>' +
    '</div>';
  }).join('');
}

// Заметка за сегодня: «почему не вышло» или «как удалось». Хранится внутри
// самого принципа по ключу дня — отдельная таблица ради строчки текста
// была бы лишней.
function noteCredo(id){
  const c = sections.credo.find(x => x.id === id);
  if(!c) return;
  const k = credoKey(c);
  openTextModal({
    title: 'Заметка за сегодня',
    placeholder: 'Что помешало или что помогло',
    value: (c.notes && c.notes[k]) || '',
    onSave: text=>{
      c.notes = c.notes || {};
      c.notes[k] = text;
      saveSection('credo');
      renderCredo();
    },
    onDelete: (c.notes && c.notes[k]) ? ()=>{
      delete c.notes[k];
      saveSection('credo');
      renderCredo();
    } : null
  });
}

function toggleCredo(id){
  const c = sections.credo.find(x => x.id === id);
  if(!c) return;
  const k = credoKey(c);
  const on = !data[k];
  if(on) data[k] = true; else delete data[k];
  saveEntry(k, on);
  // Принцип отмечают из двух мест — из раздела и с экрана дня, поэтому
  // перерисовываем тот экран, который открыт сейчас.
  renderCurrent();
  if(on && !REDUCED_MOTION) launchConfetti(false);
}

// Список привычек как «категории»: так принцип связывается с привычкой
// в том же окне, где его пишут.
function habitChoices(){
  return [{id:'', icon:'∅', name:'Без привычки'}].concat(
    activeHabits().map(h => ({id: h.id, icon: h.icon || '•', name: h.name})));
}

function openCredoModal(){
  openTextModal({
    title: 'Новый принцип',
    placeholder: 'Например: «Сначала делаю самое неприятное»',
    cats: habitChoices(),
    cat: '',
    onSave: (text, extra, habitId)=>{
      const c = {id: newId('credo'), text: text};
      if(habitId) c.habitId = habitId;
      sections.credo.push(c);
      saveSection('credo');
      renderCredo();
    }
  });
}

function editCredo(id){
  const c = sections.credo.find(x => x.id === id);
  if(!c) return;
  openTextModal({
    title: 'Изменить принцип',
    value: c.text,
    cats: habitChoices(),
    cat: c.habitId || '',
    onSave: (text, extra, habitId)=>{
      c.text = text;
      if(habitId) c.habitId = habitId; else delete c.habitId;
      saveSection('credo');
      renderCredo();
    },
    onDelete: ()=>{
      const i = sections.credo.findIndex(x => x.id === id);
      const removed = sections.credo.splice(i, 1)[0];
      markDeleted('credo', removed.id);
      saveSection('credo');
      renderCurrent();
      toast('Принцип удалён', false, ()=>{
        sections.credo.splice(i, 0, removed);
        unmarkDeleted('credo', removed.id);
        saveSection('credo');
        renderCurrent();
      });
    }
  });
}

/* ═══════════════ QUOTES: цитаты ═══════════════ */

function renderQuotes(){
  renderQuote();     // цитата дня в верхней карточке
  updateSaveQuoteBtn();
  const box = document.getElementById('quotes-list');

  if(!sections.quotes.length){
    box.innerHTML = emptyBlock('💬', 'Своих цитат пока нет',
      'Сюда стоит складывать то, что хочется перечитывать. Наверху — цитата дня из встроенной подборки.',
      '+ Своя цитата', 'new-quote');
    return;
  }

  // Избранные — наверх: их и открывают чаще всего.
  const list = sections.quotes.slice().sort((a, b)=> (b.fav ? 1 : 0) - (a.fav ? 1 : 0));
  box.innerHTML = list.map(q=>
    '<div class="quote-item">' +
      '<div class="qi-text" data-act="edit-quote" data-id="' + esc(q.id) + '">«' + esc(q.text) + '»</div>' +
      '<div class="qi-bottom">' +
        '<span class="qi-author">' + (q.author ? esc(q.author) : 'без автора') + '</span>' +
        '<button class="fav-btn' + (q.fav ? ' on' : '') + '"' +
          ' aria-label="В избранное" aria-pressed="' + (q.fav ? 'true' : 'false') + '"' +
          ' data-act="fav-quote" data-id="' + esc(q.id) + '">⭐</button>' +
      '</div>' +
    '</div>').join('');
}

function toggleFavQuote(id){
  const q = sections.quotes.find(x => x.id === id);
  if(!q) return;
  q.fav = !q.fav;
  saveSection('quotes');
  renderQuotes();
}

function openQuoteModal(){
  openTextModal({
    title: 'Своя цитата',
    placeholder: 'Текст цитаты',
    withAuthor: true,
    onSave: (text, author)=>{
      sections.quotes.push({id: newId('q'), text: text, author: author || '', fav: false});
      saveSection('quotes');
      renderQuotes();
    }
  });
}

function editQuote(id){
  const q = sections.quotes.find(x => x.id === id);
  if(!q) return;
  openTextModal({
    title: 'Изменить цитату',
    value: q.text,
    author: q.author,
    withAuthor: true,
    onSave: (text, author)=>{
      q.text = text; q.author = author || '';
      saveSection('quotes');
      renderQuotes();
    },
    onDelete: ()=>{
      const i = sections.quotes.findIndex(x => x.id === id);
      const removed = sections.quotes.splice(i, 1)[0];
      markDeleted('quotes', removed.id);
      saveSection('quotes');
      renderQuotes();
      toast('Цитата удалена', false, ()=>{
        sections.quotes.splice(i, 0, removed);
        unmarkDeleted('quotes', removed.id);
        saveSection('quotes');
        renderQuotes();
      });
    }
  });
}

/* ═══════════════ УНИВЕРСАЛЬНАЯ МОДАЛКА ВВОДА ═══════════════ */
// Одна модалка на принципы, цитаты, задачи и пункты списка ста: у всех
// один сценарий — ввести текст, сохранить, иногда удалить.
let textModalState = null;

function openTextModal(opts){
  lastFocused = document.activeElement;
  textModalState = opts;

  document.getElementById('text-modal-title').textContent = opts.title || 'Добавить';
  const input = document.getElementById('text-modal-input');
  input.value = opts.value || '';
  input.placeholder = opts.placeholder || '';

  // Категории (пункты списка ста) и вторая строка (автор цитаты, заметка
  // к пункту) — одни и те же поля, включаются по надобности.
  const cats = document.getElementById('text-modal-cats');
  if(opts.cats){
    textModalState.cat = opts.cat || opts.cats[opts.cats.length - 1].id;
    cats.style.display = '';
    renderTextModalCats();
  } else {
    cats.style.display = 'none';
  }

  const extra = document.getElementById('text-modal-extra');
  extra.style.display = (opts.withAuthor || opts.withNote) ? '' : 'none';
  extra.placeholder = opts.withNote ? 'Заметка: где, с кем, как это было' : 'Автор';
  extra.value = opts.author || opts.note || '';

  document.getElementById('text-modal-delete').style.display = opts.onDelete ? '' : 'none';

  const m = document.getElementById('text-modal');
  m.classList.add('open');
  m.setAttribute('aria-modal','true');
  m.setAttribute('role','dialog');
  input.focus();
}

function closeTextModal(){
  document.getElementById('text-modal').classList.remove('open');
  textModalState = null;
  if(lastFocused && lastFocused.focus) lastFocused.focus();
}

function renderTextModalCats(){
  const opts = textModalState;
  document.getElementById('text-modal-cats').innerHTML = opts.cats.map(c=>
    '<button type="button" class="cat-chip"' +
    ' aria-pressed="' + (c.id === opts.cat ? 'true' : 'false') + '"' +
    ' data-act="pick-text-cat" data-arg="' + esc(c.id) + '">' +
    esc(c.icon) + ' ' + esc(c.name) + '</button>').join('');
}

function pickTextModalCat(id){
  if(!textModalState) return;
  textModalState.cat = id;
  renderTextModalCats();
}

function saveTextModal(){
  if(!textModalState) return;
  const text = document.getElementById('text-modal-input').value.trim();
  if(!text){ toast('Текст не может быть пустым', true); return; }
  const extra = document.getElementById('text-modal-extra').value.trim();
  const cb = textModalState.onSave;
  const cat = textModalState.cat;
  closeTextModal();
  if(cb) cb(text, extra, cat);
}

function deleteFromTextModal(){
  if(!textModalState || !textModalState.onDelete) return;
  const cb = textModalState.onDelete;
  closeTextModal();
  cb();
}
