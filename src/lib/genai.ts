import { GoogleGenAI, Type } from "@google/genai";
import { z } from "zod";

/**
 * Modelo Padrão do Gemini (override via GEMINI_MODEL).
 */
export const MODELO_GEMINI_PADRAO = process.env.GEMINI_MODEL || "gemini-2.5-flash";

/**
 * Instancia a SDK oficial @google/genai procurando estritamente por GEMINI_API_KEY ou GOOGLE_GENAI_API_KEY.
 * Não utiliza chaves genéricas de infraestrutura.
 */
export function obterGoogleGenAI(): { ai: GoogleGenAI; modelo: string } | null {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY;
  if (!apiKey) return null;
  return {
    ai: new GoogleGenAI({ apiKey }),
    modelo: MODELO_GEMINI_PADRAO,
  };
}

// ── SCHEMAS ZOD PARA DADOS DE PRODUTO ────────────────────────────────────────

export const AtributoProdutoSchema = z.object({
  nome: z.string().min(1),
  valor: z.union([z.string(), z.number(), z.boolean()]),
  confianca: z.enum(["alta", "media", "baixa"]),
  origem: z.enum(["nome_produto", "estimativa_ia", "contexto"]),
});

export const LogisticaEstimadaSchema = z.object({
  pesoEstimadoGramas: z.number().positive().nullable(),
  comprimentoEstimadoCm: z.number().positive().nullable(),
  larguraEstimadoCm: z.number().positive().nullable(),
  alturaEstimadoCm: z.number().positive().nullable(),
  requerConfirmacao: z.literal(true),
});

export const DescricaoEstruturadaSchema = z.object({
  introducao: z.string().max(400),
  beneficios: z.array(z.string()).max(6),
  especificacoes: z.array(z.string()).max(10),
  observacoes: z.string().max(300).optional(),
});

export const ProdutoGeradoSchema = z.object({
  tituloSeo: z.string().min(1).max(70),
  descricaoCurta: z.string().max(250),
  descricao: DescricaoEstruturadaSchema,
  palavrasChave: z.array(z.string()).max(10),
  logistica: LogisticaEstimadaSchema,
  atributos: z.array(AtributoProdutoSchema),
});

export type SaidaProdutoGerado = z.infer<typeof ProdutoGeradoSchema>;

export interface EntradaCopyProduto {
  nome: string;
  marca?: string;
  segmento?: string;
  contexto?: string;
}

// ── SCHEMAS ZOD PARA IDENTIDADE DA MARCA ──────────────────────────────────────

export const DiagnosticoMarcaSchema = z.object({
  publicoAlvo: z.string().max(300),
  propostaValor: z.string().max(300),
  diferenciais: z.array(z.string()).max(5),
  posicionamento: z.string().max(250),
  tomDeVoz: z.enum(["direto", "proximo", "especialista", "inspirador"]),
  palavrasUsar: z.array(z.string()).max(8),
  palavrasEvitar: z.array(z.string()).max(8),
  slogan: z.string().max(90),
  descricaoCurta: z.string().max(200),
  pilaresComunicacao: z.array(z.string()).max(4),
});

export type SaidaDiagnosticoMarca = z.infer<typeof DiagnosticoMarcaSchema>;

export interface EntradaDiagnosticoMarca {
  nome: string;
  segmento?: string;
  personalidade?: string[];
  contexto?: string;
}

// ── SCHEMAS ZOD PARA SEO DE CATEGORIA ────────────────────────────────────────

export const SeoCategoriaGeradaSchema = z.object({
  titulo: z.string().trim().min(3).max(70),
  descricao: z.string().trim().min(40).max(170),
  palavrasChave: z.array(z.string().trim().min(2).max(50)).max(10),
});

export type SeoCategoriaGerada = z.infer<typeof SeoCategoriaGeradaSchema>;

export interface EntradaSeoCategoria {
  loja: string;
  segmento: string;
  categoria: string;
  descricaoAtual?: string | null;
  produtos: string[];
  marcas: string[];
  motos: string[];
  contexto?: string;
}

// ── FUNÇÕES PRINCIPAIS DO MOTOR SEMÂNTICO ────────────────────────────────────

