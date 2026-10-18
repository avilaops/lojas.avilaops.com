import { configSSO } from "./sso";
import { normalizarEmailB2B, validarOrcamentoB2B } from "./identidade-b2b";

export const CONTRATO_CORPORATIVO = "avila.corporativo.v2" as const;
const CONTRATO_CONTEXTO_CORPORATIVO = "avila.corporativo.v1" as const;
export const PAPEIS_CORPORATIVOS = ["ADMINISTRADOR", "COMPRADOR", "APROVADOR", "FINANCEIRO", "VENDEDOR"] as const;
export type PapelCorporativo = (typeof PAPEIS_CORPORATIVOS)[number];

export type ConfigCorporativoAuth = {
  provisionamentoUrl: string;
  contextosUrl: string;
  autorizacao: string;
};

type OpcoesHttp = { fetchImpl?: typeof fetch; timeoutMs?: number; idempotencyKey?: string };

async function requisitarJson(url: string, init: RequestInit, opcoes: OpcoesHttp, operacao: string): Promise<unknown> {
  const timeoutMs = opcoes.timeoutMs ?? 8_000;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) throw new Error("Timeout do Auth inválido.");
  let resposta: Response;
  try {
    resposta = await (opcoes.fetchImpl ?? fetch)(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  } catch {
    throw new Error(`Auth indisponível durante ${operacao}.`);
  }
  if (!resposta.ok) throw new Error(`Auth recusou ${operacao} (${resposta.status}).`);
  if (resposta.status === 204) return null;
  try {
    return await resposta.json();
  } catch {
    throw new Error(`Auth devolveu resposta inválida durante ${operacao}.`);
  }
}

const IDENTIFICADOR = /^[A-Za-z0-9._:-]{1,200}$/;

function identificador(valor: string): string {
  const limpo = valor.trim();
  if (!IDENTIFICADOR.test(limpo)) throw new Error("Identificador inválido.");
  return limpo;
}

export function referenciaAuthDaEmpresa(tenantId: string, empresaId: string): string {
  return `lojas:${identificador(tenantId)}:empresa:${identificador(empresaId)}`;
}

export function referenciaAuthDaUnidade(tenantId: string, unidadeId: string): string {
  return `lojas:${identificador(tenantId)}:unidade:${identificador(unidadeId)}`;
}

export function configCorporativoAuth(env: Record<string, string | undefined> = process.env): ConfigCorporativoAuth | null {
  const sso = configSSO(env);
  const id = (env.AUTH_CLIENT_ID ?? "").trim();
  const segredo = (env.AUTH_CLIENT_SECRET ?? "").trim();
  if (!sso || !id || !segredo) return null;
  return {
    provisionamentoUrl: `${sso.url}/api/provisionamento/corporativo`,
    contextosUrl: `${sso.url}/api/corporativo/contextos`,
    autorizacao: `Basic ${Buffer.from(`${encodeURIComponent(id)}:${encodeURIComponent(segredo)}`).toString("base64")}`,
  };
}

type AutorizacaoDesejada = {
  papel: PapelCorporativo;
  unidadeId: string | null;
  limiteAprovacaoCentavos: number | null;
};

