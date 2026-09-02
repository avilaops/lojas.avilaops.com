import { z } from "zod";
import { sugerirEssencia } from "@/lib/identidade";
import { gerarDiagnosticoMarca, MODELO_GEMINI_PADRAO } from "@/lib/genai";
import { lojistaAtual } from "@/lib/sessao";
import { exigir } from "@/lib/operadores";

const Entrada = z.object({
  nome: z.string().trim().min(1).max(80),
  segmento: z.string().trim().max(40).optional(),
  personalidade: z.array(z.string().max(30)).max(3).optional(),
  contexto: z.string().trim().max(400).optional(),
});

export async function POST(request: Request) {
  // A rota chamava `lojistaAtual()` e seguia sem conferir o resultado: qualquer
  // pessoa sem sessão gastava crédito de IA da casa.
  const { s, erro } = await exigir("configuracoes");
  if (erro) return erro;
  const lojista = s.tenant;

  const r = Entrada.safeParse(await request.json().catch(() => null));
  if (!r.success) {
    return Response.json({ erro: "Informe pelo menos o nome da loja." }, { status: 422 });
  }

  const nomeLoja = r.data.nome || lojista?.nome || "Sua loja";
  const segmento = r.data.segmento || lojista?.segmento || "comércio";

  const local = sugerirEssencia(nomeLoja, segmento, r.data.personalidade);

  try {
    const resIa = await gerarDiagnosticoMarca({
      nome: nomeLoja,
      segmento,
      personalidade: r.data.personalidade,
      contexto: r.data.contexto,
    });

    if (resIa) {
      return Response.json({
        success: true,
        source: "gemini",
        model: resIa.modelo,
        data: resIa.dados,
        publico: resIa.dados.publicoAlvo.slice(0, 240),
        diferencial: resIa.dados.propostaValor.slice(0, 300),
        slogan: resIa.dados.slogan,
        tomDeVoz: resIa.dados.tomDeVoz,
        origem: "ia",
      });
    }

    return Response.json({
      success: true,
      source: "fallback",
      model: MODELO_GEMINI_PADRAO,
      data: {
        publicoAlvo: local.publico,
        propostaValor: local.diferencial,
        diferenciais: ["Atendimento humano", "Entrega garantida", "Preço justo"],
        posicionamento: `A escolha certa em ${segmento} para o seu dia a dia.`,
        tomDeVoz: "direto",
        palavrasUsar: ["garantia", "qualidade", "agilidade"],
        palavrasEvitar: ["melhor do mundo", "infalível"],
        slogan: `${nomeLoja}: Qualidade e confiança em cada compra.`,
        descricaoCurta: `${nomeLoja} - Produtos selecionados com entrega rápida.`,
        pilaresComunicacao: ["Transparência", "Qualidade", "Agilidade"],
      },
      publico: local.publico,
      diferencial: local.diferencial,
      origem: "local",
    });
  } catch (erro) {
    console.error("[sugerir-essencia] caindo no gerador local:", erro);
    return Response.json({
      success: true,
      source: "fallback",
      model: MODELO_GEMINI_PADRAO,
      publico: local.publico,
      diferencial: local.diferencial,
      origem: "local",
    });
  }
}
