import { createCipheriv, createDecipheriv, createPrivateKey, createPublicKey, randomBytes, X509Certificate } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSecureContext, type SecureContextOptions } from "node:tls";
import forge from "node-forge";

export class ErroFiscal extends Error {}

type CertificadoLido = { titular: string; documento?: string; validoDe: Date; validoAte: Date };

function erroAoAbrirCertificado(erro: unknown): ErroFiscal {
  const detalhes = erro instanceof Error
    ? `${erro.message} ${String((erro as Error & { reason?: unknown }).reason ?? "")}`.toLowerCase()
    : "";
  if (/mac verify|password|decrypt|bad record mac/.test(detalhes)) {
    return new ErroFiscal("A senha não corresponde a este arquivo de certificado.");
  }
  if (/asn1|header too long|not enough data|nested asn1|wrong tag/.test(detalhes)) {
    return new ErroFiscal("O arquivo selecionado não é um certificado A1 .pfx ou .p12 válido.");
  }
  return new ErroFiscal("Este certificado não pôde ser aberto. Exporte novamente o A1 em formato .pfx ou .p12 e tente de novo.");
}

function lerCertificadoNativo(pfx: Buffer, senha: string): CertificadoLido {
  const contexto = createSecureContext({ pfx, passphrase: senha });
  const certificadoDer = contexto.context.getCertificate();
  if (!certificadoDer?.length) throw new Error("Certificado ausente no arquivo PKCS#12.");
  return infoCertificadoX509(new X509Certificate(certificadoDer));
}

function infoCertificadoX509(certificado: X509Certificate): CertificadoLido {
  const titular = String(certificado.toLegacyObject().subject?.CN ?? "");
  return {
    titular,
    documento: /:([0-9A-Z]{12}\d{2})$/i.exec(titular)?.[1]?.toUpperCase(),
    validoDe: new Date(certificado.validFrom),
    validoAte: new Date(certificado.validTo),
  };
}

/**
 * Último recurso para variantes PKCS#12 que o OpenSSL embutido no Node e o
 * node-forge não leem. Arquivo e senha vivem num diretório 0700, não aparecem
 * na linha de comando e são apagados antes de a requisição continuar.
 */
function abrirCertificadoOpenSSL(pfx: Buffer, senha: string): { info: CertificadoLido; cert: string; key: string } {
  const pasta = mkdtempSync(join(tmpdir(), "lojas-certificado-"));
  const arquivo = join(pasta, "certificado.p12");
  const segredo = join(pasta, "senha");
  try {
    writeFileSync(arquivo, pfx, { mode: 0o600 });
    writeFileSync(segredo, `${senha}\n`, { mode: 0o600 });
    const pem = execFileSync("openssl", [
      "pkcs12", "-legacy", "-in", arquivo, "-passin", `file:${segredo}`,
      "-clcerts", "-nodes",
    ], { encoding: "utf8", maxBuffer: 512 * 1024, stdio: ["ignore", "pipe", "pipe"] });
    const certificadoPem = pem.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/)?.[0];
    const chavePem = pem.match(/-----BEGIN (?:RSA |EC )?PRIVATE KEY-----[\s\S]+?-----END (?:RSA |EC )?PRIVATE KEY-----/)?.[0];
    if (!certificadoPem || !chavePem) throw new Error("Certificado ou chave privada ausente no arquivo PKCS#12.");

    const certificado = new X509Certificate(certificadoPem);
    const publicaDaChave = createPublicKey(createPrivateKey(chavePem)).export({ type: "spki", format: "der" });
    const publicaDoCertificado = certificado.publicKey.export({ type: "spki", format: "der" });
    if (!publicaDaChave.equals(publicaDoCertificado)) {
      throw new ErroFiscal("O certificado não contém a chave privada correspondente.");
    }
    return { info: infoCertificadoX509(certificado), cert: certificadoPem, key: chavePem };
  } finally {
    rmSync(pasta, { recursive: true, force: true });
  }
}

/** Chave e certificado PEM para XML-DSig. Nunca persiste material aberto. */
export function credencialAssinatura(pfx: Buffer, senha: string): { cert: string; key: string } {
  const convertido = abrirCertificadoOpenSSL(pfx, senha);
  return { cert: convertido.cert, key: convertido.key };
}

/** Credencial aceita pelo TLS do Node, inclusive quando o PKCS#12 usa cifras legadas. */
export function credencialTls(pfx: Buffer, senha: string): SecureContextOptions {
  try {
    createSecureContext({ pfx, passphrase: senha });
    return { pfx, passphrase: senha };
  } catch {
    const convertido = abrirCertificadoOpenSSL(pfx, senha);
    const credencial = { cert: convertido.cert, key: convertido.key };
    createSecureContext(credencial);
    return credencial;
  }
}

