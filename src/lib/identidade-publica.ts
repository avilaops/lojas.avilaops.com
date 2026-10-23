import { validarCnpj } from "@avilaops/checkout";
import type { Tenant } from "@prisma/client";
import { formatarCep, type Endereco } from "./tenant";
import { numeroParaMeta } from "./whatsapp";

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

function texto(valor: string | null): string | null {
  const limpo = valor?.trim();
  return limpo || null;
}

function emailPublico(valor: string | null): string | null {
  const limpo = texto(valor)?.toLowerCase() ?? null;
  return limpo && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(limpo) ? limpo : null;
}

function enderecoCompleto(tenant: TenantIdentidade): IdentidadePublica["enderecoLegal"] {
  const endereco = (tenant.endereco as Endereco | null) ?? {};
  const logradouro = texto(endereco.logradouro ?? null);
  const numero = texto(endereco.numero ?? null);
  const cidade = texto(endereco.cidade ?? null);
  const uf = texto(endereco.uf ?? null)?.toUpperCase() ?? null;
  const cep = formatarCep(endereco.cep);

  if (!logradouro || !numero || !cidade || !uf || !/^\d{5}-\d{3}$/.test(cep)) return null;

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
  const whatsapp = numeroParaMeta(tenant.whatsapp);
  const telefoneExibicao = texto(tenant.telefone);
  const telefoneNumero = numeroParaMeta(telefoneExibicao);
  const enderecoLegal = enderecoCompleto(tenant);

  return {
    nome: tenant.nome.trim(),
    razaoSocial: texto(tenant.razaoSocial),
    cnpj,
    whatsapp: whatsapp ? { numero: whatsapp, url: `https://wa.me/${whatsapp}` } : null,
    telefone: telefoneExibicao && telefoneNumero
      ? { exibicao: telefoneExibicao, uri: `+${telefoneNumero}` }
      : null,
    email: emailPublico(tenant.emailContato),
    horario: texto(tenant.horario),
    enderecoLegal,
    enderecoVisita: tenant.enderecoPublico ? enderecoLegal : null,
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
            telephone: `+${identidade.whatsapp.numero}`,
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
