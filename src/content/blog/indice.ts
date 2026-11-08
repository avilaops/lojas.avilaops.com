export type Post = {
  slug: string;
  title: string;
  description: string;
  publicadoEm: string;
  related: string[];
  capa?: string;
};

/** Metadados públicos. O corpo de cada artigo fica no arquivo MDX correspondente. */
export const POSTS: Post[] = [
  {
    "slug": "o-que-e-loja-virtual",
    "capa": "/media/blog/o-que-e-loja-virtual.jpg",
    "title": "O que é uma loja virtual e o que ela faz que um catálogo não faz",
    "description": "A diferença prática entre mostrar produto e vender produto: carrinho, frete calculado, pagamento e pedido registrado, com o que cada etapa resolve.",
    "publicadoEm": "2026-09-01",
    "related": [
      "/criar",
      "/ajuda",
      "/#planos",
      "o-que-e-carrinho-de-compras"
    ]
  },
  {
    "slug": "o-que-e-carrinho-de-compras",
    "capa": "/media/blog/o-que-e-carrinho-de-compras.jpg",
    "title": "O que é carrinho de compras e por que ele existe",
    "description": "Para que serve o carrinho numa loja virtual, por que ele aumenta o valor do pedido e o que fazer com quem enche o carrinho e vai embora.",
    "publicadoEm": "2026-09-02",
    "related": [
      "o-que-e-loja-virtual",
      "/criar",
      "o-que-e-checkout-da-loja",
      "/ajuda"
    ]
  },
  {
    "slug": "o-que-e-checkout-da-loja",
    "capa": "/media/blog/o-que-e-checkout-da-loja.jpg",
    "title": "O que é a tela de fechamento do pedido (checkout) e por que ela decide a venda",
    "description": "O que acontece no checkout de uma loja virtual, quais campos derrubam a conversão e por que essa é a tela onde mais se perde dinheiro.",
    "publicadoEm": "2026-09-03",
    "related": [
      "o-que-e-carrinho-de-compras",
      "/criar",
      "quem-e-quem-no-pagamento-online",
      "o-que-e-loja-virtual"
    ]
  },
  {
    "slug": "quem-e-quem-no-pagamento-online",
    "capa": "/media/blog/quem-e-quem-no-pagamento-online.jpg",
    "title": "Quem é quem no pagamento online: loja, banco, bandeira e intermediário",
    "description": "Quem participa de cada venda online no Brasil, o que cada um cobra e por que o dinheiro do cartão demora mais que o do Pix.",
    "publicadoEm": "2026-09-04",
    "related": [
      "para-que-serve-o-pix-na-loja",
      "o-que-e-gateway-de-pagamento",
      "/criar",
      "/#recursos"
    ]
  },
  {
    "slug": "para-que-serve-o-pix-na-loja",
    "capa": "/media/blog/para-que-serve-o-pix-na-loja.jpg",
    "title": "Para que serve o Pix numa loja e como o dinheiro chega até você",
    "description": "Como funciona o Pix numa loja virtual, quanto tempo leva para o pedido ser confirmado e o que fazer quando o pagamento não cai.",
    "publicadoEm": "2026-09-05",
    "related": [
      "quem-e-quem-no-pagamento-online",
      "/#recursos",
      "/criar",
      "o-que-e-gateway-de-pagamento"
    ]
  },
  {
    "slug": "o-que-e-gateway-de-pagamento",
    "capa": "/media/blog/o-que-e-gateway-de-pagamento.jpg",
    "title": "O que é o intermediário de pagamento (gateway) e quanto ele cobra",
    "description": "O que faz o intermediário de pagamento de uma loja virtual, quais taxas ele cobra e o que olhar antes de escolher um.",
    "publicadoEm": "2026-09-06",
    "related": [
      "quem-e-quem-no-pagamento-online",
      "para-que-serve-o-pix-na-loja",
      "/criar",
      "o-que-e-checkout-da-loja"
    ]
  },
  {
    "slug": "o-que-e-sku",
    "capa": "/media/blog/o-que-e-sku.jpg",
    "title": "O que é SKU, o código interno de cada produto",
    "description": "Para que serve o SKU numa loja, como criar um código que se entende sozinho e por que ele evita erro de envio e de estoque.",
    "publicadoEm": "2026-09-07",
    "related": [
      "o-que-e-loja-virtual",
      "/criar",
      "/ajuda",
      "o-que-e-checkout-da-loja"
    ]
  }
];
