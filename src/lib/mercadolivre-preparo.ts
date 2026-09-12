import type { Produto } from "@prisma/client";
import { prisma } from "./db";
import { atributosDaCategoria, preverCategoria } from "./mercadolivre";
import { enriquecerNome, temMedida } from "./nome-produto";

/**
 * A barreira entre o catálogo do lojista e o Mercado Livre.
 *
 * O caminho é `Produto` → nome enriquecido → preditor → **validação por
 * contexto** → categoria → atributos obrigatórios → diagnóstico → e só então
 * publicável. A validação do meio existe porque o preditor do ML responde com
 * a mesma convicção quando acerta e quando erra feio: medido em 02/09/2026,
 * "Papelão hidráulico" devolve *Papéis Higiênicos* em primeiro lugar.
 *
 * Nada aqui inventa dado. Marca, modelo, GTIN, material, aplicação e
 * compatibilidade só entram se estiverem no cadastro. Faltando, o produto sai
 * como REVISAO ou BLOQUEADO, porque anúncio com atributo chutado é reclamação
 * do comprador e reputação do lojista, não problema nosso a ser escondido.
 */

/**
 * Categoria coringa do preditor.
 *
 * `MLB269718` (Águas Minerais) aparece como segunda sugestão em praticamente
 * toda consulta, inclusive "Eletrodo revestido para solda" e "Correia de
 * transmissão". Não é sugestão: é o que o preditor devolve quando acabaram as
 * opções de verdade. Em primeiro lugar, significa que ele não entendeu nada.
 */
const CORINGA = "MLB269718";

/**
 * Palavra que não liga produto a categoria e por isso não conta na conferência.
 * "para veículos" aparece em meia categoria do site: casar por ela aprovaria
 * qualquer coisa.
 */
const VAZIAS = new Set([
  "para", "de", "da", "do", "com", "sem", "em", "no", "na", "por",
  "veiculos", "veiculo", "tipo", "kit", "outros", "outras",
]);

/**
 * Confiança, e o motivo dela. Nada de número mágico: são regras que o lojista
 * consegue ler e discordar.
 */
export type Confianca = "alta" | "media" | "baixa" | "nenhuma";

export interface CategoriaSugerida {
  categoriaId: string;
  categoriaNome: string;
  dominioNome: string;
}

export interface DiagnosticoAtributo {
  id: string;
  nome: string;
  /** required | catalog_required | conditional_required */
  exigencia: string;
  /** Valor achado no cadastro, quando existe. */
  valor?: string;
  /** De onde veio, para o lojista conferir a origem. */
  origem?: string;
  /**
   * O dado não existe no cadastro e não dá para deduzir do que temos. Marca,
   * GTIN e modelo são o caso típico: ou o lojista informa, ou não vai.
   */
  naoInferivel?: boolean;
}

export interface Preparo {
  produtoId: string;
  /** Nome original, para o lojista comparar. */
  nomeOriginal: string;
  nomeEnriquecido: string;
  /** O que o enriquecedor aplicou. */
  aplicou: string[];

  categoria: CategoriaSugerida | null;
  alternativas: CategoriaSugerida[];
  confianca: Confianca;
  /** Por que essa confiança, em português. */
  motivos: string[];

  presentes: DiagnosticoAtributo[];
  faltando: DiagnosticoAtributo[];
  naoInferiveis: DiagnosticoAtributo[];

  estado: "PRONTO" | "REVISAO" | "BLOQUEADO";
  /** O que o lojista precisa fazer, quando não está PRONTO. */
  pendencias: string[];
}

/** Palavras com peso, sem acento e sem as vazias. */
function palavrasUteis(texto: string): string[] {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .split(/[^a-z0-9]+/)
    .filter((p) => p.length >= 4 && !VAZIAS.has(p) && !/^\d+$/.test(p));
}

/**
 * A sugestão do ML combina com o produto?
 *
 * Compara as palavras do nome enriquecido com o nome da categoria e do domínio.
 * "Correia de transmissão 5PK" contra "Correia de Transmissão" casa; "Papelão
 * hidráulico" contra "Papéis Higiênicos" não casa em nada, e é justamente o
 * erro que precisamos pegar.
 *
 * A comparação é por radical de cinco letras porque o ML escreve a categoria no
 * plural: "correia"/"correias", "eletrodo"/"eletrodos", "retentor"/"retentores".
 */
function casaComOProduto(texto: string, c: CategoriaSugerida): boolean {
  const doProduto = palavrasUteis(texto);
  const daCategoria = [...palavrasUteis(c.categoriaNome), ...palavrasUteis(c.dominioNome)];
  return doProduto.some((p) =>
    daCategoria.some((q) => q.startsWith(p.slice(0, 5)) || p.startsWith(q.slice(0, 5))),
  );
}

