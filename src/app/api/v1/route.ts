import { ESCOPOS } from "@/lib/api-chaves";
import { POR_PAGINA_MAXIMO, POR_PAGINA_PADRAO } from "@/lib/api-resposta";

/**
 * GET /api/v1 — o índice da API, sem chave.
 *
 * Quem recebe a chave e não tem a documentação à mão descobre aqui as rotas,
 * o escopo de cada uma e como autenticar. É dado, não página: a mesma lista
 * serve para o desenvolvedor e para gerar documentação depois.
 */
export const dynamic = "force-dynamic";

const ROTAS = [
  { metodo: "GET", caminho: "/api/v1/loja", escopo: "loja:ler", descricao: "A loja dona da chave e os escopos da chave." },
  { metodo: "GET", caminho: "/api/v1/produtos", escopo: "catalogo:ler", descricao: "Catálogo completo, inclusive inativos. Filtros: ativo, categoria, sku, busca, atualizadoDesde." },
  { metodo: "GET", caminho: "/api/v1/produtos/{id}", escopo: "catalogo:ler", descricao: "Um produto (id ou slug) com as variações." },
  { metodo: "POST", caminho: "/api/v1/produtos", escopo: "produtos:escrever", descricao: "Cria um produto simples. Nasce inativo, a menos que venha ativo: true. Slug ou SKU já em uso responde conflito (409)." },
  { metodo: "PATCH", caminho: "/api/v1/produtos/{id}", escopo: "produtos:escrever", descricao: "Edita o cadastro (nome, slug, marca, descrições, categoria, ativo, destaque). Preço e estoque são de /ofertas." },
  { metodo: "PATCH", caminho: "/api/v1/ofertas", escopo: "catalogo:escrever", descricao: "Preço e estoque por SKU, em lote de até 100. Valores absolutos em centavos; reenviar o mesmo lote não muda nada." },
  { metodo: "GET", caminho: "/api/v1/pedidos", escopo: "pedidos:ler", descricao: "Pedidos. Filtros: status, canal, criadoDesde, atualizadoDesde." },
  { metodo: "GET", caminho: "/api/v1/pedidos/{id}", escopo: "pedidos:ler", descricao: "Um pedido (id ou referência) com os itens." },
  { metodo: "PATCH", caminho: "/api/v1/pedidos/{id}", escopo: "pedidos:escrever", descricao: "Avança o pedido: status (EM_SEPARACAO, ENVIADO, ENTREGUE, CANCELADO) e rastreio. Avisa o comprador uma vez por virada; pagamento não muda por aqui." },
  { metodo: "GET", caminho: "/api/v1/vitrine/loja", escopo: "vitrine:ler", descricao: "Dados públicos da loja, para um front próprio. Aceita chamada do navegador." },
  { metodo: "GET", caminho: "/api/v1/vitrine/produtos", escopo: "vitrine:ler", descricao: "Produtos ativos, como a vitrine mostra. Filtros: busca, categoria, destaque, ordem." },
] as const;

export function GET() {
  return Response.json({
    versao: "v1",
    autenticacao: "Authorization: Bearer <chave> (ou x-api-key). Chaves secretas começam com lojas_sk_, publicáveis com lojas_pk_.",
    paginacao: { parametros: ["pagina", "porPagina"], padrao: POR_PAGINA_PADRAO, maximo: POR_PAGINA_MAXIMO },
    dinheiro: "Valores em centavos inteiros (campos *Centavos), moeda BRL.",
    escopos: ESCOPOS,
    rotas: ROTAS,
  });
}
