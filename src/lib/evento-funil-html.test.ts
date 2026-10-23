import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("eventos recebidos depois da montagem não são descartados", () => {
  const fonte = readFileSync("src/components/EventoFunil.tsx", "utf8");
  assert.match(fonte, /useRef<Set<NomeEventoFunil>>/);
  assert.match(fonte, /enviados\.current\.has\(evento\)/);
  assert.match(fonte, /enviados\.current\.add\(evento\)/);
});
