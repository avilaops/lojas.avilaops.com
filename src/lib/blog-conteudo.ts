/** Registro explícito: somente artigos versionados podem ser carregados. */
export const CONTEUDOS_BLOG = {
  "o-que-e-loja-virtual": () => import("@/content/blog/o-que-e-loja-virtual.mdx"),
  "o-que-e-carrinho-de-compras": () => import("@/content/blog/o-que-e-carrinho-de-compras.mdx"),
  "o-que-e-checkout-da-loja": () => import("@/content/blog/o-que-e-checkout-da-loja.mdx"),
  "quem-e-quem-no-pagamento-online": () => import("@/content/blog/quem-e-quem-no-pagamento-online.mdx"),
  "para-que-serve-o-pix-na-loja": () => import("@/content/blog/para-que-serve-o-pix-na-loja.mdx"),
  "o-que-e-gateway-de-pagamento": () => import("@/content/blog/o-que-e-gateway-de-pagamento.mdx"),
  "o-que-e-sku": () => import("@/content/blog/o-que-e-sku.mdx"),
};
