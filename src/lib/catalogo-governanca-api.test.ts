import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const ROTA = "src/app/api/admin/tenants/[slug]/catalogo/qualidade/route.ts";

test("rota administrativa de qualidade é autenticada, isolada por tenant e não truncada", () => {
  assert.equal(existsSync(ROTA), true, "a rota de relatório precisa existir");
  const fonte = readFileSync(ROTA, "utf8");

  assert.match(fonte, /if\s*\(\s*!autorizado\(request\)\s*\)\s*return naoAutorizado\(\)/);
  assert.match(fonte, /tenant\.findUnique\([\s\S]*where:\s*\{\s*slug\s*\}/);
  assert.match(fonte, /produto\.findMany\([\s\S]*where:\s*\{\s*tenantId:\s*tenant\.id\s*\}/);
  assert.match(fonte, /include:\s*INCLUIR_CATALOGO/);
  assert.doesNotMatch(fonte, /\btake\s*:/);
  assert.doesNotMatch(fonte, /\bskip\s*:/);
  assert.match(fonte, /Response\.json\(relatorioDeGovernanca\(produtos\)\)/);

  assert.ok(fonte.indexOf("autorizado(request)") < fonte.indexOf("prisma.tenant"));
  assert.ok(fonte.indexOf("prisma.tenant") < fonte.indexOf("prisma.produto"));
});

test("rota de qualidade é somente leitura", () => {
  const fonte = readFileSync(ROTA, "utf8");
  assert.doesNotMatch(fonte, /\.(?:create|createMany|update|updateMany|upsert|delete|deleteMany)\s*\(/);
  assert.doesNotMatch(fonte, /export\s+(?:async\s+)?function\s+(?:POST|PUT|PATCH|DELETE)\b/);
});
