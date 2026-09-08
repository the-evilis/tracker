/* app-money.js — Деньги: операции и графики, бюджеты, повторы, импорт
   выписки, быстрый ввод, очередь неотправленного.
   Часть приложения. Файлы подключаются подряд и делят общую
   область видимости: сборки в проекте нет. */

/* ═══════════════ MONEY: доходы, расходы и графики ═══════════════ */

// Категории фиксированы: набор закрывает бытовые траты и работу студии,
// а редактор категорий на этом этапе только усложнил бы ввод.
const MONEY_CATS = {
  expense: [
    {id:'food',      icon:'🍜', name:'Еда'},
    {id:'home',      icon:'🏠', name:'Дом'},
    {id:'transport', icon:'🚕', name:'Транспорт'},
    {id:'health',    icon:'💊', name:'Здоровье'},
    {id:'fun',       icon:'🎬', name:'Развлечения'},
    {id:'shopping',  icon:'🛍️', name:'Покупки'},
    {id:'subs',      icon:'📱', name:'Подписки'},
    {id:'study',     icon:'📚', name:'Учёба'},
    {id:'business',  icon:'💼', name:'Бизнес'},
    {id:'other',     icon:'🔸', name:'Другое'}
  ],
  income: [
    {id:'salary',    icon:'💵', name:'Зарплата'},
    {id:'clients',   icon:'🤝', name:'Клиенты'},
    {id:'sales',     icon:'🛒', name:'Продажи'},
    {id:'percent',   icon:'📈', name:'Проценты'},
    {id:'gift',      icon:'🎁', name:'Подарок'},
    {id:'other_in',  icon:'🔸', name:'Другое'}
  ]
};
const CURRENCY = '₽';

// Суммы храним целыми в копейках: дробные рубли во float дают ошибку
// округления, и итог месяца перестаёт сходиться с суммой строк.
let txs = [];
let moneyOffset = 0;         // 0 — текущий месяц, -1 — предыдущий
let moneyLoaded = false;
let moneyTableMissing = false;

function catById(kind, id){
  const list = MONEY_CATS[kind] || [];
  return list.find(c => c.id === id) || list[list.length - 1];
}

function fmtMoney(cents, withSign){
  const sign = withSign && cents > 0 ? '+' : (cents < 0 ? '−' : '');
  const abs = Math.abs(cents);
  const rub = Math.floor(abs / 100);
  const kop = abs % 100;
  const head = String(rub).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return sign + head + (kop ? ',' + String(kop).padStart(2, '0') : '') + ' ' + CURRENCY;
}

// «1 200,50», «1200.5», «1 200" — всё это одна и та же сумма.
function parseAmount(raw){
  const s = String(raw || '').replace(/\s/g, '').replace(',', '.').replace(/[^\d.]/g, '');
  if(!s) return 0;
  const v = parseFloat(s);
  if(isNaN(v) || v <= 0) return 0;
  return Math.round(v * 100);
}

function isoDate(d){
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' +
         String(d.getDate()).padStart(2, '0');
}

function monthOf(offset){
  const d = new Date(ty, tm + offset, 1);
  return {y: d.getFullYear(), m: d.getMonth()};
}

function txInMonth(t, y, m){
  const d = String(t.ts || '');
  return d.slice(0, 7) === y + '-' + String(m + 1).padStart(2, '0');
}

// ── Загрузка операций ─────────────────────────────────────────────────────
// Тянем последние 13 месяцев: этого хватает и на текущий экран, и на
// годовой график, а объём остаётся небольшим.
// Насколько месяцев назад уже загружены операции. При листании глубже
// окно расширяется: раньше за двенадцатым месяцем шёл пустой экран, будто
// трат в тот месяц не было вовсе.
let moneyMonthsBack = 12;

async function loadTransactions(){
  if(isDemoMode){ moneyLoaded = true; return; }
  if(!currentUser) return;

  const from = new Date(ty, tm - moneyMonthsBack, 1);
  try{
    const res = await sbFetchWithTimeout(()=>
      sb.from('transactions')
        .select('id,ts,amount,kind,category,note')
        .eq('user_id', currentUser.id)
        .gte('ts', isoDate(from))
        .order('ts', {ascending: false})
    );
    if(res.error){
      // Таблицы может не быть: раздел добавлен позже остальных.
      if(/does not exist|relation|schema cache/i.test(res.error.message || '')){
        moneyTableMissing = true;
      } else {
        setSyncStatus('деньги: ' + res.error.message, false);
      }
      return;
    }
    moneyTableMissing = false;
    txs = res.data || [];

    // Неотправленные операции добавляем к серверным: иначе введённое без
    // сети пропадало бы с экрана после перезагрузки.
    const pending = txQueueRead();
    if(pending.length){
      const known = new Set(txs.map(t => t.id));
      pending.forEach(p=>{ if(!known.has(p.id)) txs.push(p); });
      txs.sort((a, b) => (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0));
    }
    moneyLoaded = true;
    await flushTxQueue();
  }catch(e){
    // Без сети показываем хотя бы то, что не успело уехать.
    txs = txQueueRead();
    setSyncStatus('деньги: нет сети', false);
  }
}

