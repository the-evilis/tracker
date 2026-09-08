/* app-core.js — Ядро: демо-режим, Supabase и вход, утилиты, кэш и очередь
   отметок, миграция ключей, тема, звук, навигация, свайпы.
   Часть приложения. Файлы подключаются подряд и делят общую
   область видимости: сборки в проекте нет. */

// ── DEMO MODE ─────────────────────────────────────────────────────────────
let isDemoMode = false;

// Демо наполняется правдоподобной историей: на пустой сетке не видно ни
// серий, ни процентов, ни смысла приложения — а именно за этим в демо и идут.
function seedDemoData(){
  data = {};
  marksValues = {};
  const rnd = (seed)=>{ const x = Math.sin(seed) * 10000; return x - Math.floor(x); };
  HABITS.forEach((h, hi)=>{
    // У каждой привычки своя дисциплинированность: от 55% до 92%.
    const rate = 0.55 + rnd(hi + 1) * 0.37;
    const cur = new Date(ty, tm, td);
    cur.setDate(cur.getDate() - 74);
    for(let i = 0; i < 75; i++){
      const day = dayObj(cur);
      if(isPlannedDay(h, day) && rnd(hi * 97 + i * 13 + 3) < rate){
        data[dkey(day.y, day.m, day.d, h.id)] = true;
      }
      cur.setDate(cur.getDate() + 1);
    }
  });
}

function leaveDemo(){
  isDemoMode = false;
  data = {};
  marksValues = {};
  HABITS = cloneDefaults();
  sections = {goals: [], list100: [], credo: [], quotes: [], money_rules: [], budgets: []};
  tombs = {goals: {}, list100: {}, credo: {}, quotes: {}, money_rules: {}, budgets: {}};
  txs = [];
  document.getElementById('demo-banner').style.display = 'none';
  showScreen('auth');
}

function enterDemo(){
  isDemoMode = true;
  currentUser = null;
  HABITS = cloneDefaults();
  seedDemoData();
  seedDemoSections();
  document.getElementById('demo-banner').style.display = 'flex';
  // Set demo avatar
  const av = document.getElementById('user-avatar');
  const menu = document.getElementById('user-menu');
  Array.from(av.childNodes).forEach(n=>{ if(n.nodeType===3) av.removeChild(n); });
  av.insertBefore(document.createTextNode('👁'), menu);
  av.style.backgroundImage = '';
  av.style.fontSize = '18px';
  document.getElementById('user-email-display').textContent = 'Демо-режим';
  showScreen('app');
  initTabs();
  setSyncStatus('демо — данные не сохраняются', false);
}

// Демо наполняет и остальные разделы: пустой экран «Целей» или «Денег»
// выглядел бы поломкой, а посмотреть на приложение приходят именно за тем,
// как оно живёт с данными.
function seedDemoSections(){
  sections = {
    goals: [
      {id:'demo-g1', name:'Спорт', icon:'🏋️', color:'#378ADD', tasks:[
        {id:'demo-t1', text:'60 кг — новый вес', done:false},
        {id:'demo-t2', text:'Режим сна', done:true},
        {id:'demo-t3', text:'Тренировки 3 раза в неделю', done:true},
        {id:'demo-t4', text:'Больше есть + протеин', done:false}
      ]},
      {id:'demo-g2', name:'Бизнес', icon:'💼', color:'#1D9E75', tasks:[
        {id:'demo-t5', text:'Три клиента на сопровождении', done:true},
        {id:'demo-t6', text:'Сайт студии', done:false},
        {id:'demo-t7', text:'Прайс на пакеты работ', done:false}
      ]},
      // У одной цели намеренно стоит близкий срок: так на экране дня видно,
      // как выглядит напоминание о горящей цели.
      {id:'demo-g3', name:'Английский', icon:'🌍', color:'#BA7517',
       due: isoDate(new Date(ty, tm, td + 4)), habitIds:['legacy-4'], tasks:[
        {id:'demo-t8', text:'Смотреть без субтитров', done:false},
        {id:'demo-t9', text:'Созвон с носителем раз в неделю', done:true}
      ]},
      {id:'demo-g4', name:'Пианино', icon:'🎹', color:'#7F77DD', tasks:[
        {id:'demo-t10', text:'Разобрать первую пьесу', done:true},
        {id:'demo-t11', text:'Играть по памяти', done:false}
      ]}
    ],
    list100: [
      {id:'demo-h1', text:'Увидеть северное сияние', done:false},
      {id:'demo-h2', text:'Пробежать полумарафон', done:true},
      {id:'demo-h3', text:'Выучить второй язык', done:false},
      {id:'demo-h4', text:'Съездить в Японию', done:true},
      {id:'demo-h5', text:'Научиться играть на пианино', done:false},
      {id:'demo-h6', text:'Прыгнуть с парашютом', done:true},
      {id:'demo-h7', text:'Написать книгу', done:false},
      {id:'demo-h8', text:'Пройти маршрут в горах', done:false}
    ],
    credo: [
      {id:'demo-c1', text:'Сначала делаю самое неприятное'},
      {id:'demo-c2', text:'Обещание себе — такое же обещание, как другим'},
      {id:'demo-c3', text:'Считаю деньги, а не надеюсь на них'},
      {id:'demo-c4', text:'Ошибка — это данные, а не приговор'}
    ],
    quotes: [
      {id:'demo-q1', text:'Дисциплина — это выбор между тем, чего хочешь сейчас, и тем, чего хочешь больше всего.', author:'', fav:true},
      {id:'demo-q2', text:'Ты не поднимаешься до уровня своих целей, ты падаешь до уровня своих систем.', author:'Джеймс Клир', fav:false}
    ],
    // Повторы и бюджеты — чтобы в демо было видно, зачем они нужны.
    money_rules: [
      {id:'demo-r1', kind:'expense', amount:4500000, category:'home',  note:'Аренда',    day:5},
      {id:'demo-r2', kind:'expense', amount:129000,  category:'subs',  note:'Подписки',  day:12},
      {id:'demo-r3', kind:'income',  amount:18000000, category:'salary', note:'Основной доход', day:5}
    ],
    budgets: [
      {cat:'food',     limit:2500000},
      {cat:'fun',      limit:800000},
      {cat:'shopping', limit:1000000}
    ]
  };

  // Отметки «следовал принципу» — за последние три недели, с пропусками.
  const rnd = s => { const x = Math.sin(s) * 10000; return x - Math.floor(x); };
  sections.credo.forEach((c, ci)=>{
    const cur = new Date(ty, tm, td);
    cur.setDate(cur.getDate() - 20);
    for(let i = 0; i < 21; i++){
      if(rnd(ci * 31 + i * 7 + 1) < 0.72){
        data[dkey(cur.getFullYear(), cur.getMonth(), cur.getDate(), c.id)] = true;
      }
      cur.setDate(cur.getDate() + 1);
    }
  });

  seedDemoMoney();
}

