// Проверка сетевого слоя бота на подменённом fetch: какие запросы уходят
// в Supabase и Telegram и как обрабатываются ошибки.
//
// Сеть здесь не задействована вовсе — глобальный fetch подменяется. Это
// важно: ошибка в формате upsert или в заголовке Prefer видна только по
// запросу, а «поймать» её на живой базе означало бы её же и испортить.
//
// Запуск: node tests/test-bot-net.js
const {createSupabase} = require('../bot/lib/supabase');
const {createTelegram} = require('../bot/lib/telegram');

let pass = 0, fail = 0;
function check(name, got, want){
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if(ok){ pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + '\n       получено: ' + JSON.stringify(got) +
                             '\n       ожидалось: ' + JSON.stringify(want)); }
}
async function rejects(name, fn, re){
  try { await fn(); fail++; console.log('  FAIL ' + name + ': ошибки не было'); }
  catch(e){
    if(re && !re.test(e.message)){
      fail++; console.log('  FAIL ' + name + ': неожиданное сообщение «' + e.message + '»');
    } else { pass++; console.log('  ok   ' + name); }
  }
}

// Подменяем fetch и запоминаем все вызовы.
const calls = [];
function abortError(){
  const e = new Error('The operation was aborted');
  e.name = 'AbortError';
  return e;
}
function mockFetch(handler){
  calls.length = 0;
  global.fetch = async (url, opts = {}) => {
    calls.push({url: String(url), method: opts.method || 'GET',
                headers: opts.headers || {},
                body: opts.body ? JSON.parse(opts.body) : null,
                signal: opts.signal});
    const result = handler(String(url), opts, calls.length);
    if (!opts.signal) return result;
    // Настоящий fetch отменяется по сигналу — заглушка обязана вести себя
    // так же, иначе проверка таймаутов просто зависнет.
    return Promise.race([result, new Promise((_, reject) => {
      if (opts.signal.aborted) reject(abortError());
      else opts.signal.addEventListener('abort', () => reject(abortError()));
    })]);
  };
}
const json = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  json: async () => (typeof body === 'string' ? JSON.parse(body) : body)
});

const silentLog = {info(){}, warn(){}, error(){}, fail(){}};

