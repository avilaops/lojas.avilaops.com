import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const fonte = readFileSync("src/app/api/vitrine/evento/route.ts", "utf8");

test("ingestão resolve tenant e sessão no servidor e grava só campos controlados", () => {
  assert.match(fonte, /eventoFunilDaVitrine\.safeParse/);
  assert.match(fonte, /tenantAtual\(\)/);
  assert.match(fonte, /COOKIE_SESSAO/);
  assert.match(fonte, /updateMany\([\s\S]*tenantId:\s*tenant\.id,\s*chave/);
  assert.match(fonte, /camposDaSessaoParaEvento/);
  assert.doesNotMatch(fonte, /request\.json\(\)[^;\n]*tenantId/);
  assert.doesNotMatch(fonte, /(?:email|telefone|user-agent|\bip\b)/i);
});

test("navegador não pode declarar pagamento nem recompra", () => {
  assert.doesNotMatch(fonte, /payment_approved|purchase|repeat_purchase/);
});