// Полгода операций: без истории графики пустые и раздел непонятен.
function seedDemoMoney(){
  txs = [];
  const rnd = s => { const x = Math.sin(s) * 10000; return x - Math.floor(x); };
  const expCats = ['food','home','transport','health','fun','shopping','subs','study'];

  for(let back = 5; back >= 0; back--){
    const base = new Date(ty, tm - back, 1);
    const y = base.getFullYear(), m = base.getMonth();
    const daysInMonth = (back === 0) ? td : new Date(y, m + 1, 0).getDate();

    // Доход: зарплата и клиенты студии.
    txs.push({id:'demo-in-' + back + '-1', ts: isoDate(new Date(y, m, Math.min(5, daysInMonth))),
              amount: 18000000 + Math.round(rnd(back + 3) * 400000), kind:'income',
              category:'salary', note:'Основной доход'});
    if(rnd(back * 5 + 2) < 0.8){
      txs.push({id:'demo-in-' + back + '-2', ts: isoDate(new Date(y, m, Math.min(18, daysInMonth))),
                amount: 4000000 + Math.round(rnd(back * 7 + 4) * 6000000), kind:'income',
                category:'clients', note:'Проект студии'});
    }

    // Расходы: от четырёх до девяти операций в неделю.
    for(let d = 1; d <= daysInMonth; d++){
      const n = rnd(back * 101 + d * 13) < 0.55 ? 1 : (rnd(back * 57 + d * 3) < 0.25 ? 2 : 0);
      for(let k = 0; k < n; k++){
        const seed = back * 1000 + d * 10 + k;
        const cat = expCats[Math.floor(rnd(seed) * expCats.length)];
        const amount = 30000 + Math.round(rnd(seed + 0.5) * 900000);
        txs.push({id:'demo-ex-' + seed, ts: isoDate(new Date(y, m, d)),
                  amount: amount, kind:'expense', category: cat, note:''});
      }
    }
  }
  txs.sort((a, b) => (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0));
  moneyLoaded = true;
  moneyTableMissing = false;
}

// ── SUPABASE ──────────────────────────────────────────────────────────────
const SB_URL = 'https://bjqcjktdbjgmwxcddppq.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJqcWNqa3RkYmpnbXd4Y2RkcHBxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5NjQ1NjMsImV4cCI6MjA5NTU0MDU2M30.-UhLFmQcuV5WutkzA5B0cTqedTa86gm-oX8VxEsqwwQ';
const sb = supabase.createClient(SB_URL, SB_KEY);

let currentUser = null;

// ── AUTH ──────────────────────────────────────────────────────────────────
function switchAuthTab(tab) {
  document.querySelectorAll('.auth-tab').forEach((t,i)=>t.classList.toggle('active',
    (i===0&&tab==='magic')||(i===1&&tab==='google')));
  document.getElementById('auth-magic-panel').style.display = tab==='magic'?'':'none';
  document.getElementById('auth-google-panel').style.display = tab==='google'?'':'none';
}

