import { z } from "zod";
import { prisma } from "@/lib/db";
import { tenantAtual } from "@/lib/tenant";
import { emitir } from "@/lib/eventos";

const Entrada = z.object({
  produtoId: z.string(),
  nome: z.string().trim().min(2).max(60),
  nota: z.number().int().min(1).max(5),
  texto: z.string().trim().max(1000).optional(),
  /** Campo-isca contra robôs: humano não preenche. */
  site: z.string().max(0).optional(),
});

// Freio simples por loja: 30 avaliações/hora por instância.
const janela = new Map<string, { n: number; ate: number }>();

/** POST — comprador envia avaliação; entra como não aprovada até o lojista liberar. */
export async function POST(request: Request) {
  const t = await tenantAtual();
  if (!t) return Response.json({ erro: "loja não encontrada" }, { status: 404 });
  const r = Entrada.safeParse(await request.json().catch(() => null));
  if (!r.success) return Response.json({ erro: "Preencha nome, nota (1 a 5) e, se quiser, um comentário." }, { status: 422 });

  const j = janela.get(t.id);
  if (j && j.ate > Date.now() && j.n >= 30) return Response.json({ erro: "Muitas avaliações agora. Tente mais tarde." }, { status: 429 });
  janela.set(t.id, j && j.ate > Date.now() ? { n: j.n + 1, ate: j.ate } : { n: 1, ate: Date.now() + 3_600_000 });

  const produto = await prisma.produto.findFirst({ where: { id: r.data.produtoId, tenantId: t.id, ativo: true } });
  if (!produto) return Response.json({ erro: "Produto não encontrado." }, { status: 404 });

  await prisma.avaliacao.create({ data: { tenantId: t.id, produtoId: produto.id, nome: r.data.nome, nota: r.data.nota, texto: r.data.texto || null } });
  await emitir({ tipo: "avaliacao.recebida", slug: t.slug, nome: t.nome, produtoNome: produto.nome, nota: r.data.nota, autor: r.data.nome, emailContato: t.loginEmail ?? t.emailContato, whatsapp: t.whatsapp });
  return Response.json({ ok: true, mensagem: "Obrigado! Sua avaliação aparece depois que a loja aprovar." }, { status: 201 });
}
