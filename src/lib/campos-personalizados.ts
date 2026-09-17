/**
 * Campos personalizados do catálogo.
 *
 * O `Produto.atributos` sempre existiu e é livre: serve para gravar o que veio
 * da planilha, e nenhuma tela sabe o que fazer com ele. Isso basta para
 * guardar, não para *pedir*: sem definição, o painel não sabe que rótulo
 * mostrar, que tipo validar, nem se aquilo pode ir ao ar.
 *
 * Aqui é o outro lado: a loja declara quais campos ela acrescenta ao produto
 * ("Rendimento por litro", "Safra", "Comprimento da lâmina"), e o painel passa
 * a perguntar, validar e publicar. É a mesma ideia do segmento — o que a loja
 * vende é dado, não código —, levada ao nível do item: nenhuma loja precisa de
 * uma coluna nova no schema para ter o campo dela.
 *
 * Duas decisões que valem explicação:
 *
 * - **A chave é derivada do rótulo uma vez e nunca mais muda.** Renomear
 *   "Safra" para "Ano da safra" mantém `safra` como chave, porque a chave é o
 *   que liga a definição ao valor gravado em mil produtos. Chave que segue o
 *   rótulo perderia o catálogo inteiro num acerto de texto.
 * - **Rascunho não existe para a vitrine.** O lojista precisa conseguir
 *   desenhar o campo e preencher cem produtos antes de a loja mostrar meia
 *   ficha para o cliente.
 */

export const TIPOS_CAMPO = [
  "texto",
  "texto-longo",
  "numero",
  "booleano",
  "data",
  "escolha",
  "url",
  "video",
  "imagem",
] as const;
export type TipoCampo = (typeof TIPOS_CAMPO)[number];

export const ROTULO_TIPO: Record<TipoCampo, string> = {
  texto: "Texto curto",
  "texto-longo": "Texto longo",
  numero: "Número",
  booleano: "Sim ou não",
  data: "Data",
  escolha: "Lista de opções",
  url: "Link",
  video: "Vídeo (YouTube ou Vimeo)",
  imagem: "Imagem",
};

export const AJUDA_TIPO: Record<TipoCampo, string> = {
  texto: "Uma linha: material, origem, voltagem",
  "texto-longo": "Vários parágrafos: modo de usar, cuidados",
  numero: "Só número, com unidade opcional ao lado",
  booleano: "Aparece na ficha como Sim ou Não",
  data: "Validade, safra, data de lançamento",
  escolha: "O valor tem de ser uma das opções que você listar",
  url: "Endereço externo: manual do fabricante, certificado",
  video: "Link do YouTube ou do Vimeo; a ficha mostra o vídeo",
  imagem: "Endereço de uma imagem já enviada à loja",
};

export interface CampoPersonalizado {
  /** Estável, derivada do rótulo na criação. Liga definição ao valor gravado. */
  chave: string;
  rotulo: string;
  tipo: TipoCampo;
  /** Texto de apoio mostrado a quem preenche o produto. */
  ajuda?: string;
  /** Sufixo exibido na ficha, só em `numero`: "ml", "kg", "m²". */
  unidade?: string;
  /** Valores aceitos, só em `escolha`. */
  opcoes?: string[];
  /** rascunho | ativo. Rascunho não chega à vitrine. */
  estado: "rascunho" | "ativo";
}

const LIMITE_CAMPOS = 30;

