import assert from "node:assert/strict";
import { after, test } from "node:test";
import { randomUUID } from "node:crypto";
import { prisma } from "../../src/lib/db";

const url = new URL(process.env.DATABASE_URL ?? "http://invalid");
if (!["127.0.0.1", "localhost"].includes(url.hostname) || url.port !== "5548" || !url.pathname.endsWith("_test")) {
  throw new Error("Este teste exige o banco isolado local :5548/*_test.");
}

after(() => prisma.$disconnect());

test("banco aceita somente snapshot técnico ausente ou completo com versões positivas", async () => {
  const tenant = await prisma.tenant.create({
    data: { slug: `qa-ficha-${randomUUID()}`, nome: "QA Ficha Técnica", status: "ATIVA" },
  });
  const agora = new Date();

  async function inserir(ficha: object | null, fichaVersao: number | null, previaVersao: number | null) {
    const id = randomUUID();
    return prisma.$executeRaw`
      INSERT INTO "SolicitacaoSobMedida" (
        "id", "tenantId", "referencia", "contratoVersao", "nome", "configuracao", "resumo",
        "fichaTecnica", "fichaTecnicaVersao", "previaVersao", "consentimentoEm", "criadoEm", "atualizadoEm"
      ) VALUES (
        ${id}, ${tenant.id}, ${`CFG-${randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`}, 1, 'QA', '{}'::jsonb, 'QA',
        CAST(${ficha === null ? null : JSON.stringify(ficha)} AS JSONB), ${fichaVersao}, ${previaVersao}, ${agora}, ${agora}, ${agora}
      )
    `;
  }

  try {
    assert.equal(await inserir(null, null, null), 1);
    assert.equal(await inserir({ versao: 1 }, 1, 1), 1);
    await assert.rejects(() => inserir({ versao: 1 }, null, 1));
    await assert.rejects(() => inserir({ versao: 1 }, 1, null));
    await assert.rejects(() => inserir(null, 1, 1));
    await assert.rejects(() => inserir(null, null, 1));
    await assert.rejects(() => inserir({ versao: 1 }, 0, 1));
    await assert.rejects(() => inserir({ versao: 1 }, 1, -1));
  } finally {
    await prisma.tenant.delete({ where: { id: tenant.id } });
  }
});
