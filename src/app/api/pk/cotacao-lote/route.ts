import { prisma } from "@/lib/db";
import { tenantAtual, lojaVende } from "@/lib/tenant";
import { cabecalhosDoLimite, LimitadorPorJanela } from "@/lib/api-limite";
import { LIMITES_COTACAO, resolverCotacao, validarItensCotacao } from "@/lib/pk-cotacao-lote";

const limitador = new LimitadorPorJanela();

export async function POST(request: Request) {
  const tenant = await tenantAtual();
  if (!tenant || tenant.slug !== "pkvedacoes" || tenant.status !== "ATIVA") return Response.json({ erro: "Página não encontrada." }, { status: 404 });
  const ip = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "desconhecido";
  const limite = limitador.consumir(`${tenant.id}:${ip}`, 10);
  const headers = { ...cabecalhosDoLimite(limite), "Cache-Control": "no-store" };
  if (!limite.permitido) return Response.json({ erro: "Aguarde um minuto antes de consultar novamente." }, { status: 429, headers: { ...headers, "Retry-After": String(limite.reiniciaEm) } });
  let entrada: unknown;
  try {
    const leitor = request.body?.getReader();
    const partes: Uint8Array[] = [];
    let bytes = 0;
    while (leitor) {
      const { done, value } = await leitor.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > LIMITES_COTACAO.bytes) { await leitor.cancel(); return Response.json({ erro: "Lista maior que 32 KB." }, { status: 413, headers }); }
      partes.push(value);
    }
    entrada = JSON.parse(Buffer.concat(partes).toString("utf8"));
  } catch { return Response.json({ erro: "Envie uma lista JSON válida." }, { status: 400, headers }); }
  let itens;
  try { itens = validarItensCotacao((entrada as { itens?: unknown } | null)?.itens); }
  catch (erro) { return Response.json({ erro: erro instanceof Error ? erro.message : "Lista inválida." }, { status: 422, headers }); }
  try {
    // Projeção interna: nenhuma linha de outra loja nem dado administrativo sai da API.
    const catalogo = await prisma.produto.findMany({ where: { tenantId: tenant.id, ativo: true }, select: { slug: true, nome: true, sku: true, codigoOriginal: true, codigosEquivalentes: true, atributos: true, ativo: true, precoCentavos: true, disponibilidade: true, estoque: true } });
    return Response.json({ itens: resolverCotacao(itens, catalogo, lojaVende(tenant)), consultadoEm: new Date().toISOString() }, { headers });
  } catch { return Response.json({ erro: "Não foi possível consultar o catálogo agora. Tente novamente." }, { status: 503, headers }); }
}
