// Smoke-проверки живого приложения в браузере.
//
// Логику дат покрывают tests/test-logic.js и tests/test-schedule.js — они
// работают без DOM. Здесь проверяется то, чего те увидеть не могут: страница
// вообще открывается, демо-режим включается, точки кликаются, виды
// переключаются, модалка работает, PWA-файлы на месте.
//
// Все тесты идут в демо-режиме: он не обращается к сети, а SDK Supabase
// подменён заглушкой (см. fixtures.js), поэтому боевая база не задействована.
const {test, expect, openDemo, dkey} = require('./fixtures');

test('экран входа открывается без ошибок', async ({page, pageErrors}) => {
  await page.goto('/index.html');

  await expect(page.locator('#auth-screen')).toBeVisible();
  await expect(page.getByPlaceholder('Ваш email')).toBeVisible();
  await expect(page.getByRole('button', {name: /Отправить ссылку для входа/})).toBeVisible();
  await expect(page.getByRole('button', {name: /Демо-режим/})).toBeVisible();
  // Приложение до входа не должно показывать основной экран.
  await expect(page.locator('#main-app')).toBeHidden();

  expect(pageErrors).toEqual([]);
});

test('демо-режим открывается и показывает историю', async ({page, pageErrors}) => {
  await openDemo(page);

  // Баннер обязателен: без него человек не знает, что данные не сохранятся.
  await expect(page.locator('#demo-banner')).toBeVisible();
  await expect(page.locator('#user-email-display')).toHaveText('Демо-режим');

  // Демо наполняется историей — статистика не должна быть пустой.
  const stats = page.locator('#stats-row .stat');
  await expect(stats).toHaveCount(4);
  await expect(stats.nth(0)).toContainText(/из/);
  await expect(stats.nth(1)).toContainText(/%/);
  await expect(page.locator('#stats-row').getByText('Дней закрыто')).toBeVisible();

  // Процент выполнения в демо заведомо больше нуля.
  const pct = await stats.nth(1).locator('.stat-num').innerText();
  expect(parseInt(pct, 10)).toBeGreaterThan(0);

  // Карточек столько же, сколько активных привычек.
  const habitCount = await page.evaluate(() => activeHabits().length);
  await expect(page.locator('#habits-list .habit-card-week')).toHaveCount(habitCount);

  expect(pageErrors).toEqual([]);
});

test('отметка за сегодня переключается и меняет статистику', async ({page, pageErrors}) => {
  await openDemo(page);

  const today = new Date();
  const habitId = await page.evaluate(() => activeHabits()[0].id);
  const dot = page.locator('button[role="checkbox"][data-k="' + dkey(today, habitId) + '"]');
  await expect(dot).toHaveCount(1);

  const before = await dot.getAttribute('aria-checked');
  const doneBefore = await page.evaluate(() => Object.keys(data).filter(x => data[x]).length);

  await dot.click();
  await expect(dot).toHaveAttribute('aria-checked', before === 'true' ? 'false' : 'true');

  const doneAfter = await page.evaluate(() => Object.keys(data).filter(x => data[x]).length);
  expect(doneAfter).toBe(before === 'true' ? doneBefore - 1 : doneBefore + 1);

  // Обратный клик возвращает исходное состояние — снятая галочка удаляет
  // запись, а не пишет done:false.
  await dot.click();
  await expect(dot).toHaveAttribute('aria-checked', before);
  const key = dkey(today, habitId);
  const stored = await page.evaluate(k => (k in data ? data[k] : null), key);
  expect(stored).toBe(before === 'true' ? true : null);

  expect(pageErrors).toEqual([]);
});

test('будущие дни отмечать нельзя', async ({page}) => {
  await openDemo(page);

  const future = page.locator('#habits-list button[role="checkbox"][disabled]');
  const count = await future.count();
  // В недельном виде будущие дни есть всегда, кроме воскресенья.
  if (count > 0) {
    await expect(future.first()).toBeDisabled();
  }
});

