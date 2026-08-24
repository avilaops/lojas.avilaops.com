# lojas.avilaops.com — regras para agentes

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
- **Automação é n8n.** Código emite evento (`src/lib/eventos.ts`); o que fazer
  com ele é fluxo.
- **Português nos nomes e comentários**, como no resto do monorepo.
- **TypeScript estrito**; `npm run typecheck` antes de entregar.
