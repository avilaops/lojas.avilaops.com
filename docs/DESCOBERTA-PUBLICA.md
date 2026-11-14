# E-Commerce • descoberta pública por Host

Contrato da entrega `AGENT-READY-PUBLICO-20261114`, responsável técnico `codex`.
O backend e as APIs continuam em TypeScript/Next.js. A implementação está em
worktree isolada; alterações de ícones e páginas em outros checkouts permanecem
preservadas. Preparação local não representa publicação ou verificação aprovada.
O patch foi reconciliado com `origin/main` em `66a2a14`, preservando a publicação
Markdown/MDX e as correções concorrentes de medição, metadados e consentimento.

## Interface e requisição

`GET /.well-known/ard.json` entrega o manifesto ARD; `GET /ai-catalog.json`
entrega o catálogo compatível em `application/json`. O `rel="ard"` aponta para
o primeiro endereço. O proxy mantém ambos na raiz também no Host da plataforma.
Não são anunciados servidores MCP, cartões de servidor ou tipos MIME próprios.

O adaptador usa `criarCatalogoPublico` de
`@avilaops/publicacao-texto/descoberta`. Recebe origem, nome, descrição, páginas
e recursos públicos; entrega `jsonArd` ou `jsonAiCatalogo`. Os tipos MIME dos
recursos são `text/html`, `text/plain` e `application/xml`, conforme as rotas
existentes. O núcleo não consulta banco ou rede.

A dependência é fixada no commit
`d5067bbbe3522f459367af3b58b4298324801f82` do motor-web, revisado no PR #5.
O núcleo passou seus 65 testes Node e a validação dos schemas oficiais;
os 32 testes específicos de descoberta também foram conferidos por este
integrador. Essa evidência do núcleo não substitui a CI do consumidor.

## Autorização, domínio e resposta

O Host público segue a autoridade existente: `x-forwarded-host`, depois `host`,
com `tenantAtual`. A plataforma é o `LOJAS_BASE_DOMAIN`, não um tenant. As lojas
usam `visivelNaBusca`, `urlDaLoja`, `identidadeDa` e `descricaoDaLoja`, as mesmas
fontes de identidade e publicação do `llms.txt`. A comparação do Host com a
origem canônica também recusa aliases com `noindex`. Uma suspensão mantém a
descoberta pública, conforme a regra existente; provisionamento, cancelamento,
Host desconhecido e combinações de Host/tenant divergentes recebem 404 sem nome
ou catálogo de outra loja.

Todas as respostas usam `private, no-store, max-age=0, must-revalidate`,
`Vary: Host, X-Forwarded-Host` e `nosniff`. Não há cache de catálogo compartilhado
nem estado global por tenant. O corpo contém somente a projeção pública; nunca
serializa o registro Prisma ou credenciais.

## Interface de navegador e efeitos

O componente só importa o adaptador quando a API estiver disponível e a página
estiver na lista pública explícita, sem query e sem `noindex`. Usa a API atual
`document.modelContext` e o fallback anterior `navigator.modelContext`, com um
`AbortController` por duração da página. O marcador exigido pelo núcleo é uma
meta no head, criada apenas no contexto aprovado e removida no encerramento.

As operações `consultar_pagina_publica` e `localizar_links_publicos` leem os
metadados e links do DOM atual. Não enviam formulários, mensagens, pedidos,
valores de campos, transações ou dados de sessão. Autenticação, cadastro,
autorização, conta, painel, APIs, carrinho e checkout ficam fora do adaptador.
Cookies de conta, lojista ou personalização também impedem a ativação. Não há
novos popups, frameworks ou integrações de medição. Sem API, a navegação existente
continua e o módulo de ferramentas não é importado.

## Dados estruturados e conteúdo

O schema Store separa o logo cadastrado da imagem de compartilhamento. `image`
usa a rota OG canônica existente da própria loja. Upload gerenciado só entra
em `logo` quando o objeto público do mesmo tenant tem leitura confirmada;
ausência de mídia histórica não vira logo fictício. O contrato e a evidência
estão em `docs/IMAGENS-PUBLICAS-SCHEMA.md`. Preços, avaliações, endereços,
checkout e vínculos canônicos continuam sob as autoridades existentes. Os dois
scripts JSON-LD do layout escapam `<`, impedindo que texto cadastrado encerre
o elemento script. A descrição segue a mesma regra pública do `llms.txt`.

