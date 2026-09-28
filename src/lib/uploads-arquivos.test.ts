import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * A rota que serve imagem não pode puxar o removedor de fundo. Em 28/09/2026
 * o binding do ONNX falhou no container e todas as imagens da plataforma
 * responderam 500 porque a rota importava `@/lib/uploads`.
 */
test("rota /uploads não importa módulo com dependência nativa estática", () => {
  const rota = readFileSync("src/app/uploads/[...caminho]/route.ts", "utf8");
  const imports = [...rota.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]);
  assert.ok(!imports.includes("@/lib/uploads"), "a rota voltou a importar @/lib/uploads");
  assert.ok(!imports.some((i) => /fundo|removedor|onnx|sharp/.test(i)), `import proibido: ${imports.join(", ")}`);
  const imagens = readFileSync("src/lib/imagens.ts", "utf8");
  assert.ok(!/^import .* from "sharp"/m.test(imagens), "imagens.ts precisa carregar o sharp sob demanda");
  const caminho = readFileSync("src/lib/uploads-arquivos.ts", "utf8");
  assert.deepEqual([...caminho.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]), ["node:path"]);
});
