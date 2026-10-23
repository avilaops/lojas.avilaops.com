import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const css = readFileSync("packages/checkout/src/ui/tokens.css", "utf8");

function luminancia(hex: string) {
  const canais = hex.match(/[a-f\d]{2}/gi)!.map((canal) => Number.parseInt(canal, 16) / 255)
    .map((canal) => canal <= 0.04045 ? canal / 12.92 : ((canal + 0.055) / 1.055) ** 2.4);
  return 0.2126 * canais[0]! + 0.7152 * canais[1]! + 0.0722 * canais[2]!;
}

function contraste(frente: string, fundo: string) {
  const [maior, menor] = [luminancia(frente), luminancia(fundo)].sort((a, b) => b - a);
  return (maior! + 0.05) / (menor! + 0.05);
}

test("texto secundário claro preserva contraste na opção selecionada", () => {
  const texto = css.match(/--ck-fg-muted:\s*(#[a-f\d]{6})/)?.[1];
  assert.ok(texto);
  assert.match(css, /--ck-accent-soft:/);
  // Resultado opaco do azul padrão a 10% sobre branco: #e9effd.
  assert.ok(contraste(texto, "#e9effd") >= 4.5);
});
