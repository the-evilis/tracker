// Конфигурация e2e-прогона. Статику отдаёт tests/serve.js — тот же набор
// файлов, что выкладывается на боевой домен, поэтому проверяется именно то,
// что уедет на сервер.
const {defineConfig, devices} = require('@playwright/test');

const PORT = process.env.PORT || 4173;
const BASE = 'http://127.0.0.1:' + PORT;

module.exports = defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  expect: {timeout: 7_000},
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // Больше четырёх параллельных браузеров на слабой машине уже роняют
  // сам Chromium — прогон при этом падает не по делу.
  workers: process.env.CI ? 1 : 4,
  reporter: process.env.CI ? [['list'], ['html', {open: 'never'}]] : [['list']],

  use: {
    baseURL: BASE,
    locale: 'ru-RU',
    timezoneId: 'Europe/Moscow',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },

  // Приложение в первую очередь телефонное, поэтому мобильный проект —
  // не украшение: вёрстка недели и месяца там другая.
  projects: [
    {name: 'desktop', use: {...devices['Desktop Chrome']}},
    {name: 'mobile',  use: {...devices['Pixel 5']}}
  ],

  webServer: {
    command: 'node tests/serve.js ' + PORT,
    url: BASE + '/index.html',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000
  }
});
