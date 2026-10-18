import { z } from "zod";
import { autorizado, naoAutorizado } from "@/lib/admin-auth";
import { criarVersaoContrato, selecionarContratoVigente } from "@/lib/contratos-comerciais";
import { prisma } from "@/lib/db";

type Ctx = { params: Promise<{ slug: string }> };

const Entrada = z.object({
  plano: z.enum(["SITE", "LOJA", "LOJA_PRO"]),
  mensalidadeCentavos: z.number().int().nonnegative(),
  comissaoPontosBase: z.number().int().min(0).max(10_000),
  vigenteDesde: z.string().datetime().optional(),
  aceiteEm: z.string().datetime().nullable().optional(),
  aceiteReferencia: z.string().trim().min(1).max(200).nullable().optional(),
  origem: z.string().trim().min(1).max(60),
}).strict();

export async function GET(request: Request, { params }: Ctx) {
  if (!autorizado(request)) return naoAutorizado();
  const { slug } = await params;
  const tenant = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
  if (!tenant) return Response.json({ erro: "loja não encontrada" }, { status: 404 });
  const contratos = await prisma.contratoComercial.findMany({ where: { tenantId: tenant.id }, orderBy: { versao: "desc" } });
  let vigente = null;
  try {
    vigente = selecionarContratoVigente(contratos, new Date());
  } catch (erro) {
    return Response.json({ erro: erro instanceof Error ? erro.message : "contratos comerciais inconsistentes" }, { status: 409 });
  }
  return Response.json({ vigente, contratos });
}

export async function POST(request: Request, { params }: Ctx) {
  if (!autorizado(request)) return naoAutorizado();
  const { slug } = await params;
  const entrada = Entrada.safeParse(await request.json().catch(() => null));
  if (!entrada.success) return Response.json({ erro: "dados inválidos", detalhes: entrada.error.flatten() }, { status: 422 });
  const tenant = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
  if (!tenant) return Response.json({ erro: "loja não encontrada" }, { status: 404 });
  try {
    const contrato = await criarVersaoContrato(tenant.id, {
      ...entrada.data,
      vigenteDesde: entrada.data.vigenteDesde ? new Date(entrada.data.vigenteDesde) : undefined,
      aceiteEm: entrada.data.aceiteEm === undefined ? undefined : entrada.data.aceiteEm === null ? null : new Date(entrada.data.aceiteEm),
    });
    return Response.json(contrato, { status: 201 });
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : "não foi possível registrar o contrato";
    const conflito = /já existe|vigente/.test(mensagem);
    return Response.json({ erro: mensagem }, { status: conflito ? 409 : 422 });
  }
}
