import { z } from "zod";
import { SEGMENTOS, sugerirEssencia } from "@/lib/identidade";

/**
 * Sugere as duas respostas de essência da marca ("quem você quer conquistar"
 * e "por que escolher sua marca") a partir do que o lojista já preencheu.
 *
 * Com `ANTHROPIC_API_KEY` no ambiente, usa a Messages API (texto curto, em
 * português, sem promessa que a loja não possa cumprir). Sem a chave, cai no
 * gerador local de `identidade.ts` — determinístico, instantâneo e de graça.
 * Em qualquer caso o texto entra no formulário como rascunho editável.
 */
const Entrada = z.object({
  nome: z.string().trim().min(1).max(80),
  segmento: z.string().trim().max(40).optional(),
  personalidade: z.array(z.string().max(30)).max(3).optional(),
  contexto: z.string().trim().max(400).optional(),
});

export async function POST(request: Request) {
  const r = Entrada.safeParse(await request.json().catch(() => null));
  if (!r.success) return Response.json({ erro: "Informe pelo menos o nome da loja." }, { status: 422 });

  const local = sugerirEssencia(r.data.nome, r.data.segmento, r.data.personalidade);
  const chave = process.env.ANTHROPIC_API_KEY;
  if (!chave) return Response.json({ ...local, origem: "local" });

  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey: chave });
    const segmento = SEGMENTOS.find(([v]) => v === r.data.segmento)?.[1] ?? r.data.segmento ?? "comércio";
    const resposta = await client.messages.create({
      model: "claude-opus-5",
      max_tokens: 1000,
      output_config: { effort: "low", format: {
        type: "json_schema",
        schema: {
          type: "object",
          properties: {
            publico: { type: "string", description: "Quem a loja quer conquistar, até 240 caracteres, primeira pessoa do plural ou frase neutra." },
            diferencial: { type: "string", description: "Por que escolher esta marca, até 300 caracteres." },
          },
          required: ["publico", "diferencial"],
          additionalProperties: false,
        },
      } },
      system:
        "Você escreve o diagnóstico de marca de pequenas lojas brasileiras. Português do Brasil, tom simples e concreto, sem jargão de publicidade, sem superlativo vazio ('a melhor', 'líder'), sem inventar prêmio, número, prazo ou certificação. Escreva como o próprio lojista falaria.",
      messages: [
        {
          role: "user",
          content: `Loja: ${r.data.nome}\nSegmento: ${segmento}\nPersonalidade: ${(r.data.personalidade ?? []).join(", ") || "não informada"}\n${r.data.contexto ? `Contexto do lojista: ${r.data.contexto}\n` : ""}\nEscreva um rascunho para as duas perguntas: quem a loja quer conquistar (até 240 caracteres) e por que escolher a marca (até 300 caracteres).`,
        },
      ],
    });

    if (resposta.stop_reason === "refusal") return Response.json({ ...local, origem: "local" });
    const texto = resposta.content.find((b) => b.type === "text");
    const dados = texto && "text" in texto ? (JSON.parse(texto.text) as { publico?: string; diferencial?: string }) : {};
    return Response.json({
      publico: (dados.publico ?? local.publico).slice(0, 240),
      diferencial: (dados.diferencial ?? local.diferencial).slice(0, 300),
      origem: "ia",
    });
  } catch (erro) {
    console.error("[sugerir-essencia] caindo no gerador local:", erro);
    return Response.json({ ...local, origem: "local" });
  }
}
