# Torre de Controle — Cobli × GR Parcerias

Plataforma web para controlar cada piloto/cliente da Torre de Controle (BPO que monitora os eventos das câmeras Cobli) em uma **ficha de assessment única**.

- **Front-end:** `Index.html` (HTML/JS único, sem dependências).
- **Back-end:** Google Apps Script (`Code.gs`, `Regras.gs`, `Notificacoes.gs`), com os dados numa Planilha Google.
- **Avisos:** Slack (mensagem direta e canais) e e-mail, com modo teste que envia só para um endereço.
- **Publicação:** passo a passo no `LEIA-ME.md`.

> Este repositório não contém dados de clientes, tokens nem chaves. O token do Slack é guardado nas Propriedades do Script do Apps Script.
