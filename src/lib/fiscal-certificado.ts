import { createCipheriv, createDecipheriv, randomBytes, X509Certificate } from "node:crypto";
import { createSecureContext } from "node:tls";
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
  const certificado = new X509Certificate(certificadoDer);
  const titular = String(certificado.toLegacyObject().subject?.CN ?? "");
  return {
    titular,
    documento: /:([0-9A-Z]{12}\d{2})$/i.exec(titular)?.[1]?.toUpperCase(),
    validoDe: new Date(certificado.validFrom),
    validoAte: new Date(certificado.validTo),
  };
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
    const compativel = lerCertificadoForge(pfx, senha);
    if (compativel) return conferirCertificado(compativel, cnpj);
    throw erroAoAbrirCertificado(erro);
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