O texto da plataforma em `llms-full.txt` continha duas declarações de ausência
de comissão, em conflito com o FAQ público atual. Foram removidas somente essas
afirmações e a linha estática com setup/período de teste, substituídas por link
para `/#planos`. Os planos montados a partir de `PLANOS` foram preservados.
Nenhum valor, cobrança ou interface comercial foi alterado.

## Persistência, falhas e evidência

Não há migração ou nova persistência de negócio. A CI usa PostgreSQL isolado
somente para fixtures fictícias, e as remove no encerramento. Recusas de
descoberta retornam 404; browser sem API ou fora do contexto público não registra
ferramentas. Não se altera a remoção intencional de `robots.txt` na borda.

O módulo está registrado em `.agents/mlops/project.json`, com fontes de código,
contrato e testes; a demanda está em `.agents/equipe/controle.json`. O inventário
MLOps da CI calcula os hashes das fontes. Nenhuma observação de execução é
registrada como aprovada antes de existir execução vinculada ao commit.

## Verificação somente no GitHub CI

Evidência executada: [CI 43577431530](https://github.com/avilaops/lojas.avilaops.com/actions/runs/43577431530)
aprovada sobre o HEAD `e00fb9c3437baf0813eefe09142e3be88ff12b49` do
[PR #250](https://github.com/avilaops/lojas.avilaops.com/pull/250), com merge de
teste `1e9cb114babb1116d76f9d88c226d0d6d2662373`. Passaram unitários, tipos,
lint, as três partes PostgreSQL, build standalone, os dois jobs de navegador
e o gate de contratos/API v1/Experiments/MLOps. O step 10 do job `132395216532`
executou `qa-descoberta-publica.mts` com sucesso. Esta é evidência de CI isolada,
não de produção; o fechamento documental subsequente precisa da CI do HEAD final.

Nenhum build, teste, instalação de dependências ou infraestrutura do E-Commerce
foi executado localmente. A restrição do projeto prevaleceu sobre a execução
local RED/GREEN; os testes foram escritos antes da implementação e executados
exclusivamente no GitHub CI.
O lockfile foi gerado somente com
`npm install --package-lock-only --ignore-scripts --no-audit --no-fund`, sem criar
`node_modules` ou executar scripts.

- Unitários existentes, incluindo `src/lib/descoberta-publica.test.ts`,
  `src/lib/descoberta-contexto.test.ts` e `src/lib/identidade-publica.test.ts`.
- Typecheck, ESLint, build standalone e gate de contratos/MLOps existentes.
- `node --import tsx scripts/qa-descoberta-publica.mts`, no job de navegador:
  dois tenants, plataforma, host desconhecido, cancelado, provisionando,
  alias noindex, domínio próprio, MIME/URLs e respostas sem cache compartilhado.
- Navegador com API atual, anterior e ausente; leitura real dos descritores,
  encerramento no `pagehide`, exclusão de rotas privadas, consultas, `noindex`
  e cookies; JSON-LD com marca relativa e tentativa de fechar script.

O job preserva `lojas-descoberta-publica-browser-<sha>/resultado.json`, contendo
commit, runId, tentativa e ambiente `github-ci-isolado`. O artefato desta execução
tem ID `14107132019`, nome
`lojas-descoberta-publica-browser-1e9cb114babb1116d76f9d88c226d0d6d2662373` e
digest do ZIP informado pela API GitHub
`sha256:bf6e31545cec1e585a110565aeb5d0834f6b33ddbfd60d9a3525dce2b338ec43`.
O nome identifica o merge de teste; o HEAD de origem continua explicitado acima.
Esse artefato é evidência da execução isolada da CI, não de produção ou
autenticação de origem. O PR permanece em rascunho. A tarefa continua em revisão
até a execução coordenadora conferir o HEAD final e autorizar a integração;
nenhum merge ou deploy foi realizado por esta entrega.
