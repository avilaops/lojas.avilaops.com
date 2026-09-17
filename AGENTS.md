# lojas.avilaops.com: regras para agentes

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
  quando a loja não tem aquilo.
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
- **Automação é n8n.** Código emite evento (`src/lib/eventos.ts`); o que fazer
  com ele é fluxo.
- **Português nos nomes e comentários**, como no resto do monorepo.
- **TypeScript estrito**; `npm run typecheck` antes de entregar.
