import { TenantAtualizacaoSchema } from "@/lib/admin-schemas";
import { atualizarTenant } from "@/lib/admin-tenants";
import { provisionarLoja } from "@/lib/provisionar";
import { lojistaAtual } from "@/lib/sessao";
import { emitir } from "@/lib/eventos";
import { lerIdentidade } from "@/lib/identidade";
import { urlDaLoja } from "@/lib/tenant";

/** PATCH — o lojista altera a própria loja (tema, contato, frete, gateway, domínio). */
export async function PATCH(request: Request) {
  const loja = await lojistaAtual();
  if (!loja) return Response.json({ erro: "Sessão expirada." }, { status: 401 });

  // Status e slug não são do lojista.
  const r = TenantAtualizacaoSchema.omit({ status: true, slug: true, plano: true }).safeParse(await request.json().catch(() => null));
  if (!r.success) return Response.json({ erro: "Dados inválidos.", detalhes: r.error.flatten() }, { status: 422 });

  const t = await atualizarTenant(loja.slug, r.data);
  if (r.data.identidade || r.data.tema || r.data.logoUrl !== undefined || r.data.bannerUrl !== undefined) {
    const identidade = lerIdentidade(t.identidade);
    await emitir({
      tipo: "loja.identidade-atualizada", slug: t.slug, nome: t.nome, url: urlDaLoja(t),
      personalidade: identidade.personalidade.join(", "), direcaoFotografica: identidade.direcaoFotografica,
      emailContato: t.emailContato, whatsapp: t.whatsapp,
    });
  }
  return Response.json({ slug: t.slug, atualizadoEm: t.atualizadoEm });
}

/** POST — reexecuta DNS + e-mail (depois de apontar o domínio, por exemplo). */
export async function POST() {
  const loja = await lojistaAtual();
  if (!loja) return Response.json({ erro: "Sessão expirada." }, { status: 401 });
  return Response.json(await provisionarLoja(loja.slug));
}
