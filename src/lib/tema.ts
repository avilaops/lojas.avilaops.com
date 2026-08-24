import { z } from "zod";

/**
 * Tema de uma loja = tokens, nunca layout.
 *
 * É a fronteira do produto: o cliente escolhe cor, fonte, raio e modo. O que
 * ele não escolhe é onde fica o menu, quantas colunas tem a vitrine ou como é
 * o checkout — isso é igual em todas as lojas, e é o que mantém o custo de
 * criação em minutos e o de manutenção em zero.
 */
export const TemaSchema = z.object({
  corPrimaria: z.string().regex(/^#[0-9a-f]{6}$/i).default("#2563eb"),
  corPrimariaTexto: z.string().regex(/^#[0-9a-f]{6}$/i).default("#ffffff"),
  corFundo: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
  corTexto: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
  modo: z.enum(["claro", "escuro"]).default("claro"),
  fonte: z.enum(["sistema", "inter", "poppins", "montserrat", "playfair"]).default("sistema"),
  raio: z.enum(["reto", "suave", "redondo"]).default("suave"),
});

export type TemaLoja = z.infer<typeof TemaSchema>;

const FONTES: Record<TemaLoja["fonte"], { family: string; google?: string }> = {
  sistema: { family: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' },
  inter: { family: "Inter, system-ui, sans-serif", google: "Inter:wght@400;600;800" },
  poppins: { family: "Poppins, system-ui, sans-serif", google: "Poppins:wght@400;600;800" },
  montserrat: { family: "Montserrat, system-ui, sans-serif", google: "Montserrat:wght@400;600;800" },
  playfair: { family: '"Playfair Display", Georgia, serif', google: "Playfair+Display:wght@400;700" },
};

const RAIOS: Record<TemaLoja["raio"], string> = { reto: "0px", suave: "0.625rem", redondo: "1.25rem" };

export function lerTema(bruto: unknown): TemaLoja {
  const r = TemaSchema.safeParse(bruto ?? {});
  return r.success ? r.data : TemaSchema.parse({});
}

export function fonteGoogleHref(tema: TemaLoja): string | null {
  const g = FONTES[tema.fonte].google;
  return g ? `https://fonts.googleapis.com/css2?family=${g}&display=swap` : null;
}

/**
 * Gera o bloco `:root { ... }` que alimenta o Tailwind (globals.css) e o
 * checkout (@avilaops/checkout/tokens.css, prefixo --ck-). As duas paletas
 * lêem os mesmos valores, então tema da loja e tela de pagamento nunca
 * divergem.
 */
export function cssDoTema(tema: TemaLoja): string {
  const escuro = tema.modo === "escuro";
  const fundo = tema.corFundo ?? (escuro ? "#0b0b0c" : "#ffffff");
  const texto = tema.corTexto ?? (escuro ? "#fafafa" : "#18181b");
  const superficie = escuro ? "#141416" : "#ffffff";
  const suave = escuro ? "#1c1c1f" : "#f6f6f7";
  const borda = escuro ? "#2a2a2e" : "#e4e4e7";
  const textoSuave = escuro ? "#a1a1aa" : "#71717a";
  const raio = RAIOS[tema.raio];
  const fonte = FONTES[tema.fonte].family;

  return `:root{
--background:${fundo};--foreground:${texto};
--card:${superficie};--card-foreground:${texto};
--muted:${suave};--muted-foreground:${textoSuave};
--border:${borda};--input:${borda};--ring:${tema.corPrimaria};
--primary:${tema.corPrimaria};--primary-foreground:${tema.corPrimariaTexto};
--radius:${raio};--font-sans:${fonte};
--ck-bg:${fundo};--ck-surface:${superficie};--ck-surface-muted:${suave};--ck-border:${borda};
--ck-fg:${texto};--ck-fg-muted:${textoSuave};
--ck-accent:${tema.corPrimaria};--ck-accent-fg:${tema.corPrimariaTexto};
--ck-radius:${raio};--ck-font:${fonte};
color-scheme:${escuro ? "dark" : "light"};
}`;
}
