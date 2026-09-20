import { TenantAtualizacaoSchema } from "@/lib/admin-schemas";
import { atualizarTenant } from "@/lib/admin-tenants";
import { provisionarLoja } from "@/lib/provisionar";
import { exigir } from "@/lib/operadores";
import { emitir } from "@/lib/eventos";
import { lerIdentidade } from "@/lib/identidade";
import { type Endereco, retiradaPublicaDisponivel, urlDaLoja } from "@/lib/tenant";

/** PATCH — o lojista altera a própria loja (tema, contato, frete, gateway, domínio). */
export async function PATCH(request: Request) {
  const { s, erro } = await exigir("configuracoes");
  if (erro) return erro;
  const loja = s.tenant;

  // Status e slug não são do lojista.
  const r = TenantAtualizacaoSchema.omit({ status: true, slug: true, plano: true }).safeParse(await request.json().catch(() => null));
  if (!r.success) return Response.json({ erro: "Dados inválidos.", detalhes: r.error.flatten() }, { status: 422 });

  if (r.data.retiradaNaLoja) {
    const atual = (s.tenant.endereco as Endereco | null) ?? {};
    const endereco = { ...atual, ...(r.data.endereco ?? {}) };
    const publico = r.data.enderecoPublico ?? s.tenant.enderecoPublico;
    if (!retiradaPublicaDisponivel({ retiradaNaLoja: true, enderecoPublico: publico, endereco })) {
      return Response.json({
        erro: "Para ativar retirada, complete o endereço da empresa e torne-o público na seção Conta.",
      }, { status: 422 });
    }
  }

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
  const { s, erro } = await exigir("configuracoes");
  if (erro) return erro;
  const loja = s.tenant;
  return Response.json(await provisionarLoja(loja.slug));
}
