import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { prisma } from "../../src/lib/db";
import { criarTenant } from "../../src/lib/admin-tenants";
import { salvarEmpresaB2B } from "../../src/lib/identidade-b2b";

const url = new URL(process.env.DATABASE_URL ?? "http://invalid");
if (!["127.0.0.1", "localhost"].includes(url.hostname) || url.port !== "5548" || !url.pathname.endsWith("_test")) {
  throw new Error("Este teste exige o banco isolado local :5548/*_test.");
}
after(() => prisma.$disconnect());

const sufixo = () => randomUUID().replace(/-/g, "").slice(0, 10);

test("empresa separa unidades, contatos, compradores e centros de custo", async () => {
  const tenant = await criarTenant({ slug: `qa-b2b-${sufixo()}`, nome: "QA B2B" });
  const comprador = await prisma.comprador.create({
    data: { tenantId: tenant.id, email: `compras-${sufixo()}@industria.test`, senhaHash: "hash", nome: "Ana Compras" },
  });
  const empresa = await prisma.empresaB2B.create({
    data: { tenantId: tenant.id, referencia: "cliente-aurora", razaoSocial: "Indústria Aurora Ltda" },
  });
  const unidade = await prisma.unidadeEmpresaB2B.create({
    data: { tenantId: tenant.id, empresaId: empresa.id, referencia: "matriz", nome: "Matriz", cnpj: "60067738000106" },
  });
  await prisma.enderecoUnidadeEmpresaB2B.create({
    data: { tenantId: tenant.id, unidadeId: unidade.id, tipo: "FISCAL", cep: "14010000", logradouro: "Rua Um", numero: "10", bairro: "Centro", cidade: "Ribeirão Preto", uf: "SP" },
  });
  await prisma.contatoEmpresaB2B.create({
    data: { tenantId: tenant.id, empresaId: empresa.id, unidadeId: unidade.id, tipo: "COMERCIAL", nome: "Ana", email: comprador.email },
  });
  const vinculo = await prisma.compradorEmpresaB2B.create({
    data: { tenantId: tenant.id, empresaId: empresa.id, compradorId: comprador.id, nome: comprador.nome, emailNormalizado: comprador.email },
  });
  const centro = await prisma.centroCustoB2B.create({
    data: { tenantId: tenant.id, empresaId: empresa.id, codigo: "MANUT", nome: "Manutenção", orcamentoMensalCentavos: 150_000 },
  });
  await prisma.compradorCentroCustoB2B.create({ data: { tenantId: tenant.id, empresaId: empresa.id, compradorEmpresaId: vinculo.id, centroCustoId: centro.id } });

  const lida = await prisma.empresaB2B.findUniqueOrThrow({
    where: { id: empresa.id },
    include: { unidades: { include: { enderecos: true } }, contatos: true, compradores: { include: { centrosCusto: true } }, centrosCusto: true },
  });
  assert.deepEqual([lida.unidades.length, lida.unidades[0].enderecos.length, lida.contatos.length, lida.compradores.length, lida.centrosCusto.length], [1, 1, 1, 1, 1]);
});

test("chaves compostas impedem ligar unidade e comprador de outro tenant", async () => {
  const a = await criarTenant({ slug: `qa-b2b-a-${sufixo()}`, nome: "QA A" });
  const b = await criarTenant({ slug: `qa-b2b-b-${sufixo()}`, nome: "QA B" });
  const empresaA = await prisma.empresaB2B.create({ data: { tenantId: a.id, referencia: "empresa", razaoSocial: "Empresa A" } });
  const compradorB = await prisma.comprador.create({ data: { tenantId: b.id, email: `b-${sufixo()}@teste.com`, senhaHash: "hash", nome: "B" } });

  await assert.rejects(
    prisma.compradorEmpresaB2B.create({ data: { tenantId: a.id, empresaId: empresaA.id, compradorId: compradorB.id, nome: "B", emailNormalizado: compradorB.email } }),
    /Foreign key constraint|restrição de chave estrangeira/i,
  );
});

test("banco recusa CNPJ malformado e orçamento negativo", async () => {
  const tenant = await criarTenant({ slug: `qa-b2b-check-${sufixo()}`, nome: "QA checks" });
  const empresa = await prisma.empresaB2B.create({ data: { tenantId: tenant.id, referencia: "checks", razaoSocial: "Checks Ltda" } });
  await assert.rejects(
    prisma.unidadeEmpresaB2B.create({ data: { tenantId: tenant.id, empresaId: empresa.id, referencia: "ruim", nome: "Ruim", cnpj: "123" } }),
    /constraint/i,
  );
  await assert.rejects(
    prisma.centroCustoB2B.create({ data: { tenantId: tenant.id, empresaId: empresa.id, codigo: "NEG", nome: "Negativo", orcamentoMensalCentavos: -1 } }),
    /constraint/i,
  );
});