/** Rótulo → chave. Mesma normalização do resto do catálogo: sem acento, sem símbolo. */
export function chaveDoRotulo(rotulo: string): string {
  return rotulo
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/**
 * Lê as definições gravadas, descartando o que não dá para exibir.
 *
 * Silencioso de propósito: definição corrompida (importação antiga, edição
 * manual do JSON) some da lista em vez de derrubar a página do produto do
 * cliente. Quem precisa saber é o painel, que mostra o que sobrou.
 */
export function lerDefinicoes(bruto: unknown): CampoPersonalizado[] {
  if (!Array.isArray(bruto)) return [];
  const vistas = new Set<string>();
  const saida: CampoPersonalizado[] = [];
  for (const item of bruto) {
    const c = item as Partial<CampoPersonalizado>;
    const rotulo = typeof c?.rotulo === "string" ? c.rotulo.trim() : "";
    const chave = typeof c?.chave === "string" && c.chave ? c.chave : chaveDoRotulo(rotulo);
    if (!rotulo || !chave || vistas.has(chave)) continue;
    if (!TIPOS_CAMPO.includes(c?.tipo as TipoCampo)) continue;
    vistas.add(chave);
    const opcoes = Array.isArray(c?.opcoes)
      ? c.opcoes.filter((o): o is string => typeof o === "string" && o.trim().length > 0).map((o) => o.trim()).slice(0, 50)
      : [];
    // Lista de opções sem opção nenhuma não é um campo: não há o que escolher.
    if (c!.tipo === "escolha" && opcoes.length === 0) continue;
    saida.push({
      chave,
      rotulo: rotulo.slice(0, 60),
      tipo: c!.tipo as TipoCampo,
      ...(typeof c?.ajuda === "string" && c.ajuda.trim() ? { ajuda: c.ajuda.trim().slice(0, 160) } : {}),
      ...(typeof c?.unidade === "string" && c.unidade.trim() ? { unidade: c.unidade.trim().slice(0, 12) } : {}),
      ...(opcoes.length ? { opcoes } : {}),
      estado: c?.estado === "ativo" ? "ativo" : "rascunho",
    });
    if (saida.length >= LIMITE_CAMPOS) break;
  }
  return saida;
}

/** Valores gravados no produto. Tudo vira texto: é o que a ficha imprime. */
export function lerValores(bruto: unknown): Record<string, string> {
  if (!bruto || typeof bruto !== "object" || Array.isArray(bruto)) return {};
  const saida: Record<string, string> = {};
  for (const [chave, valor] of Object.entries(bruto as Record<string, unknown>)) {
    if (valor === null || valor === undefined) continue;
    const texto = typeof valor === "string" ? valor : String(valor);
    if (texto.trim()) saida[chave] = texto.trim().slice(0, 2000);
  }
  return saida;
}

// ── Vídeo ───────────────────────────────────────────────────────────────

export interface Video {
  plataforma: "youtube" | "vimeo";
  id: string;
  /** URL de incorporação, pronta para o <iframe>. */
  embed: string;
}

/**
 * Link de vídeo → dados de incorporação.
 *
 * Aceita as formas que as pessoas realmente colam (watch, youtu.be, shorts,
 * embed) e devolve `null` para qualquer outra coisa. Devolver `null` importa:
 * é o que impede um endereço arbitrário colado no painel de virar `<iframe>`
 * na loja de um cliente.
 */
export function lerVideo(entrada: string): Video | null {
  const texto = entrada.trim();
  if (!texto) return null;
  let url: URL;
  try {
    url = new URL(texto);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const host = url.hostname.replace(/^www\./, "").toLowerCase();

  if (host === "youtu.be") {
    const id = url.pathname.slice(1).split("/")[0];
    return /^[\w-]{6,20}$/.test(id) ? { plataforma: "youtube", id, embed: `https://www.youtube-nocookie.com/embed/${id}` } : null;
  }
  if (host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com") {
    const partes = url.pathname.split("/").filter(Boolean);
    const id = url.searchParams.get("v") ?? (["embed", "shorts", "v"].includes(partes[0]) ? partes[1] : "");
    return id && /^[\w-]{6,20}$/.test(id)
      ? { plataforma: "youtube", id, embed: `https://www.youtube-nocookie.com/embed/${id}` }
      : null;
  }
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const id = url.pathname.split("/").filter(Boolean).find((p) => /^\d{6,12}$/.test(p)) ?? "";
    return id ? { plataforma: "vimeo", id, embed: `https://player.vimeo.com/video/${id}` } : null;
  }
  return null;
}

// ── Escrita ─────────────────────────────────────────────────────────────

/**
 * Valida um valor contra a definição do campo.
 *
 * Devolve `null` quando o valor deve ser apagado (vazio) e lança quando é
 * inválido — quem chama decide se isso vira 422 no painel ou linha ignorada
 * na importação.
 */
export class ErroCampo extends Error {}

export function normalizarValor(campo: CampoPersonalizado, bruto: unknown): string | null {
  const texto = bruto === null || bruto === undefined ? "" : String(bruto).trim();
  if (!texto) return null;

  switch (campo.tipo) {
    case "numero": {
      // Aceita "12,5" como o brasileiro escreve; guarda com ponto.
      const n = Number(texto.replace(/\./g, "").replace(",", "."));
      if (!Number.isFinite(n)) throw new ErroCampo(`"${campo.rotulo}" espera um número.`);
      return String(n);
    }
    case "booleano":
      return ["sim", "true", "1", "verdadeiro"].includes(texto.toLowerCase()) ? "sim" : "nao";
    case "data": {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) throw new ErroCampo(`"${campo.rotulo}" espera uma data.`);
      return texto;
    }
    case "escolha": {
      const escolha = (campo.opcoes ?? []).find((o) => o.toLowerCase() === texto.toLowerCase());
      if (!escolha) throw new ErroCampo(`"${campo.rotulo}" só aceita: ${(campo.opcoes ?? []).join(", ")}.`);
      return escolha;
    }
    case "video": {
      if (!lerVideo(texto)) throw new ErroCampo(`"${campo.rotulo}" espera um link do YouTube ou do Vimeo.`);
      return texto;
    }
    case "url":
    case "imagem": {
      // http(s) só: `javascript:` colado num campo de link vira XSS na ficha.
      try {
        const u = new URL(texto);
        if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error();
      } catch {
        throw new ErroCampo(`"${campo.rotulo}" espera um endereço começando com https://`);
      }
      return texto;
    }
    case "texto-longo":
      return texto.slice(0, 2000);
    case "texto":
      return texto.slice(0, 300);
  }
}

