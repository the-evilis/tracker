// Доступ к данным трекера через REST-интерфейс Supabase.
//
// Бот ходит с ключом service_role: он обходит RLS, потому что напоминание
// приходит человеку, которого в этот момент нет в браузере, и обычной
// пользовательской сессии не существует. Ключ живёт только в /opt/tracker-bot/.env
// с правами 600 и в репозиторий не попадает.
//
// Схема данных повторяет приложение:
//   habits(id = «год/месяц/день/<id привычки>», user_id, done=true)
//   user_settings(user_id, key='habits'|'values', value = JSON-строка)
// Снятая отметка удаляет строку, а не пишет done:false.
'use strict';

function createSupabase({url, serviceKey, timeoutMs = 15000, log}) {
  const base = url.replace(/\/+$/, '') + '/rest/v1/';

  async function request(path, {method = 'GET', body, headers = {}} = {}) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(base + path, {
        method,
        headers: Object.assign({
          apikey: serviceKey,
          Authorization: 'Bearer ' + serviceKey,
          'Content-Type': 'application/json'
        }, headers),
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: ctrl.signal
      });

      const text = await res.text();
      if (!res.ok) {
        // PostgREST кладёт причину в тело — без неё отладка превращается
        // в гадание по коду ответа.
        throw new Error('Supabase ' + method + ' ' + path + ' → HTTP ' + res.status +
                        (text ? ': ' + text.slice(0, 300) : ''));
      }
      if (!text) return null;
      try { return JSON.parse(text); } catch (e) { return null; }
    } catch (e) {
      if (e.name === 'AbortError') throw new Error('Supabase ' + method + ' ' + path + ': таймаут ' + timeoutMs + ' мс');
      throw e;
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    // Список привычек пользователя (JSON в user_settings под ключом habits).
    async getHabits(userId) {
      const rows = await request('user_settings?user_id=eq.' + encodeURIComponent(userId) +
                                 '&key=eq.habits&select=value');
      if (!rows || !rows.length || !rows[0].value) return [];
      try {
        const list = JSON.parse(rows[0].value);
        return Array.isArray(list) ? list : [];
      } catch (e) {
        if (log) log.warn('Список привычек пользователя ' + userId + ' не разбирается как JSON');
        return [];
      }
    },

    // Все отметки пользователя: их немного (одна строка на выполненный день),
    // а для серий нужна вся история.
    async getMarks(userId) {
      const rows = await request('habits?user_id=eq.' + encodeURIComponent(userId) +
                                 '&select=id,done');
      const marks = {};
      (rows || []).forEach(r => { if (r.done === true) marks[r.id] = true; });
      return marks;
    },

    // Числа количественных привычек («8 стаканов») лежат отдельным JSON.
    async getValues(userId) {
      const rows = await request('user_settings?user_id=eq.' + encodeURIComponent(userId) +
                                 '&key=eq.values&select=value');
      if (!rows || !rows.length || !rows[0].value) return {};
      try {
        const v = JSON.parse(rows[0].value);
        return v && typeof v === 'object' ? v : {};
      } catch (e) {
        return {};
      }
    },

    async setValues(userId, values) {
      await request('user_settings?on_conflict=user_id,key', {
        method: 'POST',
        headers: {Prefer: 'resolution=merge-duplicates,return=minimal'},
        body: [{user_id: userId, key: 'values', value: JSON.stringify(values)}]
      });
    },

    // Отметить день выполненным. Ключ и upsert — ровно как в приложении,
    // иначе строки задвоятся по паре (id, user_id).
    async mark(userId, key) {
      await request('habits?on_conflict=id,user_id', {
        method: 'POST',
        headers: {Prefer: 'resolution=merge-duplicates,return=minimal'},
        body: [{id: key, user_id: userId, done: true, updated_at: new Date().toISOString()}]
      });
    },

    // Снять отметку — именно удалением строки, как это делает приложение.
    async unmark(userId, key) {
      await request('habits?user_id=eq.' + encodeURIComponent(userId) +
                    '&id=eq.' + encodeURIComponent(key), {
        method: 'DELETE',
        headers: {Prefer: 'return=minimal'}
      });
    }
  };
}

module.exports = {createSupabase};
