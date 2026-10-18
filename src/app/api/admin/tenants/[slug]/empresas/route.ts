import { Prisma } from "@prisma/client";
import { autorizado, naoAutorizado } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import { salvarEmpresaB2B } from "@/lib/identidade-b2b";
import { EntradaEmpresaB2BSchema } from "@/lib/identidade-b2b-schema";

type Ctx = { params: Promise<{ slug: string }> };

export const empresaB2BInclude = {
  unidades: { include: { enderecos: true }, orderBy: { referencia: "asc" } },
  contatos: { orderBy: { nome: "asc" } },
  centrosCusto: { orderBy: { codigo: "asc" } },
  compradores: {
    include: {
      autorizacoes: { orderBy: [{ versao: "desc" }, { papel: "asc" }] },
      provisionamento: true,
      centrosCusto: { include: { centroCusto: true } },
    },
    orderBy: { emailNormalizado: "asc" },
  },
} satisfies Prisma.EmpresaB2BInclude;

export async function GET(request: Request, { params }: Ctx) {
  if (!autorizado(request)) return naoAutorizado();
  const { slug } = await params;
  const tenant = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
  if (!tenant) return Response.json({ erro: "loja não encontrada" }, { status: 404 });
  const empresas = await prisma.empresaB2B.findMany({
    where: { tenantId: tenant.id },
    include: empresaB2BInclude,
    orderBy: { razaoSocial: "asc" },
  });
  return Response.json({ empresas });
}
export async function POST(request: Request, { params }: Ctx) {
  if (!autorizado(request)) return naoAutorizado();
  const { slug } = await params;
  const tenant = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
  if (!tenant) return Response.json({ erro: "loja não encontrada" }, { status: 404 });
  const resultado = EntradaEmpresaB2BSchema.safeParse(await request.json().catch(() => null));
  if (!resultado.success) return Response.json({ erro: "dados inválidos", detalhes: resultado.error.flatten() }, { status: 422 });
  try {
    const empresa = await salvarEmpresaB2B(tenant.id, resultado.data, { tipo: "ADMIN", id: "api-admin" });
    return Response.json(empresa, { status: 201 });
  } catch {
    return Response.json({ erro: "dados empresariais inconsistentes" }, { status: 422 });
  }
}
