import assert from "node:assert/strict";
import test from "node:test";
import { avisoAceito } from "./indexnow";
import { CONDICAO_PUBLICAVEL, publicavel } from "./produto-regras";

test("só resposta 2xx conta como buscador avisado", () => {
  assert.equal(avisoAceito([{ ok: true }, { ok: true }]), 2);
  // 403 de chave recusada e endpoint que não respondeu não são aviso feito.
  assert.equal(avisoAceito([{ ok: false }, null]), 0);
  assert.equal(avisoAceito([{ ok: true }, null]), 1);
});

test("o filtro de consulta diz o mesmo que a régua de página publicada", () => {
  const casos = [
    { ativo: true, imagens: ["a.webp"], precoCentavos: 0 },
    { ativo: true, imagens: [], precoCentavos: 100 },
    { ativo: true, imagens: [], precoCentavos: 0 },
    { ativo: false, imagens: ["a.webp"], precoCentavos: 100 },
  ];
  const peloFiltro = (p: (typeof casos)[number]) =>
    p.ativo === CONDICAO_PUBLICAVEL.ativo && (p.imagens.length > 0 || p.precoCentavos > CONDICAO_PUBLICAVEL.OR[1].precoCentavos!.gt);
  for (const p of casos) assert.equal(peloFiltro(p), publicavel(p), JSON.stringify(p));
});
