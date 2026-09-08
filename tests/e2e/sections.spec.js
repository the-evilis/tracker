// Smoke-проверки разделов: Focus (цели и список ста), Money, Credo, Quotes.
//
// Всё в демо-режиме: сеть заблокирована, SDK Supabase подменён заглушкой,
// поэтому боевая база не задействована (см. fixtures.js).
const {test, expect, openDemo} = require('./fixtures');

// Открыть приложение и перейти на вкладку.
async function openTab(page, name) {
  await openDemo(page);
  await page.locator('#tab-' + name).click();
  await expect(page.locator('#tab-' + name)).toHaveAttribute('aria-selected', 'true');
}

test('нижнее меню показывает пять разделов', async ({page, pageErrors}) => {
  await openDemo(page);

  const tabs = page.locator('#tabbar .tab-btn');
  await expect(tabs).toHaveCount(5);
  await expect(tabs).toHaveText([/Focus/, /Money/, /Tracker/, /Credo/, /Quotes/]);

  // По умолчанию открыт трекер привычек.
  await expect(page.locator('#panel-tracker')).toBeVisible();
  await expect(page.locator('#screen-title')).toHaveText('Tracker');
  expect(pageErrors).toEqual([]);
});

test('на широком экране меню не растягивается во всю ширину', async ({page}) => {
  await page.setViewportSize({width: 1440, height: 900});
  await openDemo(page);

  const bar = await page.locator('#tabbar').boundingBox();
  // Раньше панель шла от края до края, и пять иконок расползались
  // по краям монитора вместо панели.
  expect(bar.width).toBeLessThan(600);
  // И она по центру: отступы слева и справа примерно равны.
  const gapLeft = bar.x;
  const gapRight = 1440 - (bar.x + bar.width);
  expect(Math.abs(gapLeft - gapRight)).toBeLessThan(20);

  // На телефоне панель, наоборот, занимает всю ширину.
  await page.setViewportSize({width: 390, height: 844});
  const narrow = await page.locator('#tabbar').boundingBox();
  expect(narrow.width).toBeGreaterThan(380);
});

test('вкладки переключаются и выбор запоминается', async ({page, pageErrors}) => {
  await openDemo(page);

  for (const [name, title] of [['focus', 'Focus'], ['money', 'Money'], ['credo', 'Credo'], ['quotes', 'Quotes']]) {
    await page.locator('#tab-' + name).click();
    await expect(page.locator('#panel-' + name)).toBeVisible();
    await expect(page.locator('#screen-title')).toHaveText(title);
    // Панели остальных разделов скрыты, а не просто пусты.
    await expect(page.locator('#panel-tracker')).toBeHidden();
  }

  expect(await page.evaluate(() => localStorage.getItem('tab'))).toBe('quotes');
  expect(pageErrors).toEqual([]);
});

test('шестерёнка привычек видна только в трекере', async ({page}) => {
  await openDemo(page);
  await expect(page.locator('#edit-btn')).toBeVisible();

  await page.locator('#tab-money').click();
  await expect(page.locator('#edit-btn')).toBeHidden();

  await page.locator('#tab-tracker').click();
  await expect(page.locator('#edit-btn')).toBeVisible();
});

