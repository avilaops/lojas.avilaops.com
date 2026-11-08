import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { POSTS, acharPost, postsPublicados, tituloDoRelacionado } from "./blog";

test("agendamento mantém artigos futuros fora da listagem, acesso direto e relacionados", () => {
  assert.equal(postsPublicados("2026-08-31").length, 0);
  assert.equal(postsPublicados("2026-09-02").length, 2);
  assert.equal(acharPost("o-que-e-sku", "2026-09-06"), undefined);
  assert.equal(tituloDoRelacionado("o-que-e-sku", "2026-09-06"), null);
  assert.ok(acharPost("o-que-e-sku", "2026-09-07"));
  assert.equal(tituloDoRelacionado("/ajuda"), null);
  assert.equal(acharPost("artigo-inexistente"), undefined);
});

test("listagem mantém ordem recente sem alterar o índice editorial", () => {
  const ordem = POSTS.map((post) => post.slug);
  const publicados = postsPublicados("2026-09-07");
  assert.equal(publicados[0].slug, "o-que-e-sku");
  assert.deepEqual(POSTS.map((post) => post.slug), ordem);
});

test("cada artigo do índice tem slug único, corpo MDX e capa existente", () => {
  assert.equal(new Set(POSTS.map((post) => post.slug)).size, POSTS.length);
  for (const post of POSTS) {
    assert.match(post.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.ok(existsSync(resolve("src/content/blog", `${post.slug}.mdx`)), post.slug);
    if (post.capa) assert.ok(existsSync(resolve("public", post.capa.slice(1))), post.capa);
  }
});
