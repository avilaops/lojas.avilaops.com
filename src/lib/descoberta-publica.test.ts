import assert from "node:assert/strict";
import test from "node:test";
import type { Tenant } from "@prisma/client";
import { respostaDescobertaPublica } from "./descoberta-publica";

function loja(parcial: Partial<Tenant> = {}): Tenant {
  return {
    slug: "pecas-azuis",
    nome: "Peças Azuis",
    status: "ATIVA",
    dominioPrincipal: "pecas-azuis.example",
    dominios: ["pecas-azuis.example"],
    slogan: "Componentes para manutenção.",
    sobre: "Informações públicas da Peças Azuis.",
    identidade: {},
    mpAccessTokenEnc: "SEGREDO_NAO_PUBLICAVEL",
    ...parcial,
  } as Tenant;
}

test("ARD descreve a loja do Host com a mesma identidade pública e URLs canônicas", async () => {
  const resposta = respostaDescobertaPublica({ host: "pecas-azuis.example", tenant: loja() }, "ard");
  assert.equal(resposta.status, 200);
  assert.match(resposta.headers.get("content-type") ?? "", /^application\/json/);
  assert.match(resposta.headers.get("cache-control") ?? "", /private.*no-store/);
  assert.equal(resposta.headers.get("vary"), "Host, X-Forwarded-Host");
  const texto = await resposta.text();
  assert.doesNotMatch(texto, /SEGREDO_NAO_PUBLICAVEL|mpAccessToken|razaoSocial/);
  const dados = JSON.parse(texto);
  assert.ok(dados.entries.some((entrada: { url: string; displayName: string }) => entrada.url === "https://pecas-azuis.example/" && entrada.displayName === "Peças Azuis"));
  assert.ok(dados.entries.some((entrada: { url: string }) => entrada.url === "https://pecas-azuis.example/produtos"));
  assert.ok(dados.entries.some((entrada: { url: string; type: string }) => entrada.url === "https://pecas-azuis.example/llms.txt" && entrada.type === "text/plain"));
  assert.ok(dados.entries.every((entrada: { url: string }) => new URL(entrada.url).origin === "https://pecas-azuis.example"));
});

test("catálogo compatível da segunda loja não herda nome, links ou cache da primeira", async () => {
  await respostaDescobertaPublica({ host: "pecas-azuis.example", tenant: loja() }, "ard").text();
  const resposta = respostaDescobertaPublica({
    host: "casa-verde.lojas.avilaops.com",
    tenant: loja({ slug: "casa-verde", nome: "Casa Verde", dominioPrincipal: null, dominios: [], slogan: "", identidade: { diferencial: "Objetos para a casa." } }),
  }, "ai-catalog");
  assert.equal(resposta.status, 200);
  const texto = await resposta.text();
  assert.doesNotMatch(texto, /Peças Azuis|pecas-azuis\.example|SEGREDO_NAO_PUBLICAVEL/);
  const dados = JSON.parse(texto);
  assert.equal(dados.specVersion, "1.0");
  assert.ok(dados.entries.every((entrada: { url: string }) => new URL(entrada.url).origin === "https://casa-verde.lojas.avilaops.com"));
  assert.match(texto, /Objetos para a casa/);
});

test("plataforma tem catálogo próprio e não consulta nem anuncia uma loja", async () => {
  const resposta = respostaDescobertaPublica({ host: "LOJAS.AVILAOPS.COM:443", tenant: null }, "ard");
  assert.equal(resposta.status, 200);
  const texto = await resposta.text();
  assert.doesNotMatch(texto, /pecas-azuis|\/produtos|\/painel|\/entrar|\/criar/);
  const dados = JSON.parse(texto);
  assert.ok(dados.entries.some((entrada: { url: string }) => entrada.url === "https://lojas.avilaops.com/ajuda"));
  assert.ok(dados.entries.every((entrada: { url: string }) => new URL(entrada.url).origin === "https://lojas.avilaops.com"));
});

test("host desconhecido, não canônico, misturado e lojas não publicadas recebem 404 sem catálogo", async () => {
  for (const contexto of [
    { host: "desconhecida.example", tenant: null },
    { host: "pecas-azuis.lojas.avilaops.com", tenant: loja() },
    { host: "outra.example", tenant: loja() },
    { host: "pecas-azuis.example, outra.example", tenant: loja() },
    { host: null, tenant: loja() },
    { host: "pecas-azuis.example", tenant: loja({ status: "PROVISIONANDO" }) },
    { host: "pecas-azuis.example", tenant: loja({ status: "CANCELADA" }) },
  ]) {
    const resposta = respostaDescobertaPublica(contexto, "ard");
    assert.equal(resposta.status, 404, String(contexto.host));
    assert.match(resposta.headers.get("cache-control") ?? "", /no-store/);
    assert.doesNotMatch(await resposta.text(), /Peças Azuis|SEGREDO_NAO_PUBLICAVEL|entries/);
  }
});

test("suspensão preserva descoberta pública conforme a regra existente de busca", () => {
  const resposta = respostaDescobertaPublica({ host: "pecas-azuis.example", tenant: loja({ status: "SUSPENSA" }) }, "ard");
  assert.equal(resposta.status, 200);
});