async function sendMagicLink() {
  const email = document.getElementById('auth-email').value.trim();
  if(!email){ setAuthMsg('magic','Введите email','error'); return; }
  const btn = document.getElementById('magic-btn');
  btn.disabled = true; btn.textContent = 'Отправляем...';
  setAuthMsg('magic','');
  const {error} = await sb.auth.signInWithOtp({
    email,
    options:{ emailRedirectTo: window.location.origin + window.location.pathname }
  });
  btn.disabled = false; btn.textContent = 'Отправить ссылку для входа';
  if(error){ setAuthMsg('magic', error.message, 'error'); return; }
  document.getElementById('sent-email-display').textContent = email;
  document.getElementById('auth-form-area').style.display = 'none';
  document.getElementById('auth-magic-sent').style.display = 'block';
}

async function signInWithGoogle() {
  setAuthMsg('google','');
  const {error} = await sb.auth.signInWithOAuth({
    provider:'google',
    options:{ redirectTo: window.location.origin + window.location.pathname }
  });
  if(error) setAuthMsg('google', error.message, 'error');
}

async function signOut() {
  // Перед выходом пытаемся досдать всё, что осталось в очереди.
  if(queueSize() > 0){
    if(!confirm('Есть ' + queueSize() + ' несохранённых отметок. Выйти всё равно?\n\n' +
                'Они пропадут — лучше дождаться синхронизации.')) return;
  }
  document.getElementById('user-menu').classList.remove('open');
  setSyncStatus('выход...');
  await sb.auth.signOut();
  currentUser = null;
  data = {};
  // Clear cached data
  Object.keys(localStorage).forEach(k=>{ if(k.startsWith('ht_')) localStorage.removeItem(k); });
  if(realtimeChannel){ sb.removeChannel(realtimeChannel); realtimeChannel=null; }
  // Clear URL hash
  history.replaceState(null, '', window.location.pathname);
  // Reset auth form
  const fa = document.getElementById('auth-form-area');
  const ms = document.getElementById('auth-magic-sent');
  if(fa) fa.style.display = '';
  if(ms) ms.style.display = 'none';
  const mb = document.getElementById('magic-btn');
  if(mb){ mb.disabled=false; mb.textContent='Отправить ссылку для входа'; }
  showScreen('auth');
}

function setAuthMsg(type, msg, cls=''){
  const el = document.getElementById(type+'-msg');
  if(el){ el.textContent=msg; el.className='auth-msg'+(cls?' '+cls:''); }
}

function toggleUserMenu(e){
  if(e) e.stopPropagation();
  document.getElementById('user-menu').classList.toggle('open');
}
document.addEventListener('click', e=>{
  if(!e.target.closest('#user-avatar')) document.getElementById('user-menu').classList.remove('open');
});
// Wire signout button separately — no bubbling issues
document.addEventListener('DOMContentLoaded', ()=>{
  const btn = document.getElementById('signout-btn');
  if(btn) btn.addEventListener('click', e=>{ e.stopPropagation(); signOut(); });
});

function showScreen(name){
  document.getElementById('auth-screen').style.display = name==='auth' ? 'flex' : 'none';
  document.getElementById('main-app').style.display = name==='app' ? 'block' : 'none';
}


// ── ОБЩИЕ УТИЛИТЫ ─────────────────────────────────────────────────────────
// Экранирование пользовательского текста перед вставкой в innerHTML.
// Без него привычка с символом «<» в названии ломает вёрстку карточки.
function esc(s){
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  })[c]);
}

// Системная настройка «уменьшить движение» — глушим салюты и искры.
const REDUCED_MOTION = window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Короткое всплывающее сообщение (экспорт, импорт, ошибки).
// Третий аргумент делает его действием с кнопкой «Вернуть».
let toastTimer = null;
let undoAction = null;

function toast(msg, isError, onUndo){
  const el = document.getElementById('toast');
  if(!el) return;
  undoAction = onUndo || null;
  el.textContent = msg;
  if(onUndo){
    const b = document.createElement('button');
    b.className = 'undo';
    b.type = 'button';
    b.textContent = 'Вернуть';
    b.onclick = ()=>{
      const act = undoAction;
      undoAction = null;
      el.className = 'toast';
      if(act) act();
    };
    el.appendChild(b);
  }
  el.className = 'toast show' + (isError ? ' err' : '') + (onUndo ? ' act' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>{ el.className = 'toast'; undoAction = null; },
                          onUndo ? 7000 : (isError ? 5000 : 2600));
}

// Идентификатор привычки: буквы/цифры/дефис, никогда не чисто число —
// по этому признаку отличаем новые ключи данных от старых (см. миграцию).
function newHabitId(){
  const rnd = (window.crypto && crypto.randomUUID)
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10);
  return 'h-' + Date.now().toString(36) + '-' + rnd;
}

