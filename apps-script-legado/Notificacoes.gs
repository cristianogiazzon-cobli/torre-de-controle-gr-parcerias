/**
 * Notificações no Slack — avisos de dados faltantes e prazos de piloto/etapas.
 * As regras (o que avisar, para quem e quando) vêm de Regras.gs (montarMensagens).
 *
 * Configuração (feita pela aba "Notificações" da plataforma ou em
 * Configurações do projeto > Propriedades do script):
 *   SLACK_BOT_TOKEN   token do app do Slack (xoxb-...), escopos: chat:write, users:read, users:read.email
 *   SLACK_CANAL       canal do resumo geral (ID tipo C0123ABCD ou #nome)
 *   SLACK_WEBHOOK_URL (opcional) webhook de entrada, usado só se não houver token
 */
function prop_(k) { return PropertiesService.getScriptProperties().getProperty(k); }

function slackApi_(metodo, payload) {
  const token = prop_('SLACK_BOT_TOKEN');
  if (!token) throw new Error('SLACK_BOT_TOKEN não configurado.');
  const r = UrlFetchApp.fetch('https://slack.com/api/' + metodo, {
    method: 'post', headers: { Authorization: 'Bearer ' + token }, payload: payload, muteHttpExceptions: true
  });
  const j = JSON.parse(r.getContentText());
  if (!j.ok) throw new Error('Slack ' + metodo + ': ' + j.error);
  return j;
}

function slackUserId_(email) {
  const cache = CacheService.getScriptCache(), k = 'su_' + email.toLowerCase();
  let id = cache.get(k);
  if (id) return id;
  id = slackApi_('users.lookupByEmail', { email: email }).user.id;
  cache.put(k, id, 21600);
  return id;
}

function postarCanal_(canal, texto) {
  if (prop_('SLACK_BOT_TOKEN')) { slackApi_('chat.postMessage', { channel: canal, text: texto, unfurl_links: 'false' }); return; }
  const wh = prop_('SLACK_WEBHOOK_URL');
  if (!wh) throw new Error('Slack não configurado (token ou webhook).');
  UrlFetchApp.fetch(wh, { method: 'post', contentType: 'application/json', payload: JSON.stringify({ text: texto }) });
}

function postarDM_(email, texto) {
  slackApi_('chat.postMessage', { channel: slackUserId_(email), text: texto, unfurl_links: 'false' });
}

function clientes_() {
  return aba_(ABAS.CLI).getDataRange().getValues().slice(1).filter(function (r) { return r[0]; })
    .map(function (r) { return JSON.parse(r[6]); });
}