function lerCertificadoForge(pfx: Buffer, senha: string): CertificadoLido | null {
  let pacote: forge.pkcs12.Pkcs12Pfx;
  try {
    pacote = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(pfx.toString("binary")), senha);
  } catch {
    return null;
  }
  const chaves = [
    ...(pacote.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag] ?? []),
    ...(pacote.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag] ?? []),
  ];
  const certificados = pacote.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] ?? [];
  const certificado = certificados.map((b) => b.cert).find((cert) => cert && chaves.some((bag) => {
    const chave = bag.key as forge.pki.rsa.PrivateKey | undefined;
    const publica = cert.publicKey as forge.pki.rsa.PublicKey;
    return chave?.n && publica.n && chave.n.equals(publica.n) && chave.e.equals(publica.e);
  }));
  if (!certificado) throw new ErroFiscal("O certificado não contém a chave privada correspondente.");
  const titular = String(certificado.subject.getField("CN")?.value ?? "");
  let documento = /:([0-9A-Z]{12}\d{2})$/i.exec(titular)?.[1]?.toUpperCase();
  const san = certificado.getExtension("subjectAltName") as { altNames?: { type: number; value: unknown }[] } | null;
  for (const nome of san?.altNames ?? []) {
    if (nome.type !== 0 || !Array.isArray(nome.value)) continue;
    const [oid, valor] = nome.value as forge.asn1.Asn1[];
    if (oid && valor && forge.asn1.derToOid(oid.value as string) === "2.16.76.1.3.3") {
      documento = String(Array.isArray(valor.value) ? valor.value[0]?.value : valor.value).toUpperCase();
    }
  }
  return { titular, documento, validoDe: certificado.validity.notBefore, validoAte: certificado.validity.notAfter };
}

export function chaveFiscal(): Buffer {
  const hex = process.env.LOJAS_CERT_SECRET ?? "";
  if (!/^[a-f0-9]{64}$/i.test(hex)) throw new ErroFiscal("O cofre fiscal precisa ser configurado pelo suporte.");
  return Buffer.from(hex, "hex");
}

/** Confere a chave privada, a validade e o CNPJ do certificado de cliente. */
export function lerCertificado(pfx: Buffer, senha: string, cnpj: string) {
  if (!pfx.length || pfx.length > 64 * 1024) throw new ErroFiscal("Envie um certificado A1 de até 64 KB.");
  let nativo: CertificadoLido;
  try {
    nativo = lerCertificadoNativo(pfx, senha);
  } catch (erro) {
    let erroForge: unknown;
    try {
      const compativel = lerCertificadoForge(pfx, senha);
      if (compativel) return conferirCertificado(compativel, cnpj);
    } catch (falhaForge) {
      erroForge = falhaForge;
    }
    try {
      return conferirCertificado(abrirCertificadoOpenSSL(pfx, senha).info, cnpj);
    } catch (erroOpenSSL) {
      const classificadoNativo = erroAoAbrirCertificado(erro);
      if (!/não pôde ser aberto/.test(classificadoNativo.message)) throw classificadoNativo;
      const classificado = erroAoAbrirCertificado(erroOpenSSL);
      if (!/não pôde ser aberto/.test(classificado.message)) throw classificado;
      if (erroForge instanceof ErroFiscal) throw erroForge;
      throw classificadoNativo;
    }
  }
  const info = lerCertificadoForge(pfx, senha) ?? nativo;
  return conferirCertificado(info, cnpj);
}

function conferirCertificado(info: CertificadoLido, cnpj: string) {
  if (!cnpj || info.documento !== cnpj) throw new ErroFiscal("O CNPJ do certificado deve ser o mesmo cadastrado nesta loja.");
  const agora = new Date();
  if (info.validoDe > agora || info.validoAte <= agora) {
    throw new ErroFiscal("O certificado está vencido ou ainda não está em vigor.");
  }
  return { titular: info.titular, validoAte: info.validoAte };
}

export function selarCertificado(pfx: Buffer, senha: string): string {
  const iv = randomBytes(12);
  const cifra = createCipheriv("aes-256-gcm", chaveFiscal(), iv);
  const corpo = Buffer.concat([cifra.update(JSON.stringify({ pfx: pfx.toString("base64"), senha })), cifra.final()]);
  return [iv, cifra.getAuthTag(), corpo].map((v) => v.toString("base64")).join(".");
}

export function abrirCertificado(valor: string): { pfx: Buffer; senha: string } {
  const [iv, tag, corpo] = valor.split(".").map((v) => Buffer.from(v, "base64"));
  const cifra = createDecipheriv("aes-256-gcm", chaveFiscal(), iv);
  cifra.setAuthTag(tag);
  const dados = JSON.parse(Buffer.concat([cifra.update(corpo), cifra.final()]).toString("utf8"));
  return { pfx: Buffer.from(dados.pfx, "base64"), senha: dados.senha };
}