/**
 * Gera rascunho de catálogo de produto.
 * IMPORTANTE: Os dados de logística são puramente ESTIMATIVAS e requerem confirmação do lojista
 * para que o cálculo determinístico do CepCerto funcione corretamente.
 */
export async function gerarCopyProduto(
  entrada: EntradaCopyProduto
): Promise<{ dados: SaidaProdutoGerado; modelo: string } | null> {
  const cliente = obterGoogleGenAI();
  if (!cliente) return null;

  try {
    const prompt = `Gere o rascunho semântico e comercial de catálogo para o produto a seguir.

Nome do Produto: ${entrada.nome}
Marca: ${entrada.marca || "Não informada"}
Segmento da Loja: ${entrada.segmento || "geral"}
Contexto Adicional: ${entrada.contexto || "Nenhum"}`;

    const response = await cliente.ai.models.generateContent({
      model: cliente.modelo,
      contents: prompt,
      config: {
        systemInstruction: `Você é o mecanismo semântico de enriquecimento de catálogo do Lojas Ávila Ops.
NÃO INVENTE certificações, garantias, dados operacionais reais ou prazos.
Diferencie fatos fornecidos no nome de meras estimativas da IA.
Forneça apenas estimativas para o peso em gramas e dimensões em cm.
Marque sempre o campo requerConfirmacao como true para os dados de logística.`,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            tituloSeo: { type: Type.STRING, description: "Título otimizado para SEO, max 70 caracteres" },
            descricaoCurta: { type: Type.STRING, description: "Frase persuasiva de destaque, max 250 caracteres" },
            descricao: {
              type: Type.OBJECT,
              properties: {
                introducao: { type: Type.STRING },
                beneficios: { type: Type.ARRAY, items: { type: Type.STRING } },
                especificacoes: { type: Type.ARRAY, items: { type: Type.STRING } },
                observacoes: { type: Type.STRING },
              },
              required: ["introducao", "beneficios", "especificacoes"],
            },
            palavrasChave: { type: Type.ARRAY, items: { type: Type.STRING } },
            logistica: {
              type: Type.OBJECT,
              properties: {
                pesoEstimadoGramas: { type: Type.NUMBER, nullable: true },
                comprimentoEstimadoCm: { type: Type.NUMBER, nullable: true },
                larguraEstimadoCm: { type: Type.NUMBER, nullable: true },
                alturaEstimadoCm: { type: Type.NUMBER, nullable: true },
                requerConfirmacao: { type: Type.BOOLEAN },
              },
              required: [
                "pesoEstimadoGramas",
                "comprimentoEstimadoCm",
                "larguraEstimadoCm",
                "alturaEstimadoCm",
                "requerConfirmacao",
              ],
            },
            atributos: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  nome: { type: Type.STRING },
                  valor: { type: Type.STRING },
                  confianca: { type: Type.STRING, enum: ["alta", "media", "baixa"] },
                  origem: { type: Type.STRING, enum: ["nome_produto", "estimativa_ia", "contexto"] },
                },
                required: ["nome", "valor", "confianca", "origem"],
              },
            },
          },
          required: ["tituloSeo", "descricaoCurta", "descricao", "palavrasChave", "logistica", "atributos"],
        },
      },
    });

    if (!response.text) return null;
    const jsonBruto = JSON.parse(response.text);
    const validacao = ProdutoGeradoSchema.safeParse(jsonBruto);

    if (!validacao.success) {
      console.warn("[genai] Falha na validação Zod da resposta do Gemini para produto:", validacao.error);
      return null;
    }

    return { dados: validacao.data, modelo: cliente.modelo };
  } catch (erro) {
    console.error("[genai] Erro ao gerar copy do produto:", erro);
    return null;
  }
}

/**
 * Gera a identidade semântica e diagnóstico completo da marca.
 */
