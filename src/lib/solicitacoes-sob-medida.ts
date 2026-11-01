import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "./db";
import {
  ConfiguracaoSobMedidaSchema,
  EntradaSolicitacaoSobMedidaSchema,
  resumoDaConfiguracao,
  VERSAO_CONFIGURADOR_SOB_MEDIDA,
} from "./configurador-sob-medida";

export interface DadosPersistenciaSolicitacao {
  tenantId: string;
  referencia: string;
  contratoVersao: number;
  nome: string;
  email: string | null;
  telefone: string | null;
  configuracao: Prisma.InputJsonValue;
  resumo: string;
  chaveRetomadaHash: string;
  referenciaOrigem: string | null;
  consentimentoEm: Date;
}

type PersistirSolicitacao = (dados: DadosPersistenciaSolicitacao) => Promise<{ id: string; referencia: string; criadoEm: Date }>;

export interface RegistroRetomadaSolicitacao {
  referencia: string;
  contratoVersao: number;
  chaveRetomadaHash: string | null;
  configuracao: unknown;
}

type BuscarParaRetomada = (tenantId: string, referencia: string) => Promise<RegistroRetomadaSolicitacao | null>;

export class RetomadaNaoEncontradaError extends Error {
  constructor() {
    super("Configuração ou chave de retomada inválida.");
    this.name = "RetomadaNaoEncontradaError";
  }
}

const EntradaRetomadaSchema = z.object({ codigoRetomada: z.string().trim().min(1).max(80) });
const FORMATO_CODIGO_RETOMADA = /^(CFG-[A-Z0-9]{12})\.([A-Za-z0-9_-]{22})$/;

function hashDaChave(chave: string): string {
  return createHash("sha256").update(chave).digest("hex");
}

function separarCodigoRetomada(codigo: string): { referencia: string; chave: string } {
  const partes = FORMATO_CODIGO_RETOMADA.exec(codigo);
  if (!partes) throw new RetomadaNaoEncontradaError();
  return { referencia: partes[1], chave: partes[2] };
}

function chaveConfere(chave: string, hashEsperado: string | null): boolean {
  if (!hashEsperado || !/^[a-f0-9]{64}$/.test(hashEsperado)) return false;
  return timingSafeEqual(Buffer.from(hashDaChave(chave), "hex"), Buffer.from(hashEsperado, "hex"));
}

const persistirNoBanco: PersistirSolicitacao = (dados) => prisma.solicitacaoSobMedida.create({
  data: dados,
  select: { id: true, referencia: true, criadoEm: true },
});

const buscarParaRetomadaNoBanco: BuscarParaRetomada = (tenantId, referencia) => prisma.solicitacaoSobMedida.findUnique({
  where: { tenantId_referencia: { tenantId, referencia } },
  select: { referencia: true, contratoVersao: true, chaveRetomadaHash: true, configuracao: true },
});

async function validarRetomada(tenantId: string, codigoRetomada: string, buscar: BuscarParaRetomada): Promise<RegistroRetomadaSolicitacao> {
  const { referencia, chave } = separarCodigoRetomada(codigoRetomada);
  const registro = await buscar(tenantId, referencia);
  if (!registro || !chaveConfere(chave, registro.chaveRetomadaHash)) throw new RetomadaNaoEncontradaError();
  return registro;
}

export async function retomarConfiguracaoSobMedida(tenantId: string, entradaBruta: unknown, buscar: BuscarParaRetomada = buscarParaRetomadaNoBanco) {
  const entrada = EntradaRetomadaSchema.parse(entradaBruta);
  const registro = await validarRetomada(tenantId, entrada.codigoRetomada, buscar);
  const configuracao = ConfiguracaoSobMedidaSchema.parse(registro.configuracao);
  return {
    referencia: registro.referencia,
    contratoVersao: registro.contratoVersao,
    configuracao: { ...configuracao, observacoes: "" },
  };
}

export async function criarSolicitacaoSobMedida(
  tenantId: string,
  entradaBruta: unknown,
  persistir: PersistirSolicitacao = persistirNoBanco,
  buscarParaRetomada: BuscarParaRetomada = buscarParaRetomadaNoBanco,
) {
  const entrada = EntradaSolicitacaoSobMedidaSchema.parse(entradaBruta);
  const origem = entrada.codigoRetomadaOrigem
    ? await validarRetomada(tenantId, entrada.codigoRetomadaOrigem, buscarParaRetomada)
    : null;
  const referencia = `CFG-${randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`;
  const chaveRetomada = randomBytes(16).toString("base64url");
  const gravada = await persistir({
    tenantId,
    referencia,
    contratoVersao: VERSAO_CONFIGURADOR_SOB_MEDIDA,
    nome: entrada.nome,
    email: entrada.email || null,
    telefone: entrada.telefone || null,
    configuracao: entrada.configuracao as Prisma.InputJsonValue,
    resumo: resumoDaConfiguracao(entrada.configuracao),
    chaveRetomadaHash: hashDaChave(chaveRetomada),
    referenciaOrigem: origem?.referencia ?? null,
    consentimentoEm: new Date(),
  });
  return {
    referencia: gravada.referencia,
    criadoEm: gravada.criadoEm,
    codigoRetomada: `${gravada.referencia}.${chaveRetomada}`,
  };
}
