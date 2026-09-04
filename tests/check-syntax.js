// Проверка синтаксиса всех встроенных <script> в HTML.
//
// Приложение — один файл без сборки, поэтому опечатка в скрипте не всплывает
// нигде до открытия страницы в браузере. Этот скрипт компилирует код, но не
// выполняет его: ошибка разбора будет видна сразу и с номером строки.
//
// Запуск: node tests/check-syntax.js index.html
const fs = require('fs');
const vm = require('vm');

const file = process.argv[2];
if (!file) {
  console.error('Использование: node tests/check-syntax.js <файл.html>');
  process.exit(2);
}

const html = fs.readFileSync(file, 'utf8');
const re = /<script([^>]*)>([\s\S]*?)<\/script>/gi;

let m, checked = 0, failed = 0;
while ((m = re.exec(html)) !== null) {
  const attrs = m[1] || '';
  const code = m[2];
  if (/\ssrc\s*=/i.test(attrs)) continue;      // внешний файл — проверять нечего
  if (!code.trim()) continue;

  // Номер строки начала блока — чтобы позиция ошибки совпадала с файлом.
  const line = html.slice(0, m.index).split('\n').length;
  checked++;
  try {
    new vm.Script(code, {filename: file + ' (<script> со строки ' + line + ')'});
    console.log('  ok   <script> со строки ' + line + ', ' + code.split('\n').length + ' строк');
  } catch (e) {
    failed++;
    console.log('  FAIL <script> со строки ' + line + ': ' + e.message);
  }
}

if (!checked) {
  console.error('В файле не нашлось ни одного встроенного <script>');
  process.exit(1);
}

console.log('\nПроверено блоков: ' + checked + (failed ? ', с ошибками: ' + failed : ', ошибок нет'));
process.exit(failed ? 1 : 0);
