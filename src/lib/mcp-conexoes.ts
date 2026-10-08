import type { Tenant } from "@prisma/client";
import { prisma } from "./db";
import {
  gerarSegredo,
  hashDoSegredo,
  pareceSegredo,
  pkceConfere,
  retornoRegistrado,
  VALIDADE,
  type ClienteParaRegistrar,
  type PedidoDeAutorizacao,
} from "./mcp-oauth";

/**
 * O que o login do conector MCP grava e consulta. As regras estão em
 * `mcp-oauth.ts`; aqui cada passo é uma escrita condicional, para que dois
 * pedidos simultâneos com o mesmo código ou o mesmo token de renovação não
 * rendam duas conexões.
 */

/** Registro sem conexão depois de um dia é cliente que nunca terminou o login. */
const REGISTRO_ORFAO_MS = 86_400_000;

export async function registrarCliente(c: ClienteParaRegistrar) {
  // O registro é aberto por definição do protocolo. A faxina fica aqui, na
  // própria porta de entrada, e não numa rotina: a tabela só cresce por ela.
  await prisma.clienteMcp.deleteMany({
    where: { criadoEm: { lt: new Date(Date.now() - REGISTRO_ORFAO_MS) }, conexoes: { none: {} } },
  });
  return prisma.clienteMcp.create({ data: { nome: c.nome, retornos: c.retornos } });
}

export function clientePorId(id: string | null | undefined) {
  return id ? prisma.clienteMcp.findUnique({ where: { id } }) : Promise.resolve(null);
}

/** O lojista disse sim: nasce a conexão, ainda só com o código. */
export async function criarCodigo(tenantId: string, operadorId: string | null, pedido: PedidoDeAutorizacao): Promise<string> {
  const agora = Date.now();
  // Código que ninguém trocou não vira conexão; some na autorização seguinte.
  await prisma.conexaoMcp.deleteMany({
    where: { tenantId, acessoHash: null, codigoExpiraEm: { lt: new Date(agora) } },
  });
  const codigo = gerarSegredo("codigo");
  await prisma.conexaoMcp.create({
    data: {
      tenantId,
      operadorId,
      clienteId: pedido.clienteId,
      codigoHash: codigo.hash,
      codigoExpiraEm: new Date(agora + VALIDADE.codigoMs),
      desafio: pedido.desafio,
      retorno: pedido.retorno,
    },
  });
  return codigo.valor;
}

export type ErroDeToken = { erro: "invalid_grant" | "invalid_client"; descricao: string };

function novosTokens(agora: number) {
  const acesso = gerarSegredo("acesso");
  const renovacao = gerarSegredo("renovacao");
  return {
    acesso: acesso.valor,
    renovacao: renovacao.valor,
    dados: {
      acessoHash: acesso.hash,
      acessoExpiraEm: new Date(agora + VALIDADE.acessoMs),
      renovacaoHash: renovacao.hash,
      renovacaoExpiraEm: new Date(agora + VALIDADE.renovacaoMs),
    },
  };
}

/**
 * Troca o código pelos tokens.
 *
 * O código vale uma vez. Se chegar de novo depois de gasto, alguém mais o viu:
 * a conexão que ele abriu é revogada, e o lojista autoriza outra vez.
 */
export async function trocarCodigo(p: { codigo: string; clienteId: string; retorno: string | null; verificador: string }) {
  const invalido: ErroDeToken = { erro: "invalid_grant", descricao: "Código de autorização inválido, vencido ou já usado." };
  if (!pareceSegredo("codigo", p.codigo)) return invalido;

  const conexao = await prisma.conexaoMcp.findUnique({ where: { codigoHash: hashDoSegredo(p.codigo) } });
  if (!conexao || conexao.clienteId !== p.clienteId) return invalido;
  if (conexao.codigoUsadoEm) {
    await prisma.conexaoMcp.updateMany({ where: { id: conexao.id, revogadaEm: null }, data: { revogadaEm: new Date() } });
    return invalido;
  }
  if (conexao.revogadaEm || !conexao.codigoExpiraEm || conexao.codigoExpiraEm.getTime() <= Date.now()) return invalido;
  // O retorno da troca tem que ser o do pedido; a porta local já foi conferida lá.
  if (p.retorno && conexao.retorno && !retornoRegistrado(p.retorno, [conexao.retorno])) return invalido;
  if (!conexao.desafio || !pkceConfere(p.verificador, conexao.desafio)) {
    return { erro: "invalid_grant", descricao: "code_verifier não confere com o code_challenge do pedido." } satisfies ErroDeToken;
  }

  const agora = Date.now();
  const t = novosTokens(agora);
  const gasto = await prisma.conexaoMcp.updateMany({
    where: { id: conexao.id, codigoUsadoEm: null, revogadaEm: null },
    data: { ...t.dados, codigoUsadoEm: new Date(agora), desafio: null },
  });
  return gasto.count === 1 ? { acesso: t.acesso, renovacao: t.renovacao } : invalido;
}

