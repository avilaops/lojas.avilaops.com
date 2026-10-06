import { z } from "zod";
import { TenantEntradaSchema } from "@/lib/admin-schemas";
import { concluirPrimeirosPassos, precisaDosPrimeirosPassos } from "@/lib/cadastro";
import { emitir } from "@/lib/eventos";
import { exigir } from "@/lib/operadores";
import { anunciarLojaCriada, provisionarLoja } from "@/lib/provisionar";
import { abrirSessao } from "@/lib/sessao";
import { esquecerTenantEmCache, urlDaLoja } from "@/lib/tenant";

/**
 * Terceiro passo, já dentro do painel: nome, WhatsApp e plano. É aqui que a
 * conta vira loja no ar.
 *
 * O endereço muda (do provisório para o que nasce do nome), e o token da
 * sessão carrega o endereço: por isso a sessão é aberta de novo no fim.
 */
const Entrada = z.object({
  nome: z.string().trim().min(2, "Informe o nome da loja com pelo menos 2 caracteres.").max(80, "Use um nome com até 80 caracteres."),
  // A régua inteira (boas-vindas, pedido pago, cobrança) fala pelo WhatsApp: sem ele a loja nasce muda.
  whatsapp: TenantEntradaSchema.shape.whatsapp.unwrap(),
  plano: z.enum(["SITE", "LOJA", "LOJA_PRO"]),
});

export async function POST(request: Request) {
  // Escolher o plano é decisão de cobrança: só o dono.
  const { s, erro } = await exigir("cobranca");
  if (erro) return erro;
  if (!precisaDosPrimeirosPassos(s.tenant)) return Response.json({ erro: "Esta loja já foi criada." }, { status: 409 });

  const r = Entrada.safeParse(await request.json().catch(() => null));
  if (!r.success) {
    const issue = r.error.issues[0];
    const campo = String(issue?.path[0] ?? "");
    const mensagem = campo === "whatsapp" ? "Informe DDD + número, por exemplo: (16) 99999-0000." : campo === "plano" ? "Escolha um plano." : (issue?.message ?? "Revise os dados.");
    return Response.json({ erro: mensagem, campo }, { status: 422 });
  }

  const loja = await concluirPrimeirosPassos(s.tenant, r.data);
  esquecerTenantEmCache(s.tenant.slug);
  await abrirSessao(loja.slug);

  await anunciarLojaCriada(loja);
  // A virada PROVISIONANDO → ATIVA aconteceu aqui, e não no provisionamento:
  // o marco de "loja no ar" que conta prazo para o resto sai daqui.
  const base = { slug: loja.slug, nome: loja.nome, url: urlDaLoja(loja), emailContato: loja.emailContato, whatsapp: loja.whatsapp };
  await emitir({ tipo: "loja.ativada", ...base });
  // Provisionamento (DNS/e-mail) segue em segundo plano; a resposta não espera.
  provisionarLoja(loja.slug).catch((e) => console.error("[primeiros-passos] provisionamento:", e));

  return Response.json({ slug: loja.slug, url: urlDaLoja(loja) });
}
