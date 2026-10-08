# lojas.avilaops.com: regras para agentes

<!-- avilaops:contexto:inicio (versão 2026-10-03; gerado a partir de avilaops/contexto, não editar aqui) -->
## Contexto Ávila Ops (vale para todos os projetos)

Este repositório pertence à Ávila Ops Tecnologia, que ajuda pequenas empresas a construir presença digital, organizar a operação e crescer. As contas `avilaops` e `avilainc` no GitHub são a mesma empresa. Nicolas Avila (Nicolas sem acento) é o fundador e quem decide.

### Como trabalhar

- Comunicar em português natural, com resposta direta e evidência. Sem tom de coach, promessa vaga ou jargão comercial. O idioma da interface e do conteúdo acompanha o site, não a conversa.
- Identificar o projeto, o domínio, o repositório e o ambiente antes de alterar qualquer coisa. Não presumir que todos os projetos usam o mesmo deploy.
- Ter iniciativa dentro do pedido e levar a tarefa até um resultado verificado. Plano, código, publicação e funcionamento comprovado são coisas diferentes: não declarar sucesso só porque um build terminou ou um workflow foi ativado.
- Proteger dados, acessos e a separação entre clientes. Nunca gravar segredo em arquivo versionado, issue, PR ou memória.
- Não iniciar comunicação externa nem ação irreversível sem autorização do Nicolas.
- Preservar trabalho em andamento de outra pessoa ou de outro agente. Trabalho não commitado vai para uma branch `resgate/*`.

### Decisões vigentes

- Pagamentos: Mercado Pago no Brasil e PayPal para clientes de fora. Não usar Stripe nem Éfi, mesmo que material antigo diga o contrário.
- Automações em n8n, infraestrutura em Cloudflare e canais em Twilio, preservando integrações existentes.
- Ofertas com três planos: entrada limitada, intermediário como escolha principal e premium como referência. Consultar preços vigentes antes de publicar.
- Build de aplicação roda no GitHub Actions, não no servidor de produção.
- Versão antiga de código fica no GitHub. Não criar `.tgz`, `.tar`, `*-before-*` nem pastas `rollback/`, `releases/` ou `backups/` com código no servidor; voltar versão é republicar o commit. Antes de mexer em dado, fazer dump do banco.

### Sessões na nuvem

- Uma sessão de nuvem não tem acesso à máquina do Nicolas, aos servidores nem à memória compartilhada. Não presumir o estado de produção: buscar evidência ou dizer que não foi verificado.
- Decisão durável tomada na sessão deve ficar registrada na descrição do PR e, quando for do projeto, neste arquivo, fora deste bloco.
- A memória compartilhada completa e as regras corporativas ficam no repositório privado `avilaops/contexto`.
<!-- avilaops:contexto:fim -->

- **Next.js 16**: `middleware.ts` virou `proxy.ts`; `params`/`searchParams` são
  Promise; leia `node_modules/next/dist/docs/` antes de escrever código de
  roteamento. Este projeto não usa proxy: a loja é resolvida por `headers()`
  em `src/lib/tenant.ts`.
- **Nada por loja em código.** Se uma mudança precisa de `if (slug === "x")`,
  ela está errada: vira coluna em `Tenant` ou campo em `Produto`.
- **Dinheiro em centavos, inteiro.** Ver `packages/checkout/src/core/types.ts`.
- **Preço nunca vem do navegador.** Toda rota que cobra passa por
  `montarPedidoSeguro` com `resolverItensDoCatalogo`.
- **Tokens de gateway só cifrados** (`src/lib/cofre.ts`). Nunca logar, nunca
  devolver em resposta de API.
- **Ramo da loja é dado, não código.** `Tenant.segmento` liga blocos de vitrine:
  `motopecas` (garagem, compatibilidade, código original) e `farmacia` (tarja,
  princípio ativo, equivalentes, responsável técnico). O que o bloco mostra vem
  do catálogo (`Produto.compatibilidade`, `Produto.principioAtivo`), nunca de
  uma lista por loja. Ver `src/lib/motos.ts` e `src/lib/farmacia.ts`.
