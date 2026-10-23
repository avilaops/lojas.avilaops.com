import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("ações fixas não disputam o rodapé no mobile", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(css, /body:has\(\.barra-inferior\) \.whatsapp-flutuante \{ bottom:/);
  assert.match(css, /body:has\(\.barra-inferior\) \.aviso-cookies \{ bottom:/);
  assert.match(css, /body:has\(\.aviso-cookies\) \.whatsapp-flutuante \{ display: none; \}/);
  assert.match(css, /body:has\(\.cartao-produto, \.ap-produto-info, \.acao-whatsapp\) \.whatsapp-flutuante \{ display: none; \}/);
});