// ── DATA ──────────────────────────────────────────────────────────────────
// id у привычек постоянный: отметки хранятся по нему, а не по позиции
// в списке, поэтому удаление и перетаскивание не сдвигают историю.
// id вида legacy-N совпадает с прежним номером привычки в списке, поэтому
// перенос старых отметок сводится к замене последнего сегмента ключа и
// не зависит ни от сервера, ни от того, какой список загрузился первым.
const DEFAULT_HABITS = [
  {id:'legacy-0', name:'Медитация',         icon:'🧘',  color:'#7F77DD', bg:'#EEEDFE'},
  {id:'legacy-1', name:'Благодарность',     icon:'🌼',  color:'#1D9E75', bg:'#E1F5EE'},
  {id:'legacy-2', name:'Чтение',            icon:'📖',  color:'#D4537E', bg:'#FBEAF0'},
  {id:'legacy-3', name:'Воркаут',           icon:'🏋️‍♂️', color:'#378ADD', bg:'#E6F1FB'},
  {id:'legacy-4', name:'Иностранный язык',  icon:'📚',  color:'#D85A30', bg:'#FAECE7'},
  {id:'legacy-5', name:'8000 шагов',        icon:'🏃',  color:'#0F6E56', bg:'#E1F5EE'},
  {id:'legacy-6', name:'Стретчинг',         icon:'🤸',  color:'#BA7517', bg:'#FAEEDA'},
  {id:'legacy-7', name:'Дневник',           icon:'📓',  color:'#4338CA', bg:'#EEF2FF'},
  {id:'legacy-8', name:'Режим сна',         icon:'🛌',  color:'#639922', bg:'#EAF3DE'},
];
// Всегда отдаём копию: иначе правки в редакторе мутировали бы эталонный
// список и «сброс к стандартным» перестал бы работать.
function cloneDefaults(){ return DEFAULT_HABITS.map(h=>Object.assign({}, h)); }

const COLOR_POOL=['#7F77DD','#1D9E75','#D85A30','#378ADD','#639922','#BA7517','#D4537E','#0F6E56','#C2410C','#4338CA'];
const BG_POOL   =['#EEEDFE','#E1F5EE','#FAECE7','#E6F1FB','#EAF3DE','#FAEEDA','#FBEAF0','#E1F5EE','#FEF3C7','#EEF2FF'];
const EMOJI_POOL=['🧘','🏋️','🤸','📖','🚶','🤖','🇬🇧','💧','🗣️','🌙','🎯','💊','🧠','✍️','🎸','🏃','🥗','☕','📝','⚡','🔥','🎵','🧹','💻','🏊','🚴','🌿','🧘‍♂️','🍎','🛏️','📚','🎨','🏆','💪','🧬','🫁','🫀','🌅','🥋','🧗'];

let HABITS = [...DEFAULT_HABITS];
let data = {};
let editBuffer = [];
let activeEmojiIdx = null;

// ── AI EMOJI ──────────────────────────────────────────────────────────────
const EMOJI_MAP = [
  {words:['медитац','дыхан','mindful','релакс'],emoji:'🧘'},
  {words:['трениров','воркаут','качал','спортзал','gym'],emoji:'🏋️'},
  {words:['стретч','растяж','йога'],emoji:'🤸'},
  {words:['чтен','книг','читать','read'],emoji:'📖'},
  {words:['шаг','ходьб','прогулк','walk'],emoji:'🚶'},
  {words:['бег','пробежк','run'],emoji:'🏃'},
  {words:['ai','ии','нейрос','gpt','машин','модел'],emoji:'🤖'},
  {words:['английск','язык','spanish','french','немецк'],emoji:'🌍'},
  {words:['вода','воды','гидрац','water','пить'],emoji:'💧'},
  {words:['креатин','витамин','таблетк','препарат','добавк'],emoji:'💊'},
  {words:['сон','спать','sleep','полноч','засыпа'],emoji:'🛏️'},
  {words:['артикуляц','речь','голос','дикц'],emoji:'🗣️'},
  {words:['музык','гитар','фортепиан','пианин','drum'],emoji:'🎵'},
  {words:['кофе','coffee','чай','tea'],emoji:'☕'},
  {words:['еда','питан','диет','калор','food'],emoji:'🥗'},
  {words:['код','програм','разработк','code'],emoji:'💻'},
  {words:['рисов','творч','art','sketch'],emoji:'🎨'},
  {words:['плаван','бассейн','swim'],emoji:'🏊'},
  {words:['велосипед','велик','bike','cycling'],emoji:'🚴'},
  {words:['уборк','чист','убирать'],emoji:'🧹'},
  {words:['дневник','журнал','запис','journal'],emoji:'✍️'},
  {words:['природ','парк','лес','green'],emoji:'🌿'},
  {words:['утро','рассвет','подъём'],emoji:'🌅'},
  {words:['борьб','бокс','martial','единоборств','каратэ'],emoji:'🥋'},
];

