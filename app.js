
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
  document.getElementById('demo-banner').style.display = 'none';
  showScreen('auth');
}

function enterDemo(){
  isDemoMode = true;
  currentUser = null;
  HABITS = cloneDefaults();
  seedDemoData();
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
  render();
  setSyncStatus('демо — данные не сохраняются', false);
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
    '<button class="ep-emoji" onclick="pickEmoji(\''+e+'\')" title="'+e+'">'+e+'</button>'
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

window.addEventListener('online', flushQueue);
document.addEventListener('visibilitychange', ()=>{ if(!document.hidden) flushQueue(); });

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

    setSyncStatus('синхронизировано ✓', true);
    render();
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
  if(view==='year') return 'Последние 12 месяцев';
  if(view==='week'){ const f=days[0],l=days[6]; return f.m===l.m?f.d+'–'+l.d+' '+MON_F[f.m]:f.d+' '+MON_F[f.m].slice(0,3)+' – '+l.d+' '+MON_F[l.m].slice(0,3); }
  const b=new Date(ty,tm+offset,1); return MON_F[b.getMonth()]+' '+b.getFullYear();
}

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

// Ждём ли мы отметку в этот день. Для «N раз в неделю» плановых дней нет —
// подходит любой, поэтому такие дни не помечаем как внеплановые.
function isPlannedDay(h, day){
  const s = habitSchedule(h);
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
function renderStats(days){
  const list = activeHabits();
  let done = 0, planned = 0, fullDays = 0, countedDays = 0;

  days.filter(d => !isFuture(d)).forEach(day=>{
    const due = list.filter(h => isPlannedDay(h, day));
    if(!due.length) return;
    countedDays++;
    let all = true;
    due.forEach(h=>{
      planned++;
      if(data[dkey(day.y, day.m, day.d, h.id)]) done++; else all = false;
    });
    if(all) fullDays++;
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
    {num: fullDays + '<span class="stat-of"> из ' + countedDays + '</span>', label: 'Дней закрыто'}
  ];
  document.getElementById('stats-row').innerHTML = cards.map(s=>
    '<div class="stat"><div class="stat-num">'+s.num+'</div><div class="stat-label">'+s.label+'</div></div>'
  ).join('');

  const per = document.getElementById('stats-period');
  if(per) per.textContent = view === 'week' ? 'за эту неделю'
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
  ['week','month','year'].forEach(v=>{
    const b = document.getElementById('btn-'+v);
    if(!b) return;
    b.className = 'view-btn' + (view===v ? ' active' : '');
    b.setAttribute('aria-selected', view===v ? 'true' : 'false');
  });
  // У годового вида окно всегда одно — последние 12 месяцев, листать нечего.
  const isYear = view === 'year';
  document.getElementById('btn-prev').style.visibility = isYear ? 'hidden' : '';
  document.getElementById('btn-next').style.visibility = isYear ? 'hidden' : '';

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
        '<button class="btn btn-primary" onclick="openModal()">Добавить привычку</button>'+
      '</div>';
    return;
  }

  if(view==='week') renderWeek(days);
  else if(view==='month') renderMonth(days);
  else renderYear();
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
  if(document.getElementById('edit-modal').classList.contains('open')) closeModal();
  const crop = document.getElementById('crop-overlay');
  if(crop) crop.remove();
});

