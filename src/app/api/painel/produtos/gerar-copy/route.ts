import { z } from "zod";
import { exigir } from "@/lib/operadores";
import { gerarCopyProduto, MODELO_GEMINI_PADRAO } from "@/lib/genai";

const EntradaSchema = z.object({
  nome: z.string().trim().min(1, "Nome do produto é obrigatório.").max(120),
  marca: z.string().trim().max(80).optional(),
  segmento: z.string().trim().max(50).optional(),
  contexto: z.string().trim().max(500).optional(),
});

export async function POST(request: Request) {
  // Escrever texto de produto é mexer no catálogo, e gasta crédito de IA da
  // loja: o balcão não decide isso.
  const { s, erro } = await exigir("catalogo");
  if (erro) return erro;
  const lojista = s.tenant;

  const corpo = await request.json().catch(() => null);
  const validacao = EntradaSchema.safeParse(corpo);

  if (!validacao.success) {
    return Response.json(
      { erro: validacao.error.issues[0]?.message || "Entrada inválida." },
      { status: 422 }
    );
  }

  const { nome, marca, segmento, contexto } = validacao.data;
  const segmentoFinal = segmento || lojista.segmento || "geral";

  const resultadoIa = await gerarCopyProduto({
    nome,
    marca,
    segmento: segmentoFinal,
    contexto,
  });

  if (resultadoIa) {
    return Response.json({
      success: true,
      source: "gemini",
      model: resultadoIa.modelo,
      data: resultadoIa.dados,
      warnings: [
        "🤖 Atributos de peso e dimensões são ESTIMATIVAS. Confirme as medidas reais da embalagem antes de publicar para que o cálculo do frete funcione corretamente.",
      ],
    });
  }

  // Fallback estruturado determinístico caso o Gemini não esteja disponível
  const marcaTxt = marca ? ` ${marca}` : "";
  return Response.json({
    success: true,
    source: "fallback",
    model: MODELO_GEMINI_PADRAO,
    data: {
      tituloSeo: `${nome}${marcaTxt} - Garantia e Qualidade`,
      descricaoCurta: `${nome}${marcaTxt} com excelente acabamento e despacho rápido.`,
      descricao: {
        introducao: `${nome}${marcaTxt} selecionado para oferecer alta durabilidade e excelente acabamento.`,
        beneficios: [
          "Excelente acabamento e ajuste",
          "Procedência garantida e nota fiscal",
          "Envio rápido",
        ],
        especificacoes: [
          `Produto: ${nome}`,
          marca ? `Fabricante/Marca: ${marca}` : "Fabricante: Padrão",
          `Segmento: ${segmentoFinal}`,
        ],
        observacoes: "Confira as especificações antes da instalação.",
      },
      palavrasChave: [nome.toLowerCase(), marca?.toLowerCase() || ""].filter(Boolean),
      logistica: {
        pesoEstimadoGramas: 500,
        comprimentoEstimadoCm: 20,
        larguraEstimadoCm: 15,
        alturaEstimadoCm: 10,
        requerConfirmacao: true,
      },
      atributos: [
        {
          nome: "marca",
          valor: marca || "Padrão",
          confianca: marca ? "alta" : "baixa",
          origem: marca ? "nome_produto" : "estimativa_ia",
        },
      ],
    },
    warnings: [
      "⚠️ Usando fallback determinístico local. Modifique e confirme os dados antes de publicar.",
    ],
  });
}
