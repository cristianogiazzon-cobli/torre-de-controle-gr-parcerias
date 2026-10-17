# Plataforma Torre de Controle — como publicar (≈15 min, sem custo)

Os dados ficam numa planilha do Google; a plataforma é um Web App do Apps Script em cima dela.

## Arquivos desta pasta
| Arquivo | Onde colar no Apps Script |
|---|---|
| `Code.gs` | arquivo de script `Code.gs` (backend: planilha) |
| `Regras.gs` | novo arquivo de script `Regras` (regras de negócio, usadas pela tela e pelo Slack) |
| `Notificacoes.gs` | novo arquivo de script `Notificacoes` (Slack) |
| `Index.html` | novo arquivo HTML `Index` (a tela) |
| `appsscript.json` | manifesto do projeto |

## 1. Criar a planilha
No Drive, crie uma **Planilha Google em branco** chamada `Torre de Controle - Base de Dados`.

## 2. Colar o código
1. Na planilha: **Extensões > Apps Script**.
2. `Código.gs`: apague tudo e cole `Code.gs`.
3. **+ > Script**: nome `Regras`, cole `Regras.gs`. **+ > Script**: nome `Notificacoes`, cole `Notificacoes.gs`.
4. **+ > HTML**: nome `Index`, cole `Index.html`.
5. **Configurações do projeto (engrenagem)** > marque "Mostrar arquivo de manifesto appsscript.json" e cole o conteúdo de `appsscript.json`.
6. Salve (Ctrl+S).

## 3. Preparar as abas
Selecione a função **setup** e clique em **Executar** (autorize). Devem surgir as abas `Clientes`, `Historico`, `Config` e `Resumo`.

## 4. Publicar
**Implantar > Nova implantação > App da Web** · Executar como: **Usuário que acessa o app da Web** · Quem tem acesso: **Qualquer pessoa com Conta do Google**. Copie o link `/exec` e compartilhe.
Compartilhe também a **planilha** (Editor) com quem vai usar: o acesso à planilha é a permissão da plataforma.

## 5. Ligar o Slack (aba "Notificações Slack" da plataforma)
1. Em `api.slack.com/apps` > **Create New App** > From scratch (workspace da Cobli).
2. **OAuth & Permissions** > Bot Token Scopes: `chat:write`, `users:read`, `users:read.email` (e `chat:write.public` se quiser postar em canais sem convidar o app).
3. **Install to Workspace** e copie o *Bot User OAuth Token* (`xoxb-...`).
4. Convide o app nos canais (`/invite @nome-do-app`).
5. Na plataforma: aba **Notificações Slack** > cole o token e o canal geral > **Salvar** > **Ativar envio diário (8h)** > **Enviar mensagem de teste**.
6. Use **Atualizar prévia** para ver exatamente o que seria enviado hoje.

Para a mensagem direta funcionar, o e-mail do responsável na plataforma precisa ser o mesmo e-mail dele no Slack.

## Fase de teste (ativa por padrão)
Enquanto o campo **"Modo teste"** (aba Notificações Slack) estiver preenchido — por padrão `cristiano.giazzon@cobli.co` —, **nada vai para canais nem para outras pessoas**: o resumo chega só para esse e-mail, por mensagem direta no Slack e por e-mail (o texto indica para quem o aviso iria no envio real). Para liberar geral, apague o campo e salve.
O envio por e-mail usa o Gmail da conta que ativou o gatilho (permissão `script.send_mail`).

## Como funciona (ficha de assessment única)
Cada piloto/cliente tem **uma única ficha**, em uma página só, com 8 blocos e índice lateral:
1. **Referência (HubSpot):** link, ID (campo livre), empresa, responsável, potencial (R$) e região. Nesta fase os campos são preenchidos à mão; a busca automática pelo HubSpot fica para a fase 2.
2. **Equipamentos enviados:** OBD, Instalado, Rede CAN, Câmera Fadiga e StreaMax, com quantidade, e data de instalação.
3. **Liberação no painel:** Sim ou Não (botão de rádio) (ação: adicionar `cso@grparceria.com.br` ao painel Cobli da empresa).
4. **Acesso à plataforma ONE:** nome e e-mail de cada pessoa.
5. **Eventos monitorados:** os 15 eventos, cada um com monitorar (marcar já significa que a Torre notifica), severidade (Leve/Grave/Gravíssimo), gatilho (lista de opções) e até 3 ações em ordem (grupo de WhatsApp, ligar para o motorista, ligar para o gestor da frota). Excesso de velocidade tem regras próprias (via, % acima, segundos, severidade). **A matriz é informativa:** serve para configurar a Torre e não dispara nenhuma ação.
6. **Frota monitorada:** leve, pesada ou híbrida, "monitorar todos" ou lista de placas.
7. **Grupos de aviso:** nome, objetivo e pessoas com telefone. Os grupos aparecem como opção nas ações do bloco 5.
8. **Piloto:** início, fim previsto, fim real, resultado, prorrogação e reunião de dados do painel.

As abas do sistema leem a ficha: **Acompanhamento** (lista, % da ficha e blocos de cada piloto), **Pilotos** (início e fim, linha do tempo) e **Notificações Slack**.
Dentro da ficha: **Salvar e ir para o início** (também no topo), **Exportar ficha (CSV)** e **Imprimir / PDF** para repassar a configuração. Campos de data aceitam dd/mm/aaaa, telefone usa (xx)xxxxx-xxxx e o potencial usa R$.

## Regras que a plataforma aplica
- **Nenhum campo é obrigatório.** Muitos dados só chegam depois; nada trava o piloto.
- **Acompanhamento do preenchimento:** "Ficha preenchida (%)" e blocos completos (de 8), com a lista do que falta.
- **Pilotos:** botões de prorrogar (7, 15 ou 30 dias) e linha do tempo na aba Pilotos.
- **Avisos (dias úteis, 8h):** 🔴 prazo de piloto vencido ou muito próximo, todo dia; 🟡 ficha incompleta, painel não liberado e reunião de painel pendente, seg/qua/sex; piloto a 15, 7, 3, 2 e 1 dia do fim, no dia e diariamente depois de vencer. Mensagem direta ao Responsável Cobli + resumo no canal geral + canal próprio por piloto (opcional).
- **Repasses e Side Letter não são controlados aqui.**

## Atualizar o código depois
Cole o novo conteúdo e faça **Implantar > Gerenciar implantações > Editar (lápis) > Nova versão > Implantar**. O link continua o mesmo. Se mudar o `appsscript.json` (novos escopos), cada pessoa reautoriza no próximo acesso.

## Observações
- Edição simultânea da mesma ficha: a plataforma avisa antes de sobrescrever.
- Não edite a aba `Clientes` na mão (a coluna oculta `dados_json` é o cadastro completo). A aba `Resumo` é gerada automaticamente.
- O gatilho diário roda com a conta de quem clicou em "Ativar envio diário"; essa pessoa precisa manter acesso à planilha.
