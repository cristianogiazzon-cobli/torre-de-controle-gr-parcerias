/* Avisos no Slack (porta de Notificacoes.gs). Configuração por variáveis de ambiente do Vercel:
 *   SLACK_BOT_TOKEN  xoxb-... (chat:write, users:read, users:read.email)
 *   SLACK_CANAL      canal do resumo geral (opcional)
 *   MODO_TESTE_EMAIL e-mail que recebe TUDO enquanto estiver preenchido (padrão: cristiano.giazzon@cobli.co; "-" desliga o modo teste)
 *   APP_URL          link da plataforma citado nas mensagens (opcional)
 * Nesta fase não há envio por e-mail: só Slack. */
const R = require('./regras');
const db = require('./db');

const TESTE_PADRAO = 'cristiano.giazzon@cobli.co';
const modoTeste = () => {
  const v = process.env.MODO_TESTE_EMAIL;
  if (v === undefined || v === '') return TESTE_PADRAO;
  return v.trim() === '-' ? '' : v.trim();
};

async function slack(metodo, payload) {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) throw new Error('SLACK_BOT_TOKEN não configurado.');
  const r = await fetch('https://slack.com/api/' + metodo, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(payload)
  });
  const j = await r.json();
  if (!j.ok) throw new Error('Slack ' + metodo + ': ' + j.error);
  return j;
}
async function slackUserId(email) {
  const r = await fetch('https://slack.com/api/users.lookupByEmail?email=' + encodeURIComponent(email), {
    headers: { Authorization: 'Bearer ' + process.env.SLACK_BOT_TOKEN }
  });
  const j = await r.json();
  if (!j.ok) throw new Error('Slack users.lookupByEmail: ' + j.error);
  return j.user.id;
}
const postarCanal = (canal, text) => slack('chat.postMessage', { channel: canal, text, unfurl_links: false });
const postarDM = async (email, text) => slack('chat.postMessage', { channel: await slackUserId(email), text, unfurl_links: false });

function estado() {
  return {
    token: !!process.env.SLACK_BOT_TOKEN, webhook: false, canal: process.env.SLACK_CANAL || '',
    gatilho: true, ultimo: null, url: process.env.APP_URL || '', testeEmail: modoTeste()
  };
}

async function previa(k) {
  return R.montarMensagens(await db.bootstrap(k), R.today(), { forcar: true, url: process.env.APP_URL || '' });
}

/** forcar=true ignora fim de semana e frequência (envio manual). */
async function enviar(k, forcar) {
  const msgs = R.montarMensagens(await db.bootstrap(k), R.today(), { forcar, url: process.env.APP_URL || '' });
  const teste = modoTeste();
  const res = { quando: new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }), alertas: msgs.total, global: 0, canais: 0, dms: 0, emails: 0, erros: [], fimDeSemana: msgs.fimDeSemana, modoTeste: teste };
  if (teste) {
    if (msgs.total) {
      const partes = [];
      if (msgs.global) partes.push('📣 *Seria enviado ao canal geral:*\n' + msgs.global.text);
      msgs.clientes.forEach((c) => partes.push('📣 *Seria enviado ao canal ' + c.canal + ':*\n' + c.text));
      msgs.dms.forEach((d) => partes.push('✉️ *Seria enviado por mensagem direta a ' + d.email + ':*\n' + d.text));
      const texto = '🧪 *MODO TESTE — Torre de Controle* (nada foi enviado a outras pessoas)\n\n' + partes.join('\n\n──────────\n\n');
      try { await postarDM(teste, texto); res.dms = 1; } catch (e) { res.erros.push('Slack para ' + teste + ': ' + e.message); }
    }
  } else {
    if (msgs.global && process.env.SLACK_CANAL) {
      try { await postarCanal(process.env.SLACK_CANAL, msgs.global.text); res.global = 1; } catch (e) { res.erros.push('Canal geral: ' + e.message); }
    }
    for (const c of msgs.clientes) {
      try { await postarCanal(c.canal, c.text); res.canais++; } catch (e) { res.erros.push('Canal de ' + c.nome + ': ' + e.message); }
    }
    for (const d of msgs.dms) {
      try { await postarDM(d.email, d.text); res.dms++; } catch (e) { res.erros.push('DM ' + d.email + ': ' + e.message); }
    }
  }
  return res;
}

async function teste(usuario) {
  const alvo = modoTeste() || (R.emailOk(usuario) ? usuario : '');
  const erros = [];
  const txt = '✅ Teste da *Torre de Controle*: as notificações estão funcionando.' + (modoTeste() ? ' (modo teste)' : '');
  if (!alvo) return { ok: false, erros: ['Sem destinatário: defina MODO_TESTE_EMAIL no Vercel.'], destino: '' };
  try { await postarDM(alvo, txt); } catch (e) { erros.push('Slack para ' + alvo + ': ' + e.message); }
  return { ok: !erros.length, erros, destino: alvo };
}

module.exports = { estado, previa, enviar, teste };
