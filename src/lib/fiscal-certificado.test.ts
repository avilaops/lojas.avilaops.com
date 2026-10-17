import assert from "node:assert/strict";
import { test } from "node:test";
import forge from "node-forge";
import { abrirCertificado, lerCertificado, selarCertificado } from "./fiscal-certificado";

test("cofre cifra arquivo e senha e detecta alteração", () => {
  process.env.LOJAS_CERT_SECRET = "ab".repeat(32);
  const arquivo = Buffer.from("arquivo de teste");
  const selado = selarCertificado(arquivo, "senha secreta");
  assert.ok(!selado.includes("senha secreta"));
  assert.deepEqual(abrirCertificado(selado), { pfx: arquivo, senha: "senha secreta" });
  assert.notEqual(selarCertificado(arquivo, "senha secreta"), selado);
  const partes = selado.split(".");
  const corpo = Buffer.from(partes[2], "base64"); corpo[0] ^= 1; partes[2] = corpo.toString("base64");
  assert.throws(() => abrirCertificado(partes.join(".")));
});

test("lê certificado com chave correspondente e recusa senha, CNPJ e validade incorretos", () => {
  const chaves = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = chaves.publicKey;
  cert.serialNumber = "01";
  cert.validity.notBefore = new Date(Date.now() - 86_400_000);
  cert.validity.notAfter = new Date(Date.now() + 86_400_000);
  cert.setSubject([{ name: "commonName", value: "EMPRESA TESTE:12345678000190" }]);
  cert.setIssuer(cert.subject.attributes);
  cert.sign(chaves.privateKey, forge.md.sha256.create());
  const arquivo = () => Buffer.from(forge.asn1.toDer(forge.pkcs12.toPkcs12Asn1(chaves.privateKey, cert, "senha", { algorithm: "3des" })).getBytes(), "binary");
  assert.equal(lerCertificado(arquivo(), "senha", "12345678000190").titular, "EMPRESA TESTE:12345678000190");
  assert.throws(() => lerCertificado(arquivo(), "errada", "12345678000190"), /senha não corresponde/);
  assert.throws(() => lerCertificado(arquivo(), "senha", "12345678000270"), /CNPJ/);
  cert.validity.notAfter = new Date(Date.now() - 1000); cert.sign(chaves.privateKey, forge.md.sha256.create());
  assert.throws(() => lerCertificado(arquivo(), "senha", "12345678000190"), /vencido/);
  assert.throws(() => lerCertificado(Buffer.from("invalido"), "", "12345678000190"), /não é um certificado A1/);
});

test("usa o parser nativo quando o node-forge não aceita o PKCS#12", () => {
  const chaves = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = chaves.publicKey;
  cert.serialNumber = "02";
  cert.validity.notBefore = new Date(Date.now() - 86_400_000);
  cert.validity.notAfter = new Date(Date.now() + 86_400_000);
  cert.setSubject([{ name: "commonName", value: "EMPRESA MODERNA:12345678000190" }]);
  cert.setIssuer(cert.subject.attributes);
  cert.sign(chaves.privateKey, forge.md.sha256.create());
  const arquivo = Buffer.from(forge.asn1.toDer(forge.pkcs12.toPkcs12Asn1(chaves.privateKey, cert, "senha", { algorithm: "3des" })).getBytes(), "binary");
  const original = forge.pkcs12.pkcs12FromAsn1;
  forge.pkcs12.pkcs12FromAsn1 = () => { throw new Error("algoritmo não suportado pelo node-forge"); };
  try {
    assert.equal(lerCertificado(arquivo, "senha", "12345678000190").titular, "EMPRESA MODERNA:12345678000190");
  } finally {
    forge.pkcs12.pkcs12FromAsn1 = original;
  }
});
