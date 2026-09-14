import { z } from "zod";
import { prisma } from "@/lib/db";
import { lojistaAtual } from "@/lib/sessao";
import { exigir } from "@/lib/operadores";
import { salvarGradeNoCatalogo, respostaErroCatalogo } from "@/lib/catalogo-escrita";
import { invalidarCatalogo } from "@/lib/catalogo-cache";

const medida = z.number().positive().nullable().optional();
const Entrada = z.object({
  produtoId: z.string(), versaoCatalogo: z.number().int().positive().optional(),
  opcoes: z.array(z.string().trim().min(1).max(30)).max(3),
  variantes: z.array(z.object({
    id: z.string().optional(), valores: z.record(z.string(), z.string().trim().min(1).max(40)),
    sku: z.string().trim().max(60).nullable().optional(), gtin: z.string().trim().max(20).nullable().optional(), mpn: z.string().trim().max(60).nullable().optional(),
    identificadoresEstado: z.enum(["desconhecido", "informado", "sem_identificador"]).optional(),
    precoCentavos: z.number().int().nonnegative(), precoDeCentavos: z.number().int().nonnegative().nullable().optional(), estoque: z.number().int().nonnegative().nullable().optional(),
    pesoKg: medida, alturaCm: medida, larguraCm: medida, comprimentoCm: medida,
    imagem: z.string().url().nullable().optional(), disponibilidade: z.enum(["in_stock", "out_of_stock", "backorder"]).optional(),
  })).max(200),
});

export async function PUT(request: Request) {
  const { s, erro } = await exigir("catalogo");
  if (erro) return erro;
  const r = Entrada.safeParse(await request.json().catch(()=>null));
  if (!r.success) return Response.json({ erro: "Preencha o preço e as opções de cada variação.", detalhes: r.error.flatten() }, { status: 422 });
  try {
    const p = await salvarGradeNoCatalogo(s.tenant.id, r.data.produtoId, r.data.opcoes, r.data.variantes, r.data.versaoCatalogo);
    invalidarCatalogo(s.tenant.id);
    return Response.json({ opcoes: p.opcoes, variantes: p.variantes.filter(v=>!v.padrao), versaoCatalogo: p.versaoCatalogo });
  } catch(e) { return respostaErroCatalogo(e); }
}

export async function GET(request: Request) {
  const loja = await lojistaAtual();
  if (!loja) return Response.json({ erro: "Sessão expirada." }, { status: 401 });
  const produtoId = new URL(request.url).searchParams.get("produtoId") ?? "";
  const p = await prisma.produto.findFirst({ where: { id: produtoId, tenantId: loja.id }, include: { variantes: { where: { ativo: true, padrao: false }, orderBy: { ordem: "asc" }, include: { saldos: true } } } });
  if (!p) return Response.json({ erro: "Produto não encontrado." }, { status: 404 });
  return Response.json({ opcoes: p.opcoes, variantes: p.variantes.map(v=>({ ...v, estoque: v.saldos.find(s=>s.local==="principal")?.fisico ?? null })), versaoCatalogo: p.versaoCatalogo });
}