test("promoção reutiliza comprador atual e retry não duplica empresa, unidade ou vínculo", async () => {
  const tenant = await criarTenant({ slug: `qa-b2b-idem-${sufixo()}`, nome: "QA idempotência" });
  const email = `compras-${sufixo()}@aurora.test`;
  const conta = await prisma.comprador.create({ data: { tenantId: tenant.id, email, senhaHash: "hash", nome: "Ana" } });
  const entrada = {
    referencia: "aurora",
    razaoSocial: "Indústria Aurora Ltda",
    unidades: [{ referencia: "matriz", nome: "Matriz", cnpj: "60067738000106", enderecos: [] }],
    contatos: [{ tipo: "COMERCIAL", nome: "Ana", email }],
    centrosCusto: [{ codigo: "MANUT", nome: "Manutenção", orcamentoMensalCentavos: 200_000 }],
    compradores: [{
      nome: "Ana",
      email,
      centrosCusto: ["MANUT"],
      autorizacoes: [{ papel: "COMPRADOR" as const, referenciaUnidade: "matriz", limiteAprovacaoCentavos: null }],
    }],
  };
  const ator = { tipo: "ADMIN", id: "qa", email: "qa@avilaops.com" };
  const primeira = await salvarEmpresaB2B(tenant.id, entrada, ator);
  const segunda = await salvarEmpresaB2B(tenant.id, entrada, ator);

  assert.equal(segunda.id, primeira.id);
  assert.equal(await prisma.empresaB2B.count({ where: { tenantId: tenant.id, referencia: "aurora" } }), 1);
  assert.equal(await prisma.unidadeEmpresaB2B.count({ where: { tenantId: tenant.id, empresaId: primeira.id } }), 1);
  const vinculos = await prisma.compradorEmpresaB2B.findMany({ where: { tenantId: tenant.id, empresaId: primeira.id }, include: { provisionamento: true, autorizacoes: true } });
  assert.equal(vinculos.length, 1);
  assert.equal(vinculos[0].compradorId, conta.id);
  assert.equal(vinculos[0].provisionamento?.situacao, "PENDENTE");
  assert.equal(vinculos[0].autorizacoes.length, 1);
  assert.equal(await prisma.auditoriaB2B.count({ where: { tenantId: tenant.id, empresaId: primeira.id } }), 2);
});

test("alteração após sincronização abre nova versão e preserva a intenção anterior", async () => {
  const tenant = await criarTenant({ slug: `qa-b2b-versao-${sufixo()}`, nome: "QA versão" });
  const email = `compras-${sufixo()}@aurora.test`;
  const entrada = {
    referencia: "aurora-versionada",
    razaoSocial: "Aurora Versionada Ltda",
    unidades: [{ referencia: "matriz", nome: "Matriz", cnpj: "60067738000106", enderecos: [] }],
    contatos: [],
    centrosCusto: [],
    compradores: [{
      nome: "Ana",
      email,
      centrosCusto: [],
      autorizacoes: [{ papel: "COMPRADOR" as const, referenciaUnidade: null, limiteAprovacaoCentavos: null }],
    }],
  };
  const empresa = await salvarEmpresaB2B(tenant.id, entrada, { tipo: "ADMIN", id: "qa" });
  const vinculo = await prisma.compradorEmpresaB2B.findFirstOrThrow({ where: { tenantId: tenant.id, empresaId: empresa.id }, include: { provisionamento: true } });
  await prisma.provisionamentoCompradorB2B.update({
    where: { compradorEmpresaId: vinculo.id },
    data: { situacao: "SINCRONIZADO", versaoSincronizada: 1, sincronizadoEm: new Date() },
  });

  await salvarEmpresaB2B(tenant.id, {
    ...entrada,
    compradores: [{ ...entrada.compradores[0], autorizacoes: [{ papel: "APROVADOR" as const, referenciaUnidade: null, limiteAprovacaoCentavos: 300_000 }] }],
  }, { tipo: "ADMIN", id: "qa" });

  const atualizado = await prisma.compradorEmpresaB2B.findUniqueOrThrow({
    where: { id: vinculo.id },
    include: { provisionamento: true, autorizacoes: { orderBy: { versao: "asc" } } },
  });
  assert.deepEqual(atualizado.autorizacoes.map(({ versao, papel }) => [versao, papel]), [[1, "COMPRADOR"], [2, "APROVADOR"]]);
  assert.equal(atualizado.provisionamento?.versaoDesejada, 2);
  assert.equal(atualizado.provisionamento?.situacao, "PENDENTE");
  assert.notEqual(atualizado.provisionamento?.correlacaoId, vinculo.provisionamento?.correlacaoId);
});

