// Проверка синтаксиса кода приложения.
//
// Сборки в проекте нет, поэтому опечатка в скрипте не всплывает нигде до
// открытия страницы в браузере. Этот скрипт компилирует код, но не
// выполняет его: ошибка разбора видна сразу и с номером строки.
//
// Запуск:
//   node tests/check-syntax.js app.js       — отдельный файл скрипта
//   node tests/check-syntax.js index.html   — все встроенные <script> страницы
'use strict';

const fs = require('fs');
const vm = require('vm');

const file = process.argv[2] || 'app.js';
if (!fs.existsSync(file)) {
  console.error('Файл не найден: ' + file);
  process.exit(2);
}

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

if (/\.js$/i.test(file)) {
  const code = fs.readFileSync(file, 'utf8');
  compile(code, file, code.split('\n').length);
} else {
  const html = fs.readFileSync(file, 'utf8');
  const re = /<script([^>]*)>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const attrs = m[1] || '';
    const code = m[2];
    if (/\ssrc\s*=/i.test(attrs)) continue;      // внешний файл — проверять нечего
    if (!code.trim()) continue;

    // Номер строки начала блока — чтобы позиция ошибки совпадала с файлом.
    const line = html.slice(0, m.index).split('\n').length;
    compile(code, file + ' (<script> со строки ' + line + ')', code.split('\n').length);
  }
  if (!checked) {
    // После разделения файлов это нормально: весь код уехал в app.js.
    console.log('  --   встроенных <script> в ' + file + ' нет, проверять нечего');
    process.exit(0);
  }
}

console.log('\nПроверено блоков: ' + checked + (failed ? ', с ошибками: ' + failed : ', ошибок нет'));
process.exit(failed ? 1 : 0);
