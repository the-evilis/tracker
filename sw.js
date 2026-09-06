// Service worker трекера привычек.
// Задача — дать приложению открываться без сети. Данные при этом лежат
// в localStorage, а несинхронизированные отметки — в очереди внутри
// приложения, поэтому здесь достаточно кэшировать саму оболочку.

const CACHE = 'tracker-v2';

// Файлы оболочки. Внешние ресурсы (Supabase, шрифты, CDN) намеренно
// не кэшируем: они должны ходить в сеть и не мешать обновлению.
const SHELL = [
  '/',
  '/index.html',
  '/app.js',
  '/styles.css',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

// Код и стили обновляются вместе с разметкой, поэтому берутся из сети так
// же, как HTML. Иначе после деплоя человек получил бы новую страницу со
// старым скриптом из кэша — и приложение сломалось бы до второй загрузки.
const NETWORK_FIRST = ['/app.js', '/styles.css'];

self.addEventListener('install', event=>{
  event.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(SHELL))
      // Отсутствие одного файла не должно ломать всю установку.
      .catch(()=>{})
      .then(()=>self.skipWaiting())
  );
});

self.addEventListener('activate', event=>{
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch', event=>{
  const req = event.request;

  // Вмешиваемся только в обычные GET-запросы к своему домену.
  if(req.method !== 'GET') return;
  const url = new URL(req.url);
  if(url.origin !== self.location.origin) return;

  // HTML отдаём по стратегии «сначала сеть»: так пользователь сразу
  // получает свежую версию после деплоя, а без сети — версию из кэша.
  if(req.mode === 'navigate' || (req.headers.get('accept')||'').includes('text/html')){
    event.respondWith(
      fetch(req)
        .then(res=>{
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put('/index.html', copy)).catch(()=>{});
          return res;
        })
        .catch(()=> caches.match('/index.html').then(r => r || caches.match('/')))
    );
    return;
  }

  // Скрипт и стили — тоже «сначала сеть», с откатом на кэш без сети.
  if(NETWORK_FIRST.indexOf(url.pathname) !== -1){
    event.respondWith(
      fetch(req)
        .then(res=>{
          if(res && res.status === 200){
            const copy = res.clone();
            caches.open(CACHE).then(c => c.put(req, copy)).catch(()=>{});
          }
          return res;
        })
        .catch(()=> caches.match(req))
    );
    return;
  }

  // Остальная статика — «сначала кэш», обновляем фоном.
  event.respondWith(
    caches.match(req).then(cached=>{
      const network = fetch(req).then(res=>{
        if(res && res.status === 200){
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(()=>{});
        }
        return res;
      }).catch(()=> cached);
      return cached || network;
    })
  );
});
