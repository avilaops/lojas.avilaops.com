import { z } from "zod";
import { prisma } from "@/lib/db";
import { autorizado, naoAutorizado } from "@/lib/admin-auth";
import { configurarFiscalN8n, testarFiscalN8n, DESTINO_FISCAL_N8N } from "@/lib/fiscal-n8n";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  if (!autorizado(request)) return naoAutorizado();
  const [destinos, revisoes, rotina] = await Promise.all([
    prisma.webhookApi.findMany({ where: { url: DESTINO_FISCAL_N8N }, select: { id: true, ativo: true, tenant: { select: { slug: true } }, fluxosFiscais: { select: { id: true, nome: true, ativo: true } }, entregas: { take: 5, orderBy: { criadaEm: "desc" }, select: { id: true, eventId: true, status: true, tentativas: true, ultimoStatus: true, ultimoErro: true } } } }),
    prisma.automacaoEvento.count({ where: { tipo: { startsWith: "fiscal." }, status: "PROCESSADO" } }),
    prisma.rotina.findUnique({ where: { nome: "webhooks.entregar" }, select: { ultimaEm: true, ultimoResumo: true, ultimoErro: true, falhasSeguidas: true, proximaEm: true } }),
  ]);
  return Response.json({ destinos, revisoesRegistradas: revisoes, rotina, nenhumaMovimentacao: true }, { headers: { "Cache-Control": "no-store" } });
}
export async function POST(request: Request) {
  if (!autorizado(request)) return naoAutorizado();
  const r = z.object({ acao: z.enum(["configurar", "testar"]), slugs: z.array(z.string().min(1).max(80)).min(1).max(50).optional() }).strict().safeParse(await request.json().catch(() => null));
  if (!r.success) return Response.json({ erro: "Ação fiscal inválida." }, { status: 422 });
  return Response.json(r.data.acao === "configurar" ? await configurarFiscalN8n(r.data.slugs) : await testarFiscalN8n(r.data.slugs));
}