(async () => {
  const db = createSupabase({
    url: 'https://example.supabase.co/',
    serviceKey: 'service-key',
    timeoutMs: 500,
    log: silentLog
  });

  console.log('\n1. Чтение списка привычек');
  mockFetch(() => json([{value: JSON.stringify([{id: 'd1', name: 'Медитация'}])}]));
  check('привычки разобраны', (await db.getHabits('user-1')).map(h => h.id), ['d1']);
  check('запрос к user_settings с фильтрами',
        /user_settings\?user_id=eq\.user-1&key=eq\.habits&select=value$/.test(calls[0].url), true);
  check('ключ передан в заголовках',
        [calls[0].headers.apikey, calls[0].headers.Authorization],
        ['service-key', 'Bearer service-key']);

  mockFetch(() => json([]));
  check('пусто → пустой список', await db.getHabits('user-1'), []);

  mockFetch(() => json([{value: '{ это не json'}]));
  check('битый JSON не роняет бота', await db.getHabits('user-1'), []);

  console.log('\n2. Чтение отметок');
  mockFetch(() => json([
    {id: '2026/8/4/d1', done: true},
    {id: '2026/8/3/d1', done: false},
    {id: '2026/8/2/d1', done: null}
  ]));
  check('берём только done=true', Object.keys(await db.getMarks('user-1')), ['2026/8/4/d1']);

  console.log('\n3. Отметка привычки');
  mockFetch(() => json('', 201));
  await db.mark('user-1', '2026/8/4/d1');
  check('POST в habits с on_conflict',
        /habits\?on_conflict=id,user_id$/.test(calls[0].url), true);
  check('метод POST', calls[0].method, 'POST');
  check('заголовок Prefer для upsert',
        calls[0].headers.Prefer, 'resolution=merge-duplicates,return=minimal');
  check('тело — массив с одной строкой',
        [calls[0].body.length, calls[0].body[0].id, calls[0].body[0].user_id, calls[0].body[0].done],
        [1, '2026/8/4/d1', 'user-1', true]);
  check('есть updated_at', typeof calls[0].body[0].updated_at, 'string');

  console.log('\n4. Снятие отметки — удалением строки');
  mockFetch(() => json('', 204));
  await db.unmark('user-1', '2026/8/4/d1');
  check('метод DELETE', calls[0].method, 'DELETE');
  check('фильтр по пользователю и ключу',
        /habits\?user_id=eq\.user-1&id=eq\.2026%2F8%2F4%2Fd1$/.test(calls[0].url), true);

  console.log('\n5. Значения количественных привычек');
  mockFetch(() => json('', 201));
  await db.setValues('user-1', {'2026/8/4/q1': 8});
  check('значения уходят одной JSON-строкой',
        [calls[0].body[0].key, calls[0].body[0].value], ['values', '{"2026/8/4/q1":8}']);

  console.log('\n6. Ошибки Supabase');
  mockFetch(() => json('permission denied for table habits', 403));
  await rejects('HTTP 403 → исключение с причиной',
                () => db.getMarks('user-1'), /HTTP 403.*permission denied/);

  mockFetch(() => new Promise(() => {}));   // ответ, который никогда не придёт
  await rejects('зависший запрос обрывается по таймауту',
                () => db.getMarks('user-1'), /таймаут 500 мс/);

  console.log('\n7. Telegram: отправка и ошибки');
  const tg = createTelegram({token: 'T', timeoutMs: 500, log: silentLog});

  mockFetch(() => json({ok: true, result: {message_id: 7}}));
  const sent = await tg.sendMessage('123', 'Привет', [[{text: 'ok', callback_data: 'r'}]]);
  check('вернулся результат', sent.message_id, 7);
  check('метод в адресе', /\/botT\/sendMessage$/.test(calls[0].url), true);
  check('parse_mode=HTML', calls[0].body.parse_mode, 'HTML');
  check('клавиатура передана', calls[0].body.reply_markup.inline_keyboard[0][0].callback_data, 'r');

  mockFetch(() => json({ok: false, description: 'chat not found'}));
  await rejects('ok:false → исключение с описанием',
                () => tg.sendMessage('123', 'x'), /chat not found/);

  // 429: первая попытка — «подожди», вторая — успех.
  mockFetch((url, opts, n) => n === 1
    ? json({ok: false, parameters: {retry_after: 0}}, 429)
    : json({ok: true, result: {message_id: 1}}));
  const after429 = await tg.sendMessage('123', 'x');
  check('после 429 запрос повторяется', [calls.length, after429.message_id], [2, 1]);

  // Сетевой сбой: одна ошибка не должна ронять отправку.
  mockFetch((url, opts, n) => {
    if (n === 1) throw new Error('ECONNRESET');
    return json({ok: true, result: {message_id: 2}});
  });
  const afterFail = await tg.sendMessage('123', 'x');
  check('после сетевого сбоя повтор удаётся', [calls.length, afterFail.message_id], [2, 2]);

  mockFetch(() => { throw new Error('ECONNRESET'); });
  await rejects('когда попытки кончились — ошибка наружу',
                () => tg.sendMessage('123', 'x'), /ECONNRESET/);

  mockFetch(() => new Promise(() => {}));
  await rejects('таймаут запроса к Telegram',
                () => tg.call('getMe', {}, {timeout: 300, retries: 0}), /таймаут 300 мс/);

  console.log('\n8. Длинный опрос');
  mockFetch(() => json({ok: true, result: []}));
  await tg.getUpdates(42, 30);
  check('смещение и таймаут переданы',
        [calls[0].body.offset, calls[0].body.timeout], [42, 30]);
  check('слушаем только нужные типы обновлений',
        calls[0].body.allowed_updates, ['message', 'callback_query']);

  console.log('\n' + (fail ? 'ПРОВАЛЕНО проверок: ' + fail + ' из ' + (pass + fail)
                           : 'Все проверки пройдены: ' + pass));
  process.exit(fail ? 1 : 0);
})();
