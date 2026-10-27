/* GET /api/config -> URL e chave publicável do Supabase (feitas para ficar no navegador). */
module.exports = (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const url = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const key = process.env.SUPABASE_KEY || '';
  if (!url || !key) return res.status(500).json({ error: 'Configuração ausente.' });
  return res.status(200).json({ url, key });
};
