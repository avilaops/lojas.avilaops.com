import { after, test } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { prisma } from "../../src/lib/db";
import { criarConta } from "../../src/lib/cadastro";
import { autenticarMcp, McpAuthError } from "../../src/lib/mcp-auth";
import {
  conexoesDaLoja,
  criarCodigo,
  lojaDoAcesso,
  registrarCliente,
  renovar,
  revogarConexao,
  revogarPorToken,
  trocarCodigo,
} from "../../src/lib/mcp-conexoes";
import { hashDoSegredo } from "../../src/lib/mcp-oauth";

/**
 * O login do conector MCP contra o Postgres de verdade. O que só o banco
 * prova: código e token de renovação valem uma vez mesmo com dois pedidos ao
 * mesmo tempo, e nada fica gravado em claro.
 */

const url = new URL(process.env.DATABASE_URL ?? "http://invalid");
if (!["127.0.0.1", "localhost"].includes(url.hostname) || url.port !== "5548" || !url.pathname.endsWith("_test")) {
  throw new Error("Este teste exige o banco isolado local :5548/*_test.");
}
after(() => prisma.$disconnect());

const RETORNO = "https://claude.ai/api/mcp/auth_callback";
const sufixo = () => randomUUID().replace(/-/g, "").slice(0, 10);

function pkce() {
  const verificador = randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, "");
  return { verificador, desafio: createHash("sha256").update(verificador).digest("base64url") };
}

async function lojaPro(plano: "LOJA_PRO" | "LOJA" = "LOJA_PRO") {
  const conta = await criarConta({ email: `qa-${sufixo()}@mcp.example`, senha: null });
  return prisma.tenant.update({ where: { id: conta!.id }, data: { plano, status: "ATIVA", nome: `Loja MCP ${sufixo()}` } });
}

async function conectar(tenantId: string, operadorId: string | null = null) {
  const cliente = await registrarCliente({ nome: "Claude", retornos: [RETORNO] });
  const { verificador, desafio } = pkce();
  const codigo = await criarCodigo(tenantId, operadorId, { clienteId: cliente.id, retorno: RETORNO, desafio, state: null });
  return { cliente, verificador, codigo };
}

const comBearer = (token: string) => new Request("https://lojas.avilaops.com/api/mcp", { headers: { authorization: `Bearer ${token}` } });

test("do código ao token: a conexão age como a loja que autorizou", async () => {
  const loja = await lojaPro();
  const { cliente, verificador, codigo } = await conectar(loja.id);

  const tokens = await trocarCodigo({ codigo, clienteId: cliente.id, retorno: RETORNO, verificador });
  assert.ok("acesso" in tokens);

  assert.equal((await lojaDoAcesso(tokens.acesso))?.id, loja.id);
  const auth = await autenticarMcp(comBearer(tokens.acesso));
  assert.equal(auth.tipo === "loja" && auth.tenant.id, loja.id);

  const lista = await conexoesDaLoja(loja.id);
  assert.equal(lista.length, 1);
  assert.equal(lista[0].assistente, "Claude");
  assert.ok(lista[0].ultimoUsoEm);
});

test("código e tokens não ficam em claro no banco", async () => {
  const loja = await lojaPro();
  const { cliente, verificador, codigo } = await conectar(loja.id);
  const tokens = await trocarCodigo({ codigo, clienteId: cliente.id, retorno: RETORNO, verificador });
  assert.ok("acesso" in tokens);

  const linha = await prisma.conexaoMcp.findFirstOrThrow({ where: { tenantId: loja.id } });
  const gravado = JSON.stringify(linha);
  for (const segredo of [codigo, tokens.acesso, tokens.renovacao, verificador]) assert.equal(gravado.includes(segredo), false);
  assert.equal(linha.acessoHash, hashDoSegredo(tokens.acesso));
  assert.equal(linha.desafio, null);
});

test("troca recusa verificador errado, outro cliente e outro retorno", async () => {
  const loja = await lojaPro();
  const { cliente, verificador, codigo } = await conectar(loja.id);
  const outro = await registrarCliente({ nome: "Outro", retornos: [RETORNO] });

  assert.ok("erro" in (await trocarCodigo({ codigo, clienteId: cliente.id, retorno: RETORNO, verificador: "x".repeat(43) })));
  assert.ok("erro" in (await trocarCodigo({ codigo, clienteId: outro.id, retorno: RETORNO, verificador })));
  assert.ok("erro" in (await trocarCodigo({ codigo, clienteId: cliente.id, retorno: "https://atacante.example/cb", verificador })));
  // Nenhuma das tentativas gastou o código: quem tem o verificador ainda troca.
  assert.ok("acesso" in (await trocarCodigo({ codigo, clienteId: cliente.id, retorno: RETORNO, verificador })));
});

test("código vale uma vez, mesmo em duas trocas simultâneas", async () => {
  const loja = await lojaPro();
  const { cliente, verificador, codigo } = await conectar(loja.id);
  const troca = () => trocarCodigo({ codigo, clienteId: cliente.id, retorno: RETORNO, verificador });

  const resultados = await Promise.all([troca(), troca()]);
  assert.equal(resultados.filter((r) => "acesso" in r).length, 1);
});

