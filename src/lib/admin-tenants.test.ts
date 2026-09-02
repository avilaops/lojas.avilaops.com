import assert from "node:assert/strict";
import test from "node:test";
import { slugLivre } from "./admin-tenants";
import { TenantEntradaSchema } from "./admin-schemas";

/**
 * O slug do produto sai do nome, e nome repetido é comum em catálogo técnico:
 * duas peças diferentes se chamam "Rolamento 6204 2RS". Antes disso a
 * importação estourava P2002 no meio do lote e parava — os produtos já gravados
 * ficavam, o resto sumia, sem erro visível para quem importou.
 *
 * A busca é injetada: a regra é de decisão, não de banco.
 */

/** Banco falso: slug -> id do dono. */
function comDonos(donos: Record<string, string>) {
  return async (slug: string) => (donos[slug] ? { id: donos[slug] } : null);
}

test("slug livre fica como está", async () => {
  const s = await slugLivre("t1", "rolamento-6204", null, comDonos({}));
  assert.equal(s, "rolamento-6204");
});

test("slug de outro produto ganha sufixo", async () => {
  const s = await slugLivre("t1", "rolamento-6204", null, comDonos({ "rolamento-6204": "p1" }));
  assert.equal(s, "rolamento-6204-2");
});

test("o dono mantém o próprio slug ao ser atualizado", async () => {
  // Reimportar a mesma planilha não pode renomear o que já está publicado:
  // o endereço da página é o que está no Google e no link que o cliente salvou.
  const s = await slugLivre("t1", "rolamento-6204", "p1", comDonos({ "rolamento-6204": "p1" }));
  assert.equal(s, "rolamento-6204");
});

test("pula quantos sufixos forem precisos", async () => {
  const s = await slugLivre(
    "t1",
    "retentor",
    null,
    comDonos({ retentor: "p1", "retentor-2": "p2", "retentor-3": "p3" }),
  );
  assert.equal(s, "retentor-4");
});

test("troca de nome entre dois produtos não colide", async () => {
  // O caso real da Vedashow: a planilha corrigida dá a "p2" o slug que hoje é
  // de "p1". Enquanto p1 não foi regravado, p2 desvia em vez de derrubar o lote.
  const s = await slugLivre("t1", "retentor-20x34x7", "p2", comDonos({ "retentor-20x34x7": "p1" }));
  assert.equal(s, "retentor-20x34x7-2");
});

/**
 * O domínio principal é sempre o apex. O proxy redireciona www para ele em
 * 308; se o principal fosse o www, o redirecionamento apontaria para si mesmo
 * e a loja entraria em laço no domínio do cliente.
 */
test("dominioPrincipal em www vira apex", () => {
  const r = TenantEntradaSchema.parse({ slug: "x", nome: "Loja X", dominioPrincipal: "WWW.Loja.com.br" });
  assert.equal(r.dominioPrincipal, "loja.com.br");
});

test("dominioPrincipal em apex fica como está", () => {
  const r = TenantEntradaSchema.parse({ slug: "x", nome: "Loja X", dominioPrincipal: "loja.com.br" });
  assert.equal(r.dominioPrincipal, "loja.com.br");
});
