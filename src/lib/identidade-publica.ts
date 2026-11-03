import { validarCnpj } from "@avilaops/checkout";
import type { Tenant } from "@prisma/client";
import type { Endereco } from "./tenant";
import { emailDeContato, numeroDeContato } from "./canais-publicos";

type TenantIdentidade = Pick<
  Tenant,
  | "nome"
  | "razaoSocial"
  | "cnpj"
  | "whatsapp"
  | "telefone"
  | "emailContato"
  | "horario"
  | "enderecoPublico"
  | "endereco"
>;

export interface IdentidadePublica {
  nome: string;
  razaoSocial: string | null;
  cnpj: string | null;
  whatsapp: { numero: string; url: string } | null;
  telefone: { exibicao: string; uri: string } | null;
  email: string | null;
  horario: string | null;
  enderecoLegal: (Endereco & { texto: string; logradouro: string; numero: string; cidade: string; uf: string; cep: string }) | null;
  enderecoVisita: IdentidadePublica["enderecoLegal"];
}

function texto(valor: unknown): string | null {
  const limpo = typeof valor === "string" ? valor.trim() : "";
  return limpo || null;
}

const UFS = new Set("AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(" "));

function enderecoCompleto(tenant: TenantIdentidade): IdentidadePublica["enderecoLegal"] {
  if (!tenant.endereco || typeof tenant.endereco !== "object" || Array.isArray(tenant.endereco)) return null;
  const endereco = tenant.endereco as Record<string, unknown>;
  const logradouro = texto(endereco.logradouro ?? null);
  const numero = texto(endereco.numero ?? null);
  const cidade = texto(endereco.cidade ?? null);
  const uf = texto(endereco.uf ?? null)?.toUpperCase() ?? null;
  const cepBruto = texto(endereco.cep);

  if (!logradouro || !numero || !cidade || !uf || !UFS.has(uf) || !cepBruto || !/^\d{5}-?\d{3}$/.test(cepBruto)) return null;
  const cepDigitos = cepBruto.replace(/\D/g, "");
  if (cepDigitos === "00000000") return null;
  const cep = `${cepDigitos.slice(0, 5)}-${cepDigitos.slice(5)}`;

  const bairro = texto(endereco.bairro ?? null) ?? undefined;
  return {
    logradouro,
    numero,
    ...(bairro ? { bairro } : {}),
    cidade,
    uf,
    cep,
    texto: [
      `${logradouro}, ${numero}`,
      bairro,
      `${cidade} - ${uf}`,
      cep,
    ].filter(Boolean).join(" · "),
  };
}

export function identidadePublica(tenant: TenantIdentidade): IdentidadePublica {
  const cnpjBruto = texto(tenant.cnpj);
  const cnpj = cnpjBruto && validarCnpj(cnpjBruto) ? cnpjBruto.replace(/\D/g, "") : null;
  const whatsapp = numeroDeContato(tenant.whatsapp);
  const telefoneExibicao = texto(tenant.telefone);
  const telefoneNumero = numeroDeContato(telefoneExibicao);
  const enderecoLegal = enderecoCompleto(tenant);

  return {
    nome: texto(tenant.nome) ?? "",
    razaoSocial: texto(tenant.razaoSocial),
    cnpj,
    whatsapp: whatsapp ? { numero: whatsapp, url: `https://wa.me/${whatsapp.replace(/^\+/, "")}` } : null,
    telefone: telefoneExibicao && telefoneNumero
      ? { exibicao: telefoneExibicao, uri: telefoneNumero.startsWith("+") ? telefoneNumero : `+${telefoneNumero}` }
      : null,
    email: emailDeContato(tenant.emailContato),
    horario: texto(tenant.horario),
    enderecoLegal,
    enderecoVisita: tenant.enderecoPublico === true ? enderecoLegal : null,
  };
}

export function schemaDaIdentidadePublica(
  identidade: IdentidadePublica,
  opcoes: { url: string; logo?: string | null; descricao?: string | null },
) {
  return {
    "@context": "https://schema.org",
    "@type": "Store",
    "@id": `${opcoes.url}/#organization`,
    name: identidade.nome,
    ...(identidade.razaoSocial ? { legalName: identidade.razaoSocial } : {}),
    ...(identidade.cnpj ? { taxID: identidade.cnpj } : {}),
    url: opcoes.url,
    ...(opcoes.logo ? { logo: opcoes.logo } : {}),
    ...(opcoes.descricao ? { description: opcoes.descricao } : {}),
    ...(identidade.telefone ? { telephone: identidade.telefone.uri } : {}),
    ...(identidade.email ? { email: identidade.email } : {}),
    ...(identidade.whatsapp
      ? {
          contactPoint: {
            "@type": "ContactPoint",
            contactType: "sales",
            telephone: identidade.whatsapp.numero.startsWith("+") ? identidade.whatsapp.numero : `+${identidade.whatsapp.numero}`,
            url: identidade.whatsapp.url,
          },
        }
      : {}),
    ...(identidade.enderecoLegal
      ? {
          address: {
            "@type": "PostalAddress",
            streetAddress: `${identidade.enderecoLegal.logradouro}, ${identidade.enderecoLegal.numero}`,
            addressLocality: identidade.enderecoLegal.cidade,
            addressRegion: identidade.enderecoLegal.uf,
            postalCode: identidade.enderecoLegal.cep,
            addressCountry: "BR",
          },
        }
      : {}),
    ...(identidade.horario ? { openingHours: identidade.horario } : {}),
  };
}
