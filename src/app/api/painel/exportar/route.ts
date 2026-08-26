import { lojistaAtual } from "@/lib/sessao";
import { clientesEmCsv, pedidosEmCsv } from "@/lib/exportar";

/**
 * GET /api/painel/exportar?tipo=pedidos|clientes — o arquivo desce direto no
 * navegador do lojista. É também o caminho da obrigação de LGPD de entregar os
 * dados dos clientes finais quando solicitados.
 */
export async function GET(request: Request) {
  const loja = await lojistaAtual();
  if (!loja) return Response.json({ erro: "Sessão expirada." }, { status: 401 });

  const tipo = new URL(request.url).searchParams.get("tipo");
  if (tipo !== "pedidos" && tipo !== "clientes") return Response.json({ erro: "tipo deve ser pedidos ou clientes" }, { status: 422 });

  const csv = tipo === "pedidos" ? await pedidosEmCsv(loja.id) : await clientesEmCsv(loja.id);
  const dia = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${loja.slug}-${tipo}-${dia}.csv"`,
      "cache-control": "no-store",
    },
  });
}
