import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import type { ConfigCorporativoAuth } from "../../src/lib/corporativo-auth";
import { criarTenant } from "../../src/lib/admin-tenants";
import { prisma } from "../../src/lib/db";
import { salvarEmpresaB2B } from "../../src/lib/identidade-b2b";
import { processarProvisionamentoB2B, reconciliarContextoB2B } from "../../src/lib/provisionamento-b2b";

const url = new URL(process.env.DATABASE_URL ?? "http://invalid");
if (!["127.0.0.1", "localhost"].includes(url.hostname) || url.port !== "5548" || !url.pathname.endsWith("_test")) {
  throw new Error("Este teste exige o banco isolado local :5548/*_test.");
}
after(() => prisma.$disconnect());

const config: ConfigCorporativoAuth = {
  provisionamentoUrl: "https://auth.test/api/provisionamento/corporativo",
  contextosUrl: "https://auth.test/api/corporativo/contextos",
  autorizacao: "Basic segredo-que-nao-pode-ser-persistido",
};

async function cenario() {
  const sufixo = randomUUID().slice(0, 8);
  const tenant = await criarTenant({ slug: `qa-prov-${sufixo}`, nome: "QA provisionamento" });
  const empresa = await salvarEmpresaB2B(tenant.id, {
    referencia: "cliente",
    razaoSocial: "Cliente Industrial Ltda",
    unidades: [{ referencia: "matriz", nome: "Matriz", cnpj: "60067738000106", enderecos: [] }],
    contatos: [],
    centrosCusto: [],
    compradores: [{
      nome: "Compras",
      email: `compras-${sufixo}@cliente.test`,
      centrosCusto: [],
      autorizacoes: [{ papel: "COMPRADOR", referenciaUnidade: "matriz", limiteAprovacaoCentavos: null }],
    }],
  }, { tipo: "ADMIN", id: "qa" });
  return prisma.compradorEmpresaB2B.findFirstOrThrow({ where: { tenantId: tenant.id, empresaId: empresa.id } });
}

