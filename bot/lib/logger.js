// Логирование в файл с ротацией по размеру. Сервисов на машине несколько,
// journald чистится по своим правилам, а разбираться в пропущенном
// напоминании удобнее по обычному текстовому логу рядом с остальными
// логами проекта (/var/log/tracker-*.log).
//
// Ротация простая и предсказуемая: при превышении лимита файл переименуется
// в .1, .1 → .2 и так далее до LOG_KEEP; самый старый удаляется.
'use strict';

const fs = require('fs');
const path = require('path');

function createLogger({file, maxBytes = 1024 * 1024, keep = 3, echo = true}) {
  let broken = false;   // если писать не выходит — не спамим ошибкой на каждой строке

  function ensureDir() {
    const dir = path.dirname(file);
    if (dir && !fs.existsSync(dir)) fs.mkdirSync(dir, {recursive: true});
  }

  function rotate() {
    let size = 0;
    try { size = fs.statSync(file).size; } catch (e) { return; }
    if (size < maxBytes) return;

    try { fs.unlinkSync(file + '.' + keep); } catch (e) { /* самого старого могло не быть */ }
    for (let i = keep - 1; i >= 1; i--) {
      try { fs.renameSync(file + '.' + i, file + '.' + (i + 1)); } catch (e) { /* пропуск */ }
    }
    try { fs.renameSync(file, file + '.1'); } catch (e) { /* пропуск */ }
  }

  function write(level, msg) {
    const line = '[' + new Date().toISOString() + '] ' + level + ' ' + msg;
    if (echo) console.log(line);
    if (broken) return;
    try {
      ensureDir();
      rotate();
      fs.appendFileSync(file, line + '\n');
    } catch (e) {
      broken = true;
      console.error('Не удаётся писать лог в ' + file + ': ' + e.message + ' — дальше только в stdout');
    }
  }

  return {
    info:  msg => write('INFO ', msg),
    warn:  msg => write('WARN ', msg),
    error: msg => write('ERROR', msg),
    // Ошибку логируем со стеком: без него «TypeError: undefined» бесполезен.
    fail: (msg, err) => write('ERROR', msg + ': ' + (err && err.stack ? err.stack : err))
  };
}

module.exports = {createLogger};
