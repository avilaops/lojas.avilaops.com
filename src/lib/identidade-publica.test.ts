import assert from "node:assert/strict";
import test from "node:test";
import type { Tenant } from "@prisma/client";
import { identidadePublica, schemaDaIdentidadePublica } from "./identidade-publica";

function tenant(parcial: Partial<Tenant>): Tenant {
  return {
    nome: "Loja de teste",
    enderecoPublico: false,
    endereco: null,
    ...parcial,
  } as Tenant;
}

test("publica somente a identidade e os canais confirmados da VedaShow", () => {
  assert.deepEqual(
    identidadePublica(tenant({
      nome: "Vedashow",
      razaoSocial: "Vedashow Comércio de Vedações Ltda",
      cnpj: "58.392.666/0001-12",
      whatsapp: "551634413180",
      telefone: "(16) 3441-3180",
      emailContato: "VENDAS@VEDASHOW.COM.BR",
      horario: null,
    })),
    {
      nome: "Vedashow",
      razaoSocial: "Vedashow Comércio de Vedações Ltda",
      cnpj: "58392666000112",
      whatsapp: { numero: "551634413180", url: "https://wa.me/551634413180" },
      telefone: { exibicao: "(16) 3441-3180", uri: "+551634413180" },
      email: "vendas@vedashow.com.br",
      horario: null,
      enderecoLegal: null,
      enderecoVisita: null,
    },
  );
});

test("omite canais e identidade legal malformados", () => {
  const publico = identidadePublica(tenant({
    nome: "  Loja segura  ",
    razaoSocial: "   ",
    cnpj: "123",
    whatsapp: "javascript:alert(1)",
    telefone: "ramal 7",
    emailContato: "sem-arroba.example",
    horario: "   ",
  }));

  assert.deepEqual(publico, {
    nome: "Loja segura",
    razaoSocial: null,
    cnpj: null,
    whatsapp: null,
    telefone: null,
    email: null,
    horario: null,
    enderecoLegal: null,
    enderecoVisita: null,
  });
});

test("não transforma texto arbitrário com dígitos em canal público", () => {
  for (const numero of ["ligue 1634413180", "https://wa.me/551634413180", "0000000000"]) {
    const publico = identidadePublica(tenant({ whatsapp: numero, telefone: numero }));
    assert.equal(publico.whatsapp, null, numero);
    assert.equal(publico.telefone, null, numero);
  }
});

test("normaliza número nacional para o mesmo destino do schema e dos links", () => {
  const publico = identidadePublica(tenant({ whatsapp: " (16) 3441-3180 " }));
  assert.deepEqual(publico.whatsapp, { numero: "551634413180", url: "https://wa.me/551634413180" });
});

test("número internacional mantém o país ao atravessar projeções e schema", () => {
  const publico = identidadePublica(tenant({ whatsapp: "+1 202 555 0123", telefone: "+1 202 555 0123" }));
  assert.deepEqual(publico.whatsapp, { numero: "+12025550123", url: "https://wa.me/12025550123" });
  assert.equal(publico.telefone?.uri, "+12025550123");
  const schema = schemaDaIdentidadePublica(publico, { url: "https://loja.example" });
  assert.equal(schema.contactPoint?.telephone, "+12025550123");
  const segunda = identidadePublica(tenant({ whatsapp: publico.whatsapp?.numero }));
  assert.deepEqual(segunda.whatsapp, publico.whatsapp);
});

test("endereço JSON malformado não derruba a vitrine nem publica endereço parcial", () => {
  const completo = { logradouro: "Rua A", numero: "10", cidade: "Franca", uf: "SP", cep: "14400000" };
  for (const endereco of [
    { ...completo, logradouro: 123 },
    { ...completo, numero: true },
    { ...completo, cep: 14400000 },
    { ...completo, uf: "XX" },
    { ...completo, cep: "cep14400000" },
    { ...completo, cep: "00000000" },
    [],
    "Rua A, 10",
  ]) {
    const publico = identidadePublica(tenant({ endereco, enderecoPublico: true }));
    assert.equal(publico.enderecoLegal, null, JSON.stringify(endereco));
    assert.equal(publico.enderecoVisita, null);
    assert.equal(schemaDaIdentidadePublica(publico, { url: "https://loja.example" }).address, undefined);
  }
});

test("endereço completo integra a identificação legal mas não vira convite de visita sem autorização", () => {
  const endereco = {
    logradouro: "Rua das Oficinas",
    numero: "120",
    bairro: "Centro",
    cidade: "Ribeirão Preto",
    uf: "SP",
    cep: "14010000",
  };

  const publico = identidadePublica(tenant({ endereco, enderecoPublico: false }));

  assert.equal(publico.enderecoLegal?.texto, "Rua das Oficinas, 120 · Centro · Ribeirão Preto - SP · 14010-000");
  assert.equal(publico.enderecoVisita, null);
});