/**
 * Entrada do painel → valores gravados no produto.
 *
 * Chave sem definição é descartada: o produto não carrega campo que a loja
 * apagou. Rascunho é aceito na escrita (o lojista preenche antes de publicar);
 * quem filtra por estado é a leitura da ficha.
 */
export function normalizarValores(
  definicoes: CampoPersonalizado[],
  entrada: Record<string, unknown>,
): Record<string, string> {
  const saida: Record<string, string> = {};
  for (const campo of definicoes) {
    if (!(campo.chave in entrada)) continue;
    const valor = normalizarValor(campo, entrada[campo.chave]);
    if (valor !== null) saida[campo.chave] = valor;
  }
  return saida;
}

// ── Leitura ─────────────────────────────────────────────────────────────

export interface LinhaFicha {
  chave: string;
  rotulo: string;
  tipo: TipoCampo;
  /** Já formatado para leitura humana. */
  valor: string;
  /** Só em `video`: o que o <iframe> precisa. */
  video?: Video;
}

/**
 * O que a ficha do produto publica: campo ativo, com valor, na ordem definida
 * pela loja. Campo em rascunho e campo vazio simplesmente não existem aqui.
 */
export function fichaPersonalizada(definicoes: CampoPersonalizado[], valores: Record<string, string>): LinhaFicha[] {
  const linhas: LinhaFicha[] = [];
  for (const campo of definicoes) {
    if (campo.estado !== "ativo") continue;
    const valor = valores[campo.chave];
    if (!valor) continue;

    if (campo.tipo === "video") {
      const video = lerVideo(valor);
      // Link que deixou de ser válido não vira <iframe> quebrado na loja.
      if (video) linhas.push({ chave: campo.chave, rotulo: campo.rotulo, tipo: campo.tipo, valor, video });
      continue;
    }
    linhas.push({ chave: campo.chave, rotulo: campo.rotulo, tipo: campo.tipo, valor: exibir(campo, valor) });
  }
  return linhas;
}

function exibir(campo: CampoPersonalizado, valor: string): string {
  switch (campo.tipo) {
    case "booleano":
      return valor === "sim" ? "Sim" : "Não";
    case "numero": {
      const n = Number(valor);
      /**
       * `min2` agrupa a partir de 10.000 e deixa 2019 como 2019. Sem isso, um
       * campo "Safra" tipado como número sairia "2.019" na ficha — e safra,
       * ano de fabricação e número de série são justamente o que mais se
       * cadastra como número numa loja.
       */
      const texto = Number.isFinite(n)
        ? new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3, useGrouping: "min2" }).format(n)
        : valor;
      return campo.unidade ? `${texto} ${campo.unidade}` : texto;
    }
    case "data": {
      const [ano, mes, dia] = valor.split("-");
      return dia ? `${dia}/${mes}/${ano}` : valor;
    }
    default:
      return valor;
  }
}
