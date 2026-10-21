/* ===================================================================
 * REGRAS — fonte única das regras de negócio (usada pela tela e pelo
 * servidor de notificações). Funções puras, sem DOM e sem Apps Script.
 * Modelo: 1 FICHA DE ASSESSMENT por piloto/cliente, com 8 blocos.
 * Nada é obrigatório; a ficha só mede o quanto já está preenchido.
 * =================================================================== */
var STATUS = ['Onboarding', 'Piloto', 'Ativo', 'Pausado', 'Encerrado'];
var RESULTADOS = ['Em andamento', 'Prorrogado', 'Convertido em contrato', 'Encerrado sem conversão'];
var EQUIPS = ['OBD', 'Instalado', 'Rede CAN', 'Câmera Fadiga', 'StreaMax'];
var SEVS = ['Leve', 'Grave', 'Gravíssimo'];
var ACOES = [['', '—'], ['grupo', 'Aviso no grupo de WhatsApp'], ['motorista', 'Ligar para o motorista'], ['gestor', 'Ligar para o gestor da frota']];
var EMAIL_CSO = 'cso@grparceria.com.br';
var EVENTOS_BASE = ['Distração', 'Fadiga', 'Uso de celular', 'Excesso de velocidade', 'Ultrapassagem de faixa contínua', 'Colisão',
  'Obstrução de câmera', 'Sem cinto de segurança', 'Freada brusca', 'Curva brusca', 'Distância perigosa', 'Excesso de RPM',
  'Motor ocioso', 'Permanência em ponto', 'Sem identificação do motorista'];
var IDX_VELOCIDADE = 3;
/* Blocos da ficha (sec = índice) */
var GATILHOS = ['Imediato (1ª ocorrência)', 'Nítido 1x', 'Nítido 2x', 'Nítido 3x', '3 s', '5 s', '10 s', '15 s', '30 s', '60 s', '3 eventos em 60 min'];
var FROTAS = [['leve', 'Frota leve'], ['pesada', 'Frota pesada'], ['hibrida', 'Frota híbrida']];
var BLOCOS = ['Referência (HubSpot)', 'Equipamentos enviados', 'Liberação no painel', 'Acesso à plataforma ONE',
  'Grupos de aviso', 'Eventos monitorados', 'Frota monitorada', 'Piloto (início e fim)'];
var DIAS_AVISO_PILOTO = [15, 7, 3, 2, 1, 0]; // dias antes do fim em que o Slack avisa
var DIAS_COBRANCA = [1, 3, 5];               // seg/qua/sex: lembrete de dados faltantes

/* ---------- datas ---------- */
function iso(d) { var z = new Date(d.getTime() - d.getTimezoneOffset() * 60000); return z.toISOString().slice(0, 10); }
function today() { return iso(new Date()); }
function pd(s) { return new Date(s + 'T12:00:00'); }
function addDays(s, n) { var d = pd(s); d.setDate(d.getDate() + n); return iso(d); }
function diff(a, b) { return Math.round((pd(a) - pd(b)) / 864e5); }
function fdate(s) { if (!s) return '—'; var p = String(s).split('-'); return p[2] + '/' + p[1] + '/' + p[0]; }

