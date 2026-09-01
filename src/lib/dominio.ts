import { promises as dns } from "node:dns";
import type { Tenant } from "@prisma/client";

/**
 * Domínio próprio, conferido de verdade.
 *
 * O certificado desta plataforma é emitido sob demanda: quando um host novo
 * chega por SNI, o Caddy pergunta ao `/api/dominio-permitido` se ele pertence a
 * alguma loja e só então pede o certificado. Ou seja, do nosso lado não existe
 * botão de "ativar domínio": existe o domínio estar salvo na loja e o DNS do
 * lojista apontar para cá. O resto acontece sozinho.
 *
 * O que faltava era justamente contar isso ao lojista. Ele salvava o domínio no
 * campo perdido na aba Marca, nada visível acontecia, e a conclusão natural era
 * que a plataforma não faz domínio próprio.
 */

/** Onde o DNS do lojista precisa chegar. Env para o dia em que o servidor mudar. */
export const IP_DA_PLATAFORMA = process.env.LOJAS_IP_PUBLICO ?? "178.105.82.48";

const BASE = (process.env.LOJAS_BASE_DOMAIN ?? "lojas.avilaops.com").toLowerCase();

export type EstadoDoNome = {
  nome: string;
  /** Resolve para o IP da plataforma. */
  ok: boolean;
  /** O que o DNS respondeu, para o lojista comparar com o que cadastrou. */
  encontrado: string[];
  erro: string | null;
};

export type Conferencia = {
  dominio: string;
  apex: EstadoDoNome;
  www: EstadoDoNome;
  /** Os dois no lugar: a loja já responde pelo domínio do lojista. */
  pronto: boolean;
  mensagem: string;
};

/** Tira protocolo, barra, www e espaço: o lojista cola de tudo neste campo. */
export function limparDominio(bruto: string): string {
  return bruto
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/^www\./, "")
    .replace(/\.$/, "");
}

export function dominioValido(d: string): boolean {
  return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(d) && d.length >= 4 && d.length <= 253;
}

async function conferirNome(nome: string): Promise<EstadoDoNome> {
  try {
    // resolve4 segue o CNAME até o endereço final, então uma resposta só
    // atende quem criou A no apex e quem criou CNAME no www.
    const encontrado = await dns.resolve4(nome);
    return { nome, ok: encontrado.includes(IP_DA_PLATAFORMA), encontrado, erro: null };
  } catch (e) {
    const codigo = (e as NodeJS.ErrnoException).code ?? "erro";
    const erro = codigo === "ENOTFOUND" || codigo === "ENODATA" ? "sem registro" : codigo;
    return { nome, ok: false, encontrado: [], erro };
  }
}

/**
 * Confere o apex e o www ao mesmo tempo.
 *
 * O www é conferido junto porque metade dos compradores digita com ele, e uma
 * loja que abre em `sualoja.com.br` e falha em `www.sualoja.com.br` parece
 * quebrada para essa metade.
 */
export async function conferirDominio(dominio: string): Promise<Conferencia> {
  const apexNome = limparDominio(dominio);
  const [apex, www] = await Promise.all([conferirNome(apexNome), conferirNome(`www.${apexNome}`)]);

  const pronto = apex.ok && www.ok;
  let mensagem: string;
  if (pronto) {
    mensagem = "Domínio apontado. O certificado é emitido no primeiro acesso, então a primeira visita pode demorar alguns segundos.";
  } else if (!apex.ok && !www.ok && !apex.encontrado.length && !www.encontrado.length) {
    mensagem = "Nenhum dos dois registros existe ainda. Se você acabou de criar, o DNS pode levar de alguns minutos a algumas horas para propagar.";
  } else if (!apex.ok && apex.encontrado.length) {
    mensagem = `O domínio existe, mas aponta para ${apex.encontrado.join(", ")} em vez de ${IP_DA_PLATAFORMA}. Corrija o registro A.`;
  } else if (!www.ok) {
    mensagem = "O domínio já aponta para cá, mas o www não. Crie o registro do www para não perder quem digita com ele.";
  } else {
    mensagem = "Ainda falta o registro do domínio principal.";
  }

  return { dominio: apexNome, apex, www, pronto, mensagem };
}

/** O que o lojista precisa criar no painel de quem registrou o domínio dele. */
export function registrosNecessarios(t: Tenant, dominio: string) {
  const apex = limparDominio(dominio);
  return [
    {
      tipo: "A",
      nome: "@",
      valor: IP_DA_PLATAFORMA,
      ajuda: `O "@" representa o próprio ${apex}. Registro.br e a maioria dos painéis não aceitam CNAME aqui, por isso é um endereço IP.`,
    },
    {
      tipo: "CNAME",
      nome: "www",
      valor: `${t.slug}.${BASE}`,
      ajuda: "Apontar para o endereço da sua loja, e não para o IP, faz o www continuar funcionando se algum dia o servidor mudar.",
    },
  ];
}
