/* Login: valida o token da sessão (Supabase Auth) e resolve o papel do usuário.
 * Regras (no banco, tdc_acesso): @cobli.co só entra pelo Google e vira "editor" no primeiro login;
 * quem não é @cobli.co só entra se o admin cadastrou o e-mail (e ele estiver ativo). */
const db = require('./db');

const ADMIN = 'cristiano.giazzon@cobli.co';
const MSG = {
  nao_autorizado: 'Este acesso é restrito a contas @cobli.co ou liberadas pelo administrador. Fale com ' + ADM() + '.',
  desativado: 'Seu acesso está desativado. Fale com ' + ADM() + '.',
  cobli_google: 'Contas @cobli.co entram pelo botão "Entrar com Google".',
  sem_email: 'Não foi possível identificar o e-mail da sua conta. Tente outra conta Google.'
};
function ADM() { return ADMIN; }

class Erro extends Error {
  constructor(status, msg, motivo) { super(msg); this.status = status; this.motivo = motivo; }
}

const base = () => (process.env.SUPABASE_URL || '').replace(/\/$/, '');

function metodoDoToken(tok) {
  try {
    const p = JSON.parse(Buffer.from(tok.split('.')[1], 'base64url').toString('utf8'));
    const m = Array.isArray(p.amr) && p.amr[0] && p.amr[0].method;
    return m === 'oauth' ? 'oauth' : 'otp';
  } catch (e) { return 'otp'; }
}

/* Devolve { email, nome, papel, avatar } ou lança Erro(401|403). */
async function autenticar(req) {
  const h = String(req.headers.authorization || '');
  const tok = h.startsWith('Bearer ') ? h.slice(7).trim() : '';
  if (!tok) throw new Erro(401, 'Entre com sua conta para continuar.');
  if (!base() || !process.env.SUPABASE_KEY) throw new Erro(500, 'SUPABASE_URL / SUPABASE_KEY não configuradas no Vercel.');
  let u;
  try {
    const r = await fetch(base() + '/auth/v1/user', { headers: { apikey: process.env.SUPABASE_KEY, authorization: 'Bearer ' + tok } });
    if (!r.ok) throw new Error('token');
    u = await r.json();
  } catch (e) { throw new Erro(401, 'Sua sessão expirou. Entre novamente.'); }
  const email = String(u.email || '').toLowerCase();
  const meta = u.user_metadata || {};
  const verificado = !!u.email_confirmed_at || meta.email_verified === true;
  if (!email || !verificado) throw new Erro(403, MSG.sem_email, 'sem_email');
  const nome = meta.full_name || meta.name || '';
  const res = await db.acesso(process.env.ACCESS_KEY, email, nome, metodoDoToken(tok));
  if (!res || !res.ok) {
    const motivo = (res && res.motivo) || 'nao_autorizado';
    throw new Erro(403, MSG[motivo] || MSG.nao_autorizado, motivo);
  }
  return { email: res.email, nome: res.nome || nome || res.email, papel: res.papel, avatar: meta.avatar_url || meta.picture || '' };
}

const pode = (u, ...papeis) => papeis.includes(u.papel);

module.exports = { autenticar, pode, Erro, MSG };
