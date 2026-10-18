import { autorizado, naoAutorizado } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import { salvarEmpresaB2B } from "@/lib/identidade-b2b";
import { EntradaEmpresaB2BSchema } from "@/lib/identidade-b2b-schema";
import { empresaB2BInclude } from "../route";

type Ctx = { params: Promise<{ slug: string; empresaId: string }> };

async function localizar(slug: string, empresaId: string) {
  return prisma.empresaB2B.findFirst({ where: { id: empresaId, tenant: { slug } }, include: empresaB2BInclude });
}
export async function GET(request: Request, { params }: Ctx) {
  if (!autorizado(request)) return naoAutorizado();
  const { slug, empresaId } = await params;
  const empresa = await localizar(slug, empresaId);
  if (!empresa) return Response.json({ erro: "empresa não encontrada" }, { status: 404 });
  return Response.json(empresa);
}
export async function PATCH(request: Request, { params }: Ctx) {
  if (!autorizado(request)) return naoAutorizado();
  const { slug, empresaId } = await params;
  const atual = await prisma.empresaB2B.findFirst({
    where: { id: empresaId, tenant: { slug } },
    select: { tenantId: true, referencia: true },
  });
  if (!atual) return Response.json({ erro: "empresa não encontrada" }, { status: 404 });
  const resultado = EntradaEmpresaB2BSchema.safeParse(await request.json().catch(() => null));
  if (!resultado.success) return Response.json({ erro: "dados inválidos", detalhes: resultado.error.flatten() }, { status: 422 });
  if (resultado.data.referencia.toLowerCase() !== atual.referencia) {
    return Response.json({ erro: "a referência da empresa não pode ser alterada" }, { status: 409 });
  }
  try {
    const empresa = await salvarEmpresaB2B(atual.tenantId, resultado.data, { tipo: "ADMIN", id: "api-admin" });
    if (empresa.id !== empresaId) return Response.json({ erro: "empresa não encontrada" }, { status: 404 });
    return Response.json(empresa);
  } catch {
    return Response.json({ erro: "dados empresariais inconsistentes" }, { status: 422 });
  }
}
