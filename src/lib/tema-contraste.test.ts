import assert from "node:assert/strict";
import test from "node:test";
import { contraste, cssDoTema, TemaSchema } from "./tema";

test("tema claro mantém texto secundário legível na seleção do checkout", () => {
  const css = cssDoTema(TemaSchema.parse({}));
  const texto = css.match(/--ck-fg-muted:(#[a-f\d]{6})/)?.[1];
  assert.ok(texto);
  // Resultado opaco do azul padrão a 10% sobre branco.
  assert.ok(contraste(texto, "#e9effd") >= 4.5);
});