function guessEmoji(name) {
  const lower = name.toLowerCase();
  for(const {words, emoji} of EMOJI_MAP){
    if(words.some(w => lower.includes(w))) return emoji;
  }
  return EMOJI_POOL[Math.floor(Math.random() * EMOJI_POOL.length)];
}

// ── EMOJI PICKER ──────────────────────────────────────────────────────────
function buildEmojiPicker(){
  const p = document.getElementById('emoji-picker');
  p.innerHTML = EMOJI_POOL.map(e =>
    '<button class="ep-emoji" data-act="pick-emoji" data-arg="'+e+'" title="'+e+'">'+e+'</button>'
  ).join('');
}

function openEmojiPicker(idx, btnEl){
  if(activeEmojiIdx === idx){
    closeEmojiPicker(); return;
  }
  activeEmojiIdx = idx;
  const p = document.getElementById('emoji-picker');
  p.classList.add('open');
  const rect = btnEl.getBoundingClientRect();
  p.style.left = rect.left+'px';
  p.style.top = (rect.bottom+6+window.scrollY)+'px';
}

function closeEmojiPicker(){
  activeEmojiIdx = null;
  document.getElementById('emoji-picker').classList.remove('open');
}

function pickEmoji(emoji){
  if(activeEmojiIdx === null) return;
  // Индекс -1 означает, что значок выбирают для цели, а не для привычки:
  // выбор эмодзи один на всё приложение, дублировать его незачем.
  if(activeEmojiIdx === -1){
    if(goalDraft){
      goalDraft.icon = emoji;
      document.getElementById('goal-icon-btn').textContent = emoji;
    }
    closeEmojiPicker();
    return;
  }
  editBuffer[activeEmojiIdx].icon = emoji;
  closeEmojiPicker();
  renderEditor();
}

document.addEventListener('click', e=>{
  if(!e.target.closest('#emoji-picker') && !e.target.closest('.edit-icon-btn'))
    closeEmojiPicker();
});

// ── SUPABASE HABITS CRUD ──────────────────────────────────────────────────
function setSyncStatus(msg, ok){
  const el=document.getElementById('sync-status');
  if(!el) return;
  // Always keep text (to hold height), just fade opacity
  el.textContent = msg || ' ';
  el.style.color = ok ? 'var(--accent)' : 'var(--text3)';
  el.style.opacity = msg ? '1' : '0';
}

// Ключ отметки: дата + постоянный id привычки.
function dkey(y,m,d,hid){ return y+'/'+m+'/'+d+'/'+hid; }

function cacheKey(){ return 'ht_'+((currentUser&&currentUser.id)||'anon'); }
function queueKey(){ return 'htq_'+((currentUser&&currentUser.id)||'anon'); }

// ── ОЧЕРЕДЬ НЕСИНХРОНИЗИРОВАННЫХ ОТМЕТОК ─────────────────────────────────
// Отметка, сделанная без сети, попадает сюда и досылается при первой
// возможности. Без очереди она терялась: loadData накатывал серверные
// данные поверх локальных.
function queueRead(){
  try{ return JSON.parse(localStorage.getItem(queueKey()) || '{}'); }
  catch(e){ return {}; }
}
function queueWrite(q){
  try{ localStorage.setItem(queueKey(), JSON.stringify(q)); }
  catch(e){ console.warn('очередь не сохранена', e); }
}
function queueAdd(k, val){
  const q = queueRead();
  q[k] = val;
  queueWrite(q);
  updatePendingBadge();
}
function queueSize(){ return Object.keys(queueRead()).length; }

// Показываем в статусе, что часть изменений ещё не на сервере.
function updatePendingBadge(){
  const n = queueSize();
  if(n > 0) setSyncStatus('не отправлено: ' + n, false);
}

let flushing = false;
async function flushQueue(){
  if(flushing || !currentUser || isDemoMode) return;
  const q = queueRead();
  const keys = Object.keys(q);
  if(!keys.length) return;
  flushing = true;
  try{
    // Отдельно то, что нужно записать, и то, что нужно удалить.
    const toUpsert = keys.filter(k => q[k] === true).map(k => ({
      id:k, user_id:currentUser.id, done:true, updated_at:new Date().toISOString()
    }));
    const toDelete = keys.filter(k => q[k] !== true);

    if(toUpsert.length){
      const res = await sbFetchWithTimeout(()=>
        sb.from('habits').upsert(toUpsert, {onConflict:'id,user_id'})
      );
      if(res.error) throw new Error(res.error.message);
    }
    if(toDelete.length){
      const res = await sbFetchWithTimeout(()=>
        sb.from('habits').delete().eq('user_id', currentUser.id).in('id', toDelete)
      );
      if(res.error) throw new Error(res.error.message);
    }
    localStorage.removeItem(queueKey());
    setSyncStatus('всё синхронизировано ✓', true);
    setTimeout(()=>setSyncStatus('', false), 2000);
  }catch(e){
    // Очередь намеренно остаётся — попробуем при следующем событии.
    setSyncStatus('не отправлено: ' + queueSize(), false);
  }finally{
    flushing = false;
  }
}