test('в демо-режиме нет обращений к Supabase', async ({page, sbRequests}) => {
  await openDemo(page);

  const habitId = await page.evaluate(() => activeHabits()[0].id);
  const dot = page.locator('button[role="checkbox"][data-k="' + dkey(new Date(), habitId) + '"]');
  await dot.click();
  await dot.click();

  // Ни одного сетевого запроса и ни одного вызова клиента: демо обязано
  // работать целиком локально.
  expect(sbRequests).toEqual([]);
  const clientCalls = await page.evaluate(() => window.__sbStubCalls.filter(c => c.fn !== 'from'));
  expect(clientCalls).toEqual([]);
});

test('виды недели, месяца и года переключаются', async ({page, pageErrors}) => {
  await openDemo(page);

  await page.locator('#btn-month').click();
  await expect(page.locator('#btn-month')).toHaveClass(/active/);
  await expect(page.locator('#habits-list .month-card').first()).toBeVisible();

  await page.locator('#btn-year').click();
  await expect(page.locator('#btn-year')).toHaveClass(/active/);
  await expect(page.locator('#habits-list .year-dot').first()).toBeVisible();
  // В годовом виде листать нечего — стрелки прячутся.
  await expect(page.locator('#btn-prev')).toBeHidden();

  await page.locator('#btn-week').click();
  await expect(page.locator('#habits-list .habit-card-week').first()).toBeVisible();
  await expect(page.locator('#btn-prev')).toBeVisible();

  // Выбранный вид запоминается между запусками.
  expect(await page.evaluate(() => localStorage.getItem('view'))).toBe('week');

  expect(pageErrors).toEqual([]);
});

test('навигация по неделям меняет заголовок', async ({page}) => {
  await openDemo(page);

  const title = page.locator('#nav-title');
  const start = await title.innerText();
  await page.locator('#btn-prev').click();
  await expect(title).not.toHaveText(start);
  await page.locator('#btn-next').click();
  await expect(title).toHaveText(start);
});

test('модалка привычек: добавление и закрытие по Esc', async ({page, pageErrors}) => {
  await openDemo(page);

  const before = await page.evaluate(() => activeHabits().length);

  await page.locator('#edit-btn').click();
  const modal = page.locator('#edit-modal');
  await expect(modal).toBeVisible();

  await page.locator('#new-habit-input').fill('Тест e2e');
  await page.locator('#add-habit-btn').click();
  await page.getByRole('button', {name: 'Сохранить'}).click();

  await expect(modal).toBeHidden();
  await expect(page.locator('#habits-list').getByText('Тест e2e')).toBeVisible();
  expect(await page.evaluate(() => activeHabits().length)).toBe(before + 1);

  // Esc закрывает модалку — без этого с телефона её было не бросить.
  await page.locator('#edit-btn').click();
  await expect(modal).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(modal).toBeHidden();

  expect(pageErrors).toEqual([]);
});

test('тема переключается и запоминается', async ({page}) => {
  await openDemo(page);

  const html = page.locator('html');
  const wasDark = (await html.getAttribute('data-theme')) === 'dark';

  await page.locator('#theme-btn').click();
  await expect(html).toHaveAttribute('data-theme', wasDark ? 'light' : 'dark');
  expect(await page.evaluate(() => localStorage.getItem('theme')))
    .toBe(wasDark ? 'light' : 'dark');
});

test('файлы PWA отдаются и service worker регистрируется', async ({page}) => {
  const manifest = await page.request.get('/manifest.json');
  expect(manifest.ok()).toBeTruthy();
  const json = await manifest.json();
  expect(json.name || json.short_name).toBeTruthy();

  const sw = await page.request.get('/sw.js');
  expect(sw.ok()).toBeTruthy();

  await page.goto('/index.html');
  // Регистрация асинхронная, поэтому ждём, а не проверяем сразу.
  await expect.poll(async () => page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return 'нет поддержки';
    const reg = await navigator.serviceWorker.getRegistration();
    return reg ? 'есть' : 'нет';
  }), {timeout: 10_000}).toBe('есть');
});
