import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import {
  lerContextoCorporativo,
  montarPedidoProvisionamento,
  provisionarNoAuth,
  referenciaAuthDaEmpresa,
  referenciaAuthDaUnidade,
  suspenderOuRevogarNoAuth,
  type ConfigCorporativoAuth,
  type PapelCorporativo,
} from "./corporativo-auth";
import { prisma } from "./db";

type OpcoesHttp = { fetchImpl?: typeof fetch; timeoutMs?: number };

export async function processarProvisionamentoB2B(
  compradorEmpresaId: string,
  config: ConfigCorporativoAuth,
  opcoes: OpcoesHttp = {},
): Promise<"SINCRONIZADO" | "FALHOU" | "IGNORADO"> {
  const vinculo = await prisma.compradorEmpresaB2B.findUnique({
    where: { id: compradorEmpresaId },
    include: {
      empresa: { include: { unidades: { where: { ativa: true }, orderBy: { referencia: "asc" } } } },
      provisionamento: true,
      autorizacoes: true,
    },
  });
  const provisionamento = vinculo?.provisionamento;
  if (!vinculo || !provisionamento) return "IGNORADO";
  const leaseId = randomUUID();
  const operacao = vinculo.situacao === "ATIVO" ? "PROVISIONAMENTO" : vinculo.situacao === "REVOGADO" ? "REVOGACAO" : "SUSPENSAO";
  const reivindicado = await prisma.$transaction(async (tx) => {
    const resultado = await tx.provisionamentoCompradorB2B.updateMany({
      where: {
        id: provisionamento.id,
        correlacaoId: provisionamento.correlacaoId,
        versaoDesejada: provisionamento.versaoDesejada,
        OR: [
          { situacao: { in: ["PENDENTE", "FALHOU"] } },
          { situacao: "PROCESSANDO", ultimaTentativaEm: { lt: new Date(Date.now() - 5 * 60_000) } },
        ],
      },
      data: { situacao: "PROCESSANDO", leaseId, tentativas: { increment: 1 }, ultimaTentativaEm: new Date() },
    });
    if (resultado.count === 1) {
      await tx.auditoriaB2B.create({ data: {
        tenantId: vinculo.tenantId,
        empresaId: vinculo.empresaId,
        tipoAtor: "SISTEMA",
        acao: `${operacao}_INICIADO`,
        entidade: "CompradorEmpresaB2B",
        entidadeId: compradorEmpresaId,
        resultado: "INICIADO",
        correlacaoId: provisionamento.correlacaoId,
        estadoPosterior: { versao: provisionamento.versaoDesejada, leaseId },
      } });
    }
    return resultado.count;
  });
  if (reivindicado !== 1) return "IGNORADO";
  try {
    if (vinculo.situacao !== "ATIVO") {
      const situacao = vinculo.situacao === "REVOGADO" ? "REVOGADO" : "SUSPENSO";
      const intencaoVersaoAplicada = await suspenderOuRevogarNoAuth(config, {
        email: vinculo.emailNormalizado,
        referenciaOrganizacao: referenciaAuthDaEmpresa(vinculo.tenantId, vinculo.empresaId),
        situacao,
        intencaoVersao: provisionamento.versaoDesejada,
      }, { ...opcoes, idempotencyKey: provisionamento.correlacaoId });
      if (intencaoVersaoAplicada !== provisionamento.versaoDesejada) throw new Error("Auth confirmou uma versão de intenção diferente da solicitada.");
      return prisma.$transaction(async (tx) => {
        const atual = await tx.provisionamentoCompradorB2B.findUnique({ where: { compradorEmpresaId } });
        if (!atual || atual.situacao !== "PROCESSANDO" || atual.leaseId !== leaseId || atual.correlacaoId !== provisionamento.correlacaoId || atual.versaoDesejada !== provisionamento.versaoDesejada) return "IGNORADO" as const;
        await tx.provisionamentoCompradorB2B.update({
          where: { compradorEmpresaId },
          data: { situacao, leaseId: null, versaoSincronizada: provisionamento.versaoDesejada, sincronizadoEm: new Date(), ultimoErro: null },
        });
        await tx.escopoCompradorB2B.deleteMany({ where: { tenantId: vinculo.tenantId, compradorEmpresaId } });
        await tx.auditoriaB2B.create({ data: {
          tenantId: vinculo.tenantId,
          empresaId: vinculo.empresaId,
          tipoAtor: "SISTEMA",
          acao: situacao === "REVOGADO" ? "VINCULO_REVOGADO" : "VINCULO_SUSPENSO",
          entidade: "CompradorEmpresaB2B",
          entidadeId: compradorEmpresaId,
          resultado: "SUCESSO",
          correlacaoId: provisionamento.correlacaoId,
          estadoPosterior: { situacao, versao: provisionamento.versaoDesejada },
        } });
        return "SINCRONIZADO" as const;
      }, { isolationLevel: "Serializable" });
    }
    const autorizacoes = vinculo.autorizacoes.filter((item) => item.versao === provisionamento.versaoDesejada);
    const pedido = montarPedidoProvisionamento({
      intencaoVersao: provisionamento.versaoDesejada,
      organizacaoVersao: vinculo.empresa.versao,
      tenantId: vinculo.tenantId,
      empresaId: vinculo.empresaId,
      razaoSocial: vinculo.empresa.razaoSocial,
      email: vinculo.emailNormalizado,
      unidades: vinculo.empresa.unidades.map(({ id, nome }) => ({ id, nome })),
      autorizacoes: autorizacoes.map((item) => ({
        papel: item.papel as PapelCorporativo,
        unidadeId: item.unidadeId,
        limiteAprovacaoCentavos: item.limiteAprovacaoCentavos,
      })),
    });
    const resposta = await provisionarNoAuth(config, pedido, { ...opcoes, idempotencyKey: provisionamento.correlacaoId });
    if (resposta.intencaoVersaoAplicada !== provisionamento.versaoDesejada) throw new Error("Auth confirmou uma versão de intenção diferente da solicitada.");
    if (resposta.organizacaoVersaoAplicada !== vinculo.empresa.versao) throw new Error("Auth confirmou uma versão da organização diferente da solicitada.");
    return prisma.$transaction(async (tx) => {
      const atual = await tx.provisionamentoCompradorB2B.findUnique({ where: { compradorEmpresaId } });
      if (!atual || atual.situacao !== "PROCESSANDO" || atual.leaseId !== leaseId || atual.correlacaoId !== provisionamento.correlacaoId || atual.versaoDesejada !== provisionamento.versaoDesejada) return "IGNORADO" as const;
      await tx.empresaB2B.update({ where: { id: vinculo.empresaId }, data: { authOrganizacaoId: resposta.organizacaoId } });
      await tx.compradorEmpresaB2B.update({ where: { id: compradorEmpresaId }, data: { authVinculoId: resposta.vinculoId } });
      await tx.provisionamentoCompradorB2B.update({
        where: { compradorEmpresaId },
        data: {
          situacao: "SINCRONIZADO",
          leaseId: null,
          versaoSincronizada: resposta.intencaoVersaoAplicada,
          sincronizadoEm: new Date(),
          ultimoErro: null,
        },
      });
      await tx.auditoriaB2B.create({ data: {
        tenantId: vinculo.tenantId,
        empresaId: vinculo.empresaId,
        tipoAtor: "SISTEMA",
        acao: "PROVISIONAMENTO_SINCRONIZADO",
        entidade: "CompradorEmpresaB2B",
        entidadeId: compradorEmpresaId,
        resultado: "SUCESSO",
        correlacaoId: provisionamento.correlacaoId,
        estadoPosterior: { versao: resposta.versao, organizacaoId: resposta.organizacaoId, vinculoId: resposta.vinculoId },
      } });
      return "SINCRONIZADO" as const;
    }, { isolationLevel: "Serializable" });
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message.slice(0, 500) : "Falha desconhecida no Auth.";
    await prisma.$transaction(async (tx) => {
      const atual = await tx.provisionamentoCompradorB2B.findUnique({ where: { compradorEmpresaId } });
      if (!atual || atual.situacao !== "PROCESSANDO" || atual.leaseId !== leaseId || atual.correlacaoId !== provisionamento.correlacaoId || atual.versaoDesejada !== provisionamento.versaoDesejada) return;
      await tx.provisionamentoCompradorB2B.update({
        where: { compradorEmpresaId },
        data: { situacao: "FALHOU", leaseId: null, ultimoErro: mensagem },
      });
      await tx.auditoriaB2B.create({ data: {
        tenantId: vinculo.tenantId,
        empresaId: vinculo.empresaId,
        tipoAtor: "SISTEMA",
        acao: `${operacao}_FALHOU`,
        entidade: "CompradorEmpresaB2B",
        entidadeId: compradorEmpresaId,
        resultado: "FALHA",
        correlacaoId: provisionamento.correlacaoId,
        estadoPosterior: { versao: provisionamento.versaoDesejada, erro: mensagem } as Prisma.InputJsonValue,
      } });
    }, { isolationLevel: "Serializable" });
    return "FALHOU";
  }
}
export async function reconciliarContextoB2B(compradorEmpresaId: string, corpo: unknown): Promise<boolean> {
  const vinculo = await prisma.compradorEmpresaB2B.findUnique({
    where: { id: compradorEmpresaId },
    include: { empresa: { include: { unidades: { where: { ativa: true } } } } },
  });
  if (!vinculo || vinculo.situacao !== "ATIVO") return false;
  const unidadesPorReferencia = new Map(vinculo.empresa.unidades.map((unidade) => [
    referenciaAuthDaUnidade(vinculo.tenantId, unidade.id),
    unidade.id,
  ]));
  const contexto = lerContextoCorporativo(corpo, {
    referenciaOrganizacao: referenciaAuthDaEmpresa(vinculo.tenantId, vinculo.empresaId),
    unidades: unidadesPorReferencia,
  });
  if (!contexto) return false;

  await prisma.$transaction(async (tx) => {
    await tx.empresaB2B.update({ where: { id: vinculo.empresaId }, data: { authOrganizacaoId: contexto.organizacaoId } });
    await tx.compradorEmpresaB2B.update({ where: { id: compradorEmpresaId }, data: { authVinculoId: contexto.vinculoId } });
    for (const escopo of contexto.escopos) {
      if (escopo.unidadeId && escopo.authUnidadeId) {
        await tx.unidadeEmpresaB2B.update({ where: { id: escopo.unidadeId }, data: { authUnidadeId: escopo.authUnidadeId } });
      }
    }
    await tx.escopoCompradorB2B.deleteMany({ where: { tenantId: vinculo.tenantId, compradorEmpresaId } });
    if (contexto.escopos.length) {
      await tx.escopoCompradorB2B.createMany({ data: contexto.escopos.map((escopo) => ({
        tenantId: vinculo.tenantId,
        empresaId: vinculo.empresaId,
        compradorEmpresaId,
        papel: escopo.papel,
        escopo: escopo.unidadeId ? "UNIDADE" : "ORGANIZACAO",
        unidadeId: escopo.unidadeId,
        limiteAprovacaoCentavos: escopo.limiteAprovacaoCentavos,
        contextoVersao: contexto.versao,
      })) });
    }
    await tx.auditoriaB2B.create({ data: {
      tenantId: vinculo.tenantId,
      empresaId: vinculo.empresaId,
      tipoAtor: "SISTEMA",
      acao: "CONTEXTO_AUTH_RECONCILIADO",
      entidade: "CompradorEmpresaB2B",
      entidadeId: compradorEmpresaId,
      resultado: "SUCESSO",
      estadoPosterior: { versao: contexto.versao, quantidadeEscopos: contexto.escopos.length },
    } });
  }, { isolationLevel: "Serializable" });
  return true;
}