window.addEventListener('online', ()=>{
  flushQueue();
  // Разделы и операции держат свои очереди неотправленного.
  if(typeof flushSections === 'function') flushSections();
  if(typeof flushTxQueue === 'function') flushTxQueue();
});
document.addEventListener('visibilitychange', ()=>{
  if(document.hidden) return;
  flushQueue();
  if(typeof flushSections === 'function') flushSections();
  if(typeof flushTxQueue === 'function') flushTxQueue();
});

// Fetch with timeout to avoid infinite hang
async function sbFetchWithTimeout(fn, ms=8000){
  return Promise.race([
    fn(),
    new Promise((_,reject)=>setTimeout(()=>reject(new Error('timeout')), ms))
  ]);
}

async function loadData(){
  if(!currentUser || isDemoMode) return;
  // Show cached data instantly
  try{ const cached=localStorage.getItem(cacheKey()); if(cached){ data=JSON.parse(cached); } }catch(e){}
  // Старые ключи переводим в новый формат сразу, ещё до обращения к сети:
  // иначе при недоступном сервере отметки выглядели бы пропавшими.
  ensureHabitIds();
  let migration = migrateLocalKeys();
  render();
  setSyncStatus('синхронизация...');
  try{
    // Load habit list first
    try{
      const settingsRes = await sbFetchWithTimeout(()=>
        sb.from('user_settings').select('value').eq('user_id', currentUser.id).eq('key','habits').maybeSingle()
      );
      if(settingsRes.data && settingsRes.data.value){
        const serverHabits = JSON.parse(settingsRes.data.value);
        if(Array.isArray(serverHabits) && serverHabits.length) HABITS = serverHabits;
      }
    }catch(e){ /* список привычек останется локальным — не критично */ }

    // Список с сервера мог прийти без id — проставляем те же legacy-N.
    const habitsChanged = ensureHabitIds();
    localStorage.setItem('customHabits', JSON.stringify(HABITS));

    // Load checkbox data
    const res = await sbFetchWithTimeout(()=>
      sb.from('habits').select('id,done').eq('user_id', currentUser.id)
    );
    if(res.error){ setSyncStatus('ошибка: '+res.error.message, false); return; }

    // Серверные данные накатываем поверх кэша, но НЕ трогаем ключи,
    // которые ещё лежат в очереди на отправку — локальное новее.
    const pending = queueRead();
    (res.data||[]).forEach(r=>{
      if(r.id in pending) return;
      if(r.done === true) data[r.id] = true; else delete data[r.id];
    });
    localStorage.setItem(cacheKey(), JSON.stringify(data));

    // Числа количественных привычек лежат отдельно от галочек.
    await loadValuesFromServer();

    // С сервера могли прийти старые ключи — переносим и их.
    const serverMigration = migrateLocalKeys();
    if(serverMigration){
      if(migration){
        Object.assign(serverMigration.moved, migration.moved);
        serverMigration.legacy = serverMigration.legacy.concat(migration.legacy);
      }
      migration = serverMigration;
    }
    if(migration) await pushMigration(migration);
    if(habitsChanged) await saveHabitsToServer();

    // Остальные разделы: цели, список ста, принципы, цитаты и операции.
    // Их сбой не должен ломать загрузку привычек, поэтому они грузятся
    // после и каждый молча откатывается на локальную копию.
    await loadSections();
    await loadTransactions();

    setSyncStatus('синхронизировано ✓', true);
    renderCurrent();
    flushQueue();
  }catch(e){
    setSyncStatus(e.message==='timeout'?'таймаут — используем кэш':'нет сети', false);
    updatePendingBadge();
  }
}

// ── МИГРАЦИЯ НА ПОСТОЯННЫЕ ID ────────────────────────────────────────────
// Раньше ключ отметки был «год/месяц/день/индекс_в_массиве», поэтому
// удаление или перетаскивание привычки сдвигало всю историю на соседнюю.
// Теперь в ключе стоит id привычки. Старые ключи (последний сегмент —
// число) один раз переносим на новые по текущему порядку списка.
// Привычка без id — из версии, где id вообще не было. Её прежний номер
// в списке и есть её identity, поэтому id детерминированный: legacy-N.
// Благодаря этому локальный и серверный списки сходятся к одним и тем же
// идентификаторам, в каком бы порядке они ни загрузились.
function ensureHabitIds(){
  let changed = false;
  HABITS.forEach((h, i)=>{ if(!h.id){ h.id = 'legacy-' + i; changed = true; } });
  return changed;
}

function isLegacyKey(k){
  const parts = String(k).split('/');
  return parts.length === 4 && /^\d+$/.test(parts[3]);
}

