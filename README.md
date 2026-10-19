# Torre de Controle — Cobli × GR Parcerias

Plataforma web para controlar cada piloto/cliente da Torre de Controle (BPO que monitora os eventos das câmeras Cobli) em uma **ficha de assessment única**.

- **Front-end:** `public/index.html` (HTML/JS único, sem dependências).
- **Back-end:** funções serverless do Vercel em `api/` (`rpc.js` e `cron.js`) e módulos em `lib/`.
- **Banco:** Supabase (projeto `torre-de-controle`). As tabelas ficam com RLS ligado e sem policies; o acesso é só por funções `tdc_*` protegidas pela chave de acesso.
- **Avisos:** Slack (DM e canais), com modo teste. Cron diário às 8h de Brasília, em dias úteis (`vercel.json`).
- **Legado:** `apps-script-legado/` guarda a versão anterior em Google Apps Script, só como referência.

## Acesso (sem login nesta fase)
Link secreto: `https://<dominio>/?k=<ACCESS_KEY>`. Na primeira abertura a chave é guardada no navegador e removida da barra de endereço. Quem tem o link edita tudo; para trocar a chave, atualize `config.access_key` no Supabase e `ACCESS_KEY` no Vercel.

## Variáveis de ambiente (Vercel)
| Variável | Para quê |
|---|---|
| `SUPABASE_URL`, `SUPABASE_KEY` | URL e chave publicável do projeto Supabase |
| `ACCESS_KEY` | chave do link secreto (igual a `config.access_key` no banco) |
| `CRON_SECRET` | autoriza a chamada diária de `/api/cron` |
| `SLACK_BOT_TOKEN` | token `xoxb-…` do app do Slack (`chat:write`, `users:read`, `users:read.email`) |
| `SLACK_CANAL` | canal do resumo geral (opcional) |
| `MODO_TESTE_EMAIL` | recebe tudo enquanto preenchido (padrão: cristiano.giazzon@cobli.co; `-` libera o envio real) |
| `APP_URL` | link citado nas mensagens do Slack (opcional) |

Este repositório não contém dados de clientes, tokens nem chaves.
