import type { Prisma } from "@prisma/client";
import dados from "../content/pkvedacoes/referencias-agel.json";

export type ReferenciaAgelPk = (typeof dados.referencias)[number];
const campos = ["diametroInternoMm", "diametroExternoMm", "secaoMm", "alturaMm"] as const;
const materialPk = "Nylon com fibra de vidro";
const normalizar = (codigo: string) => codigo.trim().toUpperCase().replace(/[\s.-]/g, "");

/** Referência documental, nunca declaração automática de intercambiabilidade. */
export function referenciaAgelPk(tenantSlug: string, produto: { slug: string; atributos: unknown }): ReferenciaAgelPk | null {
  if (tenantSlug !== "pkvedacoes") return null;
  const registro = dados.referencias.find(r => r.slug === produto.slug);
  if (!registro || !produto.atributos || typeof produto.atributos !== "object" || Array.isArray(produto.atributos)) return null;
  const atributos = produto.atributos as Record<string, unknown>;
  // As mesmas grafias e valores canônicos aceitos pela consulta SQL. Um cadastro
  // alterado deixa de receber a associação até ser conferido novamente.
  if (atributos.material !== materialPk || ![registro.referencia, registro.referenciaPk].includes(String(atributos.referencia))) return null;
  const confere = campos.every(campo => {
    const valor = atributos[campo];
    return valor === registro[campo] || valor === String(registro[campo]);
  });
  return confere ? registro : null;
}

/** O tenant externo da consulta continua obrigatório; este filtro só amplia a PK. */
export function condicoesBuscaAgelPk(consulta: string): Prisma.ProdutoWhereInput[] {
  const codigo = normalizar(consulta).replace(/^AGEL/, "");
  if (!codigo) return [];
  return dados.referencias.filter(r => normalizar(r.codigoAgel) === codigo).map(registro => ({
    tenant: { slug: "pkvedacoes" },
    slug: registro.slug,
    AND: [
      { atributos: { path: ["material"], equals: materialPk } },
      ...campos.map(campo => ({ OR: [
        { atributos: { path: [campo], equals: registro[campo] } },
        { atributos: { path: [campo], equals: String(registro[campo]) } },
      ] })),
      { OR: [...new Set([registro.referencia, registro.referenciaPk])].map(referencia => ({
        atributos: { path: ["referencia"], equals: referencia },
      })) },
    ],
  }));
}

export const fonteAgelPk = dados.fonte;
