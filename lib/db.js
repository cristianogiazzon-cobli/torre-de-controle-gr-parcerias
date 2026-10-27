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

/* ---- acesso e usuários (tabela public.usuarios) ---- */
const acesso = (k, email, nome, metodo) => rpc('tdc_acesso', { k, p_email: email, p_nome: nome || '', p_metodo: metodo });
const externoOk = (k, email) => rpc('tdc_externo_ok', { k, p_email: email });
const usuarios = (k) => rpc('tdc_usuarios_listar', { k });
const salvarUsuario = (k, email, nome, papel, ativo, por) => rpc('tdc_usuario_salvar', { k, p_email: email, p_nome: nome || '', p_papel: papel, p_ativo: ativo !== false, p_por: por });
const removerUsuario = (k, email) => rpc('tdc_usuario_remover', { k, p_email: email });
Object.assign(module.exports, { acesso, externoOk, usuarios, salvarUsuario, removerUsuario });
