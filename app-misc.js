/* app-misc.js — Подборка цитат, звуковые эффекты, конфетти, аватар,
   экспорт и импорт данных.
   Часть приложения. Файлы подключаются подряд и делят общую
   область видимости: сборки в проекте нет. */

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
function nextQuote(){ let n; do{n=Math.floor(Math.random()*QUOTES.length);}while(n===quoteIndex&&QUOTES.length>1); quoteIndex=n; renderQuote(); updateSaveQuoteBtn(); }

// Понравившуюся цитату дня можно забрать себе — иначе она уходит с
// перелистыванием, и вернуть её нельзя ничем, кроме везения.
function saveCurrentQuote(){
  const q = QUOTES[quoteIndex];
  if(hasOwnQuote(q)){ toast('Эта цитата уже в вашей подборке'); return; }
  sections.quotes.push({id: newId('q'), text: q.text, author: q.author || '', fav: false});
  saveSection('quotes');
  renderQuotes();
  toast('Цитата сохранена в вашу подборку');
}

function hasOwnQuote(q){
  return sections.quotes.some(x => x && x.text === q.text);
}

// Кнопка меняет вид, когда цитата уже сохранена: нажимать второй раз незачем.
function updateSaveQuoteBtn(){
  const btn = document.getElementById('save-quote-btn');
  if(!btn) return;
  const saved = hasOwnQuote(QUOTES[quoteIndex]);
  btn.textContent = saved ? '✓ В подборке' : '+ Сохранить себе';
  btn.disabled = saved;
}

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
      <button data-act="crop-cancel" style="padding:10px 24px;border-radius:10px;border:1px solid rgba(255,255,255,.3);background:none;color:#fff;cursor:pointer;font-family:var(--sans)">Отмена</button>
      <button data-act="crop-save" style="padding:10px 24px;border-radius:10px;border:none;background:var(--accent);color:#fff;cursor:pointer;font-family:var(--sans);font-weight:500">Сохранить</button>
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
    version: 4,
    exportedAt: new Date().toISOString(),
    email: (currentUser && currentUser.email) || null,
    habits: HABITS,          // вместе с графиком, целью и признаком архива
    marks: data,
    values: marksValues,     // числа количественных привычек
    // Версия 4: остальные разделы. Операции выгружаются вместе со всем
    // остальным — иначе «скачать данные» перестало бы означать «все данные».
    goals: sections.goals,
    list100: sections.list100,
    credo: sections.credo,
    quotes: sections.quotes,
    transactions: txs
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

    // Разделы из файла версии 4. Записи добавляются к существующим, а не
    // заменяют их: импорт не должен стирать то, что уже накоплено.
    let added = 0;
    SECTION_KEYS.forEach(key=>{
      const list = payload[key];
      if(!Array.isArray(list) || !list.length) return;
      const known = new Set(sections[key].map(x => x && x.id));
      list.forEach(item=>{
        if(!item || (!item.text && !item.name)) return;
        // Идентификатор из файла проверяем: он попадает в разметку, а файл
        // мог прийти откуда угодно.
        item.id = safeId(item.id, key.slice(0, 2));
        if(Array.isArray(item.tasks)){
          item.tasks.forEach(t=>{ if(t) t.id = safeId(t.id, 't'); });
        }
        if(known.has(item.id)) return;
        sections[key].push(item);
        known.add(item.id);
        added++;
      });
      saveSection(key);
    });

    // Операции: тоже по id, чтобы повторный импорт не задвоил месяц трат.
    let txAdded = 0;
    if(Array.isArray(payload.transactions)){
      const knownTx = new Set(txs.map(t => t.id));
      payload.transactions.forEach(t=>{
        if(!t || !t.ts || !t.amount) return;
        t.id = safeId(t.id, 'tx');
        if(knownTx.has(t.id)) return;
        txs.push(t);
        knownTx.add(t.id);
        txAdded++;
        if(currentUser && !isDemoMode) pushTx(t);
      });
      txs.sort((a, b) => (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0));
    }

    renderCurrent();
    toast('Загружено ' + incoming.length + ' отметок' +
          (vals ? ', ' + vals + ' значений' : '') +
          (added ? ', ' + added + ' записей разделов' : '') +
          (txAdded ? ', ' + txAdded + ' операций' : ''));

    if(currentUser && !isDemoMode){
      if(hasHabits) await saveHabitsToServer();
      if(vals) await saveValuesToServer();
      await flushQueue();
    }
  };
  reader.onerror = ()=>toast('Не удалось прочитать файл', true);
  reader.readAsText(file);
}
