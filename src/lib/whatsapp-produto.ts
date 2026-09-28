type ProdutoParaMensagem = { nome: string; sku: string | null; slug: string };

/** O atendimento recebe o identificador e o endereço oficial da peça. */
export function mensagemDoProduto(produto: ProdutoParaMensagem, urlLoja: string, consultarPreco = false) {
  return [
    consultarPreco ? "Olá! Quero consultar o preço deste produto:" : "Olá! Tenho interesse neste produto:",
    produto.nome,
    produto.sku ? `Código: ${produto.sku}` : null,
    `${urlLoja.replace(/\/$/, "")}/produtos/${encodeURIComponent(produto.slug)}`,
  ].filter(Boolean).join("\n");
}
