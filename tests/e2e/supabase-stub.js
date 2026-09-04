// Заглушка вместо @supabase/supabase-js с CDN.
//
// Зачем: e2e-прогон не должен ни зависеть от доступности jsdelivr, ни иметь
// даже теоретическую возможность записать что-нибудь в боевую базу. Демо-режим
// приложения к сети не обращается, но клиент всё равно создаётся при загрузке,
// поэтому глобальный `supabase.createClient` обязан существовать.
//
// Заглушка повторяет ровно тот кусок API, который использует index.html:
// auth (getSession, onAuthStateChange, signInWithOtp, signInWithOAuth, signOut),
// from().select/eq/in/maybeSingle/upsert/delete и channel/removeChannel.
// Любой запрос данных возвращает пустой результат без ошибки.
(function () {
  const empty = () => Promise.resolve({data: [], error: null});

  function query() {
    // Цепочка вида sb.from('habits').select(...).eq(...) должна быть
    // «тенабельной»: приложение делает await прямо на цепочке.
    const q = {
      select() { return q; },
      eq() { return q; },
      in() { return q; },
      upsert() { return q; },
      delete() { return q; },
      maybeSingle() { return Promise.resolve({data: null, error: null}); },
      then(onFulfilled, onRejected) { return empty().then(onFulfilled, onRejected); },
      catch(fn) { return empty().catch(fn); },
      finally(fn) { return empty().finally(fn); }
    };
    return q;
  }

  window.__sbStubCalls = [];

  window.supabase = {
    createClient() {
      return {
        auth: {
          getSession() { return Promise.resolve({data: {session: null}, error: null}); },
          onAuthStateChange() {
            return {data: {subscription: {unsubscribe() {}}}};
          },
          signInWithOtp(args) {
            window.__sbStubCalls.push({fn: 'signInWithOtp', args});
            return Promise.resolve({data: {}, error: null});
          },
          signInWithOAuth(args) {
            window.__sbStubCalls.push({fn: 'signInWithOAuth', args});
            return Promise.resolve({data: {}, error: null});
          },
          signOut() {
            window.__sbStubCalls.push({fn: 'signOut'});
            return Promise.resolve({error: null});
          }
        },
        from(table) {
          window.__sbStubCalls.push({fn: 'from', table});
          return query();
        },
        channel() {
          const ch = {on() { return ch; }, subscribe() { return ch; }};
          return ch;
        },
        removeChannel() {}
      };
    }
  };
})();