test("código reapresentado depois de gasto revoga a conexão que abriu", async () => {
  const loja = await lojaPro();
  const { cliente, verificador, codigo } = await conectar(loja.id);
  const tokens = await trocarCodigo({ codigo, clienteId: cliente.id, retorno: RETORNO, verificador });
  assert.ok("acesso" in tokens);

  assert.ok("erro" in (await trocarCodigo({ codigo, clienteId: cliente.id, retorno: RETORNO, verificador })));
  assert.equal(await lojaDoAcesso(tokens.acesso), null);
  assert.ok("erro" in (await renovar({ renovacao: tokens.renovacao, clienteId: cliente.id })));
});

test("renovação entrega par novo e aposenta o anterior, uma vez só", async () => {
  const loja = await lojaPro();
  const { cliente, verificador, codigo } = await conectar(loja.id);
  const primeiro = await trocarCodigo({ codigo, clienteId: cliente.id, retorno: RETORNO, verificador });
  assert.ok("acesso" in primeiro);

  const renova = () => renovar({ renovacao: primeiro.renovacao, clienteId: cliente.id });
  const resultados = await Promise.all([renova(), renova()]);
  const novos = resultados.filter((r) => "acesso" in r);
  assert.equal(novos.length, 1);
  const segundo = novos[0];
  assert.ok("acesso" in segundo);

  assert.equal(await lojaDoAcesso(primeiro.acesso), null);
  assert.equal((await lojaDoAcesso(segundo.acesso))?.id, loja.id);
  assert.ok("erro" in (await renova()));
  assert.equal((await conexoesDaLoja(loja.id)).length, 1);
});

test("desconectar no painel ou pelo assistente derruba o acesso na hora", async () => {
  const loja = await lojaPro();
  const outraLoja = await lojaPro();

  const a = await conectar(loja.id);
  const ta = await trocarCodigo({ codigo: a.codigo, clienteId: a.cliente.id, retorno: RETORNO, verificador: a.verificador });
  assert.ok("acesso" in ta);
  const [conexao] = await conexoesDaLoja(loja.id);

  // Outra loja não desconecta o que não é dela.
  assert.equal(await revogarConexao(outraLoja.id, conexao.id), false);
  assert.equal((await lojaDoAcesso(ta.acesso))?.id, loja.id);

  assert.equal(await revogarConexao(loja.id, conexao.id), true);
  assert.equal(await lojaDoAcesso(ta.acesso), null);
  assert.equal((await conexoesDaLoja(loja.id)).length, 0);

  const b = await conectar(loja.id);
  const tb = await trocarCodigo({ codigo: b.codigo, clienteId: b.cliente.id, retorno: RETORNO, verificador: b.verificador });
  assert.ok("acesso" in tb);
  await revogarPorToken(tb.renovacao);
  assert.equal(await lojaDoAcesso(tb.acesso), null);
});

test("rebaixar o plano ou suspender a loja derruba a conexão sem esperar o token vencer", async () => {
  const loja = await lojaPro();
  const { cliente, verificador, codigo } = await conectar(loja.id);
  const tokens = await trocarCodigo({ codigo, clienteId: cliente.id, retorno: RETORNO, verificador });
  assert.ok("acesso" in tokens);

  await prisma.tenant.update({ where: { id: loja.id }, data: { plano: "LOJA" } });
  await assert.rejects(autenticarMcp(comBearer(tokens.acesso)), (e) => e instanceof McpAuthError && e.statusCode === 403 && e.upgradeRequired);

  await prisma.tenant.update({ where: { id: loja.id }, data: { plano: "LOJA_PRO", status: "SUSPENSA" } });
  await assert.rejects(autenticarMcp(comBearer(tokens.acesso)), (e) => e instanceof McpAuthError && e.statusCode === 403);
});

test("operador desligado leva junto a conexão que autorizou", async () => {
  const loja = await lojaPro();
  const operador = await prisma.operadorLoja.create({
    data: { tenantId: loja.id, nome: "Gerente QA", email: `g-${sufixo()}@mcp.example`, senhaHash: "x", papel: "GERENTE" },
  });
  const { cliente, verificador, codigo } = await conectar(loja.id, operador.id);
  const tokens = await trocarCodigo({ codigo, clienteId: cliente.id, retorno: RETORNO, verificador });
  assert.ok("acesso" in tokens);
  assert.equal((await lojaDoAcesso(tokens.acesso))?.id, loja.id);

  await prisma.operadorLoja.update({ where: { id: operador.id }, data: { ativo: false } });
  assert.equal(await lojaDoAcesso(tokens.acesso), null);
});

test("token inventado ou sem credencial é 401; chave de loja inexistente não revela nada", async () => {
  await assert.rejects(autenticarMcp(comBearer(`lojas_at_${"0".repeat(40)}`)), (e) => e instanceof McpAuthError && e.statusCode === 401);
  await assert.rejects(autenticarMcp(new Request("https://lojas.avilaops.com/api/mcp")), (e) => e instanceof McpAuthError && e.statusCode === 401);

  const semChave = await lojaPro();
  const mensagens: string[] = [];
  for (const chave of [`lojas_live_nao-existe-${sufixo()}_${"a".repeat(32)}`, `lojas_live_${semChave.slug}_${"a".repeat(32)}`]) {
    await assert.rejects(autenticarMcp(comBearer(chave)), (e) => {
      assert.ok(e instanceof McpAuthError && e.statusCode === 401);
      mensagens.push(e.message);
      return true;
    });
  }
  assert.equal(mensagens[0], mensagens[1]);
});
