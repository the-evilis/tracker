// Откуда тесты берут код приложения.
//
// Логика лежит в нескольких файлах app-*.js, которые на странице
// подключаются подряд и делят общую область видимости. Для тестов они
// просто склеиваются: функции вытаскиваются по имени, порядок не важен.
//
// Поддерживаются три формы вызова:
//   readSource()                — все app-*.js из корня проекта;
//   readSource('app-money.js')  — один конкретный файл;
//   readSource('index.html')    — встроенный <script> страницы (старый вид).
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function allParts() {
  return fs.readdirSync(ROOT)
    .filter(f => /^app-[\w-]+\.js$/.test(f))
    .sort()
    .map(f => path.join(ROOT, f));
}

module.exports = function readSource(file) {
  // Без аргумента (или со старым «app.js») берём все части приложения.
  if (!file || file === 'app.js') {
    const parts = allParts();
    if (!parts.length) throw new Error('в проекте не найдено ни одного app-*.js');
    return parts.map(p => fs.readFileSync(p, 'utf8')).join('\n');
  }

  const src = fs.readFileSync(file, 'utf8');
  if (/\.js$/i.test(file)) return src;

  const m = src.match(/<script>([\s\S]*)<\/script>/);
  if (!m) throw new Error('в ' + file + ' нет встроенного <script>');
  return m[1];
};

module.exports.allParts = allParts;