const EMAIL_TESTE_PADRAO = 'cristiano.giazzon@cobli.co';
/** Enquanto houver e-mail de teste, TUDO (Slack e e-mail) vai só para essa pessoa. Para liberar geral, esvazie o campo na aba Notificações. */
function emailTeste_() {
  const v = prop_('MODO_TESTE_EMAIL');
  return v === null ? EMAIL_TESTE_PADRAO : String(v).trim();
}
function mdParaTexto_(t) {
  return String(t).replace(/<(https?:[^|>]+)\|([^>]+)>/g, '$2 ($1)').replace(/\*/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}
function enviarEmail_(para, assunto, texto) {
  MailApp.sendEmail({ to: para, subject: assunto, body: mdParaTexto_(texto), name: 'Torre de Controle' });
}

function urlApp_() { try { return ScriptApp.getService().getUrl(); } catch (e) { return ''; } }

/** Monta e envia. forcar=true ignora fim de semana e frequência (envio manual). */
function enviarNotificacoes_(forcar) {
  const msgs = montarMensagens(clientes_(), today(), { forcar: forcar, url: urlApp_() });
  const teste = emailTeste_();
  const res = { quando: Utilities.formatDate(new Date(), TZ, 'dd/MM/yyyy HH:mm'), alertas: msgs.total, global: 0, canais: 0, dms: 0, emails: 0, erros: [], fimDeSemana: msgs.fimDeSemana, modoTeste: teste || '' };
  if (teste) {
    // MODO TESTE: nada vai para canais nem para outras pessoas; tudo é consolidado e enviado só ao e-mail de teste.
    if (msgs.total) {
      const partes = [];
      if (msgs.global) partes.push('📣 *Seria enviado ao canal geral:*\n' + msgs.global.text);
      msgs.clientes.forEach(function (c) { partes.push('📣 *Seria enviado ao canal ' + c.canal + ':*\n' + c.text); });
      msgs.dms.forEach(function (d) { partes.push('✉️ *Seria enviado por mensagem direta a ' + d.email + ':*\n' + d.text); });
      const texto = '🧪 *MODO TESTE — Torre de Controle* (nada foi enviado a outras pessoas)\n\n' + partes.join('\n\n──────────\n\n');
      if (prop_('SLACK_BOT_TOKEN')) {
        try { postarDM_(teste, texto); res.dms = 1; } catch (e) { res.erros.push('Slack para ' + teste + ': ' + e.message); }
      } else res.erros.push('Slack: token não configurado.');
      try { enviarEmail_(teste, '🧪 Torre de Controle — resumo de pontos de atenção (teste)', texto); res.emails = 1; } catch (e) { res.erros.push('E-mail para ' + teste + ': ' + e.message); }
    }
  } else {
    if (msgs.global && (prop_('SLACK_CANAL') || prop_('SLACK_WEBHOOK_URL'))) {
      try { postarCanal_(prop_('SLACK_CANAL'), msgs.global.text); res.global = 1; } catch (e) { res.erros.push('Canal geral: ' + e.message); }
    }
    msgs.clientes.forEach(function (c) {
      try { postarCanal_(c.canal, c.text); res.canais++; } catch (e) { res.erros.push('Canal de ' + c.nome + ': ' + e.message); }
    });
    if (prop_('SLACK_BOT_TOKEN')) {
      msgs.dms.forEach(function (d) {
        try { postarDM_(d.email, d.text); res.dms++; } catch (e) { res.erros.push('DM ' + d.email + ': ' + e.message); }
      });
    } else if (msgs.dms.length) res.erros.push('DMs exigem SLACK_BOT_TOKEN (com webhook só é possível postar no canal).');
  }
  PropertiesService.getScriptProperties().setProperty('ULTIMO_ENVIO', JSON.stringify(res));
  return res;
}

/** Função do gatilho diário (dias úteis; a cadência de cada tipo de aviso vem de Regras.gs). */
function rotinaDiaria() { enviarNotificacoes_(false); }

/* ---------- chamadas da tela ---------- */
function getNotificacoes() {
  const ult = prop_('ULTIMO_ENVIO');
  return {
    token: !!prop_('SLACK_BOT_TOKEN'), webhook: !!prop_('SLACK_WEBHOOK_URL'), canal: prop_('SLACK_CANAL') || '',
    gatilho: ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'rotinaDiaria'; }),
    ultimo: ult ? JSON.parse(ult) : null, url: urlApp_(), testeEmail: emailTeste_()
  };
}
function salvarSlack(token, canal, webhook, testeEmail) {
  const p = PropertiesService.getScriptProperties();
  if (token) p.setProperty('SLACK_BOT_TOKEN', String(token).trim());
  if (canal !== undefined) p.setProperty('SLACK_CANAL', String(canal || '').trim());
  if (webhook) p.setProperty('SLACK_WEBHOOK_URL', String(webhook).trim());
  if (testeEmail !== undefined) p.setProperty('MODO_TESTE_EMAIL', String(testeEmail || '').trim());
  return getNotificacoes();
}
function ativarGatilho() {
  ScriptApp.getProjectTriggers().filter(function (t) { return t.getHandlerFunction() === 'rotinaDiaria'; })
    .forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('rotinaDiaria').timeBased().everyDays(1).atHour(8).inTimezone(TZ).create();
  return getNotificacoes();
}
function previaNotificacoes() { return montarMensagens(clientes_(), today(), { forcar: true, url: urlApp_() }); }
function enviarAgora() { return enviarNotificacoes_(true); }
function enviarTeste() {
  const teste = emailTeste_(), erros = [];
  const txt = '✅ Teste da *Torre de Controle*: as notificações estão funcionando.';
  if (teste) {
    // modo teste: só a pessoa configurada recebe (Slack + e-mail)
    if (prop_('SLACK_BOT_TOKEN')) { try { postarDM_(teste, txt + ' (modo teste)'); } catch (e) { erros.push('Slack para ' + teste + ': ' + e.message); } }
    else erros.push('Slack: token não configurado.');
    try { enviarEmail_(teste, '✅ Torre de Controle — teste de e-mail', txt); } catch (e) { erros.push('E-mail para ' + teste + ': ' + e.message); }
    return { ok: !erros.length, erros: erros, destino: teste };
  }
  try { postarCanal_(prop_('SLACK_CANAL'), txt); } catch (e) { erros.push('Canal geral: ' + e.message); }
  const eu = quem_();
  if (prop_('SLACK_BOT_TOKEN') && eu.indexOf('@') > 0) { try { postarDM_(eu, txt); } catch (e) { erros.push('DM para ' + eu + ': ' + e.message); } }
  return { ok: !erros.length, erros: erros, destino: eu };
}
