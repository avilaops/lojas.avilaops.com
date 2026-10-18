import { Prisma, type Plano } from "@prisma/client";
import { prisma } from "./db";
import { mensalidadeDaLoja, PRECO_DE_TABELA } from "./faixas-antigas";
import { alertar } from "./alertas";

export const COMISSAO_NOVO_CADASTRO_PONTOS_BASE = 500;

export function dadosDoContratoPadrao(plano: Plano) {
  return {
    plano,
    mensalidadeCentavos: PRECO_DE_TABELA[plano],
    comissaoPontosBase: COMISSAO_NOVO_CADASTRO_PONTOS_BASE,
  };
}

export function dadosDoContratoLegado(t: { slug: string; plano: Plano; faixaPreco: string | null }) {
  return {
    plano: t.plano,
    mensalidadeCentavos: t.slug === "vedashow" ? 35000 : mensalidadeDaLoja(t),
    comissaoPontosBase: t.slug === "vedashow" ? 500 : t.slug === "bereta-rodas" ? 300 : 0,
  };
}

export function intervaloSobreposto(
  inicioA: Date,
  fimA: Date | null,
  inicioB: Date,
  fimB: Date | null,
): boolean {
  return (fimB === null || inicioA < fimB) && (fimA === null || inicioB < fimA);
}

type IntervaloContrato = { id: string; vigenteDesde: Date; vigenteAte: Date | null };

export function selecionarContratoVigente<T extends IntervaloContrato>(contratos: T[], instante: Date): T | null {
  const vigentes = contratos.filter((c) => c.vigenteDesde <= instante && (c.vigenteAte === null || instante < c.vigenteAte));
  if (vigentes.length > 1) throw new Error("mais de um contrato comercial vigente");
  return vigentes[0] ?? null;
}

export async function contratoVigente(tenantId: string, instante = new Date()) {
  const contratos = await prisma.contratoComercial.findMany({
    where: {
      tenantId,
      vigenteDesde: { lte: instante },
      OR: [{ vigenteAte: null }, { vigenteAte: { gt: instante } }],
    },
    orderBy: { versao: "desc" },
    take: 2,
  });
  return selecionarContratoVigente(contratos, instante);
}

export async function contratoParaPedido(
  tenant: { id: string; slug: string; nome: string },
  recurso: string,
  instante = new Date(),
) {
  try {
    const contrato = await contratoVigente(tenant.id, instante);
    if (contrato) return contrato;
    await alertar({
      codigo: "contrato.comercial-invalido",
      slug: tenant.slug,
      lojaNome: tenant.nome,
      recurso,
      detalhe: "Nenhuma versão comercial cobre o instante da venda.",
      link: `/admin/lojas/${tenant.slug}`,
    });
    return null;
  } catch (erro) {
    await alertar({
      codigo: "contrato.comercial-invalido",
      slug: tenant.slug,
      lojaNome: tenant.nome,
      recurso,
      detalhe: erro instanceof Error ? erro.message : "Histórico comercial ambíguo.",
      link: `/admin/lojas/${tenant.slug}`,
    });
    return null;
  }
}

type EvidenciaAceite = {
  aceiteEm: Date | null;
  aceiteReferencia: string | null;
  origem: string;
};

export function contratoPadraoAninhado(
  plano: Plano,
  evidencia: EvidenciaAceite,
  instante = new Date(),
): Prisma.ContratoComercialCreateWithoutTenantInput {
  return {
    versao: 1,
    ...dadosDoContratoPadrao(plano),
    vigenteDesde: instante,
    situacao: "ATIVO",
    ...evidencia,
  };
}

export type NovaVersaoContrato = {
  plano: Plano;
  mensalidadeCentavos: number;
  comissaoPontosBase: number;
  vigenteDesde?: Date;
  aceiteEm?: Date | null;
  aceiteReferencia?: string | null;
  origem: string;
};

export async function criarVersaoContrato(tenantId: string, entrada: NovaVersaoContrato) {
  if (!Number.isInteger(entrada.mensalidadeCentavos) || entrada.mensalidadeCentavos < 0) throw new Error("mensalidade inválida");
  if (!Number.isInteger(entrada.comissaoPontosBase) || entrada.comissaoPontosBase < 0 || entrada.comissaoPontosBase > 10000) throw new Error("comissão inválida");
  const inicio = entrada.vigenteDesde ?? new Date();
  if (inicio.getTime() > Date.now() + 300_000) throw new Error("vigência futura não é permitida");

  for (let tentativa = 1; tentativa <= 3; tentativa++) {
    try {
      return await prisma.$transaction(async (tx) => {
        const contratos = await tx.contratoComercial.findMany({ where: { tenantId }, orderBy: { versao: "desc" } });
        const futuro = contratos.find((c) => c.vigenteDesde.getTime() >= inicio.getTime());
        if (futuro) throw new Error("já existe contrato comercial nesta vigência ou depois dela");
        const atual = selecionarContratoVigente(contratos, inicio);

        if (atual) {
          await tx.contratoComercial.update({ where: { id: atual.id }, data: { vigenteAte: inicio, situacao: "ENCERRADO" } });
        }
        await tx.tenant.update({ where: { id: tenantId }, data: { plano: entrada.plano } });
        return tx.contratoComercial.create({
          data: {
            tenantId,
            versao: (contratos[0]?.versao ?? 0) + 1,
            plano: entrada.plano,
            mensalidadeCentavos: entrada.mensalidadeCentavos,
            comissaoPontosBase: entrada.comissaoPontosBase,
            vigenteDesde: inicio,
            situacao: "ATIVO",
            aceiteEm: entrada.aceiteEm ?? null,
            aceiteReferencia: entrada.aceiteReferencia ?? null,
            origem: entrada.origem,
          },
        });
      }, { isolationLevel: "Serializable" });
    } catch (erro) {
      if (tentativa < 3 && erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2034") continue;
      throw erro;
    }
  }
  throw new Error("não foi possível registrar a versão comercial");
}
