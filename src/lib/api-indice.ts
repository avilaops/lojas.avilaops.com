import { ESCOPOS } from "./api-chaves";
import { CODIGOS_DE_ERRO, POR_PAGINA_MAXIMO, POR_PAGINA_PADRAO } from "./api-resposta";
import { ESPERAS_MIN, EVENTOS_DE_WEBHOOK, TENTATIVAS_MAXIMAS } from "./webhooks-api";

/**
 * O índice da API para desenvolvedores: as rotas, o escopo de cada uma e como
 * autenticar.
 *
 * Um dado só, com duas saídas: `GET /api/v1` (para quem tem a chave e não tem a
 * documentação à mão) e a página pública `/developers`. **Rota nova entra aqui
 * no mesmo commit em que nasce**: é o que mantém a documentação pública igual
 * ao que a API responde, sem ninguém lembrar de atualizar um texto.
 */
export const ROTAS = [
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
  { metodo: "GET", caminho: "/api/v1/vitrine/produtos/{id}", escopo: "vitrine:ler", descricao: "Um produto ativo (id ou slug) com a descrição e as variações. O id de cada variação é o que vai no carrinho." },
  { metodo: "POST", caminho: "/api/v1/vitrine/frete", escopo: "vitrine:ler", descricao: "Opções de entrega para um CEP e um carrinho, com a retirada na loja quando há. O id da opção vai em freteId na compra." },
  { metodo: "POST", caminho: "/api/v1/vitrine/checkout", escopo: "vitrine:comprar", descricao: "Fecha a compra: cria o pedido e a cobrança e devolve o Pix, o boleto ou o resultado do cartão. O preço sai do servidor. Aceita Idempotency-Key." },
  { metodo: "GET", caminho: "/api/v1/vitrine/pedidos/{referencia}", escopo: "vitrine:comprar", descricao: "Andamento do pedido pela referência devolvida na compra, para a tela do Pix saber que foi pago. Sem dado pessoal." },
] as const;

export function indiceDaApi() {
  return {
    versao: "v1",
    autenticacao: "Authorization: Bearer <chave> (ou x-api-key). Chaves secretas começam com lojas_sk_, publicáveis com lojas_pk_.",
    paginacao: { parametros: ["pagina", "porPagina"], padrao: POR_PAGINA_PADRAO, maximo: POR_PAGINA_MAXIMO },
    dinheiro: "Valores em centavos inteiros (campos *Centavos), moeda BRL.",
    erros: CODIGOS_DE_ERRO,
    escopos: ESCOPOS,
    rotas: ROTAS,
    compra: {
      quem: "Chave publicável com o escopo vitrine:comprar, marcado pelo lojista no painel, e os sites autorizados.",
      corpo: '{ "itens": [{ "id", "quantidade" }], "cliente": { "nome", "sobrenome", "email", "telefone", "documento" }, "entrega": { "cep", "logradouro", "numero", "complemento"?, "bairro", "cidade", "uf" } | null, "freteId", "meioPagamento": "pix" | "cartao" | "boleto", "cartao"?: { "token", "parcelas"?, "bandeira"? }, "totalCentavos"? }',
      regras: "O preço e o frete saem do servidor. Campo desconhecido é erro. A referência do pedido vem na resposta. Envie Idempotency-Key para repetir sem cobrar de novo. O token do cartão é gerado no navegador com a chave pública do Mercado Pago que vem em /vitrine/loja.",
    },
    webhooks: {
      cadastro: "Painel da loja, em IA e API. Só https, em domínio público.",
      eventos: EVENTOS_DE_WEBHOOK,
      corpo: '{ "id", "tipo", "criadoEm", "dados": { "pedido": <o mesmo de GET /api/v1/pedidos/{id}> } }',
      cabecalhos: ["x-lojas-evento", "x-lojas-entrega", "x-lojas-assinatura"],
      assinatura: "x-lojas-assinatura: t=<segundos>,v1=<hmac>. O hmac é HMAC-SHA256, em hexadecimal, de `<t>.<corpo exato>` com o segredo do webhook. Recuse se t tiver mais de 5 minutos.",
      entrega: `Pelo menos uma vez: o mesmo \`id\` pode chegar de novo, e é por ele que se reconhece a repetição. Responda 2xx em até 8 segundos. Sem 2xx, ${TENTATIVAS_MAXIMAS} tentativas ao todo, com esperas de ${ESPERAS_MIN.join(", ")} minutos. Redirecionamento não é seguido.`,
    },
  };
}
