import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { prisma } from "../../src/lib/db";

const url = new URL(process.env.DATABASE_URL ?? "http://invalid");
if (!["127.0.0.1", "localhost"].includes(url.hostname) || url.port !== "5548" || !url.pathname.endsWith("_test")) {
  throw new Error("Este teste exige o banco isolado local :5548/*_test.");
}

after(() => prisma.$disconnect());
const chave = () => randomUUID().replace(/-/g, "");

test("cotação preserva versões, anexos, eventos e isolamento empresarial", async () => {
  const tenant = await prisma.tenant.create({ data: { slug: `qa-cot-${chave()}`, nome: "QA Cotação", status: "ATIVA" } });
  const empresa = await prisma.empresaB2B.create({ data: { tenantId: tenant.id, referencia: "cliente", razaoSocial: "Cliente" } });
  const outra = await prisma.empresaB2B.create({ data: { tenantId: tenant.id, referencia: "outra", razaoSocial: "Outra" } });
  const unidadeOutra = await prisma.unidadeEmpresaB2B.create({ data: { tenantId: tenant.id, empresaId: outra.id, referencia: "matriz", nome: "Matriz", cnpj: "60067738000106" } });

  await assert.rejects(() => prisma.cotacaoB2B.create({
    data: {
      tenantId: tenant.id, empresaId: empresa.id, unidadeId: unidadeOutra.id,
      referencia: `COT-${chave()}`, responsavelEmail: "vendas@example.test",
      validaAte: new Date(Date.now() + 86_400_000),
    },
  }));

  const cotacao = await prisma.cotacaoB2B.create({
    data: {
      tenantId: tenant.id, empresaId: empresa.id, referencia: `COT-${chave()}`,
      responsavelEmail: "vendas@example.test", validaAte: new Date(Date.now() + 86_400_000),
      versoes: { create: { numero: 1, autorTipo: "VENDEDOR", autorEmail: "vendas@example.test", itens: [], subtotalCentavos: 0, totalCentavos: 0 } },
      eventos: { create: { tipo: "CRIADA", atorTipo: "VENDEDOR", atorEmail: "vendas@example.test", dados: {} } },
      anexos: { create: { nome: "pedido.pdf", url: "https://arquivos.example.test/pedido.pdf", tipoMime: "application/pdf", tamanhoBytes: 10 } },
    }, include: { versoes: true, eventos: true, anexos: true },
  });
  assert.deepEqual([cotacao.versoes.length, cotacao.eventos.length, cotacao.anexos.length], [1, 1, 1]);
  await assert.rejects(() => prisma.versaoCotacaoB2B.update({ where: { id: cotacao.versoes[0].id }, data: { totalCentavos: 1 } }), /imutável/i);
  await assert.rejects(() => prisma.eventoCotacaoB2B.delete({ where: { id: cotacao.eventos[0].id } }), /append-only/i);
});
