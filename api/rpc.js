/* Ponte única entre a tela e o back-end: POST /api/rpc  { fn, args: [...] }
 * Acesso por link secreto: cabeçalho x-access-key = ACCESS_KEY (e, no banco, config.access_key). */
const crypto = require('crypto');
const db = require('../lib/db');
const nt = require('../lib/notificar');

const igual = (a, b) => {
  const x = Buffer.from(String(a || '')), y = Buffer.from(String(b || ''));
  return x.length === y.length && x.length > 0 && crypto.timingSafeEqual(x, y);
};

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });
  const k = req.headers['x-access-key'];
  if (!igual(k, process.env.ACCESS_KEY)) return res.status(401).json({ error: 'Link de acesso inválido. Peça o link atualizado a quem administra a plataforma.' });
  const usuario = decodeURIComponent(String(req.headers['x-user'] || '')).slice(0, 120) || 'acesso por link';
  const { fn, args = [] } = req.body || {};
  try {
    let result;
    switch (fn) {
      case 'getBootstrap': result = { eu: usuario, clientes: await db.bootstrap(k) }; break;
      case 'saveCliente': result = await db.salvar(k, args[0], args[1], usuario, args[2]); break;
      case 'deleteCliente': result = await db.excluir(k, args[0], usuario); break;
      case 'getHistorico': result = await db.historico(k, args[0]); break;
      case 'getNotificacoes': result = nt.estado(); break;
      case 'salvarSlack': throw new Error('Nesta versão, o Slack é configurado nas variáveis de ambiente do Vercel (SLACK_BOT_TOKEN, SLACK_CANAL, MODO_TESTE_EMAIL).');
      case 'ativarGatilho': result = nt.estado(); break; // o envio diário é um cron do Vercel (vercel.json)
      case 'previaNotificacoes': result = await nt.previa(k); break;
      case 'enviarAgora': result = await nt.enviar(k, true); break;
      case 'enviarTeste': result = await nt.teste(usuario); break;
      default: return res.status(400).json({ error: 'Função desconhecida: ' + fn });
    }
    return res.status(200).json({ result });
  } catch (e) {
    return res.status(500).json({ error: e.message || String(e) });
  }
};