/** Token de renovação é de uso único: cada renovação entrega um par novo. */
export async function renovar(p: { renovacao: string; clienteId: string }) {
  const invalido: ErroDeToken = { erro: "invalid_grant", descricao: "Token de renovação inválido ou vencido. Conecte a loja de novo." };
  if (!pareceSegredo("renovacao", p.renovacao)) return invalido;

  const agora = Date.now();
  const t = novosTokens(agora);
  const trocado = await prisma.conexaoMcp.updateMany({
    where: {
      renovacaoHash: hashDoSegredo(p.renovacao),
      clienteId: p.clienteId,
      revogadaEm: null,
      renovacaoExpiraEm: { gt: new Date(agora) },
    },
    data: t.dados,
  });
  return trocado.count === 1 ? { acesso: t.acesso, renovacao: t.renovacao } : invalido;
}

/** Revogação pedida pelo próprio assistente (RFC 7009): aceita qualquer um dos dois tokens. */
export async function revogarPorToken(token: string) {
  const hash = hashDoSegredo(token);
  const onde = pareceSegredo("acesso", token) ? { acessoHash: hash } : pareceSegredo("renovacao", token) ? { renovacaoHash: hash } : null;
  if (onde) await prisma.conexaoMcp.updateMany({ where: { ...onde, revogadaEm: null }, data: { revogadaEm: new Date() } });
}

/** De quanto em quanto tempo o uso é anotado: escrever a cada chamada seria um UPDATE por ferramenta. */
const ANOTAR_USO_MS = 5 * 60_000;

/**
 * A loja de um token de acesso, ou `null`.
 *
 * Plano e status da loja não são conferidos aqui: quem decide o que cada um
 * significa é `autenticarMcp`, com a mesma regra da chave.
 */
export async function lojaDoAcesso(token: string): Promise<Tenant | null> {
  if (!pareceSegredo("acesso", token)) return null;
  const agora = Date.now();
  const conexao = await prisma.conexaoMcp.findUnique({ where: { acessoHash: hashDoSegredo(token) }, include: { tenant: true } });
  if (!conexao || conexao.revogadaEm || !conexao.acessoExpiraEm || conexao.acessoExpiraEm.getTime() <= agora) return null;

  if (conexao.operadorId) {
    const ativo = await prisma.operadorLoja.count({ where: { id: conexao.operadorId, tenantId: conexao.tenantId, ativo: true } });
    if (!ativo) return null;
  }
  if (!conexao.ultimoUsoEm || agora - conexao.ultimoUsoEm.getTime() > ANOTAR_USO_MS) {
    await prisma.conexaoMcp.updateMany({ where: { id: conexao.id }, data: { ultimoUsoEm: new Date(agora) } });
  }
  return conexao.tenant;
}

// ── Painel ─────────────────────────────────────────────────────────────

export interface ConexaoDoPainel {
  id: string;
  assistente: string;
  conectadaEm: string;
  ultimoUsoEm: string | null;
}

/** As conexões vivas da loja: já trocaram o código, não foram revogadas e ainda renovam. */
export async function conexoesDaLoja(tenantId: string): Promise<ConexaoDoPainel[]> {
  const linhas = await prisma.conexaoMcp.findMany({
    where: { tenantId, revogadaEm: null, renovacaoExpiraEm: { gt: new Date() } },
    orderBy: { criadaEm: "desc" },
    select: { id: true, criadaEm: true, ultimoUsoEm: true, cliente: { select: { nome: true } } },
  });
  return linhas.map((l) => ({
    id: l.id,
    assistente: l.cliente.nome,
    conectadaEm: l.criadaEm.toISOString(),
    ultimoUsoEm: l.ultimoUsoEm?.toISOString() ?? null,
  }));
}

export async function revogarConexao(tenantId: string, id: string): Promise<boolean> {
  const r = await prisma.conexaoMcp.updateMany({ where: { id, tenantId, revogadaEm: null }, data: { revogadaEm: new Date() } });
  return r.count === 1;
}
