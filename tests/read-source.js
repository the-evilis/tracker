// Откуда тесты берут код приложения.
//
// Раньше вся логика лежала внутри index.html, и тесты вырезали из него
// содержимое <script>. После разделения файлов логика живёт в app.js,
// но обе формы поддерживаются: так тест можно натравить и на собранную
// страницу, и на отдельный скрипт.
'use strict';

const fs = require('fs');

module.exports = function readSource(file) {
  if (!file) throw new Error('не указан файл с кодом приложения');
  const src = fs.readFileSync(file, 'utf8');
  if (/\.js$/i.test(file)) return src;

  const m = src.match(/<script>([\s\S]*)<\/script>/);
  if (!m) throw new Error('в ' + file + ' нет встроенного <script>');
  return m[1];
};