// Локальный перенос старых ключей. Делается независимо от сети — иначе
// без сервера отметки просто не нашлись бы и выглядели бы потерянными.
// Возвращает пары «новый ключ → значение» и список старых ключей.
function migrateLocalKeys(){
  const legacy = Object.keys(data).filter(isLegacyKey);
  if(!legacy.length) return null;

  const moved = {};
  legacy.forEach(k=>{
    const p = k.split('/');
    moved[p[0]+'/'+p[1]+'/'+p[2]+'/legacy-'+p[3]] = data[k];
    delete data[k];
  });
  Object.assign(data, moved);
  try{ localStorage.setItem(cacheKey(), JSON.stringify(data)); }catch(e){}
  return {moved, legacy};
}

// Серверная часть переноса: записать новые строки, удалить старые.
// Если не получится — новые ключи уходят в очередь и досылаются позже.
async function pushMigration(result){
  if(!result || !currentUser || isDemoMode) return;
  const {moved, legacy} = result;
  setSyncStatus('переносим историю...');
  try{
    const rows = Object.keys(moved).filter(k=>moved[k] === true).map(k=>({
      id:k, user_id:currentUser.id, done:true, updated_at:new Date().toISOString()
    }));
    for(let i=0; i<rows.length; i+=400){
      const res = await sbFetchWithTimeout(()=>
        sb.from('habits').upsert(rows.slice(i, i+400), {onConflict:'id,user_id'}), 20000);
      if(res.error) throw new Error(res.error.message);
    }
    for(let i=0; i<legacy.length; i+=400){
      const res = await sbFetchWithTimeout(()=>
        sb.from('habits').delete().eq('user_id', currentUser.id)
          .in('id', legacy.slice(i, i+400)), 20000);
      if(res.error) throw new Error(res.error.message);
    }
    toast('История перенесена на новый формат: ' + Object.keys(moved).length + ' отметок');
  }catch(e){
    Object.keys(moved).forEach(k=>queueAdd(k, moved[k] === true));
    setSyncStatus('перенос завершится при следующей синхронизации', false);
  }
}

async function saveEntry(k, val){
  if(!currentUser || isDemoMode) return;
  // Save locally first — instant feedback
  localStorage.setItem(cacheKey(), JSON.stringify(data));
  setSyncStatus('сохранение...');
  try{
    // Снятая галочка удаляет строку, а не пишет done:false —
    // иначе таблица растёт вдвое против нужного.
    const res = val
      ? await sbFetchWithTimeout(()=>
          sb.from('habits').upsert(
            {id:k, user_id:currentUser.id, done:true, updated_at:new Date().toISOString()},
            {onConflict:'id,user_id'}
          ))
      : await sbFetchWithTimeout(()=>
          sb.from('habits').delete().eq('user_id', currentUser.id).eq('id', k));

    if(res.error){
      queueAdd(k, val);
      setSyncStatus('ошибка: '+res.error.message, false);
      return;
    }
    setSyncStatus('сохранено ✓', true);
    setTimeout(()=>{ if(queueSize() === 0) setSyncStatus('',false); else updatePendingBadge(); }, 2000);
  }catch(e){
    // Нет сети или таймаут — кладём в очередь, досылка при возврате связи.
    queueAdd(k, val);
    setSyncStatus('сохранено локально, отправим позже', false);
  }
}

// Realtime: push changes from other devices instantly
let realtimeChannel = null;
function subscribeRealtime(){
  if(realtimeChannel) sb.removeChannel(realtimeChannel);
  realtimeChannel = sb.channel('habits_changes')
    .on('postgres_changes',
      {event:'*', schema:'public', table:'habits', filter:'user_id=eq.'+currentUser.id},
      payload=>{
        const r = payload.new || payload.old;
        if(!r) return;
        // Ключи из очереди не трогаем — там наши, ещё не отправленные изменения.
        if(r.id in queueRead()) return;
        if(payload.eventType === 'DELETE' || r.done !== true) delete data[r.id];
        else data[r.id] = true;
        localStorage.setItem(cacheKey(), JSON.stringify(data));
        setSyncStatus('обновлено ✓', true);
        render();
        setTimeout(()=>setSyncStatus('',false), 2000);
      }
    )
    .subscribe();
}

// ── THEME ─────────────────────────────────────────────────────────────────
let isDark = false;
function toggleTheme(){
  isDark=!isDark;
  document.documentElement.setAttribute('data-theme',isDark?'dark':'light');
  document.getElementById('theme-btn').textContent=isDark?'☀️':'🌙';
  localStorage.setItem('theme',isDark?'dark':'light');
  if(typeof buildStars === 'function') buildStars();
}

// ── ЗВУК ──────────────────────────────────────────────────────────────────
// Звук включён по умолчанию, но теперь его можно выключить: раньше каждая
// галочка играла аккорд, а переключателя не было вовсе.
let soundOn = true;

function applySoundBtn(){
  const b = document.getElementById('sound-btn');
  if(!b) return;
  b.textContent = soundOn ? '🔔' : '🔕';
  b.title = soundOn ? 'Звук включён' : 'Звук выключен';
  b.setAttribute('aria-pressed', soundOn ? 'true' : 'false');
}

