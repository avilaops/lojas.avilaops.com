import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { EntradaSolicitacaoSobMedidaSchema, resumoDaConfiguracao, VERSAO_CONFIGURADOR_SOB_MEDIDA } from "./configurador-sob-medida";

export interface DadosPersistenciaSolicitacao {
  tenantId: string;
  referencia: string;
  contratoVersao: number;
  nome: string;
  email: string | null;
  telefone: string | null;
  configuracao: Prisma.InputJsonValue;
  resumo: string;
  consentimentoEm: Date;
}

type PersistirSolicitacao = (dados: DadosPersistenciaSolicitacao) => Promise<{ id: string; referencia: string; criadoEm: Date }>;

const persistirNoBanco: PersistirSolicitacao = (dados) => prisma.solicitacaoSobMedida.create({
  data: dados,
  select: { id: true, referencia: true, criadoEm: true },
});

export async function criarSolicitacaoSobMedida(tenantId: string, entradaBruta: unknown, persistir: PersistirSolicitacao = persistirNoBanco) {
  const entrada = EntradaSolicitacaoSobMedidaSchema.parse(entradaBruta);
  const referencia = `CFG-${randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`;
  const gravada = await persistir({
    tenantId,
    referencia,
    contratoVersao: VERSAO_CONFIGURADOR_SOB_MEDIDA,
    nome: entrada.nome,
    email: entrada.email || null,
    telefone: entrada.telefone || null,
    configuracao: entrada.configuracao as Prisma.InputJsonValue,
    resumo: resumoDaConfiguracao(entrada.configuracao),
    consentimentoEm: new Date(),
  });
  return { referencia: gravada.referencia, criadoEm: gravada.criadoEm };
}
