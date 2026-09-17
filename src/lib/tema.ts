import { z } from "zod";

/**
 * Tema = tokens e uma experiência de vitrine versionada. Templates podem
 * compor cabeçalho, navegação, home, produto e carrinho; catálogo, identidade,
 * preço e checkout continuam compartilhados. Nenhuma condição por loja.
 */
export const TemaSchema = z.object({
  corPrimaria: z.string().regex(/^#[0-9a-f]{6}$/i).default("#2563eb"),
  corPrimariaTexto: z.string().regex(/^#[0-9a-f]{6}$/i).default("#ffffff"),
  corFundo: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
  corTexto: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
  modo: z.enum(["claro", "escuro"]).default("claro"),
  fonte: z.enum(["sistema", "inter", "poppins", "montserrat", "playfair"]).default("sistema"),
  raio: z.enum(["reto", "suave", "redondo"]).default("suave"),
  /**
   * Layout da página inicial. São composições fixas dos mesmos blocos
   * (banner, categorias, destaques, sobre) — o lojista escolhe uma, não
   * desenha. É o limite entre "personalizar" e "customizar".
   */
  layout: z.enum(["spotlight", "mercado", "distribuidora", "automotivo", "automotivo-premium", "farmacia", "conversao", "classico", "vitrine", "editorial", "minimal"]).default("classico"),
  premium: z.object({
    heroTitulo: z.string().max(120).optional(),
    heroTexto: z.string().max(300).optional(),
    heroSelo: z.string().max(90).optional(),
    buscaTitulo: z.string().max(120).optional(),
    buscaExemplo: z.string().max(100).optional(),
    editorialImagem: z.string().max(1000).regex(/^(https:\/\/|\/(?!\/))[^<>"\\]*$/).optional(),
    editorialImagemSecundaria: z.string().max(1000).regex(/^(https:\/\/|\/(?!\/))[^<>"\\]*$/).optional(),
    editorialTitulo: z.string().max(120).optional(),
    editorialTexto: z.string().max(400).optional(),
    logoEscuroUrl: z.string().max(1000).regex(/^(https:\/\/|\/(?!\/))[^<>"\\]*$/).optional(),
    mostrarNome: z.boolean().optional(),
    etapas: z.array(z.object({
      categoria: z.string().regex(/^[a-z0-9-]+$/).max(100),
      titulo: z.string().max(60),
      texto: z.string().max(180),
      icone: z.enum(["lavagem", "polimento", "protecao", "vitrificacao", "acessorios", "kits", "moto"]),
    })).max(8).optional(),
  }).optional(),
  /**
   * O que a vitrine faz com categoria que não tem foto.
   *
   *   ocultar  a categoria fica fora dos atalhos e da grade de departamentos
   *            da home (continua no menu, no catálogo e no painel). É o
   *            padrão: fileira de círculos onde metade é desenho genérico
   *            parece loja inacabada, e a área mais cara da página vai para
   *            quem tem o que mostrar.
   *   icone    entra com um pictograma escolhido pelo nome da categoria.
   *            Serve a loja que prefere a fileira inteira à fileira bonita.
   *
   * Nasceu como decisão de produto em 09/09/2026 ("deixar apenas a que tem
   * foto") e virou pictograma global em 10/09 sem passar por aqui. Agora é
   * escolha da loja, com o padrão do lado da decisão original.
   */
  categoriaSemImagem: z.enum(["ocultar", "icone"]).default("ocultar"),
});

export const LAYOUTS: Array<{ valor: TemaLoja["layout"]; rotulo: string; descricao: string }> = [
  { valor: "automotivo-premium", rotulo: "Automotivo Premium", descricao: "Experiência completa: navegação fotográfica, banner editorial, galeria ampliada e carrinho lateral. Mantém a identidade da marca em toda a compra." },
  { valor: "spotlight", rotulo: "Spotlight", descricao: "Hero de alto impacto, produto principal e navegação visual. Ideal para performance e marca." },
  { valor: "mercado", rotulo: "Mercado", descricao: "Catálogo denso, departamentos e mais produtos por tela. Ideal para distribuidoras." },
  { valor: "distribuidora", rotulo: "Distribuidora", descricao: "O catálogo denso do Mercado com a sua imagem de banner na abertura. Para distribuidora que já tem arte de marca." },
  { valor: "farmacia", rotulo: "Farmácia", descricao: "Abre pela busca da substância e pelo que a pessoa está sentindo, não pela vitrine. Departamentos de drogaria, selo de receita no card e o farmacêutico responsável à vista. Para farmácia e drogaria." },
  { valor: "automotivo", rotulo: "Automotivo", descricao: "Mostra o catálogo na ordem do serviço: lavar, corrigir, proteger. Para estética automotiva, acessórios e oficina, onde a ordem de aplicação é o que o cliente não sabe." },
  { valor: "conversao", rotulo: "Conversão", descricao: "Oferta clara, benefícios e caminho curto até a compra. Ideal para campanhas." },
  { valor: "classico", rotulo: "Clássico", descricao: "Faixa colorida com slogan, categorias em cartões, destaques em 4 colunas." },
  { valor: "vitrine", rotulo: "Vitrine", descricao: "Banner grande de ponta a ponta, categorias em chips, grade cheia de produtos. Bom para muita foto." },
  { valor: "editorial", rotulo: "Editorial", descricao: "Texto de um lado, imagem do outro; categorias com foto; poucos destaques, grandes; bloco “sobre”. Bom para marca." },
  { valor: "minimal", rotulo: "Minimal", descricao: "Sem banner: slogan centralizado e produtos em 3 colunas. Bom para catálogo enxuto." },
];

export type TemaLoja = z.infer<typeof TemaSchema>;

/**
 * Os layouts que existem, na ordem em que o painel oferece. Quem precisa da
 * lista (o MCP, a landing) lê daqui em vez de repetir: em 17/09/2026 havia
 * quatro contagens diferentes no repositório — dez no schema, "sete" na
 * landing, "oito" num comentário e sete na descrição do MCP, cujo enum
 * aceitava nove e deixava o Automotivo Premium fora do alcance de um agente.
 */
export const VALORES_LAYOUT = LAYOUTS.map((l) => l.valor);

/**
 * Aplica mudanças sobre o tema atual e devolve null se o resultado não for
 * válido. Existe porque escrever tema sem validar não falha na hora: falha
 * na leitura seguinte, e `lerTema` troca o tema inteiro pelo padrão — um
 * layout inexistente vindo de fora apagaria cor, fonte e cantos da loja.
 */
export function mesclarTema(atual: TemaLoja, mudancas: Partial<TemaLoja>): TemaLoja | null {
  const r = TemaSchema.safeParse({ ...atual, ...mudancas });
  return r.success ? r.data : null;
}

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
/** Luminância relativa (WCAG) de uma cor hex. */
function luminancia(hex: string): number {
  const c = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => {
    const v = parseInt(c.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contraste(a: string, b: string): number {
  const [la, lb] = [luminancia(a), luminancia(b)];
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/**
 * Texto sobre a cor primária: se o que veio não passa de 4.5:1 (AA), troca
 * por branco ou preto — o que der mais contraste. Botão ilegível não sai.
 */
export function corTextoLegivel(fundo: string, preferida: string): string {
  if (contraste(fundo, preferida) >= 4.5) return preferida;
  return contraste(fundo, "#ffffff") >= contraste(fundo, "#111111") ? "#ffffff" : "#111111";
}

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
--primary:${tema.corPrimaria};--primary-foreground:${corTextoLegivel(tema.corPrimaria, tema.corPrimariaTexto)};
--radius:${raio};--font-sans:${fonte};
--ck-bg:${fundo};--ck-surface:${superficie};--ck-surface-muted:${suave};--ck-border:${borda};
--ck-fg:${texto};--ck-fg-muted:${textoSuave};
--ck-accent:${tema.corPrimaria};--ck-accent-fg:${corTextoLegivel(tema.corPrimaria, tema.corPrimariaTexto)};
--ck-radius:${raio};--ck-font:${fonte};
color-scheme:${escuro ? "dark" : "light"};
}`;
}