/**
 * Confiança pelas regras, na ordem em que elas mandam.
 *
 * A primeira regra que decide, decide. É de propósito: quero poder apontar para
 * uma linha quando o lojista perguntar "por que esse ficou em revisão?".
 */
function avaliarConfianca(
  nomeEnriquecido: string,
  grupo: string | null | undefined,
  cruas: CategoriaSugerida[],
): { categoria: CategoriaSugerida | null; alternativas: CategoriaSugerida[]; confianca: Confianca; motivos: string[] } {
  const motivos: string[] = [];

  // O coringa nunca é resposta, em nenhuma posição.
  const reais = cruas.filter((c) => c.categoriaId !== CORINGA);

  // Coringa em primeiro lugar não é um detalhe a anotar: é o preditor dizendo
  // que não entendeu o nome. O que vem depois dele é resto de lista, e aprovar
  // por semelhança de palavra aí seria construir confiança sobre uma resposta
  // que o próprio ML já declarou fraca. Medido em 02/09/2026 com "Papelão
  // hidráulico", que só não passou porque faltava marca.
  if (cruas[0]?.categoriaId === CORINGA) {
    motivos.push(
      "O Mercado Livre não reconheceu o produto: devolveu a categoria genérica que ele usa quando não entende o nome.",
    );
    return { categoria: reais[0] ?? null, alternativas: reais.slice(1), confianca: "nenhuma", motivos };
  }

  if (reais.length === 0) {
    motivos.push("Nenhuma categoria plausível foi sugerida.");
    return { categoria: null, alternativas: [], confianca: "nenhuma", motivos };
  }

  const primeira = reais[0];
  const alternativas = reais.slice(1);

  if (!casaComOProduto(nomeEnriquecido, primeira)) {
    motivos.push(`A categoria sugerida ("${primeira.categoriaNome}") não tem relação com o nome do produto.`);
    return { categoria: primeira, alternativas, confianca: "nenhuma", motivos };
  }
  motivos.push(`O nome do produto e a categoria "${primeira.categoriaNome}" falam da mesma coisa.`);

  // Grupo do catálogo batendo com a categoria é o sinal mais forte que temos: é
  // a classificação que o lojista já fez, e ele conhece o que vende.
  const g = (grupo ?? "").trim();
  const grupoConfirma = g.length >= 3 && casaComOProduto(g, primeira);
  if (grupoConfirma) motivos.push(`O grupo "${g}" do seu catálogo confirma a categoria.`);

  const identificavel = temMedida(nomeEnriquecido) || /\b[A-Z0-9]*\d[A-Z0-9]*\b/.test(nomeEnriquecido);
  if (identificavel) motivos.push("O nome tem medida ou código, que é o que identifica a peça.");

  // Sugestão única e coerente vale mais que a primeira de três parecidas: com
  // várias candidatas, o próprio ML está em dúvida.
  const unica = alternativas.length === 0;
  if (unica) motivos.push("O Mercado Livre não ofereceu outra categoria: não há ambiguidade.");
  else motivos.push(`Existem ${alternativas.length} outra(s) categoria(s) parecida(s); vale conferir antes de publicar.`);

  // Ambiguidade rebaixa a confiança, e não só rende um aviso.
  //
  // "Correia de transmissão 5PK 1230" devolve *Correia de Transmissão* e
  // *Correias Dentadas*, que são peças diferentes. Com grupo e medida batendo,
  // a regra anterior dava confiança alta e o produto ia publicado sozinho para
  // uma das duas. Duas categorias plausíveis é dúvida do próprio ML, e dúvida
  // do ML tem que virar dúvida nossa: no máximo média, ou seja, revisão.
  const confianca: Confianca = !unica
    ? grupoConfirma
      ? "media"
      : "baixa"
    : grupoConfirma && identificavel
      ? "alta"
      : grupoConfirma || identificavel
        ? "media"
        : "baixa";

  return { categoria: primeira, alternativas, confianca, motivos };
}

/**
 * Atributos da categoria, buscados uma vez só.
 *
 * Oitocentos retentores caem todos em MLB375065: sem cache seriam oitocentas
 * chamadas idênticas, e o ML limita requisição por aplicativo. O cache é do
 * processo e sem expiração porque a lista de atributos de uma categoria não
 * muda no meio de uma importação.
 */
const cacheAtributos = new Map<string, Promise<Awaited<ReturnType<typeof atributosDaCategoria>>>>();

export function atributosComCache(categoriaId: string) {
  const guardado = cacheAtributos.get(categoriaId);
  if (guardado) return guardado;
  // Guardo a promessa, não o resultado: dois produtos preparados ao mesmo tempo
  // na mesma categoria fariam duas chamadas se eu esperasse a primeira acabar.
  const p = atributosDaCategoria(categoriaId).catch((e) => {
    cacheAtributos.delete(categoriaId);
    throw e;
  });
  cacheAtributos.set(categoriaId, p);
  return p;
}

