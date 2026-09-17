import { z } from "zod";
import { sugerirEssencia } from "@/lib/identidade";
import { gerarDiagnosticoMarca, MODELO_GEMINI_PADRAO } from "@/lib/genai";
import { sessaoDoPainel } from "@/lib/sessao";
import { permite } from "@/lib/operadores";

const Entrada = z.object({
  nome: z.string().trim().min(1).max(80),
  segmento: z.string().trim().max(40).optional(),
  personalidade: z.array(z.string().max(30)).max(3).optional(),
  contexto: z.string().trim().max(400).optional(),
});

// Freio simples para quem ainda não tem loja, em memória (uma instância).
// O rascunho anônimo não custa crédito, mas também não é endpoint aberto.
const rascunhosPorIp = new Map<string, { n: number; ate: number }>();
const JANELA = 10 * 60_000;
const LIMITE = 30;

function excedeuOLimite(request: Request): boolean {
  const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "desconhecido";
  const agora = Date.now();
  const atual = rascunhosPorIp.get(ip);
  if (!atual || atual.ate <= agora) {
    rascunhosPorIp.set(ip, { n: 1, ate: agora + JANELA });
    return false;
  }
  atual.n += 1;
  return atual.n > LIMITE;
}

export async function POST(request: Request) {
  /**
   * Dois públicos, uma rota:
   *
   *   - o lojista com sessão (estúdio) → IA, que é crédito da casa;
   *   - quem está criando a loja em /criar → rascunho local, determinístico.
   *
   * A rota já foi aberta a qualquer um e gastava crédito por visitante; depois
   * passou a exigir sessão e, com isso, o "✦ preencher com IA" do wizard —
   * usado justamente por quem ainda NÃO tem loja — respondia 401 sempre. O
   * meio-termo é este: ninguém sem loja gasta IA, e ninguém fica sem rascunho.
   */
  const s = await sessaoDoPainel();
  if (s && !permite(s.papel, "configuracoes")) {
    return Response.json({ erro: "Seu acesso não permite esta ação. Fale com o dono da loja." }, { status: 403 });
  }
  const lojista = s?.tenant ?? null;

  const r = Entrada.safeParse(await request.json().catch(() => null));
  if (!r.success) {
    return Response.json({ erro: "Informe pelo menos o nome da loja." }, { status: 422 });
  }

  const nomeLoja = r.data.nome || lojista?.nome || "Sua loja";
  const segmento = r.data.segmento || lojista?.segmento || "comércio";

  const local = sugerirEssencia(nomeLoja, segmento, r.data.personalidade);

  if (!lojista) {
    if (excedeuOLimite(request)) {
      return Response.json({ erro: "Muitos rascunhos seguidos. Aguarde alguns minutos." }, { status: 429 });
    }
    return Response.json({
      success: true,
      source: "fallback",
      model: MODELO_GEMINI_PADRAO,
      publico: local.publico,
      diferencial: local.diferencial,
      origem: "local",
    });
  }

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
