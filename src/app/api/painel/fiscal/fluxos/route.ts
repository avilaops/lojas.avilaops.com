import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { exigir } from "@/lib/operadores";
import { origemFiscalPermitida } from "@/lib/fiscal-origem";
import { ConfigurarFluxoFiscal, EVENTOS_FISCAIS, CAMPOS_FISCAIS, FINALIDADES_FISCAIS } from "@/lib/fiscal-fluxos-contrato";
import { planoPermite } from "@/lib/api-chaves";

export const dynamic = "force-dynamic";

export async function GET() {
  const { s, erro } = await exigir("fiscal");
  if (erro) return erro;
  const tenantId = s.tenant.id;
  const [fluxos, destinos, entregas] = await Promise.all([
    prisma.fluxoFiscalLoja.findMany({ where: { tenantId }, orderBy: { criadoEm: "desc" } }),
    prisma.webhookApi.findMany({ where: { tenantId }, select: { id: true, nome: true, url: true, ativo: true } }),
    prisma.entregaWebhook.findMany({
      where: { tenantId, tipo: { startsWith: "fiscal." } }, orderBy: { criadaEm: "desc" }, take: 30,
      select: { id: true, webhookId: true, eventId: true, tipo: true, status: true, tentativas: true, ultimoStatus: true, ultimoErro: true, criadaEm: true, entregueEm: true, corpo: true },
    }),
  ]);
  const metadados = z.object({ fluxo: z.object({ nome: z.string() }), dados: z.object({ documento: z.object({ id: z.string(), nsu: z.string(), numero: z.string().nullable() }) }) });
  const historico = entregas.map(({ corpo, ...e }) => {
    const m = metadados.safeParse(corpo);
    return { ...e, documento: m.success ? m.data.dados.documento : null, fluxoNome: m.success ? m.data.fluxo.nome : null };
  });
  return Response.json({ fluxos, destinos, entregas: historico, podeUsar: planoPermite("SECRETA", s.tenant.plano), eventos: EVENTOS_FISCAIS, campos: CAMPOS_FISCAIS, finalidades: FINALIDADES_FISCAIS }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const { s, erro } = await exigir("fiscal");
  if (erro) return erro;
  if (!origemFiscalPermitida(request)) return Response.json({ erro: "Origem não permitida." }, { status: 403 });
  if (!planoPermite("SECRETA", s.tenant.plano) || s.tenant.status !== "ATIVA") return Response.json({ erro: "Os fluxos exigem uma loja ativa com plano Loja Pro." }, { status: 403 });
  const r = ConfigurarFluxoFiscal.safeParse(await request.json().catch(() => null));
  if (!r.success) return Response.json({ erro: r.error.issues[0]?.message ?? "Configuração inválida." }, { status: 422 });
  // O destino precisa ser da sessão; nunca aceitar tenantId do corpo.
  const destino = await prisma.webhookApi.findFirst({ where: { id: r.data.webhookId, tenantId: s.tenant.id, ativo: true }, select: { id: true } });
  if (!destino) return Response.json({ erro: "Escolha um destino ativo desta loja." }, { status: 422 });
  try {
    const fluxo = await prisma.fluxoFiscalLoja.create({ data: { ...r.data, tenantId: s.tenant.id, criadoPor: s.tenant.loginEmail ?? "DONO" } });
    return Response.json({ id: fluxo.id }, { status: 201 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return Response.json({ erro: "Este destino já possui um fluxo para essa finalidade. Edite o fluxo existente." }, { status: 409 });
    throw e;
  }
}

const Alterar = z.object({ id: z.string().min(1).max(80), ativo: z.boolean() }).strict();
export async function PATCH(request: Request) {
  const { s, erro } = await exigir("fiscal");
  if (erro) return erro;
  if (!origemFiscalPermitida(request)) return Response.json({ erro: "Origem não permitida." }, { status: 403 });
  const r = Alterar.safeParse(await request.json().catch(() => null));
  if (!r.success) return Response.json({ erro: "Dados inválidos." }, { status: 422 });
  if (r.data.ativo && (!planoPermite("SECRETA", s.tenant.plano) || s.tenant.status !== "ATIVA")) return Response.json({ erro: "Ativação indisponível neste plano ou situação da loja." }, { status: 403 });
  const alterado = await prisma.fluxoFiscalLoja.updateMany({ where: { id: r.data.id, tenantId: s.tenant.id }, data: { ativo: r.data.ativo } });
  return alterado.count ? Response.json({ ok: true }) : Response.json({ erro: "Fluxo não encontrado." }, { status: 404 });
}

export async function PUT(request: Request) {
  const { s, erro } = await exigir("fiscal");
  if (erro) return erro;
  if (!origemFiscalPermitida(request)) return Response.json({ erro: "Origem não permitida." }, { status: 403 });
  if (!planoPermite("SECRETA", s.tenant.plano) || s.tenant.status !== "ATIVA") return Response.json({ erro: "Os fluxos exigem uma loja ativa com plano Loja Pro." }, { status: 403 });
  const r = z.object({ id: z.string().min(1).max(80), configuracao: ConfigurarFluxoFiscal }).strict().safeParse(await request.json().catch(() => null));
  if (!r.success) return Response.json({ erro: r.error.issues[0]?.message ?? "Dados inválidos." }, { status: 422 });
  // Identidade do fluxo é estável. Mudar campos não cria outra entrega para documentos já enviados.
  const alterado = await prisma.fluxoFiscalLoja.updateMany({
    where: { id: r.data.id, tenantId: s.tenant.id, webhookId: r.data.configuracao.webhookId, finalidade: r.data.configuracao.finalidade },
    data: { nome: r.data.configuracao.nome, eventos: r.data.configuracao.eventos, campos: r.data.configuracao.campos },
  });
  return alterado.count ? Response.json({ ok: true }) : Response.json({ erro: "Fluxo não encontrado ou destino/finalidade alterados." }, { status: 404 });
}
