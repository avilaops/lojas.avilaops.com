import { compradorAtual } from "@/lib/conta";
import { criarCotacaoB2B, expirarCotacoesVencidas } from "@/lib/cotacoes-b2b";
import { erroCotacao } from "@/lib/cotacoes-b2b-api";
import { CriarCotacaoSchema } from "@/lib/cotacoes-b2b-schema";
import { prisma } from "@/lib/db";
import { tenantAtual } from "@/lib/tenant";

const Entrada = CriarCotacaoSchema.omit({ ator: true, responsavelEmail: true });

async function sessaoComprador() {
  const tenant = await tenantAtual();
  if (!tenant) return { resposta: Response.json({ erro: "Loja não encontrada." }, { status: 404 }) } as const;
  const comprador = await compradorAtual(tenant);
  if (!comprador) return { resposta: Response.json({ erro: "Entre na sua conta." }, { status: 401 }) } as const;
  return { tenant, comprador } as const;
}

export async function GET() {
  const sessao = await sessaoComprador();
  if ("resposta" in sessao) return sessao.resposta;
  const { tenant, comprador } = sessao;
  await expirarCotacoesVencidas(tenant.id);
  const cotacoes = await prisma.cotacaoB2B.findMany({
    where: { tenantId: tenant.id, compradorEmpresa: { compradorId: comprador.id, situacao: "ATIVO" } },
    include: {
      empresa: { select: { razaoSocial: true } },
      versoes: { orderBy: { numero: "desc" }, take: 1 },
      pedido: { select: { id: true, numero: true, status: true } },
    },
    orderBy: { criadoEm: "desc" },
  });
  return Response.json({ cotacoes });
}

export async function POST(request: Request) {
  const sessao = await sessaoComprador();
  if ("resposta" in sessao) return sessao.resposta;
  const entrada = Entrada.safeParse(await request.json().catch(() => null));
  if (!entrada.success) return Response.json({ erro: "Dados inválidos.", detalhes: entrada.error.flatten() }, { status: 422 });
  const compradorEmpresaId = entrada.data.compradorEmpresaId;
  if (!compradorEmpresaId) return Response.json({ erro: "Informe a empresa compradora." }, { status: 422 });
  const vinculo = await prisma.compradorEmpresaB2B.findFirst({
    where: {
      id: compradorEmpresaId,
      tenantId: sessao.tenant.id,
      empresaId: entrada.data.empresaId,
      compradorId: sessao.comprador.id,
      situacao: "ATIVO",
    },
    select: { id: true },
  });
  if (!vinculo) return Response.json({ erro: "Empresa não encontrada para este comprador." }, { status: 404 });
  const escopo = await prisma.escopoCompradorB2B.findFirst({
    where: {
      tenantId: sessao.tenant.id,
      empresaId: entrada.data.empresaId,
      compradorEmpresaId: vinculo.id,
      OR: [{ unidadeId: null }, { unidadeId: entrada.data.unidadeId ?? null }],
    },
    select: { papel: true, unidadeId: true },
  });
  if (!escopo) return Response.json({ erro: "Comprador sem acesso à unidade informada." }, { status: 403 });
  if (entrada.data.unidadeId) {
    const unidade = await prisma.unidadeEmpresaB2B.findFirst({
      where: { tenantId: sessao.tenant.id, empresaId: entrada.data.empresaId, id: entrada.data.unidadeId, ativa: true },
      select: { id: true },
    });
    if (!unidade) return Response.json({ erro: "Unidade não encontrada ou inativa." }, { status: 404 });
  }
  if (entrada.data.centroCustoId && escopo.papel !== "ADMINISTRADOR") {
    const centroPermitido = await prisma.compradorCentroCustoB2B.findFirst({
      where: { tenantId: sessao.tenant.id, empresaId: entrada.data.empresaId, compradorEmpresaId: vinculo.id, centroCustoId: entrada.data.centroCustoId },
      select: { centroCustoId: true },
    });
    if (!centroPermitido) return Response.json({ erro: "Comprador sem acesso ao centro de custo informado." }, { status: 403 });
  }
  const ator = { tipo: "COMPRADOR", id: vinculo.id, email: sessao.comprador.email };
  try {
    return Response.json(await criarCotacaoB2B(sessao.tenant.id, {
      ...entrada.data,
      compradorEmpresaId: vinculo.id,
      responsavelEmail: sessao.comprador.email,
    }, ator), { status: 201 });
  } catch (falha) {
    return erroCotacao(falha);
  }
}
