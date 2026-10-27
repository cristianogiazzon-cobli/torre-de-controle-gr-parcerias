/* Torre de Controle — sessão (Supabase Auth, sem bibliotecas).
 * Google: /auth/v1/authorize -> volta em /login.html com #access_token (fluxo implícito).
 * A sessão fica no navegador; o servidor valida o token em cada chamada (/api/rpc, /api/pdf). */
(function () {
  'use strict';
  var K = 'tdc_sess', cfgP = null, refreshing = null;
  var now = function () { return Math.floor(Date.now() / 1000); };

  /* limpa restos do acesso antigo por link secreto */
  try { localStorage.removeItem('tdc_k'); localStorage.removeItem('tdc_user'); } catch (e) {}
  try {
    var u0 = new URL(location.href);
    if (u0.searchParams.has('k')) { u0.searchParams.delete('k'); history.replaceState(null, '', u0.pathname + (u0.search || '') + u0.hash); }
  } catch (e) {}

  function cfg() {
    return cfgP || (cfgP = fetch('/api/config', { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error('Configuração indisponível.');
      return r.json();
    }));
  }
  function load() { try { return JSON.parse(localStorage.getItem(K) || 'null'); } catch (e) { return null; } }
  function save(s) { try { localStorage.setItem(K, JSON.stringify(s)); } catch (e) {} }
  function clear() { try { localStorage.removeItem(K); } catch (e) {} }
  function hasSession() { var s = load(); return !!(s && s.refresh_token); }

  /* Depois do redirecionamento: guarda a sessão do #hash. Devolve texto de erro, ou null. */
  function takeHash() {
    var h = location.hash.replace(/^#/, '');
    if (!h) return null;
    var p = new URLSearchParams(h);
    if (p.get('error') || p.get('error_description')) {
      history.replaceState(null, '', location.pathname + location.search);
      return 'Não foi possível entrar. Tente novamente.';
    }
    var at = p.get('access_token');
    if (!at) return null;
    save({ access_token: at, refresh_token: p.get('refresh_token'), expires_at: now() + (parseInt(p.get('expires_in'), 10) || 3600) });
    history.replaceState(null, '', location.pathname + location.search);
    return null;
  }

  function refresh(s) {
    if (refreshing) return refreshing;
    refreshing = (async function () {
      try {
        var c = await cfg();
        var r = await fetch(c.url + '/auth/v1/token?grant_type=refresh_token', {
          method: 'POST', headers: { apikey: c.key, 'content-type': 'application/json' },
          body: JSON.stringify({ refresh_token: s.refresh_token })
        });
        if (!r.ok) { clear(); return null; }
        var j = await r.json();
        var n = { access_token: j.access_token, refresh_token: j.refresh_token || s.refresh_token, expires_at: now() + (j.expires_in || 3600) };
        save(n); return n;
      } finally { refreshing = null; }
    })();
    return refreshing;
  }

  async function token() {
    var s = load();
    if (!s) return '';
    if (s.expires_at - 60 < now()) { s = await refresh(s); if (!s) return ''; }
    return s.access_token;
  }

  async function me() {
    var t = await token(), e;
    if (!t) { e = new Error('Sessão expirada.'); e.status = 401; throw e; }
    var r = await fetch('/api/rpc', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + t }, body: JSON.stringify({ fn: 'getMe', args: [] }) });
    var j = await r.json().catch(function () { return {}; });
    if (!r.ok) { e = new Error(j.error || ('Erro ' + r.status)); e.status = r.status; e.motivo = j.motivo; throw e; }
    return j.result;
  }

  async function loginGoogle() {
    var c = await cfg();
    location.href = c.url + '/auth/v1/authorize?provider=google&redirect_to=' + encodeURIComponent(location.origin + '/login.html') + '&hd=cobli.co&prompt=select_account';
  }

  async function signOut() {
    var s = load();
    try {
      if (s && s.access_token) {
        var c = await cfg();
        await fetch(c.url + '/auth/v1/logout', { method: 'POST', headers: { apikey: c.key, authorization: 'Bearer ' + s.access_token } });
      }
    } catch (e) {}
    clear();
  }

  function toLogin(motivo) { location.replace('/login.html' + (motivo ? '?erro=' + encodeURIComponent(motivo) : '')); }

  window.TDCAuth = { token: token, me: me, hasSession: hasSession, takeHash: takeHash, loginGoogle: loginGoogle, signOut: signOut, toLogin: toLogin };
})();