/** Quantas categorias distintas o cache já respondeu. Serve ao teste e ao log da importação. */
export function tamanhoDoCache(): number {
  return cacheAtributos.size;
}

export function limparCache(): void {
  cacheAtributos.clear();
}

type ProdutoParaPreparo = Pick<Produto, "id" | "nome" | "marca" | "sku" | "gtin" | "atributos">;

/**
 * O que o cadastro tem para um atributo do ML, e de onde veio.
 *
 * Só lê campo real do produto. Não deduz marca do nome nem material do grupo:
 * "papelão" no nome não prova que o material declarado seja papelão.
 */
function valorDoCadastro(atributoId: string, produto: ProdutoParaPreparo): { valor: string; origem: string } | null {
  const livres = (produto.atributos ?? {}) as Record<string, unknown>;
  const doJson = (chaves: string[]) => {
    for (const c of chaves) {
      const v = livres[c];
      if (typeof v === "string" && v.trim()) return { valor: v.trim(), origem: `atributo "${c}" do produto` };
      if (typeof v === "number") return { valor: String(v), origem: `atributo "${c}" do produto` };
    }
    return null;
  };

  switch (atributoId) {
    case "BRAND":
      // "DIVERSOS" é ausência de marca escrita como se fosse marca.
      return produto.marca && produto.marca.trim().toUpperCase() !== "DIVERSOS"
        ? { valor: produto.marca.trim(), origem: "marca do produto" }
        : doJson(["marca", "brand"]);
    case "GTIN":
      return produto.gtin?.trim() ? { valor: produto.gtin.trim(), origem: "GTIN do produto" } : null;
    case "PART_NUMBER":
      return (
        doJson(["partNumber", "codigoFabricante"]) ??
        (produto.sku?.trim() ? { valor: produto.sku.trim(), origem: "código (SKU) do produto" } : null)
      );
    case "MODEL":
      return doJson(["modelo", "model"]);
    case "MATERIAL":
      return doJson(["material"]);
    default:
      return doJson([atributoId, atributoId.toLowerCase()]);
  }
}

/**
 * Atributo que ninguém deduz: ou está no cadastro, ou o lojista precisa digitar.
 *
 * Deduzir qualquer um destes é inventar. GTIN inventado é código de barras de
 * outro produto; marca inventada é uso indevido de marca alheia; tipo de veículo
 * inventado é a peça chegar no carro errado.
 */
const NAO_INFERIVEIS = new Set(["BRAND", "GTIN", "MODEL", "PART_NUMBER", "VEHICLE_TYPE", "MATERIAL"]);

export interface EntradaPreparo {
  produto: ProdutoParaPreparo;
  /** Grupo do catálogo do lojista, quando existe. É o que dá confiança. */
  grupo?: string | null;
}

