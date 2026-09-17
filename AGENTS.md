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
- **Automação é n8n.** Código emite evento (`src/lib/eventos.ts`); o que fazer
  com ele é fluxo.
- **Português nos nomes e comentários**, como no resto do monorepo.
- **TypeScript estrito**; `npm run typecheck` antes de entregar.