test("publica somente endereço autorizado e completo", () => {
  assert.equal(
    identidadePublica(tenant({
      enderecoPublico: true,
      endereco: { logradouro: "Rua A", numero: "10", cidade: "Ribeirão Preto", uf: "SP" },
    })).enderecoLegal,
    null,
  );

  assert.deepEqual(
    identidadePublica(tenant({
      enderecoPublico: true,
      endereco: {
        logradouro: "Rua das Oficinas",
        numero: "120",
        bairro: "Centro",
        cidade: "Ribeirão Preto",
        uf: "SP",
        cep: "14010000",
      },
    })).enderecoLegal,
    {
      texto: "Rua das Oficinas, 120 · Centro · Ribeirão Preto - SP · 14010-000",
      logradouro: "Rua das Oficinas",
      numero: "120",
      bairro: "Centro",
      cidade: "Ribeirão Preto",
      uf: "SP",
      cep: "14010-000",
    },
  );
  assert.equal(
    identidadePublica(tenant({
      enderecoPublico: true,
      endereco: {
        logradouro: "Rua das Oficinas",
        numero: "120",
        bairro: "Centro",
        cidade: "Ribeirão Preto",
        uf: "SP",
        cep: "14010000",
      },
    })).enderecoVisita?.texto,
    "Rua das Oficinas, 120 · Centro · Ribeirão Preto - SP · 14010-000",
  );
});

test("schema Store usa a mesma identidade validada sem campos vazios", () => {
  const identidade = identidadePublica(tenant({
    nome: "Vedashow",
    razaoSocial: "Vedashow Comércio de Vedações Ltda",
    cnpj: "58.392.666/0001-12",
    whatsapp: "551634413180",
    telefone: "(16) 3441-3180",
    emailContato: "vendas@vedashow.com.br",
  }));

  assert.deepEqual(
    schemaDaIdentidadePublica(identidade, {
      url: "https://vedashow.com.br",
      logo: "https://cdn.example/vedashow.svg",
      descricao: "Peças para manutenção industrial.",
    }),
    {
      "@context": "https://schema.org",
      "@type": "Store",
      "@id": "https://vedashow.com.br/#organization",
      name: "Vedashow",
      legalName: "Vedashow Comércio de Vedações Ltda",
      taxID: "58392666000112",
      url: "https://vedashow.com.br",
      logo: "https://cdn.example/vedashow.svg",
      description: "Peças para manutenção industrial.",
      telephone: "+551634413180",
      email: "vendas@vedashow.com.br",
      contactPoint: {
        "@type": "ContactPoint",
        contactType: "sales",
        telephone: "+551634413180",
        url: "https://wa.me/551634413180",
      },
    },
  );
});

test("schema separa logo real e imagem de compartilhamento da própria loja", () => {
  const identidade = identidadePublica(tenant({ nome: "Marca QA" }));
  const comMarca = schemaDaIdentidadePublica(identidade, { url: "https://marca.example", logo: "/uploads/marca.webp", imagem: "/opengraph-image" });
  assert.equal(comMarca.logo, "https://marca.example/uploads/marca.webp");
  assert.equal(comMarca.image, "https://marca.example/opengraph-image");
  const semMarca = schemaDaIdentidadePublica(identidade, { url: "https://marca.example", imagem: "/opengraph-image" });
  assert.equal(Object.hasOwn(semMarca, "logo"), false);
  assert.equal(semMarca.image, "https://marca.example/opengraph-image");
  for (const logo of [null, "", "javascript:alert(1)", "data:image/png;base64,AA==", "https://usuario:senha@cdn.example/logo.svg"]) {
    const schema = schemaDaIdentidadePublica(identidade, { url: "https://marca.example", logo });
    assert.equal(Object.hasOwn(schema, "image"), false);
    assert.equal(Object.hasOwn(schema, "logo"), false);
  }
});

test("schema Store inclui endereço legal completo mesmo sem convite de visita e horário confirmado", () => {
  const identidade = identidadePublica(tenant({
    horario: "Segunda a sexta, 8h às 18h",
    enderecoPublico: false,
    endereco: {
      logradouro: "Rua das Oficinas",
      numero: "120",
      bairro: "Centro",
      cidade: "Ribeirão Preto",
      uf: "SP",
      cep: "14010000",
    },
  }));

  const schema = schemaDaIdentidadePublica(identidade, { url: "https://loja.example" });

  assert.equal(identidade.enderecoVisita, null);
  assert.equal(schema.openingHours, "Segunda a sexta, 8h às 18h");
  assert.deepEqual(schema.address, {
    "@type": "PostalAddress",
    streetAddress: "Rua das Oficinas, 120",
    addressLocality: "Ribeirão Preto",
    addressRegion: "SP",
    postalCode: "14010-000",
    addressCountry: "BR",
  });
});