function toggleSound(){
  soundOn = !soundOn;
  try{ localStorage.setItem('soundOn', soundOn ? '1' : '0'); }catch(e){}
  applySoundBtn();
  toast(soundOn ? 'Звук включён' : 'Звук выключен');
  if(soundOn) magicSound('view');
}

function initSound(){
  let saved = null;
  try{ saved = localStorage.getItem('soundOn'); }catch(e){}
  soundOn = saved === null ? true : saved === '1';
  applySoundBtn();
}

// ── NAVIGATION ────────────────────────────────────────────────────────────
let view='week', offset=0;
// Дата пересчитывается, а не фиксируется на момент загрузки: вкладка,
// оставленная открытой вечером, после полуночи должна показывать новый день.
let today = new Date();
let ty = today.getFullYear(), tm = today.getMonth(), td = today.getDate();

function refreshToday(){
  const now = new Date();
  const changed = now.getDate() !== td || now.getMonth() !== tm || now.getFullYear() !== ty;
  today = now; ty = now.getFullYear(); tm = now.getMonth(); td = now.getDate();
  return changed;
}
// Проверяем раз в минуту и при каждом возврате на вкладку.
setInterval(()=>{ if(refreshToday()) render(); }, 60000);
document.addEventListener('visibilitychange', ()=>{
  if(!document.hidden && refreshToday()) render();
});
const DOW=['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];
const MON_S=['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'];
const MON_F=['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];

function setView(v){ view=v; offset=0; localStorage.setItem('view',v); render(); }
function navigate(d){ if(view==='year') return; offset+=d; render(); }

// ── СВАЙПЫ ────────────────────────────────────────────────────────────────
// На телефоне листать недели маленькими стрелками в шапке неудобно.
// Свайп внутри горизонтальных лент (месяц, год) не перехватываем — там
// он двигает саму ленту.
(function initSwipe(){
  let x0 = null, y0 = null, inScroller = false;
  const app = document.getElementById('main-app');
  if(!app) return;

  app.addEventListener('touchstart', e=>{
    if(e.touches.length !== 1){ x0 = null; return; }
    inScroller = !!e.target.closest('.month-scroll, .year-scroll');
    x0 = e.touches[0].clientX;
    y0 = e.touches[0].clientY;
  }, {passive:true});

  app.addEventListener('touchend', e=>{
    if(x0 === null || inScroller || view === 'year') return;
    const t = e.changedTouches[0];
    const dx = t.clientX - x0, dy = t.clientY - y0;
    x0 = null;
    // Порог по X и требование, чтобы жест был именно горизонтальным.
    if(Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.6) return;
    navigate(dx < 0 ? 1 : -1);
    magicSound('nav');
  }, {passive:true});
})();
function getDIM(y,m){ return new Date(y,m+1,0).getDate(); }

function getViewDays(){
  // «Сегодня» — один день: список того, что осталось на сейчас, без сетки
  // за неделю. Именно за этим открывают приложение вечером.
  if(view==='today'){
    const d = new Date(ty, tm, td);
    return [{y: ty, m: tm, d: td, date: d}];
  }
  if(view==='year'){
    // Скользящее окно в 365 дней: у годового вида нет «предыдущего года»,
    // стрелки для него скрыты.
    const out = [];
    const cur = new Date(ty, tm, td);
    cur.setDate(cur.getDate() - 364);
    for(let i = 0; i < 365; i++){
      out.push(dayObj(cur));
      cur.setDate(cur.getDate() + 1);
    }
    return out;
  }
  if(view==='week'){
    const base=new Date(ty,tm,td); base.setDate(base.getDate()+offset*7);
    const mon=new Date(base); const dow=mon.getDay()||7; mon.setDate(mon.getDate()-dow+1);
    return Array.from({length:7},(_,i)=>{ const d=new Date(mon); d.setDate(d.getDate()+i); return {y:d.getFullYear(),m:d.getMonth(),d:d.getDate(),date:d}; });
  }
  const base=new Date(ty,tm+offset,1); const y=base.getFullYear(),m=base.getMonth();
  return Array.from({length:getDIM(y,m)},(_,i)=>{ const date=new Date(y,m,i+1); return {y,m,d:i+1,date}; });
}

function isToday(day){ return day.y===ty&&day.m===tm&&day.d===td; }
function isFuture(day){ return new Date(day.y,day.m,day.d)>new Date(ty,tm,td); }

function navTitle(days){
  if(view==='today') return 'Сегодня';
  if(view==='year') return 'Последние 12 месяцев';
  if(view==='week'){ const f=days[0],l=days[6]; return f.m===l.m?f.d+'–'+l.d+' '+MON_F[f.m]:f.d+' '+MON_F[f.m].slice(0,3)+' – '+l.d+' '+MON_F[l.m].slice(0,3); }
  const b=new Date(ty,tm+offset,1); return MON_F[b.getMonth()]+' '+b.getFullYear();
}
