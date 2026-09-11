import { z } from "zod";
import { prisma } from "@/lib/db";
import { lojistaAtual } from "@/lib/sessao";
import { emitir } from "@/lib/eventos";
import { urlDaLoja } from "@/lib/tenant";
import { filtroDePedidos, paginaValida, POR_PAGINA_PEDIDOS } from "@/lib/pedidos-painel";

const Entrada = z.object({
  id: z.string(),
  status: z.enum(["EM_SEPARACAO", "ENVIADO", "ENTREGUE", "CANCELADO"]).optional(),
  rastreio: z.string().trim().max(60).nullable().optional(),
});

/**
 * GET — a lista de pedidos, com filtro e página no banco.
 *
 * A tela recebia os 200 mais recentes com itens e filtrava no navegador. Com
 * catálogo grande vem loja grande, e 200 deixa de ser "todos": o pedido 201
 * simplesmente não existia para o lojista. O filtro mora em
 * `lib/pedidos-painel.ts`, que é testado sem banco e garante o tenant em toda
 * consulta.
 */
export async function GET(request: Request) {
  const loja = await lojistaAtual();
  if (!loja) return Response.json({ erro: "Sessão expirada." }, { status: 401 });

  const url = new URL(request.url);
  const where = filtroDePedidos({ tenantId: loja.id, q: url.searchParams.get("q"), situacao: url.searchParams.get("situacao") });
  const pagina = paginaValida(url.searchParams.get("pagina"));
  const POR_PAGINA = POR_PAGINA_PEDIDOS;

  const [total, itens, porSituacao] = await Promise.all([
    prisma.pedido.count({ where }),
    prisma.pedido.findMany({
      where,
      select: {
        id: true, numero: true, referencia: true, status: true, clienteNome: true, clienteTelefone: true,
        totalCentavos: true, criadoEm: true, rastreio: true,
        _count: { select: { itens: true } },
      },
      orderBy: { criadoEm: "desc" },
      skip: (pagina - 1) * POR_PAGINA,
      take: POR_PAGINA,
    }),
    prisma.pedido.groupBy({ by: ["status"], where: { tenantId: loja.id }, _count: { _all: true } }),
  ]);

  return Response.json({
    total,
    pagina,
    porPagina: POR_PAGINA,
    paginas: Math.max(1, Math.ceil(total / POR_PAGINA)),
    resumo: Object.fromEntries(porSituacao.map((g) => [g.status, g._count._all])) as Record<string, number>,
    itens: itens.map((p) => ({ ...p, criadoEm: p.criadoEm.toISOString(), itens: p._count.itens })),
  });
}

/** PATCH — o lojista avança o pedido. Pagamento só muda pelo webhook. */
export async function PATCH(request: Request) {
  const loja = await lojistaAtual();
  if (!loja) return Response.json({ erro: "Sessão expirada." }, { status: 401 });
  const r = Entrada.safeParse(await request.json().catch(() => null));
  if (!r.success) return Response.json({ erro: "Dados inválidos." }, { status: 422 });

  const pedido = await prisma.pedido.findFirst({ where: { id: r.data.id, tenantId: loja.id } });
  if (!pedido) return Response.json({ erro: "Pedido não encontrado." }, { status: 404 });
  if (pedido.status === "AGUARDANDO_PAGAMENTO" && r.data.status && r.data.status !== "CANCELADO") {
    return Response.json({ erro: "Pedido ainda não foi pago." }, { status: 409 });
  }
  const a = await prisma.pedido.update({
    where: { id: pedido.id },
    data: { ...(r.data.status ? { status: r.data.status } : {}), ...(r.data.rastreio !== undefined ? { rastreio: r.data.rastreio } : {}) },
  });
  // Quem pagou some do mapa até o pacote chegar, se ninguém avisar. O aviso sai
  // uma vez só, na virada para ENVIADO: salvar o rastreio de novo, ou marcar
  // entregue depois, não pode gerar um segundo e-mail.
  if (r.data.status === "ENVIADO" && pedido.status !== "ENVIADO") {
    await emitir({
      tipo: "pedido.enviado",
      slug: loja.slug,
      referencia: a.referencia,
      numero: a.numero,
      clienteNome: a.clienteNome,
      clienteEmail: a.clienteEmail,
      clienteTelefone: a.clienteTelefone,
      transportadora: a.freteNome,
      rastreio: a.rastreio,
      linkPedido: `${urlDaLoja(loja)}/pedido/${a.referencia}`,
      lojaNome: loja.nome,
      lojaUrl: urlDaLoja(loja),
      lojistaEmail: loja.loginEmail ?? loja.emailContato,
      lojistaWhatsapp: loja.whatsapp,
      emailRemetente: loja.emailRemetente,
    });
  }

  return Response.json({ id: a.id, status: a.status, rastreio: a.rastreio });
}
