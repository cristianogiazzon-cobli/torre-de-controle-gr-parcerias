/* Acesso ao Supabase via funções RPC (tdc_*), todas protegidas pela chave de acesso (config.access_key).
 * Usa só a chave publicável: as tabelas têm RLS ligado e sem policies, então o único caminho é pelas funções. */
const URL_ = () => (process.env.SUPABASE_URL || '').replace(/\/$/, '');

async function rpc(nome, params) {
  const key = process.env.SUPABASE_KEY;
  if (!URL_() || !key) throw new Error('SUPABASE_URL / SUPABASE_KEY não configuradas no Vercel.');
  const r = await fetch(URL_() + '/rest/v1/rpc/' + nome, {
    method: 'POST',
    headers: { apikey: key, 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  });
  const txt = await r.text();
  let j; try { j = txt ? JSON.parse(txt) : null; } catch (e) { j = null; }
  if (!r.ok) throw new Error((j && (j.message || j.hint)) || ('Supabase ' + r.status));
  return j;
}

const bootstrap = (k) => rpc('tdc_bootstrap', { k });
const salvar = (k, cli, versaoBase, usuario, logs) => rpc('tdc_save', { k, cli, versao_base: versaoBase || '', usuario, logs: logs || [] });
const excluir = (k, cid, usuario) => rpc('tdc_delete', { k, cid, usuario });
const historico = (k, cid) => rpc('tdc_historico', { k, cid });

module.exports = { bootstrap, salvar, excluir, historico };