- **Regra da lei não mora no JSX.** O que a norma proíbe entra em
  `src/lib/produto-regras.ts` e vale também no servidor: controle especial
  (`dispensavelADistancia`) é recusado pelo resolvedor do carrinho e pela
  reserva de estoque, não só escondido na tela. Ver `docs/FARMACIA.md`.
- **Template compõe, não personaliza.** `Tenant.tema.layout` escolhe a
  composição; o texto e as imagens do template são campos do tema
  (`tema.premium` no Automotivo Premium), editados no painel. Nenhum slug de
  categoria escrito no componente: o que aponta para o catálogo se resolve pelo
  catálogo (`src/lib/etapas-premium.ts`, `src/lib/trilha-automotiva.ts`) e some
  quando a loja não tem aquilo. Template novo entra por `CONTRATOS` em
  `src/lib/templates.ts`; página pergunta ao contrato (`usaBlocoProprio`,
  `contratoDo`), não compara `layout` com o nome do template.
- **Prévia do tema só lê.** `/painel/previa` desenha o rascunho que veio em
  `?t=` sobre o catálogo de demonstração de `src/lib/previa-tema.ts`; não grava,
  não mede e não emite evento. A home sai de `comporHome`
  (`src/components/home/composicao.tsx`), a mesma da loja publicada: layout novo
  entra lá, não em outra cadeia de `? :`.
- **Política é do lojista, com rede de proteção.** O texto padrão continua
  sendo o que vai ao ar em loja que não mexeu (`src/lib/politicas.ts`); o que o
  lojista escreve substitui. O que a lei fixa não é configuração: o prazo de
  arrependimento tem piso de 7 dias **no leitor** (`lerRegrasDevolucao`), não na
  tela, e taxa/frete de retorno só valem na cortesia depois dele. Campo que
  produziria política ilegal não entra, por mais que outro produto tenha.
- **Campo de produto é definição da loja, não coluna.** `atributos` é bagagem de
  importação; o que a loja pergunta se declara em `Tenant.camposPersonalizados`
  (`src/lib/campos-personalizados.ts`), com chave estável — renomear o rótulo não
  pode perder o valor gravado em mil produtos.
- **Texto do lojista nunca é marcação.** Política, publicação e campo saem como
  texto; linha em branco separa parágrafo. Link só `http(s)`, vídeo só YouTube e
  Vimeo: o resto vira `<iframe>` arbitrário na loja de um cliente.
- **Medição é first-party e sem perfil.** `SessaoVitrine` mede a própria loja, no
  próprio domínio, sem IP nem user-agent (`src/lib/atribuicao.ts`). Ligar a visita
  de hoje à de ontem é perfil e depende de "aceito" no banner. Número que a
  medição não tem não vira zero na tela: vira a explicação de por que não existe.
- **O relógio é nosso, e o e-mail também.** O que roda sozinho está em
  `ROTINAS` (`src/lib/rotinas.ts`) e é o próprio container que dispara — rotina
  nova é entrada no catálogo, não agendamento em serviço de fora; o nome vai
  para a tabela `Rotina`, então renomear é migração (`docs/ROTINAS.md`).
  Executar o evento também: `CANAIS_POR_TIPO` em `src/lib/acoes-do-evento.ts`
  diz quais canais cada tipo usa, o texto de cada mensagem é função pura
  (`emails-do-evento.ts`, `whatsapp-do-evento.ts`) e o envio fica em
  `email.ts` e `whatsapp.ts` (`docs/MENSAGENS.md`). **Tipo só é nosso quando
  todos os canais dele estão configurados** — executar metade faz o aviso do
  lojista sumir sem ninguém notar, e canal que já saiu fica em
  `AutomacaoEvento.canaisFeitos` para a nova tentativa não repetir. O que ainda
  é do n8n é o que espera (`pix_pendente` aos 30 min, `loja_indicacoes` aos 3
  dias), não um canal.
- **O conector MCP entra por login, e não conhece assistente pelo nome.** O
  lojista cola `https://lojas.avilaops.com/api/mcp` no Claude, no ChatGPT ou no
  Codex e autoriza em `/autorizar`; o servidor de autorização somos nós
  (`/oauth/*`, `/.well-known/*`, regras em `src/lib/mcp-oauth.ts`). Nenhuma
  lista de clientes aceitos: quem fala o protocolo se registra sozinho. Erro só
  é redirecionado depois de conferir o `redirect_uri`, PKCE S256 é obrigatório,
  e código e tokens ficam só como sha256. A chave `lojas_live_…` continua, para
  n8n e scripts. Ver `docs/MCP.md`.