test("processador envia fotografia completa e confirma IDs e versão do Auth", async () => {
  const vinculo = await cenario();
  let corpoJson = "";
  const fetchImpl: typeof fetch = async (_input, init) => {
    corpoJson = String(init?.body);
    return Response.json({ contrato: "avila.corporativo.v2", organizacaoId: "org-auth", vinculoId: "vinc-auth", versao: 9, intencaoVersaoAplicada: 1, organizacaoVersaoAplicada: 1 });
  };
  assert.equal(await processarProvisionamentoB2B(vinculo.id, config, { fetchImpl, timeoutMs: 100 }), "SINCRONIZADO");
  const corpo = JSON.parse(corpoJson) as Record<string, unknown>;
  assert.equal(corpo?.email, vinculo.emailNormalizado);
  assert.equal(corpo?.intencaoVersao, 1);
  assert.equal(corpo?.organizacaoVersao, 1);
  assert.equal((corpo?.autorizacoes as unknown[]).length, 1);

  const salvo = await prisma.compradorEmpresaB2B.findUniqueOrThrow({
    where: { id: vinculo.id },
    include: { empresa: true, provisionamento: true },
  });
  assert.equal(salvo.authVinculoId, "vinc-auth");
  assert.equal(salvo.empresa.authOrganizacaoId, "org-auth");
  assert.deepEqual([salvo.provisionamento?.situacao, salvo.provisionamento?.versaoSincronizada, salvo.provisionamento?.tentativas], ["SINCRONIZADO", 1, 1]);
});
test("falha conserva intenção pendente, não concede acesso e não persiste resposta sensível", async () => {
  const vinculo = await cenario();
  const fetchImpl: typeof fetch = async () => new Response("token=segredo-absoluto", { status: 500 });
  assert.equal(await processarProvisionamentoB2B(vinculo.id, config, { fetchImpl, timeoutMs: 100 }), "FALHOU");
  const salvo = await prisma.compradorEmpresaB2B.findUniqueOrThrow({ where: { id: vinculo.id }, include: { provisionamento: true } });
  assert.equal(salvo.authVinculoId, null);
  assert.equal(salvo.provisionamento?.situacao, "FALHOU");
  assert.equal(salvo.provisionamento?.ultimoErro?.includes("segredo-absoluto"), false);
  const auditoria = await prisma.auditoriaB2B.findFirstOrThrow({ where: { entidadeId: vinculo.id, acao: "PROVISIONAMENTO_FALHOU" } });
  assert.equal(JSON.stringify(auditoria).includes("segredo-absoluto"), false);
});
test("reconciliação aceita somente o contexto exato da empresa e das unidades locais", async () => {
  const vinculo = await cenario();
  const unidade = await prisma.unidadeEmpresaB2B.findFirstOrThrow({ where: { empresaId: vinculo.empresaId } });
  const contexto = {
    contrato: "avila.corporativo.v1",
    contextos: [{
      contrato: "avila.corporativo.v1",
      organizacaoId: "org-contexto",
      vinculoId: "vinc-contexto",
      referenciaExterna: `lojas:${vinculo.tenantId}:empresa:${vinculo.empresaId}`,
      versao: 7,
      autorizacoesOrganizacao: [],
      unidades: [{
        id: "unidade-auth",
        referenciaExterna: `lojas:${vinculo.tenantId}:unidade:${unidade.id}`,
        autorizacoes: [{ papel: "APROVADOR", limiteAprovacaoCentavos: 500_000 }],
      }],
    }],
  };
  assert.equal(await reconciliarContextoB2B(vinculo.id, contexto), true);
  const escopos = await prisma.escopoCompradorB2B.findMany({ where: { compradorEmpresaId: vinculo.id } });
  assert.deepEqual(escopos.map(({ papel, unidadeId, limiteAprovacaoCentavos, contextoVersao }) => ({ papel, unidadeId, limiteAprovacaoCentavos, contextoVersao })), [{
    papel: "APROVADOR", unidadeId: unidade.id, limiteAprovacaoCentavos: 500_000, contextoVersao: 7,
  }]);
  assert.equal((await prisma.unidadeEmpresaB2B.findUniqueOrThrow({ where: { id: unidade.id } })).authUnidadeId, "unidade-auth");

  const invalido = structuredClone(contexto);
  invalido.contextos[0].unidades[0].referenciaExterna = "lojas:outro:unidade:invasora";
  assert.equal(await reconciliarContextoB2B(vinculo.id, invalido), false);
  assert.equal(await prisma.escopoCompradorB2B.count({ where: { compradorEmpresaId: vinculo.id } }), 1);
});
test("resposta antiga não confirma intenção alterada durante a chamada", async () => {
  const vinculo = await cenario();
  let liberar!: () => void;
  let iniciou!: () => void;
  const iniciada = new Promise<void>((resolve) => { iniciou = resolve; });
  const bloqueio = new Promise<void>((resolve) => { liberar = resolve; });
  const fetchImpl: typeof fetch = async () => {
    iniciou();
    await bloqueio;
    return Response.json({ contrato: "avila.corporativo.v2", organizacaoId: "org-antiga", vinculoId: "vinc-antigo", versao: 1, intencaoVersaoAplicada: 1, organizacaoVersaoAplicada: 1 });
  };
  const processamento = processarProvisionamentoB2B(vinculo.id, config, { fetchImpl, timeoutMs: 5_000 });
  await iniciada;
  const empresa = await prisma.empresaB2B.findUniqueOrThrow({ where: { id: vinculo.empresaId }, include: { unidades: true } });
  await salvarEmpresaB2B(vinculo.tenantId, {
    referencia: empresa.referencia,
    razaoSocial: empresa.razaoSocial,
    unidades: empresa.unidades.map((u) => ({ referencia: u.referencia, nome: u.nome, cnpj: u.cnpj, enderecos: [] })),
    contatos: [], centrosCusto: [],
    compradores: [{ nome: vinculo.nome, email: vinculo.emailNormalizado, centrosCusto: [], autorizacoes: [{ papel: "APROVADOR", referenciaUnidade: null, limiteAprovacaoCentavos: 10_000 }] }],
  }, { tipo: "ADMIN", id: "qa" });
  liberar();
  assert.equal(await processamento, "IGNORADO");
  const atual = await prisma.compradorEmpresaB2B.findUniqueOrThrow({ where: { id: vinculo.id }, include: { provisionamento: true } });
  assert.deepEqual([atual.authVinculoId, atual.provisionamento?.situacao, atual.provisionamento?.versaoDesejada], [null, "PENDENTE", 2]);
});
test("reivindicação atômica deixa somente um worker chamar o Auth", async () => {
  const vinculo = await cenario();
  let chamadas = 0;
  const fetchImpl: typeof fetch = async () => {
    chamadas++;
    return Response.json({ contrato: "avila.corporativo.v2", organizacaoId: "org-unica", vinculoId: "vinc-unico", versao: 1, intencaoVersaoAplicada: 1, organizacaoVersaoAplicada: 1 });
  };
  const resultados = await Promise.all([
    processarProvisionamentoB2B(vinculo.id, config, { fetchImpl, timeoutMs: 100 }),
    processarProvisionamentoB2B(vinculo.id, config, { fetchImpl, timeoutMs: 100 }),
  ]);
  assert.equal(chamadas, 1);
  assert.deepEqual(resultados.sort(), ["IGNORADO", "SINCRONIZADO"]);
});
test("worker com lease vencido não sobrescreve o resultado do novo dono", async () => {
  const vinculo = await cenario();
  let liberarAntigo!: () => void;
  let iniciouAntigo!: () => void;
  const antigoIniciado = new Promise<void>((resolve) => { iniciouAntigo = resolve; });
  const bloqueioAntigo = new Promise<void>((resolve) => { liberarAntigo = resolve; });
  let chamadas = 0;
  const fetchImpl: typeof fetch = async () => {
    chamadas++;
    if (chamadas === 1) {
      iniciouAntigo();
      await bloqueioAntigo;
      return Response.json({ contrato: "avila.corporativo.v2", organizacaoId: "org-antiga", vinculoId: "vinc-antigo", versao: 1, intencaoVersaoAplicada: 1, organizacaoVersaoAplicada: 1 });
    }
    return Response.json({ contrato: "avila.corporativo.v2", organizacaoId: "org-nova", vinculoId: "vinc-novo", versao: 1, intencaoVersaoAplicada: 1, organizacaoVersaoAplicada: 1 });
  };

  const workerAntigo = processarProvisionamentoB2B(vinculo.id, config, { fetchImpl, timeoutMs: 5_000 });
  await antigoIniciado;
  await prisma.provisionamentoCompradorB2B.update({
    where: { compradorEmpresaId: vinculo.id },
    data: { ultimaTentativaEm: new Date(Date.now() - 6 * 60_000) },
  });
  assert.equal(await processarProvisionamentoB2B(vinculo.id, config, { fetchImpl, timeoutMs: 5_000 }), "SINCRONIZADO");
  liberarAntigo();
  assert.equal(await workerAntigo, "IGNORADO");

  const salvo = await prisma.compradorEmpresaB2B.findUniqueOrThrow({ where: { id: vinculo.id }, include: { empresa: true, provisionamento: true } });
  assert.deepEqual([salvo.authVinculoId, salvo.empresa.authOrganizacaoId, salvo.provisionamento?.situacao, salvo.provisionamento?.tentativas], [
    "vinc-novo", "org-nova", "SINCRONIZADO", 2,
  ]);
});
test("comprador omitido é suspenso também no Auth e perde a projeção local", async () => {
  const vinculo = await cenario();
  const empresa = await prisma.empresaB2B.findUniqueOrThrow({ where: { id: vinculo.empresaId }, include: { unidades: true } });
  await salvarEmpresaB2B(vinculo.tenantId, {
    referencia: empresa.referencia, razaoSocial: empresa.razaoSocial,
    unidades: empresa.unidades.map((u) => ({ referencia: u.referencia, nome: u.nome, cnpj: u.cnpj, enderecos: [] })),
    contatos: [], centrosCusto: [], compradores: [],
  }, { tipo: "ADMIN", id: "qa" });
  let metodo = "";
  const fetchImpl: typeof fetch = async (_input, init) => {
    metodo = init?.method ?? "";
    return Response.json({ contrato: "avila.corporativo.v2", intencaoVersaoAplicada: 2 });
  };
  assert.equal(await processarProvisionamentoB2B(vinculo.id, config, { fetchImpl, timeoutMs: 100 }), "SINCRONIZADO");
  assert.equal(metodo, "DELETE");
  const salvo = await prisma.compradorEmpresaB2B.findUniqueOrThrow({ where: { id: vinculo.id }, include: { provisionamento: true, escopos: true } });
  assert.deepEqual([salvo.situacao, salvo.provisionamento?.situacao, salvo.escopos.length], ["SUSPENSO", "SUSPENSO", 0]);
});