/** Prepara um produto: nome, categoria, atributos e veredito. */
export async function prepararProduto({ produto, grupo }: EntradaPreparo): Promise<Preparo> {
  const enriquecido = enriquecerNome({ nome: produto.nome, grupo, marca: produto.marca });

  const cruas = (await preverCategoria(enriquecido.nome, 3)).map((c) => ({
    categoriaId: c.category_id,
    categoriaNome: c.category_name,
    dominioNome: c.domain_name,
  }));

  const { categoria, alternativas, confianca, motivos } = avaliarConfianca(enriquecido.nome, grupo, cruas);

  const base = {
    produtoId: produto.id,
    nomeOriginal: produto.nome,
    nomeEnriquecido: enriquecido.nome,
    aplicou: enriquecido.aplicou,
    categoria,
    alternativas,
    confianca,
    motivos,
  };

  // Sem categoria crível não há atributo a conferir: buscar os obrigatórios de
  // uma categoria errada só produziria uma lista de pendências errada.
  if (!categoria || confianca === "nenhuma") {
    return {
      ...base,
      presentes: [],
      faltando: [],
      naoInferiveis: [],
      estado: "BLOQUEADO",
      pendencias: [
        "Escolha a categoria do Mercado Livre à mão: não consegui identificar uma categoria confiável pelo nome.",
      ],
    };
  }

  const exigidos = await atributosComCache(categoria.categoriaId);

  const presentes: DiagnosticoAtributo[] = [];
  const faltando: DiagnosticoAtributo[] = [];
  const naoInferiveis: DiagnosticoAtributo[] = [];

  for (const a of exigidos) {
    const exigencia = a.tags?.required
      ? "required"
      : a.tags?.catalog_required
        ? "catalog_required"
        : "conditional_required";
    const achado = valorDoCadastro(a.id, produto);
    if (achado) {
      presentes.push({ id: a.id, nome: a.name, exigencia, ...achado });
      continue;
    }
    const d: DiagnosticoAtributo = { id: a.id, nome: a.name, exigencia };
    if (NAO_INFERIVEIS.has(a.id)) {
      d.naoInferivel = true;
      naoInferiveis.push(d);
    }
    faltando.push(d);
  }

  // `EMPTY_GTIN_REASON` existe para o caso de não haver GTIN. Cobrar os dois ao
  // mesmo tempo é contraditório, e cobrar o motivo de quem tem o código é pedir
  // justificativa para uma ausência que não existe.
  const temGtin = presentes.some((p) => p.id === "GTIN");
  const semSentido = (f: DiagnosticoAtributo) => f.id === "EMPTY_GTIN_REASON" && temGtin;

  const pendencias: string[] = [];

  // `conditional_required` não impede publicar: o ML aceita sem, com regra
  // própria (GTIN aceita "motivo de GTIN vazio"). Vira revisão, não bloqueio.
  const bloqueia = faltando.filter((f) => f.exigencia !== "conditional_required" && !semSentido(f));
  for (const f of bloqueia) {
    pendencias.push(`Informe ${f.nome.toLowerCase()}: o Mercado Livre exige e não dá para deduzir do cadastro.`);
  }
  for (const f of faltando) {
    if (f.exigencia !== "conditional_required" || semSentido(f)) continue;
    pendencias.push(`${f.nome} não está no cadastro. Dá para publicar sem, mas o anúncio aparece menos.`);
  }
  if (confianca === "baixa") {
    pendencias.push("Confira a categoria antes de publicar: a sugestão não veio forte.");
  }

  const estado: Preparo["estado"] =
    bloqueia.length > 0 ? "BLOQUEADO" : pendencias.length > 0 || confianca !== "alta" ? "REVISAO" : "PRONTO";

  return { ...base, presentes, faltando, naoInferiveis, estado, pendencias };
}

/**
 * Prepara o catálogo inteiro de uma loja e guarda o resultado.
 *
 * Grava em `AnuncioMercadoLivre`, e nunca em `Produto`: o preparo é a opinião
 * de um canal sobre o produto, não um fato do produto. A mesma peça pode estar
 * pronta para o Mercado Livre e bloqueada na Amazon, e escrever isso no
 * cadastro faria um canal sujar o que o outro lê.
 *
 * Não publica nada. Ao fim, o lojista tem três listas para trabalhar (pronto,
 * revisão, bloqueado) sem que uma única conta tenha sido conectada.
 */
export async function prepararCatalogo(
  tenantId: string,
  opcoes: {
    limite?: number;
    somenteSemAnuncio?: boolean;
    aoAndar?: (feitos: number, total: number) => void;
  } = {},
): Promise<{ pronto: number; revisao: number; bloqueado: number; total: number }> {
  const produtos = await prisma.produto.findMany({
    where: {
      tenantId,
      ativo: true,
      ...(opcoes.somenteSemAnuncio ? { anunciosMl: { none: {} } } : {}),
    },
    select: {
      id: true,
      nome: true,
      marca: true,
      sku: true,
      gtin: true,
      atributos: true,
      categoria: { select: { nome: true } },
    },
    take: opcoes.limite,
    orderBy: { criadoEm: "asc" },
  });

  const contagem = { pronto: 0, revisao: 0, bloqueado: 0, total: produtos.length };

  for (const [i, p] of produtos.entries()) {
    const { categoria, ...produto } = p;
    // A categoria da loja é o "grupo" do catálogo: é a classificação que o
    // lojista já fez, e é ela que dá confiança à previsão.
    const r = await prepararProduto({ produto, grupo: categoria?.nome });

    await prisma.anuncioMercadoLivre.upsert({
      where: { tenantId_produtoId: { tenantId, produtoId: p.id } },
      create: {
        tenantId,
        produtoId: p.id,
        categoriaMl: r.categoria?.categoriaId ?? null,
        preparo: r as unknown as object,
        preparoEstado: r.estado,
        preparadoEm: new Date(),
      },
      // Só o preparo é reescrito: `estado`, `mlbId` e `permalink` pertencem à
      // publicação, e repreparar não pode apagar um anúncio que já está no ar.
      update: {
        categoriaMl: r.categoria?.categoriaId ?? null,
        preparo: r as unknown as object,
        preparoEstado: r.estado,
        preparadoEm: new Date(),
      },
    });

    if (r.estado === "PRONTO") contagem.pronto++;
    else if (r.estado === "REVISAO") contagem.revisao++;
    else contagem.bloqueado++;

    opcoes.aoAndar?.(i + 1, produtos.length);
  }

  return contagem;
}
