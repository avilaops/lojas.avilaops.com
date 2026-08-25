import { z } from "zod";
import { TemaSchema, type TemaLoja } from "./tema";

export const SegmentoSchema = z.enum([
  "moda", "beleza", "casa", "alimentos", "saude", "tecnologia", "automotivo", "agro", "servicos", "outro",
]);

export const PersonalidadeSchema = z.enum([
  "sofisticada", "acolhedora", "ousada", "minimalista", "artesanal", "tecnologica",
]);

export const IdentidadeSchema = z.object({
  segmento: SegmentoSchema.default("outro"),
  publico: z.string().max(240).default(""),
  diferencial: z.string().max(300).default(""),
  personalidade: z.array(PersonalidadeSchema).min(1).max(3).default(["sofisticada"]),
  tomDeVoz: z.enum(["direto", "proximo", "especialista", "inspirador"]).default("direto"),
  objetivo: z.enum(["vender", "posicionar", "captar", "lancar"]).default("vender"),
  estiloFotografico: z.enum(["editorial", "produto", "lifestyle", "natural", "tecnico"]).default("produto"),
  corApoio: z.string().regex(/^#[0-9a-f]{6}$/i).default("#dbeafe"),
  assinatura: z.string().max(180).default(""),
  direcaoFotografica: z.string().max(500).default(""),
  palavrasChave: z.array(z.string().max(40)).max(8).default([]),
});

export type IdentidadeLoja = z.infer<typeof IdentidadeSchema>;
export type DiagnosticoMarca = Pick<IdentidadeLoja, "segmento" | "publico" | "diferencial" | "personalidade" | "tomDeVoz" | "objetivo" | "estiloFotografico">;

type Receita = Pick<TemaLoja, "corPrimaria" | "corPrimariaTexto" | "corFundo" | "corTexto" | "modo" | "fonte" | "raio" | "layout"> & { apoio: string };

const RECEITAS: Record<IdentidadeLoja["personalidade"][number], Receita> = {
  sofisticada: { corPrimaria: "#8b5e3c", corPrimariaTexto: "#ffffff", corFundo: "#f7f3ed", corTexto: "#241c17", modo: "claro", fonte: "playfair", raio: "reto", layout: "editorial", apoio: "#d8c4ad" },
  acolhedora: { corPrimaria: "#a34832", corPrimariaTexto: "#ffffff", corFundo: "#fff9f2", corTexto: "#35221d", modo: "claro", fonte: "poppins", raio: "redondo", layout: "classico", apoio: "#f2c9a5" },
  ousada: { corPrimaria: "#5b35f2", corPrimariaTexto: "#ffffff", corFundo: "#f7f5ff", corTexto: "#171129", modo: "claro", fonte: "montserrat", raio: "suave", layout: "vitrine", apoio: "#c9bcff" },
  minimalista: { corPrimaria: "#171717", corPrimariaTexto: "#ffffff", corFundo: "#fafafa", corTexto: "#171717", modo: "claro", fonte: "inter", raio: "reto", layout: "minimal", apoio: "#dedede" },
  artesanal: { corPrimaria: "#78613b", corPrimariaTexto: "#ffffff", corFundo: "#fbf7ed", corTexto: "#302a20", modo: "claro", fonte: "playfair", raio: "suave", layout: "editorial", apoio: "#d9c59e" },
  tecnologica: { corPrimaria: "#2563eb", corPrimariaTexto: "#ffffff", corFundo: "#070b14", corTexto: "#f8fafc", modo: "escuro", fonte: "inter", raio: "suave", layout: "vitrine", apoio: "#38bdf8" },
};

const SEGMENTO_COR: Partial<Record<IdentidadeLoja["segmento"], string>> = {
  beleza: "#b14f78", moda: "#6d3c63", alimentos: "#a84825", saude: "#167b68", tecnologia: "#2563eb",
  automotivo: "#cf2e2e", agro: "#397047", casa: "#8b5e3c",
};

const FOTOGRAFIA: Record<IdentidadeLoja["estiloFotografico"], string> = {
  editorial: "Composição editorial, luz controlada, respiro e enquadramentos que valorizem textura e acabamento.",
  produto: "Produto em primeiro plano, fundo limpo, luz uniforme e cores fiéis; uma foto de contexto por coleção.",
  lifestyle: "Produto em uso real, luz natural, movimento sutil e cenários coerentes com o público da marca.",
  natural: "Luz suave, materiais orgânicos, imperfeições honestas e atmosfera próxima, sem aparência de banco de imagens.",
  tecnico: "Detalhes, escala, aplicação e desempenho visíveis; fundos neutros e enquadramentos objetivos.",
};

export function lerIdentidade(bruto: unknown): IdentidadeLoja {
  const r = IdentidadeSchema.safeParse(bruto ?? {});
  return r.success ? r.data : IdentidadeSchema.parse({});
}

export function criarDirecaoVisual(diagnostico: DiagnosticoMarca, nome = "Sua marca"): { identidade: IdentidadeLoja; tema: TemaLoja } {
  const principal = diagnostico.personalidade[0] ?? "sofisticada";
  const receita = RECEITAS[principal];
  const corPrimaria = SEGMENTO_COR[diagnostico.segmento] ?? receita.corPrimaria;
  const personalidade = diagnostico.personalidade.map((x) => x.replace(/^./, (c) => c.toUpperCase()));
  const palavrasChave = Array.from(new Set([...personalidade, diagnostico.segmento, diagnostico.tomDeVoz])).slice(0, 8);
  const assinatura = diagnostico.diferencial
    ? `${nome}: ${diagnostico.diferencial.replace(/[.!?]+$/, "")}.`
    : `${nome}, uma experiência ${principal} feita para o seu público.`;
  const identidade = IdentidadeSchema.parse({
    ...diagnostico,
    corApoio: receita.apoio,
    assinatura,
    direcaoFotografica: FOTOGRAFIA[diagnostico.estiloFotografico],
    palavrasChave,
  });
  const tema = TemaSchema.parse({ ...receita, corPrimaria });
  return { identidade, tema };
}

export const SEGMENTOS = [
  ["moda", "Moda e acessórios"], ["beleza", "Beleza e autocuidado"], ["casa", "Casa e decoração"],
  ["alimentos", "Alimentos e bebidas"], ["saude", "Saúde e bem-estar"], ["tecnologia", "Tecnologia"],
  ["automotivo", "Automotivo"], ["agro", "Agro e campo"], ["servicos", "Serviços"], ["outro", "Outro"],
] as const;

export const PERSONALIDADES = [
  ["sofisticada", "Sofisticada"], ["acolhedora", "Acolhedora"], ["ousada", "Ousada"],
  ["minimalista", "Minimalista"], ["artesanal", "Artesanal"], ["tecnologica", "Tecnológica"],
] as const;