export function montarPedidoProvisionamento(entrada: {
  intencaoVersao: number;
  organizacaoVersao: number;
  tenantId: string;
  empresaId: string;
  razaoSocial: string;
  email: string;
  convidadoPor?: string | null;
  unidades: Array<{ id: string; nome: string }>;
  autorizacoes: AutorizacaoDesejada[];
}) {
  const unidades = entrada.unidades.map((unidade) => ({
    id: identificador(unidade.id),
    referencia: referenciaAuthDaUnidade(entrada.tenantId, unidade.id),
    nome: unidade.nome.trim(),
  }));
  const referencias = new Map(unidades.map((unidade) => [unidade.id, unidade.referencia]));
  const autorizacoes = entrada.autorizacoes.map((autorizacao) => {
    const referenciaUnidade = autorizacao.unidadeId === null ? null : referencias.get(identificador(autorizacao.unidadeId));
    if (autorizacao.unidadeId !== null && !referenciaUnidade) throw new Error("Unidade da autorização não pertence ao payload.");
    return {
      papel: autorizacao.papel,
      referenciaUnidade: referenciaUnidade ?? null,
      limiteAprovacaoCentavos: autorizacao.limiteAprovacaoCentavos === null ? null : validarOrcamentoB2B(autorizacao.limiteAprovacaoCentavos),
    };
  });
  if (!entrada.razaoSocial.trim() || unidades.some((unidade) => !unidade.nome) || autorizacoes.length === 0) {
    throw new Error("Dados corporativos incompletos.");
  }
  return {
    versao: CONTRATO_CORPORATIVO,
    intencaoVersao: entrada.intencaoVersao,
    organizacaoVersao: entrada.organizacaoVersao,
    email: normalizarEmailB2B(entrada.email),
    organizacao: { referencia: referenciaAuthDaEmpresa(entrada.tenantId, entrada.empresaId), nome: entrada.razaoSocial.trim() },
    unidades: unidades.map(({ referencia, nome }) => ({ referencia, nome })),
    autorizacoes,
    convidadoPor: entrada.convidadoPor?.trim() || null,
  };
}

function objeto(valor: unknown): Record<string, unknown> | null {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor) ? valor as Record<string, unknown> : null;
}

function texto(valor: unknown): string | null {
  return typeof valor === "string" && valor.trim() ? valor.trim() : null;
}

function papel(valor: unknown): PapelCorporativo | null {
  return typeof valor === "string" && PAPEIS_CORPORATIVOS.includes(valor as PapelCorporativo) ? valor as PapelCorporativo : null;
}

function limite(valor: unknown): number | null | undefined {
  if (valor === null) return null;
  return typeof valor === "number" && Number.isSafeInteger(valor) && valor >= 0 ? valor : undefined;
}

export function lerRespostaProvisionamento(valor: unknown): { organizacaoId: string; vinculoId: string; versao: number; intencaoVersaoAplicada: number; organizacaoVersaoAplicada: number } | null {
  const corpo = objeto(valor);
  const organizacaoId = texto(corpo?.organizacaoId);
  const vinculoId = texto(corpo?.vinculoId);
  const versao = corpo?.versao;
  const intencaoVersaoAplicada = corpo?.intencaoVersaoAplicada;
  const organizacaoVersaoAplicada = corpo?.organizacaoVersaoAplicada;
  return corpo?.contrato === CONTRATO_CORPORATIVO && organizacaoId && vinculoId && Number.isSafeInteger(versao) && Number(versao) > 0
    && Number.isSafeInteger(intencaoVersaoAplicada) && Number(intencaoVersaoAplicada) > 0
    && Number.isSafeInteger(organizacaoVersaoAplicada) && Number(organizacaoVersaoAplicada) > 0
    ? { organizacaoId, vinculoId, versao: Number(versao), intencaoVersaoAplicada: Number(intencaoVersaoAplicada), organizacaoVersaoAplicada: Number(organizacaoVersaoAplicada) }
    : null;
}

export async function provisionarNoAuth(
  config: ConfigCorporativoAuth,
  pedido: unknown,
  opcoes: OpcoesHttp = {},
): Promise<{ organizacaoId: string; vinculoId: string; versao: number; intencaoVersaoAplicada: number; organizacaoVersaoAplicada: number }> {
  const corpo = await requisitarJson(config.provisionamentoUrl, {
    method: "POST",
    headers: {
      authorization: config.autorizacao,
      "content-type": "application/json",
      ...(opcoes.idempotencyKey ? { "idempotency-key": opcoes.idempotencyKey } : {}),
    },
    body: JSON.stringify(pedido),
  }, opcoes, "o provisionamento");
  const resposta = lerRespostaProvisionamento(corpo);
  if (!resposta) throw new Error("Auth devolveu resposta inválida durante o provisionamento.");
  return resposta;
}