/* ---------- validações ---------- */
function emailOk(s) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || '').trim()); }
function foneOk(s) { return String(s || '').replace(/\D/g, '').length >= 10; }
/** Extrai o ID do registro de um link do HubSpot (ou aceita o próprio ID numérico). */
function hsId(s) {
  s = String(s || '').trim(); if (!s) return '';
  if (/^\d+$/.test(s)) return s;
  var m = s.replace(/[?#].*$/, '').match(/(\d+)\/?$/);
  return m ? m[1] : '';
}
function placasLista(txt) {
  return String(txt || '').split(/[\s,;]+/).map(function (p) { return p.toUpperCase().replace(/[^A-Z0-9]/g, ''); }).filter(Boolean);
}

/* ---------- consultas sobre a ficha ---------- */
function emProjeto(c) { return c.status === 'Onboarding' || c.status === 'Piloto'; }
function ativoCli(c) { return c.status !== 'Pausado' && c.status !== 'Encerrado'; }
function equipTxt(c) {
  var l = EQUIPS.filter(function (e) { return c.equip[e] && +c.equip[e].qtd > 0; }).map(function (e) { return e + ' × ' + c.equip[e].qtd; });
  return l.length ? l.join(', ') : '';
}
function eventosMon(c) { return c.eventos.filter(function (e) { return e.monitorar; }); }
function gruposNomes(c) { return c.grupos.map(function (g) { return (g.nome || '').trim(); }).filter(Boolean); }

/* ---------- dados a preencher (acompanhamento; nada é bloqueante) ---------- */
function itens(c) {
  var L = [];
  function add(sec, l, ok) { L.push({ sec: sec, l: l, ok: !!ok }); }
  var h = c.hubspot;
  add(0, 'ID ou link do HubSpot', h.id);
  add(0, 'Nome da empresa', h.empresa && String(h.empresa).trim());
  add(0, 'Responsável', h.responsavel && String(h.responsavel).trim());
  add(0, 'Região / endereço', h.regiao && String(h.regiao).trim());
  var q = EQUIPS.some(function (e) { return c.equip[e] && +c.equip[e].qtd > 0; });
  add(1, 'Ao menos 1 equipamento com quantidade', q);
  add(1, 'Data de instalação', c.instalacao);
  add(2, 'Liberação no painel respondida (Sim/Não)', c.painel === 'sim' || c.painel === 'nao');
  add(2, 'Painel liberado — ' + EMAIL_CSO + ' adicionado', c.painel === 'sim');
  var us = c.one;
  add(3, 'Ao menos 1 acesso à plataforma ONE', us.length > 0);
  add(3, 'Todos os acessos com nome e e-mail válido', us.length > 0 && us.every(function (u) { return u.nome && emailOk(u.email); }));
  var mon = eventosMon(c);
  add(5, 'Ao menos 1 evento marcado para monitorar', mon.length > 0);
  add(5, 'Todos os eventos monitorados com severidade (Leve/Grave/Gravíssimo)', mon.length > 0 && mon.every(function (e) { return e.sev; }));
  add(5, 'Todos os eventos monitorados com gatilho definido', mon.length > 0 && mon.every(function (e) { return e.gatilho && String(e.gatilho).trim(); }));
  add(5, 'Todos os eventos monitorados com ao menos 1 ação', mon.length > 0 && mon.every(function (e) { return e.acoes.some(function (a) { return a.t; }); }));
  var refs = [];
  c.eventos.forEach(function (e) { e.acoes.forEach(function (a) { if (a.t === 'grupo') refs.push(a.g); }); });
  if (refs.length) add(5, 'Ações de grupo apontam para um grupo cadastrado', refs.every(function (g) { return g && gruposNomes(c).indexOf(g) >= 0; }));
  if (c.eventos[IDX_VELOCIDADE] && c.eventos[IDX_VELOCIDADE].monitorar)
    add(5, 'Excesso de velocidade: ao menos 1 regra (via, % acima e severidade)', c.velocidade.some(function (r) { return r.pct && r.sev; }));
  add(6, 'Tipo de frota (leve, pesada ou híbrida)', c.frota.tipo === 'leve' || c.frota.tipo === 'pesada' || c.frota.tipo === 'hibrida');
  add(6, 'Monitorar todos os veículos OU informar as placas', c.frota.todos || placasLista(c.frota.placas).length > 0);
  add(4, 'Ao menos 1 grupo', c.grupos.length > 0);
  add(4, 'Todos os grupos com nome, objetivo e ao menos 1 pessoa com telefone válido', c.grupos.length > 0 && c.grupos.every(function (g) {
    return g.nome && g.objetivo && g.pessoas.length > 0 && g.pessoas.every(function (p) { return p.nome && foneOk(p.telefone); });
  }));
  add(7, 'Início do piloto', c.inicio);
  add(7, 'Fim previsto do piloto', c.fim && (!c.inicio || c.fim >= c.inicio));
  add(0, 'Responsável Cobli (e-mail)', emailOk(c.responsavel));
  return L;
}
function faltas(c, sec) { return itens(c).filter(function (i) { return i.sec === sec && !i.ok; }).map(function (i) { return i.l; }); }
function completude(c) {
  var L = itens(c), ok = L.filter(function (i) { return i.ok; }).length;
  return { ok: ok, total: L.length, pct: Math.round(ok / L.length * 100) };
}
/** Situação de cada bloco: {sec, titulo, ok, total, pct, completo}. */
function blocos(c) {
  var L = itens(c);
  return BLOCOS.map(function (t, s) {
    var d = L.filter(function (i) { return i.sec === s; }), ok = d.filter(function (i) { return i.ok; }).length;
    return { sec: s, titulo: t, ok: ok, total: d.length, pct: d.length ? Math.round(ok / d.length * 100) : 100, completo: ok === d.length };
  });
}
function nBlocosOk(c) { return blocos(c).filter(function (b) { return b.completo; }).length; }
/** Primeiro bloco incompleto (índice) ou -1. */
function proxBloco(c) { var b = blocos(c); for (var i = 0; i < b.length; i++) if (!b[i].completo) return i; return -1; }
/** Pendências, texto curto por bloco (usado em alertas). */
function pendenciasTxt(c) {
  var out = [];
  BLOCOS.forEach(function (t, s) { var f = faltas(c, s); if (f.length) out.push((s + 1) + '. ' + t + ' (' + f.length + ' item(ns))'); });
  return out;
}

/* ---------- piloto ---------- */
function pilotoInfo(c, hoje) {
  hoje = hoje || today();
  var r = { inicio: c.inicio, fim: c.fim, fimReal: c.fimReal, resultado: c.resultado || 'Em andamento', estado: 'sem datas', total: 0, decorridos: 0, restantes: null, pct: 0 };
  if (!c.inicio || !c.fim) return r;
  r.total = Math.max(1, diff(c.fim, c.inicio));
  r.decorridos = Math.max(0, Math.min(r.total, diff(hoje, c.inicio)));
  r.restantes = diff(c.fim, hoje);
  r.pct = Math.round(r.decorridos / r.total * 100);
  if (c.fimReal || r.resultado === 'Convertido em contrato' || r.resultado === 'Encerrado sem conversão') r.estado = 'encerrado';
  else if (hoje < c.inicio) r.estado = 'planejado';
  else if (r.restantes < 0) r.estado = 'vencido';
  else if (r.restantes <= 7) r.estado = 'vence';
  else r.estado = 'andamento';
  return r;
}

/* ---------- alertas (tela + Slack) ----------
 * freq: 'diario' = Slack todo dia útil · 'mwf' = seg/qua/sex · 'ui' = só na tela */
function alertas(c, hoje) {
  hoje = hoje || today();
  var A = [], resp = c.responsavel ? [c.responsavel] : [];
  function add(n, tipo, t, freq, r) { A.push({ n: n, tipo: tipo, t: t, freq: freq, resp: r || resp }); }
  if (c.status === 'Encerrado' || c.status === 'Pausado') return A;
  var pend = pendenciasTxt(c), f = faltas(c, -1);
  if (pend.length || f.length) add('amber', 'falta', 'Ficha de assessment incompleta — ' + pend.concat(f).join('; ') + '.', 'mwf');
  if (c.painel === 'nao' && emProjeto(c)) add('amber', 'painel', 'Painel ainda não liberado — adicione ' + EMAIL_CSO + ' ao painel Cobli do cliente.', 'mwf');
  if (c.status === 'Onboarding' && c.inicio && hoje > c.inicio) add('amber', 'piloto', 'O início do piloto (' + fdate(c.inicio) + ') já passou e o cliente continua em Onboarding.', 'mwf');
  if (c.status === 'Piloto' && c.inicio && !c.reuniaoPainel && diff(hoje, c.inicio) >= 7)
    add('amber', 'reuniao', 'Reunião de dados do painel ainda não registrada (piloto iniciou há ' + diff(hoje, c.inicio) + ' dia(s)).', 'mwf');
  if (emProjeto(c) && c.fim && !c.fimReal && c.resultado !== 'Convertido em contrato' && c.resultado !== 'Encerrado sem conversão') {
    var d = diff(c.fim, hoje), marco = DIAS_AVISO_PILOTO.indexOf(d) >= 0;
    if (d < 0) add('red', 'piloto', 'Piloto passou do fim previsto (' + fdate(c.fim) + ') há ' + (-d) + ' dia(s) — registre o resultado: converter, prorrogar ou encerrar.', 'diario');
    else if (d === 0) add('red', 'piloto', 'Piloto termina HOJE (' + fdate(c.fim) + ') — defina: converter, prorrogar ou encerrar.', 'diario');
    else if (d <= 15) add(d <= 3 ? 'red' : 'amber', 'piloto', 'Piloto termina em ' + d + ' dia(s) (' + fdate(c.fim) + ') — alinhe a decisão com o cliente.', marco ? 'diario' : 'ui');
  }
  return A;
}

/* ---------- mensagens do Slack (puras) ---------- */
function esc_(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function incluir_(a, dia, forcar) { return forcar || a.freq === 'diario' || (a.freq === 'mwf' && DIAS_COBRANCA.indexOf(dia) >= 0); }
function montarMensagens(clientes, hoje, opts) {
  opts = opts || {}; hoje = hoje || today();
  var dia = pd(hoje).getDay(), out = { global: null, clientes: [], dms: [], total: 0, fimDeSemana: false };
  if (!opts.forcar && (dia === 0 || dia === 6)) { out.fimDeSemana = true; return out; }
  var link = opts.url ? '\n<' + opts.url + '|Abrir a plataforma>' : '';
  var porCliente = [], dm = {};
  clientes.forEach(function (c) {
    var al = alertas(c, hoje).filter(function (a) { return incluir_(a, dia, opts.forcar); });
    if (!al.length) return;
    al.sort(function (x, y) { return (x.n === 'red' ? 0 : 1) - (y.n === 'red' ? 0 : 1); });
    porCliente.push({ c: c, al: al });
    al.forEach(function (a) {
      out.total++;
      a.resp.filter(emailOk).forEach(function (m) { (dm[m.toLowerCase()] = dm[m.toLowerCase()] || []).push({ c: c, a: a }); });
    });
  });
  var ico = function (a) { return a.n === 'red' ? '🔴' : '🟡'; };
  if (porCliente.length) {
    var linhas = porCliente.map(function (x) {
      var top = x.al.slice(0, 3).map(function (a) { return '   ' + ico(a) + ' ' + esc_(a.t); });
      if (x.al.length > 3) top.push('   … e mais ' + (x.al.length - 3) + ' ponto(s)');
      return '• *' + esc_(x.c.nome) + '* (' + completude(x.c).pct + '% da ficha)\n' + top.join('\n');
    });
    out.global = { text: '🚨 *Torre de Controle — pontos de atenção em ' + fdate(hoje) + '*\n' + linhas.join('\n') + link };
    porCliente.forEach(function (x) {
      if (!x.c.canalSlack) return;
      out.clientes.push({ canal: x.c.canalSlack, nome: x.c.nome, text: '🚨 *' + esc_(x.c.nome) + ' — Torre de Controle*\n' + x.al.map(function (a) { return ico(a) + ' ' + esc_(a.t); }).join('\n') + link });
    });
  }
  Object.keys(dm).forEach(function (m) {
    var it = dm[m], nomes = {};
    it.forEach(function (i) { (nomes[i.c.nome] = nomes[i.c.nome] || []).push(i.a); });
    var txt = '👋 Oi! Você tem pendências nas fichas de assessment / pilotos da *Torre de Controle*:\n' +
      Object.keys(nomes).map(function (n) { return '*' + esc_(n) + '*\n' + nomes[n].map(function (a) { return '   ' + ico(a) + ' ' + esc_(a.t); }).join('\n'); }).join('\n') + link;
    out.dms.push({ email: m, text: txt });
  });
  return out;
}

module.exports = { STATUS, EQUIPS, EMAIL_CSO, today, pd, fdate, emailOk, montarMensagens, alertas, completude };
