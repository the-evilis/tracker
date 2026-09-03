// Service worker трекера привычек.
// Задача — дать приложению открываться без сети. Данные при этом лежат
// в localStorage, а несинхронизированные отметки — в очереди внутри
// приложения, поэтому здесь достаточно кэшировать саму оболочку.

const CACHE = 'tracker-v1';

// Файлы оболочки. Внешние ресурсы (Supabase, шрифты, CDN) намеренно
// не кэшируем: они должны ходить в сеть и не мешать обновлению.
const SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

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
