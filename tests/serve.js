// Минимальный статический сервер для e2e-тестов: отдаёт файлы проекта так же,
// как это делает nginx на боевом домене. Без зависимостей — приложение живёт
// без сборки, и тестовая обвязка не должна тянуть за собой лишнего.
//
// Запуск: node tests/serve.js [порт]   (по умолчанию 4173, либо $PORT)
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PORT = parseInt(process.argv[2] || process.env.PORT || '4173', 10);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.png':  'image/png',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.webmanifest': 'application/manifest+json'
};

const server = http.createServer((req, res) => {
  let rel;
  try {
    rel = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch (e) {
    res.writeHead(400).end('Bad request');
    return;
  }
  if (rel === '/' || rel === '') rel = '/index.html';

  // Выход за пределы папки проекта запрещён: сервер тестовый, но пусть ведёт
  // себя корректно — иначе ../ из адреса отдаст что угодно с диска.
  const file = path.join(ROOT, path.normalize(rel).replace(/^([\\/])+/, ''));
  if (!file.startsWith(ROOT)) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  fs.readFile(file, (err, buf) => {
    if (err) {
      res.writeHead(404, {'Content-Type': 'text/plain; charset=utf-8'}).end('Не найдено');
      return;
    }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
      // Тесты всегда должны видеть свежий файл, а не прошлый прогон.
      'Cache-Control': 'no-store'
    }).end(buf);
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('Статика проекта на http://127.0.0.1:' + PORT + '/ (корень: ' + ROOT + ')');
});

// Без этого Playwright не сможет корректно погасить сервер после прогона.
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => server.close(() => process.exit(0)));
}
