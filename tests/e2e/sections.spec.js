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

test('разделы не ходят в сеть в демо-режиме', async ({page, sbRequests}) => {
  await openDemo(page);

  for (const name of ['focus', 'money', 'credo', 'quotes']) {
    await page.locator('#tab-' + name).click();
  }
  await page.locator('#tab-credo').click();
  await page.locator('.credo-row .task-check').first().click();

  expect(sbRequests).toEqual([]);
});