- **API para desenvolvedores passa por uma porta só.** Rota de `/api/v1` usa
  `rotaDaApi({ escopo })` (`src/lib/api-rotas.ts`) e não autentica, não monta
  erro nem põe CORS sozinha. A loja vem da chave, e toda consulta filtra pelo
  `tenant.id` dela. Escopo novo entra em `ESCOPOS` junto com a rota que o exige;
  chave publicável é só `vitrine:ler`. O que sai é projeção explícita de
  `api-recursos.ts`, nunca `...produto`. Chave guardada só como sha256.
  `/v1` sem `/api` é outro contrato (`gapp.ts`). Ver `docs/API.md`.
- **Métrica por loja guarda host, grupo, status e duração — e mais nada.**
  `registrar` (`src/lib/metricas-tenant.ts`) não aceita outro campo: caminho,
  query, cabeçalho, IP e mensagem de erro não entram. Rota nova se mede com
  `medirRota(grupo, ...)`, e grupo novo entra em `GRUPOS`. O registro é do
  processo e fica no `globalThis`, não em escopo de módulo (bundles separados
  no standalone); zera no deploy. Ver `docs/METRICAS.md`.
- **Prova de banco é em container próprio, nunca no banco de desenvolvimento.**
  `npm run banco:teste` sobe o `lojas-db-test` (`docker-compose.test.yml`) na
  imagem **de produção** — Postgres 18, que é o do host nos servidores — e
  `npm run test:integracao` roda a suíte. `npm test` não inclui a integração, e
  é obrigatório rodá-la à mão antes de entregar mudança no catálogo: foi por ela
  nunca rodar que a busca ficou quebrada por semanas. Ver `docs/BANCO-DE-TESTE.md`.
- **Gatilho que outra migração já estendeu não se reescreve do zero.**
  `CREATE OR REPLACE FUNCTION` troca o corpo inteiro sem avisar. Migração que
  mexe em `produto_texto_de_busca()` parte do corpo em vigor, não de uma versão
  antiga. Ver `docs/BUSCA-REGRESSAO.md`.
- **Versão antiga mora no GitHub, não no servidor.** O deploy é
  `deploy/deploy.sh`: ele guarda `app.anterior` só enquanto roda, para o
  rollback automático, e apaga a cópia quando a nova passa. Não copie `app`,
  `standalone.tgz` nem pastas de build para `/opt/lojas/rollback`,
  `releases` ou `backups` "por segurança": a raiz do servidor tem 38 GB e
  chegou a 97% em 28/09/2026 com essas cópias. Voltar versão é republicar o
  commit. Antes de mexer em dado, faça dump do banco; é o único backup que o
  GitHub não substitui.
- **A entrada do painel é o Auth.** Com `SSO_APP_ID` configurado, `/entrar`
  manda direto ao login único (auth.avilaops.com), como o ERP; quem entra no
  Lojas se libera na conta do Auth. A página só aparece com recado do Auth
  (`?sso=`), falha do Google ou `?senha=1`, que é a porta de quem tem só e-mail
  e senha da loja (cadastro por `/criar`). Não tire essa porta enquanto o
  cadastro de loja não criar a conta no Auth.
- **Recebimento tem dois caminhos e nenhum estado misto.** A loja conecta a
  conta do Mercado Pago por OAuth (`src/lib/mercado-pago-conta.ts`) ou cola as
  chaves da própria aplicação; quem diz qual é `Tenant.mpRefreshTokenEnc`.
  Gravar por um caminho apaga os campos do outro. O aplicativo é da plataforma
  e só vale com `MP_APP_ID`, `MP_APP_SECRET` e `MP_APP_WEBHOOK_SECRET` juntos.
  Renovar o acesso é da rotina `mercadopago.renovar`, nunca da cobrança: o
  refresh é de uso único. Ver `docs/MERCADO-PAGO-OAUTH.md`.
- **Português nos nomes e comentários**, como no resto do monorepo.
- **TypeScript estrito**; `npm run typecheck` antes de entregar.