async function moneyNavigate(d){
  moneyOffset += d;
  if(moneyOffset > 0) moneyOffset = 0;      // будущих месяцев не бывает
  renderMoney();

  // Ушли за пределы загруженного окна — расширяем его и догружаем.
  // Годовой график смотрит на 11 месяцев назад от текущего экрана.
  const needBack = Math.abs(moneyOffset) + 12;
  if(!isDemoMode && currentUser && needBack > moneyMonthsBack){
    moneyMonthsBack = needBack;
    setSyncStatus('загружаем историю...', false);
    await loadTransactions();
    setSyncStatus('', false);
    renderMoney();
  }
}

function renderMoney(){
  const {y, m} = monthOf(moneyOffset);
  document.getElementById('money-title').textContent = MON_F[m] + ' ' + y;
  document.getElementById('money-next').style.visibility = moneyOffset >= 0 ? 'hidden' : '';

  const stats = document.getElementById('money-stats');
  const charts = document.getElementById('money-charts');
  const list = document.getElementById('money-list');

  if(moneyTableMissing){
    stats.innerHTML = '';
    charts.innerHTML = '';
    list.innerHTML = '<div class="empty-section">' +
      '<div class="empty-emoji">🗄️</div>' +
      '<h3>Таблица операций не создана</h3>' +
      '<p>Раздел «Деньги» хранит операции в отдельной таблице Supabase. ' +
      'Выполните SQL из README (раздел «Деньги») в SQL Editor дашборда — и обновите страницу.</p>' +
      '</div>';
    return;
  }

  const month = txs.filter(t => txInMonth(t, y, m));
  const income = month.filter(t => t.kind === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = month.filter(t => t.kind === 'expense').reduce((s, t) => s + t.amount, 0);
  const balance = income - expense;

  // День месяца, по который считаем средний расход: у прошлых месяцев он
  // полный, у текущего — только прожитая часть.
  const isCurrent = moneyOffset === 0;
  const daysPassed = isCurrent ? td : new Date(y, m + 1, 0).getDate();
  const perDay = daysPassed ? Math.round(expense / daysPassed) : 0;

  // Сравнение с прошлым месяцем: абсолютная сумма ничего не говорит, пока
  // не с чем сравнить.
  const prev = monthOf(moneyOffset - 1);
  const prevMonth = txs.filter(t => txInMonth(t, prev.y, prev.m));
  const prevIncome = prevMonth.filter(t => t.kind === 'income').reduce((s, t) => s + t.amount, 0);
  const prevExpense = prevMonth.filter(t => t.kind === 'expense').reduce((s, t) => s + t.amount, 0);

  // Для текущего месяца честно сравниваем равные отрезки: с 1-го по то же
  // число прошлого месяца, иначе «меньше» получается просто потому, что
  // месяц ещё не кончился.
  const prevSameSpan = isCurrent
    ? prevMonth.filter(t => t.kind === 'expense' &&
        parseInt(String(t.ts).slice(8, 10), 10) <= td)
        .reduce((s, t) => s + t.amount, 0)
    : prevExpense;

  const diff = (now, was)=>{
    if(!was) return '';
    const pct = Math.round((now - was) / was * 100);
    if(Math.abs(pct) < 3) return '<span class="delta same">≈ как в прошлом</span>';
    return '<span class="delta ' + (pct > 0 ? 'up' : 'down') + '">' +
           (pct > 0 ? '↑' : '↓') + ' ' + Math.abs(pct) + '%</span>';
  };

  stats.innerHTML = [
    {num: fmtMoney(income), label: 'Доходы', delta: diff(income, prevIncome)},
    {num: fmtMoney(expense), label: 'Расходы', delta: diff(expense, prevSameSpan)},
    {num: fmtMoney(balance), label: 'Остаток', delta: ''},
    {num: fmtMoney(perDay), label: 'В день', delta: ''}
  ].map(s => '<div class="stat"><div class="stat-num" style="font-size:16px">' + s.num +
             '</div><div class="stat-label">' + s.label + '</div>' +
             (s.delta ? '<div class="stat-delta">' + s.delta + '</div>' : '') +
             '</div>').join('');

  document.getElementById('money-budgets').innerHTML = budgetsHtml();
  charts.innerHTML = expense || income ? (catChartHtml(month) + monthsChartHtml()) : '';

  if(!month.length){
    list.innerHTML = emptyBlock('💰', 'Операций за месяц нет',
      'Записывайте траты сразу — на память они не восстанавливаются. Две кнопки выше добавляют операцию в пару касаний.',
      '', '');
    return;
  }

  // Группировка по дням: так список читается как выписка.
  const byDay = {};
  month.forEach(t=>{ (byDay[t.ts] = byDay[t.ts] || []).push(t); });

  list.innerHTML = Object.keys(byDay).sort().reverse().map(day=>{
    const d = new Date(day + 'T00:00:00');
    const head = '<div class="money-day">' + d.getDate() + ' ' + MON_S[d.getMonth()] + '</div>';
    const rows = byDay[day].map(t=>{
      const c = catById(t.kind, t.category);
      return '<button class="money-line" data-act="open-tx"' +
        ' data-kind="' + esc(t.kind) + '" data-id="' + esc(t.id) + '">' +
        '<span class="m-cat">' + esc(c.icon) + '</span>' +
        '<span class="m-mid">' +
          '<span class="m-title">' + esc(c.name) + '</span>' +
          (t.note ? '<span class="m-note">' + esc(t.note) + '</span>' : '') +
        '</span>' +
        '<span class="m-sum ' + t.kind + '">' +
          (t.kind === 'income' ? '+' : '−') + fmtMoney(t.amount) + '</span>' +
      '</button>';
    }).join('');
    return head + rows;
  }).join('');
}

// Расходы по категориям за месяц — горизонтальные полосы.
function catChartHtml(month){
  const spent = {};
  month.filter(t => t.kind === 'expense').forEach(t=>{
    spent[t.category] = (spent[t.category] || 0) + t.amount;
  });
  const rows = Object.keys(spent).sort((a, b) => spent[b] - spent[a]);
  if(!rows.length) return '';
  const max = spent[rows[0]];

  return '<div class="chart-card"><h3>Расходы по категориям</h3>' +
    rows.map(id=>{
      const c = catById('expense', id);
      return '<div class="cat-bar">' +
        '<span class="cb-ico">' + esc(c.icon) + '</span>' +
        '<span class="cb-name">' + esc(c.name) + '</span>' +
        '<span class="cb-track"><span class="cb-fill" style="width:' +
          Math.round(spent[id] / max * 100) + '%"></span></span>' +
        '<span class="cb-sum">' + fmtMoney(spent[id]) + '</span>' +
      '</div>';
    }).join('') + '</div>';
}

// Доходы и расходы по месяцам — двенадцать пар столбиков.
function monthsChartHtml(){
  const cols = [];
  let max = 1;
  for(let i = 11; i >= 0; i--){
    const {y, m} = monthOf(moneyOffset - i);
    const month = txs.filter(t => txInMonth(t, y, m));
    const inc = month.filter(t => t.kind === 'income').reduce((s, t) => s + t.amount, 0);
    const exp = month.filter(t => t.kind === 'expense').reduce((s, t) => s + t.amount, 0);
    max = Math.max(max, inc, exp);
    cols.push({m, inc, exp});
  }

  return '<div class="chart-card"><h3>Год по месяцам</h3><div class="months-chart">' +
    cols.map(c =>
      '<div class="mc-col">' +
        '<div class="mc-bars">' +
          '<div class="mc-bar mc-in" style="height:' + Math.round(c.inc / max * 100) + '%"' +
            ' title="Доход ' + fmtMoney(c.inc) + '"></div>' +
          '<div class="mc-bar mc-out" style="height:' + Math.round(c.exp / max * 100) + '%"' +
            ' title="Расход ' + fmtMoney(c.exp) + '"></div>' +
        '</div>' +
        '<div class="mc-lbl">' + MON_S[c.m].slice(0, 3) + '</div>' +
      '</div>').join('') +
    '</div><div class="chart-legend">' +
      '<span><i style="background:var(--accent)"></i>доходы</span>' +
      '<span><i style="background:var(--text3)"></i>расходы</span>' +
    '</div></div>';
}

/* ═══════════════ ДЕНЬГИ: бюджеты, повторы, импорт ═══════════════ */

function budgetFor(catId){
  const b = sections.budgets.find(x => x && x.cat === catId);
  return b ? b.limit : 0;
}

// Сколько потрачено по категории в показанном месяце.
function spentByCat(catId){
  const {y, m} = monthOf(moneyOffset);
  return txs.filter(t => t.kind === 'expense' && t.category === catId && txInMonth(t, y, m))
            .reduce((s, t) => s + t.amount, 0);
}

// Блок бюджетов: показываем только те категории, где лимит задан, и только
// если по ним уже есть траты либо лимит вот-вот кончится.
function budgetsHtml(){
  const withLimit = sections.budgets.filter(b => b && b.limit > 0);
  if(!withLimit.length) return '';

  const rows = withLimit.map(b=>{
    const c = catById('expense', b.cat);
    const spent = spentByCat(b.cat);
    const pct = Math.min(200, Math.round(spent / b.limit * 100));
    const state = pct >= 100 ? 'over' : pct >= 80 ? 'warn' : 'ok';
    return '<div class="cat-bar budget-bar ' + state + '">' +
      '<span class="cb-ico">' + esc(c.icon) + '</span>' +
      '<span class="cb-name">' + esc(c.name) + '</span>' +
      '<span class="cb-track"><span class="cb-fill" style="width:' +
        Math.min(100, pct) + '%"></span></span>' +
      // В бюджете копейки только мешают: важен порядок, а не точность.
      '<span class="cb-sum">' + fmtMoney(Math.round(spent / 100) * 100) +
        ' / ' + fmtMoney(b.limit) + '</span>' +
    '</div>';
  }).join('');

  const over = withLimit.filter(b => spentByCat(b.cat) >= b.limit).length;
  return '<div class="chart-card"><h3>Бюджеты' +
    (over ? ' · превышено: ' + over : '') + '</h3>' + rows + '</div>';
}

// ── Повторяющиеся операции ───────────────────────────────────────────────
function openRulesModal(){
  lastFocused = document.activeElement;
  renderRules();
  const m = document.getElementById('rules-modal');
  m.classList.add('open');
  m.setAttribute('aria-modal','true');
  m.setAttribute('role','dialog');
}

function closeRulesModal(){
  document.getElementById('rules-modal').classList.remove('open');
  if(lastFocused && lastFocused.focus) lastFocused.focus();
}

function renderRules(){
  const box = document.getElementById('rules-list');
  const {y, m} = monthOf(moneyOffset);

  if(!sections.money_rules.length){
    box.innerHTML = '<div class="empty-section" style="padding:20px 10px">' +
      '<div class="empty-emoji">↻</div>' +
      '<p>Пока пусто. Кнопка ниже превратит операции показанного месяца ' +
      'в повторяющиеся — потом их можно будет добавлять одним нажатием.</p></div>';
    return;
  }

  box.innerHTML = sections.money_rules.map(r=>{
    const c = catById(r.kind, r.category);
    // Уже добавлено в этот месяц? Тогда повторно не предлагаем.
    const already = txs.some(t => t.ruleId === r.id && txInMonth(t, y, m));
    return '<div class="rule-row">' +
      '<span class="m-cat">' + esc(c.icon) + '</span>' +
      '<span class="m-mid">' +
        '<span class="m-title">' + esc(r.note || c.name) + '</span>' +
        '<span class="m-note">' + esc(c.name) + ' · ' + r.day + ' число</span>' +
      '</span>' +
      '<span class="m-sum ' + r.kind + '">' + (r.kind === 'income' ? '+' : '−') +
        fmtMoney(r.amount) + '</span>' +
      (already
        ? '<span class="rule-done">✓</span>'
        : '<button class="btn btn-secondary arch-btn" data-act="apply-rule" data-id="' +
          esc(r.id) + '">Добавить</button>') +
      '<button class="task-del" data-act="del-rule" data-id="' + esc(r.id) + '"' +
        ' aria-label="Удалить правило">✕</button>' +
    '</div>';
  }).join('') +
  (sections.money_rules.some(r => !txs.some(t => t.ruleId === r.id && txInMonth(t, y, m)))
    ? '<button class="btn btn-primary" style="width:100%;margin-top:12px"' +
      ' data-act="apply-all-rules">Добавить все за этот месяц</button>'
    : '');
}

// Правила проще всего собрать из уже введённых операций месяца: человек
// один раз ввёл аренду — дальше она повторяется сама.
function addRuleFromCurrent(){
  const {y, m} = monthOf(moneyOffset);
  const month = txs.filter(t => txInMonth(t, y, m) && !t.ruleId);
  if(!month.length){ toast('В этом месяце нет операций для повтора', true); return; }

  let added = 0;
  month.forEach(t=>{
    const dup = sections.money_rules.some(r =>
      r.kind === t.kind && r.category === t.category && r.amount === t.amount);
    if(dup) return;
    sections.money_rules.push({
      id: newId('r'), kind: t.kind, amount: t.amount, category: t.category,
      note: t.note || '', day: parseInt(String(t.ts).slice(8, 10), 10) || 1
    });
    added++;
  });

  if(!added){ toast('Все операции месяца уже есть в списке повторов'); return; }
  saveSection('money_rules');
  renderRules();
  toast('Добавлено правил: ' + added);
}

async function applyRule(id){
  const r = sections.money_rules.find(x => x.id === id);
  if(!r) return;
  const {y, m} = monthOf(moneyOffset);
  const day = Math.min(r.day || 1, new Date(y, m + 1, 0).getDate());

  const row = {
    id: newId('tx'), ts: isoDate(new Date(y, m, day)), amount: r.amount,
    kind: r.kind, category: r.category, note: r.note || '', ruleId: r.id
  };
  txs.unshift(row);
  txs.sort((a, b) => (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0));
  renderRules();
  renderMoney();
  await pushTx(row);
}

async function applyAllRules(){
  const {y, m} = monthOf(moneyOffset);
  const pending = sections.money_rules.filter(r =>
    !txs.some(t => t.ruleId === r.id && txInMonth(t, y, m)));
  for(const r of pending) await applyRule(r.id);
  toast('Добавлено операций: ' + pending.length);
}

function deleteRule(id){
  const i = sections.money_rules.findIndex(r => r.id === id);
  if(i === -1) return;
  const removed = sections.money_rules.splice(i, 1)[0];
  markDeleted('money_rules', removed.id);
  saveSection('money_rules');
  renderRules();
  toast('Правило удалено', false, ()=>{
    sections.money_rules.splice(i, 0, removed);
    unmarkDeleted('money_rules', removed.id);
    saveSection('money_rules');
    renderRules();
  });
}

// ── Бюджеты ──────────────────────────────────────────────────────────────
function openBudgetModal(){
  lastFocused = document.activeElement;
  document.getElementById('budget-list').innerHTML = MONEY_CATS.expense.map(c=>{
    const limit = budgetFor(c.id);
    return '<div class="budget-edit">' +
      '<span class="cb-ico">' + esc(c.icon) + '</span>' +
      '<span class="cb-name">' + esc(c.name) + '</span>' +
      '<input class="add-input budget-input" data-cat="' + c.id + '" type="text"' +
        ' inputmode="decimal" placeholder="без лимита" value="' +
        (limit ? (limit / 100) : '') + '">' +
    '</div>';
  }).join('');

  const m = document.getElementById('budget-modal');
  m.classList.add('open');
  m.setAttribute('aria-modal','true');
  m.setAttribute('role','dialog');
}

function closeBudgetModal(){
  document.getElementById('budget-modal').classList.remove('open');
  if(lastFocused && lastFocused.focus) lastFocused.focus();
}

function saveBudgets(){
  const next = [];
  document.querySelectorAll('#budget-list .budget-input').forEach(inp=>{
    const limit = parseAmount(inp.value);
    if(limit > 0) next.push({cat: inp.dataset.cat, limit: limit});
  });
  // Снятый лимит — это удаление записи: без пометки он вернулся бы
  // со второго устройства при следующей синхронизации.
  sections.budgets.forEach(b=>{
    if(b && !next.some(n => n.cat === b.cat)) markDeleted('budgets', b.cat);
  });
  sections.budgets = next;
  saveSection('budgets');
  closeBudgetModal();
  renderMoney();
  toast(next.length ? 'Бюджеты сохранены' : 'Бюджеты сняты');
}

// ── Импорт выписки CSV ───────────────────────────────────────────────────
// Банки выгружают по-разному, поэтому колонки ищем по названиям, а разделитель
// определяем по первой строке. Всё, что не разобралось, пропускаем и
// показываем в итоге — молча терять строки выписки нельзя.
function parseCsv(text){
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if(!lines.length) return {rows: [], skipped: 0};

  const sep = (lines[0].match(/;/g) || []).length > (lines[0].match(/,/g) || []).length ? ';' : ',';
  const split = line=>{
    const out = []; let cur = '', q = false;
    for(let i = 0; i < line.length; i++){
      const ch = line[i];
      if(ch === '"'){ q = !q; continue; }
      if(ch === sep && !q){ out.push(cur); cur = ''; continue; }
      cur += ch;
    }
    out.push(cur);
    return out.map(s => s.trim());
  };

  const head = split(lines[0]).map(h => h.toLowerCase());
  const find = names => head.findIndex(h => names.some(n => h.indexOf(n) !== -1));
  const iDate = find(['дата', 'date']);
  const iSum  = find(['сумма', 'amount', 'оборот']);
  const iNote = find(['описание', 'назначение', 'коммент', 'description', 'категория']);

  if(iDate === -1 || iSum === -1) return {rows: [], skipped: lines.length - 1, noHead: true};

  const rows = [];
  let skipped = 0;
  for(let i = 1; i < lines.length; i++){
    const cols = split(lines[i]);
    const rawDate = cols[iDate] || '';
    const rawSum = (cols[iSum] || '').replace(/\s/g, '').replace(',', '.');

    // Дата: 2026-09-06, 06.09.2026 или 06/09/2026.
    let ts = null;
    let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(rawDate);
    if(m) ts = m[1] + '-' + m[2] + '-' + m[3];
    if(!ts){
      m = /^(\d{2})[.\/](\d{2})[.\/](\d{4})/.exec(rawDate);
      if(m) ts = m[3] + '-' + m[2] + '-' + m[1];
    }

    const val = parseFloat(rawSum);
    if(!ts || isNaN(val) || val === 0){ skipped++; continue; }

    rows.push({
      id: newId('tx'),
      ts: ts,
      amount: Math.round(Math.abs(val) * 100),
      kind: val < 0 ? 'expense' : 'income',
      category: val < 0 ? 'other' : 'other_in',
      note: (iNote !== -1 ? (cols[iNote] || '') : '').slice(0, 80)
    });
  }
  return {rows, skipped};
}

function importCsv(e){
  const file = e.target.files && e.target.files[0];
  e.target.value = '';
  if(!file) return;
  if(moneyTableMissing){ toast('Сначала создайте таблицу transactions', true); return; }

  const reader = new FileReader();
  reader.onload = async ev=>{
    const {rows, skipped, noHead} = parseCsv(String(ev.target.result || ''));
    if(noHead){
      toast('В файле не нашлись колонки с датой и суммой', true);
      return;
    }
    if(!rows.length){ toast('Не удалось разобрать ни одной строки', true); return; }

    if(!confirm('Загрузить ' + rows.length + ' операций' +
                (skipped ? ' (пропущено строк: ' + skipped + ')' : '') +
                '?\n\nОни добавятся к текущим, категория — «Другое».')) return;

    rows.forEach(r=>{ txs.push(r); });
    txs.sort((a, b) => (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0));
    renderMoney();

    for(const r of rows) await pushTx(r, {silent: true});
    toast('Загружено операций: ' + rows.length +
          (skipped ? ', пропущено: ' + skipped : ''));
  };
  reader.onerror = ()=>toast('Не удалось прочитать файл', true);
  reader.readAsText(file, 'utf-8');
}

/* ═══════════════ БЫСТРЫЙ ВВОД ОПЕРАЦИИ ═══════════════ */
// «850 кафе» → расход 850 ₽ в категорию, которой это слово уже помечалось.
// Смысл в том, чтобы запись занимала секунды: полноценная форма с выбором
// категории через месяц перестаёт открываться вовсе.
function parseQuick(raw){
  const s = String(raw || '').trim();
  if(!s) return null;

  // Сумма — первое число в строке; знак решает, доход это или расход.
  const m = /(^|\s)([+-]?)(\d[\d\s]*(?:[.,]\d{1,2})?)/.exec(s);
  if(!m) return null;

  const amount = parseAmount(m[3]);
  if(!amount) return null;

  const explicitIncome = m[2] === '+';
  const rest = (s.slice(0, m.index) + ' ' + s.slice(m.index + m[0].length)).trim();

  return {amount, note: rest, income: explicitIncome};
}

// Категория берётся из прошлых операций с тем же словом: человек один раз
// записал «кофе» как «Еда» — дальше приложение помнит это само.
function guessCategory(note, kind){
  const word = String(note || '').toLowerCase().trim();
  if(word){
    const prev = txs.filter(t => t.kind === kind && t.note &&
                                t.note.toLowerCase().indexOf(word) !== -1);
    if(prev.length) return prev[0].category;

    // Не нашли по всей заметке — пробуем по первому слову.
    const first = word.split(/\s+/)[0];
    if(first.length >= 3){
      const byFirst = txs.filter(t => t.kind === kind && t.note &&
                                     t.note.toLowerCase().indexOf(first) !== -1);
      if(byFirst.length) return byFirst[0].category;
    }
  }
  return kind === 'income' ? 'other_in' : 'other';
}

// Поле быстрого ввода есть и на экране дня, и в разделе денег.
function quickAddTxFrom(id){ return quickAddTx(id); }

async function quickAddTx(inputId){
  const input = document.getElementById(inputId || 'quick-tx');
  if(!input) return;

  if(moneyTableMissing){ toast('Сначала создайте таблицу transactions', true); return; }

  const parsed = parseQuick(input.value);
  if(!parsed){
    toast('Не понял сумму. Например: «850 кафе»', true);
    input.focus();
    return;
  }

  const kind = parsed.income ? 'income' : 'expense';
  const row = {
    id: newId('tx'),
    ts: isoDate(new Date(ty, tm, td)),
    amount: parsed.amount,
    kind: kind,
    category: guessCategory(parsed.note, kind),
    note: parsed.note.slice(0, 80)
  };

  txs.unshift(row);
  txs.sort((a, b) => (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0));
  input.value = '';

  const cat = catById(kind, row.category);
  // Категорию угадали — говорим какую, чтобы ошибку было видно сразу.
  toast((kind === 'income' ? '+' : '−') + fmtMoney(row.amount) + ' · ' + cat.name, false);
  renderCurrent();
  await pushTx(row);
}

// «Повторить вчера»: регулярные траты почти всегда повторяются с теми же
// суммами, и вводить их заново — лишняя работа.
async function repeatYesterday(){
  const iso = isoDate(new Date(ty, tm, td - 1));
  const yesterday = txs.filter(t => t.ts === iso);
  if(!yesterday.length){ toast('Вчера операций не было', true); return; }

  const today = isoDate(new Date(ty, tm, td));
  const copies = yesterday.map(t => Object.assign({}, t, {id: newId('tx'), ts: today}));
  copies.forEach(c => txs.unshift(c));
  txs.sort((a, b) => (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0));
  renderCurrent();

  for(const c of copies) await pushTx(c, {silent: true});
  toast('Скопировано операций: ' + copies.length, false, async ()=>{
    copies.forEach(c=>{
      const i = txs.findIndex(t => t.id === c.id);
      if(i !== -1) txs.splice(i, 1);
    });
    renderCurrent();
    for(const c of copies) await removeTx(c.id);
  });
}

async function removeTx(id){
  if(isDemoMode || !currentUser) return;
  try{
    const res = await sbFetchWithTimeout(()=>
      sb.from('transactions').delete().eq('user_id', currentUser.id).eq('id', id));
    if(res.error) throw new Error(res.error.message);
    txQueueDrop(id);
  }catch(e){ /* останется на сервере; список поправится при следующей загрузке */ }
}

// ── Модалка операции ──────────────────────────────────────────────────────
let txDraft = null;

function openTxModal(kind, id){
  if(moneyTableMissing){ toast('Сначала создайте таблицу transactions по инструкции из README', true); return; }
  lastFocused = document.activeElement;

  const existing = id ? txs.find(t => t.id === id) : null;
  txDraft = existing
    ? {id: existing.id, kind: existing.kind, category: existing.category}
    : {id: null, kind: kind, category: MONEY_CATS[kind][0].id};

  document.getElementById('tx-modal-title').textContent =
    (txDraft.kind === 'income' ? 'Доход' : 'Расход') + (existing ? '' : ' — новая операция');
  document.getElementById('tx-amount').value = existing ? (existing.amount / 100).toString().replace('.', ',') : '';
  document.getElementById('tx-note').value = existing ? (existing.note || '') : '';
  document.getElementById('tx-date').value = existing ? existing.ts : isoDate(new Date(ty, tm, td));
  document.getElementById('tx-delete-btn').style.display = existing ? '' : 'none';
  renderTxCategories();

  const m = document.getElementById('tx-modal');
  m.classList.add('open');
  m.setAttribute('aria-modal','true');
  m.setAttribute('role','dialog');
  document.getElementById('tx-amount').focus();
}

function renderTxCategories(){
  document.getElementById('tx-categories').innerHTML = MONEY_CATS[txDraft.kind].map(c=>
    '<button class="cat-chip" aria-pressed="' + (c.id === txDraft.category ? 'true' : 'false') + '"' +
    ' data-act="pick-tx-cat" data-arg="' + esc(c.id) + '">' + esc(c.icon) + ' ' + esc(c.name) + '</button>').join('');
}

function pickTxCat(id){
  txDraft.category = id;
  renderTxCategories();
}

function closeTxModal(){
  document.getElementById('tx-modal').classList.remove('open');
  txDraft = null;
  if(lastFocused && lastFocused.focus) lastFocused.focus();
}

async function saveTxModal(){
  const amount = parseAmount(document.getElementById('tx-amount').value);
  if(!amount){ toast('Введите сумму больше нуля', true); return; }

  const ts = document.getElementById('tx-date').value || isoDate(new Date(ty, tm, td));
  const note = document.getElementById('tx-note').value.trim();
  const row = {
    id: txDraft.id || newId('tx'),
    ts: ts,
    amount: amount,
    kind: txDraft.kind,
    category: txDraft.category,
    note: note
  };

  const i = txs.findIndex(t => t.id === row.id);
  if(i === -1) txs.unshift(row); else txs[i] = row;
  txs.sort((a, b) => (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0));

  closeTxModal();
  renderMoney();
  await pushTx(row);
}

// ── Очередь неотправленных операций ───────────────────────────────────────
// Без неё операция, введённая без сети, жила только в памяти вкладки и
// исчезала при перезагрузке: на экране она есть, в базе её нет.
function txQueueKey(){ return 'txq_' + ((currentUser && currentUser.id) || 'anon'); }

function txQueueRead(){
  try{
    const v = JSON.parse(localStorage.getItem(txQueueKey()) || '[]');
    return Array.isArray(v) ? v : [];
  }catch(e){ return []; }
}

function txQueueWrite(list){
  try{ localStorage.setItem(txQueueKey(), JSON.stringify(list)); }catch(e){}
}

function txQueueAdd(row){
  const list = txQueueRead().filter(r => r.id !== row.id);
  list.push(row);
  txQueueWrite(list);
  setSyncStatus('операций не отправлено: ' + list.length, false);
}

function txQueueDrop(id){
  txQueueWrite(txQueueRead().filter(r => r.id !== id));
}

async function flushTxQueue(){
  if(isDemoMode || !currentUser) return;
  const list = txQueueRead();
  if(!list.length) return;
  for(const row of list){
    await pushTx(row, {silent: true});
  }
  const left = txQueueRead().length;
  if(!left){
    setSyncStatus('операции синхронизированы ✓', true);
    setTimeout(()=>setSyncStatus('', false), 1500);
  }
}

async function pushTx(row, opts){
  if(isDemoMode || !currentUser) return;
  try{
    const res = await sbFetchWithTimeout(()=>
      sb.from('transactions').upsert(
        Object.assign({user_id: currentUser.id}, row),
        {onConflict:'id,user_id'}
      )
    );
    if(res.error) throw new Error(res.error.message);
    txQueueDrop(row.id);
    if(!opts || !opts.silent){
      setSyncStatus('операция сохранена ✓', true);
      setTimeout(()=>setSyncStatus('', false), 1500);
    }
  }catch(e){
    // Операция остаётся в очереди и уйдёт при возврате сети или на старте.
    txQueueAdd(row);
    if(!opts || !opts.silent){
      toast('Операция сохранена локально, отправим при связи', false);
    }
  }
}

async function deleteTxFromModal(){
  if(!txDraft || !txDraft.id) return;
  const id = txDraft.id;
  const i = txs.findIndex(t => t.id === id);
  if(i === -1){ closeTxModal(); return; }
  const removed = txs.splice(i, 1)[0];

  closeTxModal();
  renderMoney();

  if(!isDemoMode && currentUser){
    try{
      const res = await sbFetchWithTimeout(()=>
        sb.from('transactions').delete().eq('user_id', currentUser.id).eq('id', id)
      );
      if(res.error) throw new Error(res.error.message);
    }catch(e){
      txs.splice(i, 0, removed);
      renderMoney();
      toast('Не удалось удалить операцию: ' + e.message, true);
      return;
    }
  }
  toast('Операция удалена', false, async ()=>{
    txs.splice(i, 0, removed);
    renderMoney();
    await pushTx(removed);
  });
}
