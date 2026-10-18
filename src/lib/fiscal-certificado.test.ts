import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createSecureContext } from "node:tls";
import forge from "node-forge";
import { abrirCertificado, credencialTls, lerCertificado, selarCertificado } from "./fiscal-certificado";

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

test("usa o node-forge quando o OpenSSL recusa a criptografia legada do PKCS#12", () => {
  const pasta = mkdtempSync(join(tmpdir(), "fiscal-pkcs12-legado-"));
  const chave = join(pasta, "chave.pem");
  const certificado = join(pasta, "certificado.pem");
  const arquivo = join(pasta, "certificado.p12");

  try {
    execFileSync("openssl", [
      "req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "1",
      "-keyout", chave, "-out", certificado, "-subj", "/CN=EMPRESA LEGADA:12345678000190",
    ], { stdio: "ignore" });
    execFileSync("openssl", [
      "pkcs12", "-export", "-legacy", "-inkey", chave, "-in", certificado,
      "-out", arquivo, "-passout", "pass:senha",
    ], { stdio: "ignore" });

    const pfx = readFileSync(arquivo);
    assert.throws(() => createSecureContext({ pfx, passphrase: "senha" }), /Unsupported PKCS12 PFX data/);
    assert.equal(
      lerCertificado(pfx, "senha", "12345678000190").titular,
      "EMPRESA LEGADA:12345678000190",
    );
    assert.throws(
      () => lerCertificado(pfx, "senha-incorreta", "12345678000190"),
      /senha não corresponde/,
    );
  } finally {
    rmSync(pasta, { recursive: true, force: true });
  }
});

test("abre PKCS#12 legado com chave EC usando o OpenSSL do sistema", () => {
  const pasta = mkdtempSync(join(tmpdir(), "fiscal-pkcs12-ec-"));
  const chave = join(pasta, "chave.pem");
  const certificado = join(pasta, "certificado.pem");
  const arquivo = join(pasta, "certificado.p12");

  try {
    execFileSync("openssl", ["ecparam", "-name", "prime256v1", "-genkey", "-noout", "-out", chave]);
    execFileSync("openssl", [
      "req", "-new", "-x509", "-days", "1", "-key", chave, "-out", certificado,
      "-subj", "/CN=EMPRESA EC:12345678000190",
    ]);
    execFileSync("openssl", [
      "pkcs12", "-export", "-legacy", "-inkey", chave, "-in", certificado,
      "-out", arquivo, "-passout", "pass:senha",
    ]);

    assert.equal(
      lerCertificado(readFileSync(arquivo), "senha", "12345678000190").titular,
      "EMPRESA EC:12345678000190",
    );
    const tls = credencialTls(readFileSync(arquivo), "senha");
    assert.ok("cert" in tls && "key" in tls);
    assert.doesNotThrow(() => createSecureContext(tls));
  } finally {
    rmSync(pasta, { recursive: true, force: true });
  }
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
