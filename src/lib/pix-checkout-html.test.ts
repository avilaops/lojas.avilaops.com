import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

for (const arquivo of [
  "src/components/checkout/PixNaConta.tsx",
  "src/app/checkout/CheckoutClient.tsx",
]) {
  test(`${arquivo} nomeia o campo Pix copia e cola`, () => {
    const fonte = readFileSync(arquivo, "utf8");
    assert.match(fonte, /<textarea aria-label="Código Pix copia e cola"/);
  });
}
