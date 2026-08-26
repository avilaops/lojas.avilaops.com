import { z } from "zod";
import { prisma } from "@/lib/db";
import { tenantAtual } from "@/lib/tenant";

/**
 * "Avise-me quando chegar". Produto sem estoque hoje é venda perdida em
 * silêncio: o visitante sai e ninguém fica sabendo. Aqui a loja registra quem
 * queria — e ganha uma lista de reposição feita pela própria demanda.
 */
const Entrada = z.object({
  produtoId: z.string().max(40),
  email: z.string().email(),
  telefone: z.string().max(30).optional(),
  /** Campo-isca contra robôs: humano não preenche. */
  site: z.string().max(0).optional(),
});

const janela = new Map<string, { n: number; ate: number }>();

export async function POST(request: Request) {
  const t = await tenantAtual();
  if (!t) return Response.json({ erro: "loja não encontrada" }, { status: 404 });

  const r = Entrada.safeParse(await request.json().catch(() => null));
  if (!r.success) return Response.json({ erro: "Informe um e-mail válido." }, { status: 422 });

  const j = janela.get(t.id);
  if (j && j.ate > Date.now() && j.n >= 60) return Response.json({ erro: "Muitos pedidos agora. Tente mais tarde." }, { status: 429 });
  janela.set(t.id, j && j.ate > Date.now() ? { n: j.n + 1, ate: j.ate } : { n: 1, ate: Date.now() + 3_600_000 });

  const produto = await prisma.produto.findFirst({ where: { id: r.data.produtoId, tenantId: t.id, ativo: true }, select: { id: true } });
  if (!produto) return Response.json({ erro: "Produto não encontrado." }, { status: 404 });

  const email = r.data.email.trim().toLowerCase();
  // Pedir de novo não duplica nem "regasta" quem já foi avisado: o upsert
  // reabre o aviso, que é o que a pessoa quis ao clicar outra vez.
  await prisma.avisoEstoque.upsert({
    where: { produtoId_email: { produtoId: produto.id, email } },
    create: { tenantId: t.id, produtoId: produto.id, email, telefone: r.data.telefone?.replace(/\D/g, "") || null },
    update: { avisadoEm: null, telefone: r.data.telefone?.replace(/\D/g, "") || undefined },
  });

  return Response.json({ ok: true, mensagem: "Pronto! Avisamos você assim que chegar." }, { status: 201 });
}
