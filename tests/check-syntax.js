// Проверка синтаксиса кода приложения.
//
// Сборки в проекте нет, поэтому опечатка не всплывает нигде до открытия
// страницы в браузере. Скрипт компилирует код, но не выполняет его: ошибка
// разбора видна сразу и с номером строки.
//
// Запуск:
//   node tests/check-syntax.js               — все части app-*.js
//   node tests/check-syntax.js app-money.js  — конкретный файл
//   node tests/check-syntax.js index.html    — встроенные <script> страницы
'use strict';

const fs = require('fs');
const vm = require('vm');
const path = require('path');
const {allParts} = require('./read-source');

let checked = 0, failed = 0;

function compile(code, label, lines) {
  checked++;
  try {
    new vm.Script(code, {filename: label});
    console.log('  ok   ' + label + ', ' + lines + ' строк');
  } catch (e) {
    failed++;
    console.log('  FAIL ' + label + ': ' + e.message);
  }
}

function checkJs(file) {
  const code = fs.readFileSync(file, 'utf8');
  compile(code, path.basename(file), code.split('\n').length);
}

const arg = process.argv[2];

if (!arg || arg === 'app.js') {
  const parts = allParts();
  if (!parts.length) {
    console.error('Не найдено ни одного app-*.js');
    process.exit(2);
  }
  parts.forEach(checkJs);
} else if (!fs.existsSync(arg)) {
  console.error('Файл не найден: ' + arg);
  process.exit(2);
} else if (/\.js$/i.test(arg)) {
  checkJs(arg);
} else {
  const html = fs.readFileSync(arg, 'utf8');
  const re = /<script([^>]*)>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const attrs = m[1] || '';
    const code = m[2];
    if (/\ssrc\s*=/i.test(attrs)) continue;      // внешний файл — проверять нечего
    if (!code.trim()) continue;
    const line = html.slice(0, m.index).split('\n').length;
    compile(code, arg + ' (<script> со строки ' + line + ')', code.split('\n').length);
  }
  if (!checked) {
    console.log('  --   встроенных <script> в ' + arg + ' нет, проверять нечего');
    process.exit(0);
  }
}

console.log('\nПроверено файлов: ' + checked + (failed ? ', с ошибками: ' + failed : ', ошибок нет'));
process.exit(failed ? 1 : 0);
