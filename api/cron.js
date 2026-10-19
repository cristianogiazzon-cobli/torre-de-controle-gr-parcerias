/* Envio diário (dias úteis, 8h de Brasília = 11:00 UTC). O Vercel chama com Authorization: Bearer CRON_SECRET. */
const nt = require('../lib/notificar');
module.exports = async (req, res) => {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.authorization !== 'Bearer ' + secret) return res.status(401).json({ error: 'não autorizado' });
  try { return res.status(200).json(await nt.enviar(process.env.ACCESS_KEY, false)); }
  catch (e) { return res.status(500).json({ error: e.message }); }
};
