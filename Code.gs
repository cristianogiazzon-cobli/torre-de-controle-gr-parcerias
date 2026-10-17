/**
 * Torre de Controle — Cobli × GR Parcerias
 * Backend em Google Apps Script. Os dados ficam nas abas desta planilha:
 *   Clientes  -> 1 linha por cliente (campos principais + JSON completo)
 *   Historico -> registro de tudo que foi alterado, por quem e quando
 *   Config    -> reservada (não usada hoje)
 *   Resumo    -> visão achatada para filtrar/analisar na própria planilha (gerada automaticamente)
 */
const ABAS = { CLI: 'Clientes', HIST: 'Historico', CFG: 'Config', RES: 'Resumo' };
const CABECALHOS = {
  Clientes: ['id', 'nome', 'status', 'versao', 'atualizado_em', 'atualizado_por', 'dados_json'],
  Historico: ['data_hora', 'usuario', 'cliente_id', 'cliente', 'evento'],
  Config: ['chave', 'valor'],
  Resumo: ['Cliente', 'Status', 'Empresa (HubSpot)', 'Região', 'Ficha preenchida (%)', 'Blocos completos (de 8)', 'Próximo bloco incompleto',
           'Equipamentos', 'Painel liberado', 'Acessos ONE', 'Eventos monitorados', 'Grupos', 'Início do piloto', 'Fim previsto',
           'Dias para o fim', 'Resultado do piloto', 'Responsável Cobli', 'Atualizado em', 'Atualizado por']
};
const TZ = 'America/Sao_Paulo';

/** Rode UMA vez no editor (menu Executar > setup) para criar as abas. */
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  PropertiesService.getScriptProperties().setProperty('SS_ID', ss.getId());
  Object.keys(CABECALHOS).forEach(function (nome) {
    const sh = ss.getSheetByName(nome) || ss.insertSheet(nome);
    if (sh.getLastRow() === 0) {
      sh.getRange(1, 1, 1, CABECALHOS[nome].length).setValues([CABECALHOS[nome]])
        .setFontWeight('bold').setBackground('#2B1F8F').setFontColor('#FFFFFF');
      sh.setFrozenRows(1);
    }
  });
  ['Página1', 'Sheet1', 'Folha1'].forEach(function (n) {
    const s = ss.getSheetByName(n);
    if (s && ss.getSheets().length > 1) ss.deleteSheet(s);
  });
  ss.getSheetByName(ABAS.CLI).hideColumns(7);
  return 'Planilha pronta. Agora publique: Implantar > Nova implantação > App da Web.';
}

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Torre de Controle — Cobli × GR Parcerias')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/* ---------- helpers ---------- */
function ss_() {
  const id = PropertiesService.getScriptProperties().getProperty('SS_ID');
  if (!id) throw new Error('Execute a função setup() uma vez antes de usar a plataforma.');
  return SpreadsheetApp.openById(id);
}
function aba_(nome) {
  const sh = ss_().getSheetByName(nome);
  if (!sh) throw new Error('Aba "' + nome + '" não encontrada. Execute setup().');
  return sh;
}
function quem_() {
  return Session.getActiveUser().getEmail() || Session.getEffectiveUser().getEmail() || 'desconhecido';
}
function fmt_(d) {
  return d instanceof Date ? Utilities.formatDate(d, TZ, 'dd/MM/yyyy HH:mm') : String(d || '');
}
function hist_(cli, texto) {
  aba_(ABAS.HIST).appendRow([new Date(), quem_(), cli.id, cli.nome, texto]);
}
function comLock_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { return fn(); } finally { lock.releaseLock(); }
}

/* ---------- API chamada pelo front ---------- */
function getBootstrap() {
  const vals = aba_(ABAS.CLI).getDataRange().getValues().slice(1).filter(function (r) { return r[0]; });
  const clientes = vals.map(function (r) {
    const c = JSON.parse(r[6]);
    c._versao = String(r[3]);
    c._atualizadoEm = fmt_(r[4]);
    c._atualizadoPor = r[5];
    return c;
  });
  return { eu: quem_(), clientes: clientes };
}

function saveCliente(cli, versaoBase, logs) {
  const json = JSON.stringify(cli);
  if (json.length > 45000) throw new Error('Dados do cliente grandes demais para uma célula.');
  return comLock_(function () {
    const sh = aba_(ABAS.CLI);
    const vals = sh.getDataRange().getValues();
    let linha = -1;
    for (let i = 1; i < vals.length; i++) if (vals[i][0] === cli.id) { linha = i + 1; break; }
    if (linha > 0 && versaoBase && String(vals[linha - 1][3]) !== String(versaoBase)) {
      const atual = JSON.parse(vals[linha - 1][6]);
      atual._versao = String(vals[linha - 1][3]);
      return { conflito: true, cliente: atual, por: vals[linha - 1][5] };
    }
    const versao = 'v' + Date.now();
    const reg = [cli.id, cli.nome, cli.status, versao, new Date(), quem_(), json];
    if (linha > 0) sh.getRange(linha, 1, 1, 7).setValues([reg]); else sh.appendRow(reg);
    (logs || []).forEach(function (t) { hist_(cli, t); });
    atualizarResumo_();
    return { ok: true, versao: versao };
  });
}

function deleteCliente(id) {
  return comLock_(function () {
    const sh = aba_(ABAS.CLI), vals = sh.getDataRange().getValues();
    for (let i = 1; i < vals.length; i++) {
      if (vals[i][0] === id) {
        hist_({ id: id, nome: vals[i][1] }, 'Cliente excluído');
        sh.deleteRow(i + 1);
        break;
      }
    }
    atualizarResumo_();
    return true;
  });
}

function getHistorico(id) {
  return aba_(ABAS.HIST).getDataRange().getValues().slice(1)
    .filter(function (r) { return r[2] === id; })
    .reverse().slice(0, 200)
    .map(function (r) { return { ts: fmt_(r[0]), user: r[1], txt: r[4] }; });
}

/** Reescreve a aba Resumo (somente leitura, gerada a partir de Clientes). */
function atualizarResumo_() {
  const vals = aba_(ABAS.CLI).getDataRange().getValues().slice(1).filter(function (r) { return r[0]; });
  const hoje = today();
  const linhas = vals.map(function (r) {
    const c = JSON.parse(r[6]);
    const pb = proxBloco(c), pi = pilotoInfo(c, hoje), bl = blocos(c);
    return [c.nome, c.status, c.hubspot.empresa || '', c.hubspot.regiao || '', completude(c).pct / 100, nBlocosOk(c),
            pb < 0 ? 'Ficha completa' : (pb + 1) + '. ' + BLOCOS[pb], equipTxt(c), c.painel === 'sim' ? 'Sim' : (c.painel === 'nao' ? 'Não' : ''),
            c.one.length, eventosMon(c).length, c.grupos.length, fdate(c.inicio), fdate(c.fim),
            pi.restantes === null ? '' : pi.restantes, c.resultado || '', c.responsavel || '', fmt_(r[4]), r[5]];
  });
  const sh = aba_(ABAS.RES), n = CABECALHOS.Resumo.length;
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, n).clearContent();
  if (linhas.length) {
    sh.getRange(2, 1, linhas.length, n).setValues(linhas);
    sh.getRange(2, 5, linhas.length, 1).setNumberFormat('0%');
  }
}
