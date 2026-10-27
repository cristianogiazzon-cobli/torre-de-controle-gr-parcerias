/* Ponte única entre a tela e o back-end: POST /api/rpc  { fn, args: [...] }
 * Autenticação: cabeçalho Authorization: Bearer <token da sessão>. O e-mail vem do token (nunca do navegador).
 * A ACCESS_KEY fica só no servidor (funções tdc_* do banco e cron). */
const db = require('../lib/db');
const nt = require('../lib/notificar');
const { autenticar, pode, Erro } = require('../lib/auth');

const LEITURA = ['admin', 'editor', 'leitor'];
const EDICAO = ['admin', 'editor'];
const ADMIN = ['admin'];

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });
  const k = process.env.ACCESS_KEY;
  let u;
  try { u = await autenticar(req); }
  catch (e) { return res.status(e.status || 500).json({ error: e.message, motivo: e.motivo }); }
  const { fn, args = [] } = req.body || {};
  const exige = (...p) => { if (!pode(u, ...p)) throw new Erro(403, 'Seu papel (' + u.papel + ') não permite esta ação.', 'sem_permissao'); };
  try {
    let result;
    switch (fn) {
      case 'getMe': exige(...LEITURA); result = { email: u.email, nome: u.nome, papel: u.papel, avatar: u.avatar }; break;
      case 'getBootstrap': {
        exige(...LEITURA);
        const [clientes, catalogo] = await Promise.all([db.bootstrap(k), db.catalogo(k)]);
        let pendentes = 0;
        if (u.papel === 'admin') { const sl = await db.solicitacoes(k); pendentes = sl.filter(x => x.status === 'pendente').length; }
        result = { eu: u.email, nome: u.nome, papel: u.papel, avatar: u.avatar, clientes, catalogo, pendentes };
        break;
      }
      /* catálogo de eventos (leitura: todos; edição: só admin) */
      case 'getCatalogo': exige(...LEITURA); result = await db.catalogo(k); break;
      case 'salvarCatalogo': {
        exige(...ADMIN);
        const it = args[0] || {};
        result = await db.salvarCatalogo(k, it, u.email); break;
      }
      case 'removerCatalogo': exige(...ADMIN); result = await db.removerCatalogo(k, String(args[0] || ''), u.email); break;
      case 'pedirEvento': {
        exige(...EDICAO);
        const [cid, cnome, nome, grupo, obs] = args;
        result = await db.solicitar(k, u.email, cid, cnome, nome, grupo, obs); break;
      }
      case 'listarSolicitacoes': exige(...ADMIN); result = await db.solicitacoes(k); break;
      case 'resolverSolicitacao': {
        exige(...ADMIN);
        const [id, status, motivo, catId, addFicha] = args;
        result = await db.resolverSolicitacao(k, Number(id), status, motivo, u.email, catId, addFicha); break;
      }
      case 'getHistorico': exige(...LEITURA); result = await db.historico(k, args[0]); break;
      case 'saveCliente': exige(...EDICAO); result = await db.salvar(k, args[0], args[1], u.email, args[2]); break;
      case 'deleteCliente': exige(...ADMIN); result = await db.excluir(k, args[0], u.email); break;
      case 'getNotificacoes': exige('admin'); result = nt.estado(); break;
      case 'salvarSlack': throw new Error('Nesta versão, o Slack é configurado nas variáveis de ambiente do Vercel (SLACK_BOT_TOKEN, SLACK_CANAL, MODO_TESTE_EMAIL).');
      case 'ativarGatilho': exige('admin'); result = nt.estado(); break; // o envio diário é um cron do Vercel (vercel.json)
      case 'previaNotificacoes': exige('admin'); result = await nt.previa(k); break;
      case 'enviarAgora': exige('admin'); result = await nt.enviar(k, true); break;
      case 'enviarTeste': exige('admin'); result = await nt.teste(u.email); break;
      /* gestão de acessos — só admin */
      case 'listarAcessos': exige(...ADMIN); result = await db.usuarios(k); break;
      case 'salvarAcesso': {
        exige(...ADMIN);
        const [email, nome, papel, ativo] = args;
        const em = String(email || '').trim().toLowerCase();
        if (em === u.email && (papel !== 'admin' || ativo === false)) throw new Error('Você não pode rebaixar nem desativar o seu próprio acesso.');
        result = await db.salvarUsuario(k, em, nome, papel, ativo, u.email); break;
      }
      case 'removerAcesso': {
        exige(...ADMIN);
        const em = String(args[0] || '').trim().toLowerCase();
        if (em === u.email) throw new Error('Você não pode remover o seu próprio acesso.');
        result = await db.removerUsuario(k, em); break;
      }
      default: return res.status(400).json({ error: 'Função desconhecida: ' + fn });
    }
    return res.status(200).json({ result });
  } catch (e) {
    return res.status(e.status || 500).json({ error: e.message || String(e), motivo: e.motivo });
  }
};