test("agregado completo desativa unidade e centro omitidos e enfileira suspensão do comprador", async () => {
  const tenant = await criarTenant({ slug: `qa-b2b-remocao-${sufixo()}`, nome: "QA remoção" });
  const email = `remover-${sufixo()}@aurora.test`;
  const base = {
    referencia: "remocao",
    razaoSocial: "Remoção Industrial Ltda",
    unidades: [
      { referencia: "matriz", nome: "Matriz", cnpj: "60067738000106", enderecos: [] },
      { referencia: "filial", nome: "Filial", cnpj: "11222333000181", enderecos: [] },
    ],
    contatos: [],
    centrosCusto: [{ codigo: "ANTIGO", nome: "Antigo", orcamentoMensalCentavos: 100 }],
    compradores: [{ nome: "Compras", email, centrosCusto: ["ANTIGO"], autorizacoes: [{ papel: "COMPRADOR" as const, referenciaUnidade: "filial", limiteAprovacaoCentavos: null }] }],
  };
  const empresa = await salvarEmpresaB2B(tenant.id, base, { tipo: "ADMIN", id: "qa" });
  await salvarEmpresaB2B(tenant.id, { ...base, unidades: [base.unidades[0]], centrosCusto: [], compradores: [] }, { tipo: "ADMIN", id: "qa" });

  const filial = await prisma.unidadeEmpresaB2B.findFirstOrThrow({ where: { empresaId: empresa.id, referencia: "filial" } });
  const centro = await prisma.centroCustoB2B.findFirstOrThrow({ where: { empresaId: empresa.id, codigo: "ANTIGO" } });
  const comprador = await prisma.compradorEmpresaB2B.findFirstOrThrow({ where: { empresaId: empresa.id, emailNormalizado: email }, include: { provisionamento: true } });
  assert.deepEqual([filial.ativa, centro.ativo, comprador.situacao, comprador.provisionamento?.situacao], [false, false, "SUSPENSO", "PENDENTE"]);
});

test("banco recusa vínculos entre empresas do mesmo tenant e protege auditoria append-only", async () => {
  const tenant = await criarTenant({ slug: `qa-b2b-empresa-fk-${sufixo()}`, nome: "QA empresa FK" });
  const a = await prisma.empresaB2B.create({ data: { tenantId: tenant.id, referencia: "a", razaoSocial: "Empresa A" } });
  const b = await prisma.empresaB2B.create({ data: { tenantId: tenant.id, referencia: "b", razaoSocial: "Empresa B" } });
  const unidadeB = await prisma.unidadeEmpresaB2B.create({ data: { tenantId: tenant.id, empresaId: b.id, referencia: "matriz", nome: "Matriz B", cnpj: "60067738000106" } });
  await assert.rejects(prisma.contatoEmpresaB2B.create({
    data: { tenantId: tenant.id, empresaId: a.id, unidadeId: unidadeB.id, tipo: "COMERCIAL", nome: "Invasor" },
  }), /Foreign key constraint|restrição de chave estrangeira/i);

  const auditada = await salvarEmpresaB2B(tenant.id, {
    referencia: "auditada", razaoSocial: "Auditada Ltda",
    unidades: [{ referencia: "matriz", nome: "Matriz", cnpj: "11222333000181", enderecos: [] }],
    contatos: [], centrosCusto: [], compradores: [],
  }, { tipo: "ADMIN", id: "qa" });
  const auditoria = await prisma.auditoriaB2B.findFirstOrThrow({ where: { empresaId: auditada.id } });
  assert.equal(Array.isArray((auditoria.estadoPosterior as { unidades?: unknown[] }).unidades), true);
  await assert.rejects(prisma.auditoriaB2B.update({ where: { id: auditoria.id }, data: { resultado: "ALTERADO" } }), /append-only/i);
  await assert.rejects(prisma.auditoriaB2B.delete({ where: { id: auditoria.id } }), /append-only/i);
});
