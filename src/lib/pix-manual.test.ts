import assert from "node:assert/strict";
import test from "node:test";
import { cidadeDoBrCode, lerComprovante, pixManualLigado } from "./pix-manual";
import { provedoresDePagamento } from "./provedores-pagamento";
import { provedoresVisiveis, separarValores } from "./recebimento-v2";

test("a flag nasce desligada e o registro conhece o Pix na conta", () => {
  assert.equal(pixManualLigado({ recursos: [] }), false);
  assert.equal(pixManualLigado({ recursos: ["pagamentos_pix_manual"] }), true);
  assert.deepEqual(provedoresVisiveis({ recursos: [] }).map((d) => d.id), ["mercadopago"]);
  assert.ok(provedoresVisiveis({ recursos: ["pagamentos_pix_manual"] }).some((d) => d.id === "pix_manual"));
  const def = provedoresDePagamento.obter("pix_manual");
  assert.equal(def.tipoConexao, "pix_direto");
  assert.equal(def.campos.length > 0 && def.campos.every((c) => c.segredo === false), true);
  assert.equal(def.guia.length > 0, true);
  assert.equal(def.capacidades.webhook, false);
  assert.equal(def.capacidades.confirmacaoAutomatica, false);
  assert.equal(def.capacidades.estorno, false);
  assert.equal(provedoresDePagamento.obter("mercadopago").capacidades.confirmacaoAutomatica, true);
});

test("a tela separa a chave e o nome em públicos, e o teste confere a chave", async () => {
  const def = provedoresDePagamento.obter("pix_manual");
  const separado = separarValores(def, { chavePix: " loja@exemplo.com ", nomeRecebedor: "Loja Exemplo", intruso: "x" });
  assert.equal(separado.ok, true);
  if (!separado.ok) return;
  assert.deepEqual(separado.publicos, { chavePix: "loja@exemplo.com", nomeRecebedor: "Loja Exemplo" });
  assert.deepEqual(separado.segredos, {});
  const ok = await def.testarConexao(separado.ctx);
  assert.equal(ok.ok, true);
  const ruim = await def.testarConexao({ segredos: {}, publicos: { chavePix: "nao-e-chave", nomeRecebedor: "Loja" } });
  assert.equal(ruim.ok, false);
  if (!ruim.ok) assert.match(ruim.mensagem, /chave Pix/i);
});

test("cidade do BR Code cabe em 15 e não leva acento", () => {
  assert.equal(cidadeDoBrCode({ cidade: "Ribeirão Preto" }), "RIBEIRAO PRETO");
  assert.equal(cidadeDoBrCode(null), "BRASILIA");
  assert.equal(cidadeDoBrCode({ cidade: "São José do Rio Preto" }).length <= 15, true);
});

test("comprovante só aceita foto ou PDF de verdade", () => {
  assert.equal("erro" in lerComprovante(Buffer.from("nao sou arquivo"), "image/png"), true);
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(16)]);
  const ok = lerComprovante(png, "image/png");
  assert.equal("ext" in ok && ok.ext, ".png");
  const vazio = lerComprovante(Buffer.alloc(0), "image/png");
  assert.equal("erro" in vazio && /vazio/.test(vazio.erro), true);
});
