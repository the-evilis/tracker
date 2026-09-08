/* app-init.js — Запуск приложения и декоративный слой.
   Часть приложения. Файлы подключаются подряд и делят общую
   область видимости: сборки в проекте нет. */

// ── INIT ──────────────────────────────────────────────────────────────────
(async()=>{
  // Theme
  const t=localStorage.getItem('theme');
  if(t==='dark'){isDark=true;document.documentElement.setAttribute('data-theme','dark');document.getElementById('theme-btn').textContent='☀️';}
  // Выбранный вид уважаем и на телефоне; неделя — только если выбора не было.
  const savedView = localStorage.getItem('view');
  view = (savedView === 'today' || savedView === 'week' ||
          savedView === 'month' || savedView === 'year')
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
      sections = {goals: [], list100: [], credo: [], quotes: [], money_rules: [], budgets: []};
      tombs = {goals: {}, list100: {}, credo: {}, quotes: {}, money_rules: {}, budgets: {}};
      txs = [];
      moneyLoaded = false;
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
        // Разделы и операции тоже принадлежат прежнему аккаунту: без сброса
        // новый пользователь видел бы чужие цели и траты до конца загрузки.
        sections = {goals: [], list100: [], credo: [], quotes: [], money_rules: [], budgets: []};
        txs = [];
        moneyLoaded = false;
      }
      showScreen('app');
      initTabs();
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
    initTabs();
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
