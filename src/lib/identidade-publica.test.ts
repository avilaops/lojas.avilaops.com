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
