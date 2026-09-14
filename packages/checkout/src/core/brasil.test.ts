import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  apenasDigitos,
  mascararCelular,
  mascararCep,
  mascararDocumento,
  tipoDocumento,
  validarCelular,
  validarCnpj,
  validarCpf,
  validarDocumento,
} from "./brasil.ts";

describe("validarCpf", () => {
  it("aceita CPF com dígito verificador correto", () => {
    for (const cpf of ["529.982.247-25", "52998224725", "111.444.777-35"]) {
      assert.equal(validarCpf(cpf), true, cpf);
    }
  });

  it("recusa dígito verificador errado", () => {
    assert.equal(validarCpf("529.982.247-26"), false);
  });

  it("recusa todos os dígitos iguais", () => {
    // Estes passam num teste de comprimento e são o que bot e cliente
    // apressado digitam. O problema só apareceria na emissão da nota.
    for (let d = 0; d <= 9; d += 1) {
      assert.equal(validarCpf(String(d).repeat(11)), false, `${d}`.repeat(11));
    }
  });

  it("recusa comprimento errado", () => {
    assert.equal(validarCpf("5299822472"), false);
    assert.equal(validarCpf("529982247250"), false);
    assert.equal(validarCpf(""), false);
  });
});

describe("validarCnpj", () => {
  it("aceita CNPJ válido, com e sem máscara", () => {
    assert.equal(validarCnpj("11.222.333/0001-81"), true);
    assert.equal(validarCnpj("11222333000181"), true);
  });

  it("recusa dígito errado e repetição", () => {
    assert.equal(validarCnpj("11.222.333/0001-82"), false);
    assert.equal(validarCnpj("11111111111111"), false);
  });
});

describe("validarDocumento", () => {
  it("aceita CPF e CNPJ, porque a loja vende para os dois", () => {
    assert.equal(validarDocumento("529.982.247-25"), true);
    assert.equal(validarDocumento("11.222.333/0001-81"), true);
  });

  it("recusa comprimento que não é nem um nem outro", () => {
    assert.equal(validarDocumento("123456789012"), false);
  });

  it("identifica o tipo pelo comprimento", () => {
    assert.equal(tipoDocumento("52998224725"), "CPF");
    assert.equal(tipoDocumento("11222333000181"), "CNPJ");
    assert.equal(tipoDocumento("123"), null);
  });
});

describe("validarCelular", () => {
  it("aceita celular com DDD válido e nono dígito", () => {
    assert.equal(validarCelular("(16) 99412-3923"), true);
  });

  it("recusa fixo, DDD inválido e comprimento errado", () => {
    assert.equal(validarCelular("(16) 3432-0745"), false, "fixo não é celular");
    assert.equal(validarCelular("(10) 99412-3923"), false, "DDD 10 não existe");
    assert.equal(validarCelular("1699412392"), false);
  });
});

describe("máscaras", () => {
  it("mascaram valor incompleto, para o campo não pular ao sair do foco", () => {
    assert.equal(mascararDocumento("529"), "529");
    assert.equal(mascararDocumento("5299822"), "529.982.2");
    assert.equal(mascararDocumento("52998224725"), "529.982.247-25");
    assert.equal(mascararDocumento("11222333000181"), "11.222.333/0001-81");
  });

  it("mascaram celular e CEP progressivamente", () => {
    assert.equal(mascararCelular("16"), "16");
    assert.equal(mascararCelular("16994"), "(16) 994");
    assert.equal(mascararCelular("16994123923"), "(16) 99412-3923");
    assert.equal(mascararCep("14075"), "14075");
    assert.equal(mascararCep("14075240"), "14075-240");
  });

  it("descartam caracteres além do comprimento máximo", () => {
    assert.equal(apenasDigitos("(16) 99412-3923"), "16994123923");
    assert.equal(mascararCep("140752409999"), "14075-240");
  });
});