export async function gerarDiagnosticoMarca(
  entrada: EntradaDiagnosticoMarca
): Promise<{ dados: SaidaDiagnosticoMarca; modelo: string } | null> {
  const cliente = obterGoogleGenAI();
  if (!cliente) return null;

  try {
    const prompt = `Gere a identidade semântica completa para a loja brasileira a seguir.

Nome da Loja: ${entrada.nome}
Segmento: ${entrada.segmento || "comércio"}
Personalidades desejadas: ${(entrada.personalidade || []).join(", ") || "não informada"}
Contexto: ${entrada.contexto || "Nenhum"}`;

    const response = await cliente.ai.models.generateContent({
      model: cliente.modelo,
      contents: prompt,
      config: {
        systemInstruction: `Você é o estrategista de marca e tom de voz do Lojas Ávila Ops.
Escreva em Português do Brasil autêntico, próximo e sem clichês publicitários ou superlativos vazios.
Respeite estritamente os limites de caracteres e o formato especificado.`,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            publicoAlvo: { type: Type.STRING },
            propostaValor: { type: Type.STRING },
            diferenciais: { type: Type.ARRAY, items: { type: Type.STRING } },
            posicionamento: { type: Type.STRING },
            tomDeVoz: {
              type: Type.STRING,
              enum: ["direto", "proximo", "especialista", "inspirador"],
            },
            palavrasUsar: { type: Type.ARRAY, items: { type: Type.STRING } },
            palavrasEvitar: { type: Type.ARRAY, items: { type: Type.STRING } },
            slogan: { type: Type.STRING },
            descricaoCurta: { type: Type.STRING },
            pilaresComunicacao: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: [
            "publicoAlvo",
            "propostaValor",
            "diferenciais",
            "posicionamento",
            "tomDeVoz",
            "palavrasUsar",
            "palavrasEvitar",
            "slogan",
            "descricaoCurta",
            "pilaresComunicacao",
          ],
        },
      },
    });

    if (!response.text) return null;
    const jsonBruto = JSON.parse(response.text);
    const validacao = DiagnosticoMarcaSchema.safeParse(jsonBruto);

    if (!validacao.success) {
      console.warn("[genai] Falha na validação Zod da resposta de identidade de marca:", validacao.error);
      return null;
    }

    return { dados: validacao.data, modelo: cliente.modelo };
  } catch (erro) {
    console.error("[genai] Erro ao gerar diagnóstico de marca:", erro);
    return null;
  }
}

/**
 * Gera apenas metadados da categoria. É chamado por ação do painel ou rotina
 * n8n; nunca durante a renderização da loja ou visita de um robô.
 */
export async function gerarSeoCategoria(
  entrada: EntradaSeoCategoria,
): Promise<{ dados: SeoCategoriaGerada; modelo: string } | null> {
  const cliente = obterGoogleGenAI();
  if (!cliente) return null;

  try {
    const response = await cliente.ai.models.generateContent({
      model: cliente.modelo,
      contents: `Crie os metadados de uma página de categoria de e-commerce brasileiro.

Loja: ${entrada.loja}
Segmento: ${entrada.segmento}
Categoria: ${entrada.categoria}
Descrição atual: ${entrada.descricaoAtual || "não informada"}
Produtos reais da categoria: ${entrada.produtos.join("; ") || "nenhum cadastrado"}
Marcas reais: ${entrada.marcas.join(", ") || "não informadas"}
Motos reais citadas no catálogo: ${entrada.motos.join(", ") || "não informadas"}
Contexto adicional: ${entrada.contexto || "nenhum"}`,
      config: {
        systemInstruction: `Você escreve SEO para o Lojas Ávila Ops em português do Brasil.
Use somente fatos fornecidos. Não invente estoque, preço, garantia, frete, prazo, certificação, aplicação ou marca.
O título é específico da página e não deve repetir o nome da loja, pois o template global o acrescenta.
A descrição deve ser natural, útil e comercial, sem lista de palavras-chave e sem superlativos vazios.`,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            titulo: { type: Type.STRING, description: "Título da página sem o nome da loja, máximo 70 caracteres" },
            descricao: { type: Type.STRING, description: "Meta description em português, de 40 a 170 caracteres" },
            palavrasChave: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Até 10 termos realmente relacionados ao catálogo" },
          },
          required: ["titulo", "descricao", "palavrasChave"],
        },
      },
    });

    if (!response.text) return null;
    const validacao = SeoCategoriaGeradaSchema.safeParse(JSON.parse(response.text));
    if (!validacao.success) {
      console.warn("[genai] SEO de categoria fora do contrato:", validacao.error.flatten());
      return null;
    }
    return { dados: validacao.data, modelo: cliente.modelo };
  } catch (erro) {
    console.error("[genai] Erro ao gerar SEO de categoria:", erro);
    return null;
  }
}
