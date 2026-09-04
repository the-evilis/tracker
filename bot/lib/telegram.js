// Обёртка над Bot API. Ничего лишнего: отправка и правка сообщений,
// ответ на нажатие кнопки и длинный опрос обновлений.
//
// Два правила, без которых бот однажды тихо повисает:
//   * у каждого запроса есть таймаут (AbortController) — иначе висящее
//     соединение останавливает весь цикл;
//   * ошибку 429 уважаем и ждём столько, сколько просит Telegram.
'use strict';

const API = 'https://api.telegram.org/bot';

function createTelegram({token, timeoutMs = 15000, log}) {
  async function call(method, payload, {timeout = timeoutMs, retries = 2} = {}) {
    let lastErr = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeout);
      try {
        const res = await fetch(API + token + '/' + method, {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify(payload || {}),
          signal: ctrl.signal
        });
        const body = await res.json().catch(() => ({}));

        if (res.status === 429) {
          const wait = ((body.parameters && body.parameters.retry_after) || 1) * 1000;
          if (log) log.warn('Telegram просит подождать ' + Math.round(wait / 1000) + ' с (' + method + ')');
          await sleep(wait);
          continue;
        }
        if (!body.ok) {
          throw new Error(method + ': ' + (body.description || ('HTTP ' + res.status)));
        }
        return body.result;
      } catch (e) {
        lastErr = e.name === 'AbortError'
          ? new Error(method + ': таймаут ' + timeout + ' мс')
          : e;
        // Сетевые сбои — обычное дело, поэтому повторяем с нарастающей паузой.
        if (attempt < retries) await sleep(1000 * (attempt + 1));
      } finally {
        clearTimeout(timer);
      }
    }
    throw lastErr;
  }

  return {
    call,

    sendMessage: (chatId, text, keyboard) => call('sendMessage', {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      reply_markup: keyboard ? {inline_keyboard: keyboard} : undefined
    }),

    editMessage: (chatId, messageId, text, keyboard) => call('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      reply_markup: keyboard ? {inline_keyboard: keyboard} : undefined
    }),

    answerCallback: (id, text) => call('answerCallbackQuery', {
      callback_query_id: id,
      text: text || undefined
    }),

    // Длинный опрос: соединение живёт до pollTimeout секунд, поэтому свой
    // таймаут делаем заведомо больше, иначе будем рвать нормальные запросы.
    getUpdates: (offset, pollTimeoutSec) => call('getUpdates', {
      offset,
      timeout: pollTimeoutSec,
      allowed_updates: ['message', 'callback_query']
    }, {timeout: (pollTimeoutSec + 10) * 1000, retries: 0}),

    setMyCommands: commands => call('setMyCommands', {commands})
  };
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Текст привычки уходит в сообщение с parse_mode=HTML, а в названии
// вполне может оказаться «<» или «&».
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

module.exports = {createTelegram, sleep, esc};