export async function suspenderOuRevogarNoAuth(
  config: ConfigCorporativoAuth,
  entrada: { email: string; referenciaOrganizacao: string; situacao: "SUSPENSO" | "REVOGADO"; intencaoVersao: number },
  opcoes: OpcoesHttp = {},
): Promise<number> {
  const url = new URL(config.provisionamentoUrl);
  url.searchParams.set("email", normalizarEmailB2B(entrada.email));
  url.searchParams.set("organizacao", identificador(entrada.referenciaOrganizacao));
  url.searchParams.set("situacao", entrada.situacao);
  url.searchParams.set("intencaoVersao", String(entrada.intencaoVersao));
  url.searchParams.set("contrato", CONTRATO_CORPORATIVO);
  const corpo = objeto(await requisitarJson(url.toString(), {
    method: "DELETE",
    headers: { authorization: config.autorizacao, ...(opcoes.idempotencyKey ? { "idempotency-key": opcoes.idempotencyKey } : {}) },
  }, opcoes, "a alteração do vínculo"));
  const aplicada = corpo?.intencaoVersaoAplicada;
  if (corpo?.contrato !== CONTRATO_CORPORATIVO || !Number.isSafeInteger(aplicada) || Number(aplicada) <= 0) {
    throw new Error("Auth devolveu resposta inválida durante a alteração do vínculo.");
  }
  return Number(aplicada);
}

export async function consultarContextosCorporativos(
  config: ConfigCorporativoAuth,
  accessToken: string,
  opcoes: OpcoesHttp = {},
): Promise<unknown> {
  const token = accessToken.trim();
  if (!token) throw new Error("Access token ausente.");
  return requisitarJson(config.contextosUrl, { method: "GET", headers: { authorization: `Bearer ${token}` } }, opcoes, "a consulta de contexto");
}

export type ContextoCorporativoLojas = {
  organizacaoId: string;
  vinculoId: string;
  versao: number;
  escopos: Array<{ papel: PapelCorporativo; unidadeId: string | null; authUnidadeId: string | null; limiteAprovacaoCentavos: number | null }>;
};

function lerAutorizacao(valor: unknown): { papel: PapelCorporativo; limiteAprovacaoCentavos: number | null } | null {
  const item = objeto(valor);
  const papelLido = papel(item?.papel);
  const limiteLido = limite(item?.limiteAprovacaoCentavos);
  return papelLido && limiteLido !== undefined ? { papel: papelLido, limiteAprovacaoCentavos: limiteLido } : null;
}

export function lerContextoCorporativo(
  valor: unknown,
  esperado: { referenciaOrganizacao: string; unidades: ReadonlyMap<string, string> },
): ContextoCorporativoLojas | null {
  const corpo = objeto(valor);
  if (corpo?.contrato !== CONTRATO_CONTEXTO_CORPORATIVO || !Array.isArray(corpo.contextos)) return null;
  const contexto = corpo.contextos.map(objeto).find((item) => item?.referenciaExterna === esperado.referenciaOrganizacao);
  if (!contexto || contexto.contrato !== CONTRATO_CONTEXTO_CORPORATIVO) return null;
  const organizacaoId = texto(contexto.organizacaoId);
  const vinculoId = texto(contexto.vinculoId);
  const versao = contexto.versao;
  if (!organizacaoId || !vinculoId || !Number.isSafeInteger(versao) || Number(versao) <= 0) return null;
  if (!Array.isArray(contexto.autorizacoesOrganizacao) || !Array.isArray(contexto.unidades)) return null;

  const escopos: ContextoCorporativoLojas["escopos"] = [];
  for (const bruta of contexto.autorizacoesOrganizacao) {
    const autorizacao = lerAutorizacao(bruta);
    if (!autorizacao) return null;
    escopos.push({ ...autorizacao, unidadeId: null, authUnidadeId: null });
  }
  for (const bruta of contexto.unidades) {
    const unidade = objeto(bruta);
    const authUnidadeId = texto(unidade?.id);
    const referencia = texto(unidade?.referenciaExterna);
    if (!authUnidadeId || !referencia || !Array.isArray(unidade?.autorizacoes)) return null;
    const unidadeId = esperado.unidades.get(referencia);
    if (!unidadeId) return null;
    for (const brutaAutorizacao of unidade.autorizacoes) {
      const autorizacao = lerAutorizacao(brutaAutorizacao);
      if (!autorizacao) return null;
      escopos.push({ ...autorizacao, unidadeId, authUnidadeId });
    }
  }
  return { organizacaoId, vinculoId, versao: Number(versao), escopos };
}
