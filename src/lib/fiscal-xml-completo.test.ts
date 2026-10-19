import { test } from "node:test";
import assert from "node:assert/strict";
import { validarXmlCompleto } from "./fiscal-xml-completo";
const chave = "3".repeat(44);
const cnpj = "60067738000106";
const xml = `<nfeProc><NFe><infNFe Id="NFe${chave}"><ide><mod>55</mod></ide><dest><CNPJ>${cnpj}</CNPJ></dest></infNFe></NFe><protNFe><infProt><chNFe>${chave}</chNFe><cStat>100</cStat></infProt></protNFe></nfeProc>`;
test("aceita XML completo autorizado vinculado ao destinatário e chave", () => {
  assert.equal(validarXmlCompleto(xml, chave, cnpj).schema, "procNFe_v4.00.xsd");
});
test("recusa resumo, destinatário divergente, chave diferente e entidade XML", () => {
  assert.throws(() => validarXmlCompleto(`<resNFe><chNFe>${chave}</chNFe></resNFe>`, chave, cnpj));
  assert.throws(() => validarXmlCompleto(xml, "4".repeat(44), cnpj));
  assert.throws(() => validarXmlCompleto(xml, chave, "12345678000100"));
  assert.throws(() => validarXmlCompleto(`<!DOCTYPE foo>${xml}`, chave, cnpj));
});
