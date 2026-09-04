// Общая обвязка e2e-тестов.
//
// Две фикстуры включаются автоматически для каждого теста:
//   * подмена SDK Supabase локальной заглушкой и запрет любых запросов
//     на *.supabase.co — прогон не трогает боевую базу и не зависит от сети;
//   * сбор ошибок консоли и необработанных исключений страницы.
const base = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const STUB = fs.readFileSync(path.join(__dirname, 'supabase-stub.js'), 'utf8');

const test = base.test.extend({
  // Сюда попадают все попытки постучаться в Supabase. В демо-режиме список
  // обязан оставаться пустым — это отдельная проверка.
  sbRequests: [async ({page}, use) => {
    const requests = [];

    await page.route('**/cdn.jsdelivr.net/**', route => route.fulfill({
      status: 200,
      contentType: 'application/javascript; charset=utf-8',
      body: STUB
    }));

    await page.route('**://*.supabase.co/**', route => {
      requests.push(route.request().method() + ' ' + route.request().url());
      route.abort();
    });

    await use(requests);
  }, {auto: true}],

  // Ошибки консоли — самый дешёвый способ поймать опечатку в скрипте:
  // приложение в одном файле, любая такая ошибка убивает всю страницу.
  pageErrors: [async ({page}, use) => {
    const errors = [];
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    page.on('console', msg => {
      if (msg.type() !== 'error') return;
      const text = msg.text();
      // Заблокированные нами же запросы к Supabase — ожидаемый шум.
      if (/supabase\.co/.test(text) || /Failed to load resource/.test(text)) return;
      errors.push('console: ' + text);
    });
    await use(errors);
  }, {auto: true}]
});

// Ключ отметки в базе: год/месяц/день/id, месяц с нуля — как в JavaScript.
function dkey(date, habitId) {
  return date.getFullYear() + '/' + date.getMonth() + '/' + date.getDate() + '/' + habitId;
}

// Открыть приложение и войти в демо-режим — точка старта почти всех тестов.
async function openDemo(page) {
  await page.goto('/index.html');
  await page.getByRole('button', {name: /Демо-режим/}).click();
  await base.expect(page.locator('#main-app')).toBeVisible();
  await base.expect(page.locator('#habits-list .habit-card-week').first()).toBeVisible();
}

module.exports = {test, expect: base.expect, openDemo, dkey};
