/* POST /api/otp { email } -> envia o link de acesso, só para externos cadastrados e ativos.
 * A resposta é sempre a mesma, para não revelar quem está cadastrado. */
const db = require('../lib/db');

const ultimo = new Map(); // limite simples por e-mail (por instância)
const base = () => (process.env.SUPABASE_URL || '').replace(/\/$/, '');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });
  const email = String((req.body && req.body.email) || '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 200) return res.status(400).json({ error: 'Digite um e-mail válido.' });
  const t = Date.now();
  if (ultimo.get(email) && t - ultimo.get(email) < 45000) return res.status(429).json({ error: 'Aguarde alguns segundos antes de pedir outro link.' });
  ultimo.set(email, t);
  if (ultimo.size > 500) ultimo.clear();
  try {
    if (await db.externoOk(process.env.ACCESS_KEY, email)) {
      const origem = (req.headers['x-forwarded-host'] ? 'https://' + req.headers['x-forwarded-host'] : '') || '';
      const to = origem ? '?redirect_to=' + encodeURIComponent(origem + '/login.html') : '';
      const r = await fetch(base() + '/auth/v1/otp' + to, {
        method: 'POST',
        headers: { apikey: process.env.SUPABASE_KEY, 'content-type': 'application/json' },
        body: JSON.stringify({ email, create_user: true })
      });
      if (!r.ok) return res.status(502).json({ error: 'Não foi possível enviar agora. Tente de novo em instantes.' });
    }
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: 'Não foi possível enviar agora. Tente de novo em instantes.' });
  }
};
