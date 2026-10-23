import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const fonte = readFileSync("src/components/cart/Sugestoes.tsx", "utf8");

test("imagem da sugestão tem nome acessível no link", () => {
  assert.match(fonte, /<a[^>]+aria-label={`Ver \$\{s\.nome\}`}[^>]*>/);
});