test('Focus: цель открывается, задача отмечается', async ({page, pageErrors}) => {
  await openTab(page, 'focus');

  const cards = page.locator('.goal-card');
  await expect(cards.first()).toBeVisible();
  const before = await page.evaluate(() => sections.goals[0].tasks.filter(t => t.done).length);

  await cards.first().click();
  await expect(page.locator('#panel-goal')).toBeVisible();
  await expect(page.locator('.task-row').first()).toBeVisible();

  const check = page.locator('.task-check').first();
  const wasDone = (await check.getAttribute('aria-checked')) === 'true';
  await check.click();
  await expect(page.locator('.task-check').first())
    .toHaveAttribute('aria-checked', wasDone ? 'false' : 'true');

  const after = await page.evaluate(() => sections.goals[0].tasks.filter(t => t.done).length);
  expect(after).toBe(wasDone ? before - 1 : before + 1);

  await page.locator('.back-btn').click();
  await expect(page.locator('#panel-focus')).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test('Focus: новая цель добавляется', async ({page}) => {
  await openTab(page, 'focus');
  const before = await page.evaluate(() => sections.goals.length);

  await page.locator('#add-goal-btn').click();
  await expect(page.locator('#goal-modal')).toHaveClass(/open/);
  await page.locator('#goal-name').fill('Тест цель');
  await page.locator('#goal-save-btn').click();

  await expect(page.locator('#goal-modal')).not.toHaveClass(/open/);
  await expect(page.locator('.goal-card').filter({hasText: 'Тест цель'})).toBeVisible();
  expect(await page.evaluate(() => sections.goals.length)).toBe(before + 1);
});

test('Focus: список ста открывается и принимает пункт', async ({page}) => {
  await openTab(page, 'focus');

  await expect(page.locator('.hundred-card')).toBeVisible();
  await expect(page.locator('.hundred-dots span')).toHaveCount(100);

  await page.locator('.hundred-card').click();
  await expect(page.locator('#panel-goal')).toBeVisible();
  await expect(page.locator('#screen-title')).toHaveText('100');

  const before = await page.evaluate(() => sections.list100.length);
  await page.getByRole('button', {name: '+ Новый пункт'}).click();
  await expect(page.locator('#text-modal')).toHaveClass(/open/);
  await page.locator('#text-modal-input').fill('Дойти до Байкала');
  await page.locator('#text-modal-save').click();

  await expect(page.locator('.task-text').filter({hasText: 'Дойти до Байкала'})).toBeVisible();
  expect(await page.evaluate(() => sections.list100.length)).toBe(before + 1);
});

test('Credo: принцип дня и отметка «следовал»', async ({page, pageErrors}) => {
  await openTab(page, 'credo');

  await expect(page.locator('.credo-today')).toBeVisible();
  await expect(page.locator('.credo-row')).not.toHaveCount(0);

  // Отметка кредо кладётся в те же данные, что и привычки, тем же ключом.
  const check = page.locator('.credo-row .task-check').first();
  const wasDone = (await check.getAttribute('aria-checked')) === 'true';
  const before = await page.evaluate(() => Object.keys(data).length);

  await check.click();
  await expect(page.locator('.credo-row .task-check').first())
    .toHaveAttribute('aria-checked', wasDone ? 'false' : 'true');

  const after = await page.evaluate(() => Object.keys(data).length);
  expect(after).toBe(wasDone ? before - 1 : before + 1);
  expect(pageErrors).toEqual([]);
});

test('Credo: новый принцип добавляется', async ({page}) => {
  await openTab(page, 'credo');
  const before = await page.evaluate(() => sections.credo.length);

  await page.locator('#add-credo-btn').click();
  await page.locator('#text-modal-input').fill('Проверяю цифры до решения');
  await page.locator('#text-modal-save').click();

  await expect(page.locator('.cr-text').filter({hasText: 'Проверяю цифры'})).toBeVisible();
  expect(await page.evaluate(() => sections.credo.length)).toBe(before + 1);
});

test('Quotes: цитата дня, своя цитата и избранное', async ({page, pageErrors}) => {
  await openTab(page, 'quotes');

  await expect(page.locator('#quote-text')).not.toBeEmpty();
  await expect(page.locator('.quote-item')).not.toHaveCount(0);

  await page.locator('#add-quote-btn').click();
  await page.locator('#text-modal-input').fill('Работает — не трогай');
  await page.locator('#text-modal-extra').fill('Народное');
  await page.locator('#text-modal-save').click();

  const added = page.locator('.quote-item').filter({hasText: 'Работает — не трогай'});
  await expect(added).toBeVisible();
  await expect(added.locator('.qi-author')).toHaveText('Народное');

  // Избранные идут раньше остальных: в демо избранная цитата уже есть,
  // поэтому проверяем порядок целиком, а не только первую карточку.
  await added.locator('.fav-btn').click();
  await expect(added.locator('.fav-btn')).toHaveAttribute('aria-pressed', 'true');

  const favFlags = await page.$$eval('.quote-item .fav-btn',
    els => els.map(e => e.getAttribute('aria-pressed') === 'true'));
  expect(favFlags).toEqual(favFlags.slice().sort((a, b) => (b ? 1 : 0) - (a ? 1 : 0)));
  expect(pageErrors).toEqual([]);
});

test('Quotes: цитата дня забирается в свою подборку', async ({page}) => {
  await openTab(page, 'quotes');

  const before = await page.evaluate(() => sections.quotes.length);
  const dayQuote = await page.locator('#quote-text').innerText();

  await page.locator('#save-quote-btn').click();

  // Кнопка становится неактивной: повторно сохранять ту же цитату незачем.
  await expect(page.locator('#save-quote-btn')).toBeDisabled();
  await expect(page.locator('#save-quote-btn')).toHaveText(/В подборке/);
  expect(await page.evaluate(() => sections.quotes.length)).toBe(before + 1);
  await expect(page.locator('.quote-item').filter({hasText: dayQuote.slice(0, 30)})).toBeVisible();

  // Другая цитата — кнопка снова активна.
  await page.getByRole('button', {name: /Другая/}).click();
  await expect(page.locator('#save-quote-btn')).toBeEnabled();
});

test('переносы строк в тексте сохраняются', async ({page}) => {
  await openTab(page, 'credo');

  await page.locator('#add-credo-btn').click();
  await page.locator('#text-modal-input').fill('я\nя\nя');
  await page.locator('#text-modal-save').click();

  const row = page.locator('.cr-text').filter({hasText: 'я'}).last();
  await expect(row).toBeVisible();

  // Текст сохранён с переводами строк, и CSS их не схлопывает.
  expect(await page.evaluate(() => sections.credo[sections.credo.length - 1].text)).toBe('я\nя\nя');
  const ws = await row.evaluate(el => getComputedStyle(el).whiteSpace);
  expect(ws).toBe('pre-line');
});

test('Money: месяц, статистика и графики', async ({page, pageErrors}) => {
  await openTab(page, 'money');

  await expect(page.locator('#money-stats .stat')).toHaveCount(4);
  await expect(page.locator('#money-list .money-line').first()).toBeVisible();
  await expect(page.locator('#money-charts .chart-card')).toHaveCount(2);

  // Листание месяцев: заголовок меняется, вперёд из текущего месяца нельзя.
  const title = page.locator('#money-title');
  const now = await title.innerText();
  await expect(page.locator('#money-next')).toBeHidden();
  await page.locator('#money-prev').click();
  await expect(title).not.toHaveText(now);
  await expect(page.locator('#money-next')).toBeVisible();
  await page.locator('#money-next').click();
  await expect(title).toHaveText(now);

  expect(pageErrors).toEqual([]);
});

test('Money: операция добавляется и удаляется', async ({page}) => {
  await openTab(page, 'money');

  const before = await page.evaluate(() => txs.length);

  await page.locator('.btn-expense').click();
  await expect(page.locator('#tx-modal')).toHaveClass(/open/);
  await page.locator('#tx-amount').fill('1 250,50');
  await page.locator('.cat-chip').nth(1).click();
  await page.locator('#tx-note').fill('Тестовая трата');
  await page.locator('#tx-save-btn').click();

  await expect(page.locator('#tx-modal')).not.toHaveClass(/open/);
  expect(await page.evaluate(() => txs.length)).toBe(before + 1);

  // Сумма разобрана в копейки без потери дробной части.
  const amount = await page.evaluate(() => txs.find(t => t.note === 'Тестовая трата').amount);
  expect(amount).toBe(125050);

  const line = page.locator('.money-line').filter({hasText: 'Тестовая трата'});
  await expect(line).toBeVisible();

  await line.click();
  await expect(page.locator('#tx-modal')).toHaveClass(/open/);
  await page.locator('#tx-delete-btn').click();

  expect(await page.evaluate(() => txs.length)).toBe(before);
  await expect(page.locator('.money-line').filter({hasText: 'Тестовая трата'})).toHaveCount(0);
});

test('Money: пустая сумма не сохраняется', async ({page}) => {
  await openTab(page, 'money');
  const before = await page.evaluate(() => txs.length);

  await page.locator('.btn-income').click();
  await page.locator('#tx-save-btn').click();

  // Модалка осталась открытой, операция не создана.
  await expect(page.locator('#tx-modal')).toHaveClass(/open/);
  expect(await page.evaluate(() => txs.length)).toBe(before);
  await page.keyboard.press('Escape');
  await expect(page.locator('#tx-modal')).not.toHaveClass(/open/);
});

test('Focus: срок цели и привязка привычек', async ({page}) => {
  await openTab(page, 'focus');

  await page.locator('.goal-card').first().click();
  await page.locator('[data-act="edit-goal"]').click();
  await expect(page.locator('#goal-modal')).toHaveClass(/open/);

  // Срок: ставим завтрашний день и проверяем подпись «остался 1 день».
  const tomorrow = await page.evaluate(() => {
    const d = new Date(ty, tm, td + 1);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') +
           '-' + String(d.getDate()).padStart(2, '0');
  });
  await page.locator('#goal-due').fill(tomorrow);

  // И привязываем первую привычку.
  await page.locator('#goal-habits .cat-chip').first().click();
  await page.locator('#goal-save-btn').click();

  // Проверяем именно экран цели: в скрытом списке лежат такие же подписи.
  await expect(page.locator('#panel-goal .goal-sub')).toContainText(/остал/);
  await expect(page.locator('.goal-habits-row')).toBeVisible();
  expect(await page.evaluate(() => sections.goals[0].habitIds.length)).toBe(1);
  expect(await page.evaluate(() => sections.goals[0].due)).toBe(tomorrow);

  // И на карточке в списке срок тоже виден.
  await page.locator('.back-btn').click();
  await expect(page.locator('#panel-focus .goal-card').first()).toContainText(/остал/);
});

test('Focus: цель уходит в архив и возвращается', async ({page}) => {
  await openTab(page, 'focus');
  const before = await page.locator('.goal-card').count();

  await page.locator('.goal-card').first().click();
  await page.locator('[data-act="edit-goal"]').click();
  await page.locator('#goal-archive-btn').click();

  await expect(page.locator('.goal-card')).toHaveCount(before - 1);
  await expect(page.locator('.archive-block')).toBeVisible();

  // Архив свёрнут — сначала раскрываем.
  await page.locator('.archive-block summary').click();
  await page.locator('[data-act="unarchive-goal"]').first().click();
  await expect(page.locator('.goal-card')).toHaveCount(before);
});

test('100: категория, заметка и дата выполнения', async ({page}) => {
  await openTab(page, 'focus');
  await page.locator('.hundred-card').click();

  // Новый пункт с категорией и заметкой.
  await page.getByRole('button', {name: '+ Новый пункт'}).click();
  await page.locator('#text-modal-input').fill('Сплавиться по реке');
  await page.locator('#text-modal-extra').fill('с братом, весной');
  await page.locator('#text-modal-cats .cat-chip').first().click();   // Путешествия
  await page.locator('#text-modal-save').click();

  const row = page.locator('.task-row').filter({hasText: 'Сплавиться по реке'});
  await expect(row).toBeVisible();
  await expect(row.locator('.task-meta')).toContainText('с братом');

  // Отметка проставляет дату.
  await row.locator('.task-check').click();
  await expect(row.locator('.task-meta')).toContainText('сегодня');

  // Фильтр по категории оставляет только её пункты.
  await page.locator('[data-act="filter-100"]').nth(1).click();
  const texts = await page.locator('.task-text').allInnerTexts();
  expect(texts.some(t => t.includes('Сплавиться'))).toBeTruthy();
});

test('Credo: неделя, связка с привычкой и заметка', async ({page}) => {
  await openTab(page, 'credo');

  // Семь дней истории у каждого принципа.
  await expect(page.locator('.credo-row').first().locator('.cw-day')).toHaveCount(7);
  await expect(page.locator('.credo-today .ct-week')).toContainText('%');

  // Привязка привычки к принципу.
  await page.locator('.cr-text').first().click();
  await expect(page.locator('#text-modal')).toHaveClass(/open/);
  await page.locator('#text-modal-cats .cat-chip').nth(1).click();
  await page.locator('#text-modal-save').click();
  await expect(page.locator('.cr-habit').first()).toBeVisible();

  // Заметка за сегодня.
  await page.locator('[data-act="note-credo"]').first().click();
  await page.locator('#text-modal-input').fill('День был длинный');
  await page.locator('#text-modal-save').click();
  await expect(page.locator('.cr-note').first()).toContainText('День был длинный');
});

test('Tracker: вид «Сегодня» показывает только сегодняшнее', async ({page}) => {
  await openDemo(page);
  await page.locator('#btn-today').click();

  await expect(page.locator('#btn-today')).toHaveClass(/active/);
  await expect(page.locator('#nav-title')).toHaveText('Сегодня');
  await expect(page.locator('.today-row').first()).toBeVisible();
  // Листать по дням тут нечего.
  await expect(page.locator('#btn-prev')).toBeHidden();

  // Отметка прямо отсюда меняет данные и переносит строку в «Сделано».
  const check = page.locator('.today-row:not(.done) .today-check').first();
  const before = await page.evaluate(() => Object.keys(data).length);
  await check.click();
  expect(await page.evaluate(() => Object.keys(data).length)).toBe(before + 1);
  await expect(page.locator('.today-sep').first()).toBeVisible();

  expect(await page.evaluate(() => localStorage.getItem('view'))).toBe('today');
});

test('Сегодня: принцип дня, срок цели и деньги на одном экране', async ({page, pageErrors}) => {
  await openDemo(page);
  await page.locator('#btn-today').click();

  // Метрики дня вместо общего процента.
  await expect(page.locator('#stats-row').getByText('Сегодня')).toBeVisible();
  await expect(page.locator('#stats-row').getByText('Хороших дней')).toBeVisible();

  // Принцип дня — с отметкой прямо здесь. Ищем внутри экрана дня: такие же
  // кнопки есть и в разделе Credo, он просто скрыт.
  const credoCheck = page.locator('#panel-tracker [data-act="toggle-credo"]');
  await expect(credoCheck).toBeVisible();
  const was = (await credoCheck.getAttribute('aria-checked')) === 'true';
  await credoCheck.click();
  await expect(page.locator('#panel-tracker [data-act="toggle-credo"]'))
    .toHaveAttribute('aria-checked', was ? 'false' : 'true');

  // Деньги за сегодня и поле быстрого ввода.
  await expect(page.locator('.today-money')).toBeVisible();
  await expect(page.locator('#quick-tx')).toBeVisible();

  expect(pageErrors).toEqual([]);
});

test('Сегодня: быстрый ввод понимает «850 кафе»', async ({page}) => {
  await openDemo(page);
  await page.locator('#btn-today').click();

  const before = await page.evaluate(() => txs.length);
  await page.locator('#quick-tx').fill('850 кафе');
  await page.locator('#quick-tx').press('Enter');

  expect(await page.evaluate(() => txs.length)).toBe(before + 1);
  const added = await page.evaluate(() => txs[0]);
  expect(added.amount).toBe(85000);
  expect(added.kind).toBe('expense');
  expect(added.note).toBe('кафе');

  // Знак «+» делает операцию доходом.
  await page.locator('#quick-tx').fill('+50000 клиент');
  await page.locator('#quick-tx').press('Enter');
  const income = await page.evaluate(() => txs[0]);
  expect(income.kind).toBe('income');
  expect(income.amount).toBe(5000000);

  // Категория подхватывается из прошлой операции с тем же словом.
  await page.evaluate(() => {
    txs.unshift({id: 'seed-1', ts: txs[0].ts, amount: 30000, kind: 'expense',
                 category: 'transport', note: 'такси домой'});
  });
  await page.locator('#quick-tx').fill('420 такси');
  await page.locator('#quick-tx').press('Enter');
  const guessed = await page.evaluate(() => txs.find(t => t.note === 'такси'));
  expect(guessed.category).toBe('transport');
});

test('Сегодня: строка мусора не создаёт операцию', async ({page}) => {
  await openDemo(page);
  await page.locator('#btn-today').click();

  const before = await page.evaluate(() => txs.length);
  await page.locator('#quick-tx').fill('просто текст');
  await page.locator('#quick-tx').press('Enter');

  expect(await page.evaluate(() => txs.length)).toBe(before);
  await expect(page.locator('#toast')).toContainText(/Не понял сумму/);
});

test('Money: повторить вчера копирует операции на сегодня', async ({page}) => {
  await openTab(page, 'money');

  const yesterdayCount = await page.evaluate(() => {
    const d = new Date(ty, tm, td - 1);
    const iso = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') +
                '-' + String(d.getDate()).padStart(2, '0');
    return txs.filter(t => t.ts === iso).length;
  });
  const before = await page.evaluate(() => txs.length);

  await page.getByRole('button', {name: /Повторить вчера/}).click();

  expect(await page.evaluate(() => txs.length)).toBe(before + yesterdayCount);
});

test('Money: бюджеты и сравнение с прошлым месяцем', async ({page}) => {
  await openTab(page, 'money');

  // В демо бюджеты заданы — блок виден и показывает лимиты.
  await expect(page.locator('#money-budgets .budget-bar').first()).toBeVisible();
  await expect(page.locator('#money-stats .delta').first()).toBeVisible();

  // Правка лимита через модалку.
  await page.getByRole('button', {name: /Бюджеты/}).click();
  await expect(page.locator('#budget-modal')).toHaveClass(/open/);
  await page.locator('.budget-input').first().fill('30000');
  await page.getByRole('button', {name: 'Сохранить'}).click();
  expect(await page.evaluate(() => sections.budgets[0].limit)).toBe(3000000);
});

test('Money: повторяющаяся операция добавляется одним нажатием', async ({page}) => {
  await openTab(page, 'money');

  await page.getByRole('button', {name: /Повторяющиеся/}).click();
  await expect(page.locator('#rules-modal')).toHaveClass(/open/);
  await expect(page.locator('.rule-row')).toHaveCount(3);

  const before = await page.evaluate(() => txs.length);
  await page.locator('[data-act="apply-rule"]').first().click();
  expect(await page.evaluate(() => txs.length)).toBe(before + 1);

  // Повторно ту же операцию не предлагаем.
  await expect(page.locator('.rule-done').first()).toBeVisible();
});

test('Money: импорт CSV разбирает дату, сумму и знак', async ({page}) => {
  await openTab(page, 'money');
  page.on('dialog', d => d.accept());

  const before = await page.evaluate(() => txs.length);
  await page.locator('#csv-file').setInputFiles({
    name: 'vypiska.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(
      'Дата;Сумма;Описание\n' +
      '06.09.2026;-1 250,50;Кофейня\n' +
      '05.09.2026;40000;Оплата клиента\n' +
      'кривая строка;;\n', 'utf-8')
  });

  await expect.poll(() => page.evaluate(() => txs.length)).toBe(before + 2);
  const imported = await page.evaluate(() => txs.filter(t => t.note === 'Кофейня')[0]);
  expect(imported.amount).toBe(125050);
  expect(imported.kind).toBe('expense');
  expect(imported.ts).toBe('2026-09-06');
});

test('разделы не ходят в сеть в демо-режиме', async ({page, sbRequests}) => {
  await openDemo(page);

  for (const name of ['focus', 'money', 'credo', 'quotes']) {
    await page.locator('#tab-' + name).click();
  }
  await page.locator('#tab-credo').click();
  await page.locator('.credo-row .task-check').first().click();

  expect(sbRequests).toEqual([]);
});
