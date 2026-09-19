import { exigir } from "@/lib/operadores";
import { filtroDaUrl } from "@/lib/catalogo-filtros";
import {
  FORMATOS,
  clientesEmLinhas,
  montarPlanilha,
  pedidosEmLinhas,
  produtosEmLinhas,
  type Formato,
} from "@/lib/exportar";

/**
 * GET /api/painel/exportar?tipo=produtos|pedidos|clientes&formato=csv|xlsx —
 * o arquivo desce direto no navegador do lojista.
 *
 * `produtos` aceita os mesmos `q`, `categoria` e `situacao` da lista do painel:
 * o que a tela está mostrando é o que o arquivo traz. É também a volta da
 * importação — as colunas são as que o `lerCsvProdutos` lê.
 *
 * `clientes` é o caminho da obrigação de LGPD de entregar os dados dos
 * clientes finais quando solicitados.
 */
const TIPOS = {
  // Catálogo é do time de catálogo; pedido é do balcão. Quem só despacha não
  // baixa a tabela de preço da loja inteira.
  produtos: { permissao: "catalogo", aba: "Produtos" },
  pedidos: { permissao: "pedidos", aba: "Pedidos" },
  clientes: { permissao: "pedidos", aba: "Clientes" },
} as const;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tipo = url.searchParams.get("tipo") ?? "";
  if (!(tipo in TIPOS)) {
    return Response.json({ erro: "tipo deve ser produtos, pedidos ou clientes" }, { status: 422 });
  }
  const escolha = TIPOS[tipo as keyof typeof TIPOS];

  const { s, erro } = await exigir(escolha.permissao);
  if (erro) return erro;
  const loja = s.tenant;

  const formato: Formato = url.searchParams.get("formato") === "xlsx" ? "xlsx" : "csv";

  const linhas =
    tipo === "produtos"
      ? await produtosEmLinhas(loja.id, filtroDaUrl(url))
      : tipo === "pedidos"
        ? await pedidosEmLinhas(loja.id)
        : await clientesEmLinhas(loja.id);

  const corpo = montarPlanilha(linhas, formato, escolha.aba);
  const dia = new Date().toISOString().slice(0, 10);
  const { tipo: contentType, extensao } = FORMATOS[formato];
  return new Response(corpo, {
    headers: {
      "content-type": contentType,
      "content-disposition": `attachment; filename="${loja.slug}-${tipo}-${dia}.${extensao}"`,
      "cache-control": "no-store",
    },
  });
}