// Фокус не уходит из открытой модалки: иначе табом попадаешь на элементы
// под ней, не понимая, где находишься.
document.addEventListener('keydown', e=>{
  if(e.key !== 'Tab') return;
  const m = document.getElementById('edit-modal');
  if(!m.classList.contains('open')) return;
  const items = m.querySelectorAll('button, input, select, [tabindex]:not([tabindex="-1"])');
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
    let extra = '<select class="edit-select" onchange="setSchedType('+i+',this.value)" aria-label="Как часто">'+
        '<option value="daily"'         +(s.type==='daily'?' selected':'')+         '>каждый день</option>'+
        '<option value="weekdays"'      +(s.type==='weekdays'?' selected':'')+      '>по дням недели</option>'+
        '<option value="times_per_week"'+(s.type==='times_per_week'?' selected':'')+'>раз в неделю</option>'+
      '</select>';

    if(s.type === 'weekdays'){
      extra += '<span class="dow-pick">' + [1,2,3,4,5,6,0].map(d=>
        '<button type="button" class="dow-btn'+(s.days.indexOf(d)!==-1?' on':'')+'"'+
        ' onclick="toggleDow('+i+','+d+')" aria-pressed="'+(s.days.indexOf(d)!==-1?'true':'false')+'"'+
        ' aria-label="'+DOW_SHORT[d]+'">'+DOW_SHORT[d]+'</button>'
      ).join('') + '</span>';
    } else if(s.type === 'times_per_week'){
      extra += '<input class="edit-num" type="number" min="1" max="7" value="'+s.n+'"'+
        ' onchange="setSchedTimes('+i+',this.value)" aria-label="Сколько раз в неделю">'+
        '<span class="hint">раз в неделю</span>';
    }

    extra += '<input class="edit-num" type="number" min="0" max="999" value="'+(target||'')+'"'+
      ' placeholder="цель" onchange="setTarget('+i+',this.value)" aria-label="Цель за день">'+
      '<span class="hint">цель за день, если есть</span>';

    return '<div class="edit-row" draggable="true" data-idx="'+i+'" '+
         'ondragstart="dragStart(event,'+i+')" '+
         'ondragover="dragOver(event)" '+
         'ondrop="dragDrop(event,'+i+')" '+
         'ondragend="dragEnd(event)" '+
         'ondragleave="dragLeave(event)">'+
      '<span class="drag-handle" title="Перетащи чтобы изменить порядок">⋮⋮</span>'+
      '<button class="edit-icon-btn" onclick="openEmojiPicker('+i+',this)" title="Выбрать эмодзи" aria-label="Выбрать эмодзи">'+esc(h.icon)+'</button>'+
      '<input class="edit-input" value="'+esc(h.name)+'" oninput="editBuffer['+i+'].name=this.value" maxlength="30" aria-label="Название привычки">'+
      '<button class="arch-btn" onclick="archiveHabit('+i+')" title="Убрать в архив вместе с историей">В архив</button>'+
      '<button class="del-btn" onclick="removeHabit('+i+')" title="Удалить" aria-label="Удалить привычку">✕</button>'+
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
      '<button class="arch-btn" onclick="unarchiveHabit('+i+')">Вернуть</button>'+
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
  HABITS = editBuffer.map(cloneHabit);
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

// ── QUOTES ────────────────────────────────────────────────────────────────
const QUOTES=[
  {text:'Мы — это то, что мы делаем постоянно. Совершенство — не действие, а привычка.',author:'Аристотель'},
  {text:'Маленькие ежедневные улучшения — ключ к результатам, которые потрясают.',author:'Робин Шарма'},
  {text:'Дисциплина — это мост между целями и достижениями.',author:'Джим Рон'},
  {text:'Победи утро — победишь день.',author:'Робин Шарма'},
  {text:'Не нужно быть великим, чтобы начать. Но нужно начать, чтобы стать великим.',author:'Зиг Зиглар'},
  {text:'Каждый день — это новый шанс изменить свою жизнь.',author:''},
  {text:'Успех — это сумма небольших усилий, повторяемых день за днём.',author:'Роберт Кольер'},
  {text:'Тело достигает того, во что верит разум.',author:''},
  {text:'Сначала ты формируешь привычки, потом привычки формируют тебя.',author:''},
  {text:'Мотивация заставляет начать. Привычка заставляет продолжать.',author:'Джим Рон'},
  {text:'Путь в тысячу миль начинается с одного шага.',author:'Лао-цзы'},
  {text:'Единственный способ делать великие дела — любить то, что делаешь.',author:'Стив Джобс'},
  {text:'Не считай дни — сделай так, чтобы дни считались.',author:'Мухаммед Али'},
  {text:'Каждое утро — это второй шанс.',author:''},
  {text:'Лучший проект, над которым ты когда-либо будешь работать — это ты сам.',author:''},
  {text:'Прогресс, а не совершенство.',author:''},
  {text:'Здоровье — это не всё, но без здоровья всё — ничто.',author:'Артур Шопенгауэр'},
  {text:'Инвестиции в знания приносят наибольший доход.',author:'Бенджамин Франклин'},
  {text:'Медитация — это не уход от жизни, а её более глубокое проживание.',author:''},
  {text:'Победитель — это просто мечтатель, который никогда не сдавался.',author:'Нельсон Мандела'},
  {text:'Стань тем изменением, которое хочешь видеть в мире.',author:'Махатма Ганди'},
  {text:'Твои привычки сегодня — это твоя биография завтра.',author:''},
  {text:'Твоя сила больше, чем ты думаешь.',author:''},
  {text:'Растяжка — это диалог с телом. Слушай его.',author:''},
  {text:'Тот, кто двигается вперёд — уже впереди.',author:''},
  {text:'Дисциплина — это выбор между тем, чего ты хочешь сейчас, и тем, чего хочешь больше всего.',author:''},
  {text:'Привычки — это невидимая архитектура повседневной жизни.',author:'Гретхен Рубин'},
  {text:'Каждое действие — это голос за того человека, которым ты хочешь стать.',author:'Джеймс Клир'},
  {text:'Вы не поднимаетесь до уровня своих целей. Вы опускаетесь до уровня своих систем.',author:'Джеймс Клир'},
  {text:'Небольшие привычки имеют большое значение. Это не вопрос скорости — это вопрос направления.',author:'Джеймс Клир'},
  {text:'Человек есть то, что он делает.',author:'Сартр'},
  {text:'Сосредоточься на том, что в твоей власти.',author:'Эпиктет'},
  {text:'Самое сложное — начать. Всё остальное — вопрос терпения и постоянства.',author:''},
  {text:'Великие дела состоят из маленьких, которые казались незначительными.',author:'Ван Гог'},
  {text:'Твоё тело — это единственное место, где тебе суждено жить всю жизнь.',author:''},
  {text:'Не ищи мотивацию. Создавай дисциплину.',author:''},
  {text:'Лучше сделать и пожалеть, чем не сделать и пожалеть.',author:'Марк Твен'},
  {text:'Настойчивость — не долгий забег. Это много коротких забегов, один за другим.',author:'Уолтер Эллиот'},
  {text:'Каждый день, в котором ты не учишься чему-то новому — потерянный день.',author:'Чарли Мангер'},
  {text:'Единственное, что стоит между тобой и твоей мечтой — это воля попробовать и вера в то, что это возможно.',author:'Джоэл Браун'},
  {text:'Мозг — как мышца. Чем больше тренируешь, тем сильнее он становится.',author:''},
  {text:'Спи хорошо, двигайся каждый день, ешь настоящую еду. Это не сложно — это основа.',author:''},
  {text:'Благодарность превращает то, что у нас есть, в достаточное.',author:''},
  {text:'Счастье — это не цель, это побочный эффект правильной жизни.',author:'Элеонора Рузвельт'},
  {text:'Чтение — это тренировка для ума, так же как физические упражнения — для тела.',author:'Стил'},
  {text:'Знание — сила.',author:'Фрэнсис Бэкон'},
  {text:'Живи так, как будто умрёшь завтра. Учись так, как будто будешь жить вечно.',author:'Махатма Ганди'},
  {text:'Сделай сегодня то, о чём завтра будешь рад.',author:''},
  {text:'Нет ничего невозможного. Само слово говорит: "Я возможно!"',author:'Одри Хепберн'},
  {text:'Ты ближе к цели, чем думаешь.',author:''},
  {text:'Неважно как медленно ты идёшь, главное — не останавливаться.',author:'Конфуций'},
  {text:'Начни с того, что необходимо. Потом сделай то, что возможно. И вдруг обнаружишь, что делаешь невозможное.',author:'Франциск Ассизский'},
  {text:'Препятствие — это не конец дороги, а поворот.',author:''},
  {text:'Всё, что тебе нужно — уже в тебе.',author:''},
  {text:'Сегодняшний день больше никогда не повторится. Используй его.',author:''},
  {text:'Маленький прогресс — всё равно прогресс.',author:''},
  {text:'Твои будущие достижения определяются твоими сегодняшними привычками.',author:''},
  {text:'Сон — это суперсила. Не жертвуй им.',author:''},
  {text:'Движение — это жизнь. Остановка — это смерть.',author:''},
  {text:'Язык открывает дверь в другой мир.',author:''},
  {text:'Каждое утро ты рождаешься заново. Важно то, что ты делаешь сегодня.',author:'Будда'},
  {text:'Потенциал — это одно. Реализация — совсем другое.',author:''},
  {text:'Сила воли — это мышца. Тренируй её каждый день.',author:''},
  {text:'Ты не обязан быть лучше всех. Ты обязан быть лучше, чем вчера.',author:''},
  {text:'Ограничения существуют только в уме.',author:''},
  {text:'Лучшее время посадить дерево было 20 лет назад. Второе лучшее время — сейчас.',author:'Китайская пословица'},
  {text:'Возможности не появляются сами. Их создают.',author:'Крис Гроссер'},
  {text:'Тот, кто не находит времени на здоровье, найдёт время на болезнь.',author:''},
  {text:'Спокойный ум важнее быстрого ума.',author:''},
  {text:'Хочешь изменить мир — начни с себя.',author:'Толстой'},
  {text:'Жизнь начинается там, где заканчивается зона комфорта.',author:'Нил Дональд Уолш'},
  {text:'Уверенность приходит не от постоянных успехов, а от умения оправляться после неудач.',author:''},
  {text:'Сделай шаг, и дорога появится сама.',author:''},
  {text:'Хороший сон — лучшая медитация.',author:'Далай Лама'},
  {text:'Твоё тело слышит всё, что говорит твой ум.',author:''},
  {text:'Движение лечит почти всё.',author:''},
  {text:'Читай. Думай. Действуй.',author:''},
  {text:'Язык — это окно в другую культуру.',author:''},
  {text:'AI — инструмент. Мудрость — твоя.',author:''},
  {text:'Будущее принадлежит тем, кто учится сегодня.',author:''},
  {text:'Тишина утра стоит больше шума дня.',author:''},
  {text:'Каждый шаг — это инвестиция в себя.',author:''},
  {text:'Твои привычки — твой характер.',author:''},
  {text:'Маленькие победы складываются в большую жизнь.',author:''},
  {text:'Не думай о том, сколько осталось. Думай о том, как сделать этот шаг.',author:''},
  {text:'Здоровье — это тихое богатство.',author:''},
  {text:'Думай медленно, действуй быстро.',author:''},
  {text:'Терпение и время делают больше, чем сила и страсть.',author:'Лафонтен'},
  {text:'Лучший способ предсказать своё будущее — создать его.',author:'Питер Друкер'},
  {text:'Знание без действия — это просто развлечение.',author:''},
    {text:'Никогда не поздно стать тем, кем ты мог бы быть.',author:'Джордж Элиот'},
  {text:'Самодисциплина — это высшая форма самолюбия.',author:''},
  {text:'Ты то, что ты делаешь повторно.',author:''},
  {text:'Один хороший день — это случайность. Тридцать — это привычка.',author:''},
  {text:'Усталость — это временно. Гордость за себя — навсегда.',author:''},
  {text:'Прямо сейчас ты достаточно хорош. Завтра станешь лучше.',author:''},
  {text:'Трудности делают тебя сильнее или раскрывают твою настоящую силу.',author:''},
  {text:'Каждая тренировка — это разговор с будущей версией себя.',author:''},
  {text:'Благодарность — это не слабость. Это суперсила.',author:''},
  {text:'Люди, которые говорят, что это невозможно, просто боятся попробовать.',author:''},
  {text:'Твоё завтра зависит от того, что ты делаешь сегодня.',author:''},
];
// Цитата дня, а не случайная при каждом входе: у всех она одна и та же
// в течение суток, и это маленький общий ритуал вместо шума.
function quoteOfTheDay(){
  const days = Math.floor(Date.UTC(ty, tm, td) / 86400000);
  return days % QUOTES.length;
}
let quoteIndex = quoteOfTheDay();
function renderQuote(){
  const q=QUOTES[quoteIndex];
  const te=document.getElementById('quote-text'),ae=document.getElementById('quote-author');
  te.style.opacity=ae.style.opacity='0';
  setTimeout(()=>{ te.textContent=q.text; ae.textContent=q.author?'— '+q.author:''; te.style.transition=ae.style.transition='opacity .4s'; te.style.opacity=ae.style.opacity='1'; },200);
}
function nextQuote(){ let n; do{n=Math.floor(Math.random()*QUOTES.length);}while(n===quoteIndex&&QUOTES.length>1); quoteIndex=n; renderQuote(); }

// ── MAGIC SOUNDS ──────────────────────────────────────────────────────────
const AC=new(window.AudioContext||window.webkitAudioContext)();
function resumeAC(){ if(AC.state==='suspended') AC.resume(); }
function magicSound(type){
  if(!soundOn) return;
  resumeAC(); const now=AC.currentTime;
  const node=(f,t,dur,gp,ge,st,fe)=>{ const o=AC.createOscillator(),g=AC.createGain(); o.type=t; o.frequency.setValueAtTime(f,st||now); if(fe) o.frequency.exponentialRampToValueAtTime(fe,(st||now)+dur*0.8); g.gain.setValueAtTime(0.001,st||now); g.gain.linearRampToValueAtTime(gp,(st||now)+0.02); g.gain.exponentialRampToValueAtTime(ge||(gp*0.001),(st||now)+dur); o.connect(g); g.connect(AC.destination); o.start(st||now); o.stop((st||now)+dur+0.01); };
  if(type==='nav'){ node(660,'sine',0.18,0.08,0.001,now,1100); node(990,'sine',0.14,0.05,0.001,now+0.06,1500); node(1320,'sine',0.10,0.03,0.001,now+0.11); }
  else if(type==='view'){ node(440,'triangle',0.22,0.07,0.001,now,880); node(880,'sine',0.18,0.04,0.001,now+0.04,440); node(2200,'sine',0.12,0.02,0.001,now+0.08); }
  else if(type==='edit'){ [0,0.06,0.12,0.18].forEach((delay,i)=>{ const freqs=[523,659,784,1047]; node(freqs[i],'sine',0.3,0.06,0.001,now+delay); }); }
}
document.getElementById('btn-prev').addEventListener('click',()=>magicSound('nav'));
document.getElementById('btn-next').addEventListener('click',()=>magicSound('nav'));
document.getElementById('btn-week').addEventListener('click',()=>magicSound('view'));
document.getElementById('btn-month').addEventListener('click',()=>magicSound('view'));
document.getElementById('edit-btn').addEventListener('click',()=>magicSound('edit'));

// ── CONFETTI ──────────────────────────────────────────────────────────────
function playCheer(big){
  if(!soundOn) return;
  resumeAC(); const now=AC.currentTime;
  // Magical chime: C major arpeggio + sparkly fairy dust ticks
  const notes = big
    ? [523.25, 659.25, 783.99, 1046.50, 1318.51, 1567.98]
    : [523.25, 659.25, 783.99, 1046.50];
  notes.forEach((freq, i)=>{
    const t = now + i * 0.05;
    const o = AC.createOscillator(), g = AC.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(big ? 0.14 : 0.10, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
    o.connect(g); g.connect(AC.destination);
    o.start(t); o.stop(t + 0.75);
    const o2 = AC.createOscillator(), g2 = AC.createGain();
    o2.type = 'triangle';
    o2.frequency.setValueAtTime(freq * 2, t);
    g2.gain.setValueAtTime(0.001, t);
    g2.gain.linearRampToValueAtTime(0.035, t + 0.02);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
    o2.connect(g2); g2.connect(AC.destination);
    o2.start(t); o2.stop(t + 0.5);
  });
  const tickCount = big ? 12 : 5;
  for(let s=0; s<tickCount; s++){
    const t = now + 0.05 + Math.random() * (big ? 0.6 : 0.3);
    const o = AC.createOscillator(), g = AC.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(2400 + Math.random() * 1600, t);
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.04, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    o.connect(g); g.connect(AC.destination);
    o.start(t); o.stop(t + 0.12);
  }
}
let animId=null;

function createFW(ctx,x,y,color){ return Array.from({length:32},()=>{ const a=Math.random()*Math.PI*2,sp=2.5+Math.random()*4; return {x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,r:2+Math.random()*2.5,color,opacity:1,trail:[]}; }); }
function launchConfetti(big){
  if(REDUCED_MOTION) return;
  const canvas=document.getElementById('confetti-canvas'); const ctx=canvas.getContext('2d');
  canvas.width=window.innerWidth; canvas.height=window.innerHeight;
  if(animId) cancelAnimationFrame(animId); playCheer(big);
  const colors=['#52B788','#7F77DD','#FF6B6B','#378ADD','#FFD700','#FF69B4','#00CFFF','#FFA500','#B8FF4F','#FF4FCF'];
  const N=big?380:90;
  const particles=Array.from({length:N},()=>{ const s=Math.random()>0.5; return {x:s?Math.random()*canvas.width*0.35:canvas.width*0.65+Math.random()*canvas.width*0.35,y:canvas.height+10,vx:(s?1:-1)*(1+Math.random()*4),vy:-(8+Math.random()*12),r:4+Math.random()*7,color:colors[Math.floor(Math.random()*colors.length)],tilt:Math.random()*Math.PI*2,tiltSpeed:(Math.random()-0.5)*0.2,gravity:0.25+Math.random()*0.15,opacity:1,shape:['rect','circle','star','ribbon'][Math.floor(Math.random()*4)],delay:Math.random()*(big?55:18)}; });
  let sparks=[]; const fwC=['#FFD700','#FF6B6B','#00CFFF','#B8FF4F','#FF4FCF','#FFA500'];
  if(big)[0,28,56,84,112].forEach((dl,i)=>setTimeout(()=>sparks.push(...createFW(ctx,canvas.width*(0.15+Math.random()*0.7),canvas.height*(0.08+Math.random()*0.35),fwC[i%fwC.length])),dl*16));
  const maxF=big?300:150; let frame=0;
  function drawStar(x,y,r,col,op){ ctx.save();ctx.globalAlpha=op;ctx.fillStyle=col;ctx.translate(x,y);ctx.beginPath();for(let i=0;i<5;i++){const a=i*4*Math.PI/5-Math.PI/2,ia=a+2*Math.PI/5;i===0?ctx.moveTo(Math.cos(a)*r,Math.sin(a)*r):ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r);ctx.lineTo(Math.cos(ia)*(r*0.4),Math.sin(ia)*(r*0.4));}ctx.closePath();ctx.fill();ctx.restore(); }
  function tick(){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    particles.forEach(p=>{ if(frame<p.delay)return; p.vy+=p.gravity;p.vx*=0.99;p.x+=p.vx;p.y+=p.vy;p.tilt+=p.tiltSpeed; if(frame>maxF*0.65)p.opacity-=0.018; if(p.opacity<=0||p.y>canvas.height+20)return; ctx.save();ctx.globalAlpha=Math.max(0,p.opacity);ctx.fillStyle=p.color;ctx.translate(p.x,p.y);ctx.rotate(p.tilt); if(p.shape==='circle'){ctx.beginPath();ctx.arc(0,0,p.r/2,0,Math.PI*2);ctx.fill();}else if(p.shape==='star'){ctx.restore();drawStar(p.x,p.y,p.r,p.color,Math.max(0,p.opacity));return;}else if(p.shape==='ribbon')ctx.fillRect(-p.r*0.3,-p.r,p.r*0.6,p.r*2);else ctx.fillRect(-p.r/2,-p.r/2,p.r,p.r*1.6);ctx.restore(); });
    sparks.forEach(s=>{ s.trail.push({x:s.x,y:s.y});if(s.trail.length>6)s.trail.shift();s.x+=s.vx;s.y+=s.vy;s.vy+=0.12;s.vx*=0.98;s.opacity-=0.018;if(s.opacity<=0)return;s.trail.forEach((pt,ti)=>{ctx.beginPath();ctx.arc(pt.x,pt.y,s.r*(ti/s.trail.length)*0.6,0,Math.PI*2);ctx.fillStyle=s.color;ctx.globalAlpha=s.opacity*(ti/s.trail.length)*0.4;ctx.fill();});ctx.beginPath();ctx.arc(s.x,s.y,s.r,0,Math.PI*2);ctx.fillStyle=s.color;ctx.globalAlpha=Math.max(0,s.opacity);ctx.fill();ctx.globalAlpha=1; });
    sparks=sparks.filter(s=>s.opacity>0);
    frame++;
    if(frame<maxF||sparks.length>0) animId=requestAnimationFrame(tick);
    else{ctx.clearRect(0,0,canvas.width,canvas.height);animId=null;}
  }
  tick();
}

// ── USER AVATAR ──────────────────────────────────────────────────────────────
function uploadAvatar(e){
  const file = e.target.files[0]; if(!file) return;
  const reader = new FileReader();
  reader.onload = ev=>{
    document.getElementById('user-menu').classList.remove('open');
    showCropUI(ev.target.result);
  };
  reader.readAsDataURL(file);
}

function showCropUI(src){
  // Remove existing
  const old = document.getElementById('crop-overlay'); if(old) old.remove();
  const overlay = document.createElement('div');
  overlay.id = 'crop-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:9000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px';
  overlay.innerHTML = `
    <div style="color:#fff;font-size:15px;font-family:var(--sans)">Выберите область фото</div>
    <div style="position:relative;user-select:none" id="crop-wrap">
      <img id="crop-img" src="${src}" style="max-width:min(90vw,500px);max-height:60vh;display:block">
      <div id="crop-box" style="position:absolute;border:2px solid #fff;box-shadow:0 0 0 9999px rgba(0,0,0,.5);cursor:move;aspect-ratio:1"></div>
    </div>
    <div style="display:flex;gap:12px">
      <button onclick="document.getElementById('crop-overlay').remove()" style="padding:10px 24px;border-radius:10px;border:1px solid rgba(255,255,255,.3);background:none;color:#fff;cursor:pointer;font-family:var(--sans)">Отмена</button>
      <button onclick="cropAndSave()" style="padding:10px 24px;border-radius:10px;border:none;background:var(--accent);color:#fff;cursor:pointer;font-family:var(--sans);font-weight:500">Сохранить</button>
    </div>`;
  document.body.appendChild(overlay);

  // Init crop box after image loads
  const img = document.getElementById('crop-img');
  img.onload = initCrop;
  if(img.complete) initCrop();
}

function initCrop(){
  const img = document.getElementById('crop-img');
  const wrap = document.getElementById('crop-wrap');
  const box = document.getElementById('crop-box');
  wrap.style.width = img.offsetWidth+'px';
  wrap.style.height = img.offsetHeight+'px';
  const size = Math.min(img.offsetWidth, img.offsetHeight) * 0.7;
  let bx = (img.offsetWidth - size)/2, by = (img.offsetHeight - size)/2;
  const setBox = ()=>{ box.style.left=bx+'px'; box.style.top=by+'px'; box.style.width=size+'px'; box.style.height=size+'px'; };
  setBox();
  // Drag
  let drag=false, ox=0, oy=0;
  box.addEventListener('mousedown', e=>{ drag=true; ox=e.clientX-bx; oy=e.clientY-by; e.preventDefault(); });
  box.addEventListener('touchstart', e=>{ drag=true; ox=e.touches[0].clientX-bx; oy=e.touches[0].clientY-by; e.preventDefault(); },{passive:false});
  const move = (cx,cy)=>{ if(!drag)return; bx=Math.max(0,Math.min(img.offsetWidth-size, cx-ox)); by=Math.max(0,Math.min(img.offsetHeight-size, cy-oy)); setBox(); };
  document.addEventListener('mousemove', e=>move(e.clientX,e.clientY));
  document.addEventListener('touchmove', e=>move(e.touches[0].clientX,e.touches[0].clientY),{passive:true});
  document.addEventListener('mouseup', ()=>drag=false);
  document.addEventListener('touchend', ()=>drag=false);
}

function cropAndSave(){
  const img = document.getElementById('crop-img');
  const box = document.getElementById('crop-box');
  const scaleX = img.naturalWidth / img.offsetWidth;
  const scaleY = img.naturalHeight / img.offsetHeight;
  const sx = parseFloat(box.style.left) * scaleX;
  const sy = parseFloat(box.style.top) * scaleY;
  const sw = parseFloat(box.style.width) * scaleX;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 120;
  canvas.getContext('2d').drawImage(img, sx, sy, sw, sw, 0, 0, 120, 120);
  const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
  localStorage.setItem('customAvatar', dataUrl);
  applyAvatar(dataUrl);
  document.getElementById('crop-overlay').remove();
}

function applyAvatar(src){
  const av = document.getElementById('user-avatar');
  av.style.backgroundImage = 'url('+src+')';
  av.style.backgroundSize = 'cover';
  av.style.backgroundPosition = 'center';
  av.style.color = 'transparent';
}

function setUserAvatar(user){
  const av = document.getElementById('user-avatar');
  const menu = document.getElementById('user-menu');
  Array.from(av.childNodes).forEach(n=>{ if(n.nodeType===3) av.removeChild(n); });
  const initial = (user.user_metadata?.full_name || user.email || '?')[0].toUpperCase();
  av.insertBefore(document.createTextNode(initial), menu);
  av.style.backgroundImage = '';
  av.style.color = '#fff';
  const customAvatar = localStorage.getItem('customAvatar');
  if(customAvatar){ applyAvatar(customAvatar); document.getElementById('user-email-display').textContent = user.email || ''; return; }
  // Find Google profile picture across all possible Supabase fields
  const pic = user.user_metadata?.avatar_url
          || user.user_metadata?.picture
          || user.identities?.[0]?.identity_data?.avatar_url
          || user.identities?.[0]?.identity_data?.picture
          || null;
  if(pic){
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = ()=>{ av.style.backgroundImage = 'url("'+pic+'")'; av.style.backgroundSize = 'cover'; av.style.backgroundPosition = 'center'; av.style.color = 'transparent'; };
    img.onerror = ()=>{ av.style.backgroundImage = ''; av.style.color = '#fff'; };
    img.src = pic;
  }
  document.getElementById('user-email-display').textContent = user.email || '';
}

// ── ЭКСПОРТ И ИМПОРТ ──────────────────────────────────────────────────────
// Пользователь должен иметь возможность забрать свои данные и перенести их.
function exportData(){
  document.getElementById('user-menu').classList.remove('open');
  const payload = {
    format: 'habit-tracker',
    version: 3,
    exportedAt: new Date().toISOString(),
    email: (currentUser && currentUser.email) || null,
    habits: HABITS,          // вместе с графиком, целью и признаком архива
    marks: data,
    values: marksValues      // числа количественных привычек
  };
  try{
    const blob = new Blob([JSON.stringify(payload, null, 2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const d = new Date();
    const stamp = d.getFullYear() + '-' +
      String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
    a.href = url;
    a.download = 'privychki-' + stamp + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(url), 1000);
    toast('Файл сохранён: ' + Object.keys(data).length + ' отметок');
  }catch(e){
    toast('Не удалось сохранить файл', true);
  }
}

function importData(e){
  const file = e.target.files && e.target.files[0];
  e.target.value = '';
  if(!file) return;
  document.getElementById('user-menu').classList.remove('open');
  const reader = new FileReader();
  reader.onload = async ev=>{
    let payload;
    try{ payload = JSON.parse(ev.target.result); }
    catch(err){ toast('Это не файл с данными трекера', true); return; }

    if(!payload || typeof payload !== 'object' || !payload.marks){
      toast('В файле нет отметок — проверьте, тот ли это файл', true);
      return;
    }
    const incoming = Object.keys(payload.marks).filter(k => payload.marks[k] === true);
    const hasHabits = Array.isArray(payload.habits) && payload.habits.length;
    if(!confirm('Загрузить ' + incoming.length + ' отметок' +
                (hasHabits ? ' и ' + payload.habits.length + ' привычек' : '') +
                '?\n\nОни добавятся к текущим данным, ничего не удалится.')) return;

    if(hasHabits){
      // Привычки без id получают его здесь же, дубликаты по id не плодим.
      const known = new Set(HABITS.map(h=>h.id));
      payload.habits.forEach(h=>{
        if(!h || !h.name) return;
        if(!h.id) h.id = newHabitId();
        if(!known.has(h.id)){ HABITS.push(h); known.add(h.id); }
      });
      localStorage.setItem('customHabits', JSON.stringify(HABITS));
    }

    incoming.forEach(k=>{ data[k] = true; queueAdd(k, true); });
    localStorage.setItem(cacheKey(), JSON.stringify(data));

    // Числа количественных привычек из файла версии 3 и выше.
    let vals = 0;
    if(payload.values && typeof payload.values === 'object'){
      Object.keys(payload.values).forEach(k=>{
        const v = payload.values[k];
        if(typeof v === 'number' && v > 0){ marksValues[k] = v; vals++; }
      });
      try{ localStorage.setItem(valuesKey(), JSON.stringify(marksValues)); }catch(e){}
    }

    render();
    toast('Загружено ' + incoming.length + ' отметок' + (vals ? ' и ' + vals + ' значений' : ''));

    if(currentUser && !isDemoMode){
      if(hasHabits) await saveHabitsToServer();
      if(vals) await saveValuesToServer();
      await flushQueue();
    }
  };
  reader.onerror = ()=>toast('Не удалось прочитать файл', true);
  reader.readAsText(file);
}

// ── INIT ──────────────────────────────────────────────────────────────────
(async()=>{
  // Theme
  const t=localStorage.getItem('theme');
  if(t==='dark'){isDark=true;document.documentElement.setAttribute('data-theme','dark');document.getElementById('theme-btn').textContent='☀️';}
  // Выбранный вид уважаем и на телефоне; неделя — только если выбора не было.
  const savedView = localStorage.getItem('view');
  view = (savedView === 'week' || savedView === 'month' || savedView === 'year')
    ? savedView
    : 'week';
  let stored = null;
  try{ stored = JSON.parse(localStorage.getItem('customHabits')||'null'); }catch(e){}
  HABITS = (Array.isArray(stored) && stored.length) ? stored : cloneDefaults();
  ensureHabitIds();
  try{ marksValues = JSON.parse(localStorage.getItem(valuesKey()) || '{}'); }catch(e){ marksValues = {}; }
  initSound();
  buildEmojiPicker();
  renderQuote();

  // Service worker — офлайн-режим и запуск с домашнего экрана.
  if('serviceWorker' in navigator){
    navigator.serviceWorker.register('/sw.js').catch(()=>{ /* офлайн просто не включится */ });
  }

  // Auth state listener
  sb.auth.onAuthStateChange(async(event, session)=>{
    if(event === 'SIGNED_OUT'){
      currentUser = null;
      data = {};
      showScreen('auth');
      return;
    }
    if(event === 'SIGNED_IN' && session && session.user){
      // Only reload data if different user or first login
      const isNewUser = !currentUser || currentUser.id !== session.user.id;
      currentUser = session.user;
      setUserAvatar(currentUser);
      if(isNewUser){
        // Clear previous user's cached habits before loading new user's data
        data = {};
        HABITS = cloneDefaults();
        localStorage.removeItem('customHabits');
      }
      showScreen('app');
      render();
      if(isNewUser){ await loadData(); subscribeRealtime(); }
    }
    if(event === 'TOKEN_REFRESHED' && session){
      currentUser = session.user;
    }
  });

  // Check existing session on load
  const {data:{session}} = await sb.auth.getSession();
  // Now safe to clear hash — Supabase already read the token
  if(window.location.hash && window.location.hash.includes('access_token')){
    history.replaceState(null, '', window.location.pathname);
  }
  if(session && session.user){
    currentUser = session.user;
    setUserAvatar(currentUser);
    // Reset to defaults — loadData will fill from server
    data = {};
    HABITS = cloneDefaults();
    showScreen('app');
    render();
    await loadData();
    subscribeRealtime();
  } else {
    showScreen('auth');
  }
})();

/* ═══════════════ ✨ DISNEY MAGIC — JS ═══════════════ */
(function magic(){
  // При включённой системной настройке «уменьшить движение» декоративный
  // слой не создаём вовсе — он же и самый тяжёлый для слабых устройств.
  if(REDUCED_MOTION) return;

  document.body.classList.add('magic-cursor');

  // Искорки за курсором. На сенсорных экранах курсора нет, поэтому там
  // обработчик не вешаем — иначе он впустую создаёт DOM при прокрутке.
  const hasCursor = !(window.matchMedia && window.matchMedia('(hover: none)').matches);

  let lastSpark = 0;
  if(hasCursor) document.addEventListener('mousemove', function(e){
    const now = Date.now();
    if(now - lastSpark < 60) return;
    lastSpark = now;
    if(Math.random() > 0.45) return;
    const s = document.createElement('div');
    s.className = 'spark';
    s.style.left = (e.clientX + (Math.random()*8-4)) + 'px';
    s.style.top  = (e.clientY + (Math.random()*8-4)) + 'px';
    s.style.width = s.style.height = (4 + Math.random()*6) + 'px';
    document.body.appendChild(s);
    setTimeout(function(){ s.remove(); }, 1000);
  });

  // Sparkle в шапке
  setTimeout(function(){
    const h = document.querySelector('.header h1');
    if(h && !h.classList.contains('app-title')) h.classList.add('app-title');
  }, 200);
})();

// Ночные звёздочки для тёмной темы. Раньше слой строился, но никогда не
// показывался: стили ждали класс dark на body, а тема ставит data-theme
// на html. Теперь звёзды перестраиваются при переключении темы напрямую.
function buildStars(){
  if(REDUCED_MOTION) return;
  let layer = document.querySelector('.night-stars');
  if(!layer){
    layer = document.createElement('div');
    layer.className = 'night-stars';
    document.body.appendChild(layer);
  }
  // В светлой теме слой скрыт стилями — незачем держать в нём узлы.
  if(document.documentElement.getAttribute('data-theme') !== 'dark'){
    layer.innerHTML = '';
    return;
  }
  layer.innerHTML = '';
  for(let i=0;i<40;i++){
    const star = document.createElement('div');
    star.className = 'night-star';
    const sz = 1 + Math.random()*2.2;
    star.style.width = star.style.height = sz + 'px';
    star.style.left = (Math.random()*100) + '%';
    star.style.top  = (Math.random()*100) + '%';
    star.style.animationDelay = (Math.random()*3) + 's';
    star.style.animationDuration = (2 + Math.random()*3) + 's';
    layer.appendChild(star);
  }
}
buildStars();

