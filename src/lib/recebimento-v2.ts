import type { Tenant } from "@prisma/client";
import { PROVEDORES, type ContextoProvedor, type DefinicaoProvedor, type ProvedorId } from "@avilaops/checkout/server";
import { prisma } from "./db";
import { aplicativoConfigurado as mercadoPagoOAuthConfigurado } from "./mercado-pago-conta";
import { credencialParaTela, ehLegadoMercadoPago, garantirCredencialMercadoPago } from "./credenciais";
import { provedoresDePagamento } from "./provedores-pagamento";
import { recursoAtivo, type Recurso } from "./recursos";

/**
 * Dados da tela Configurações → Recebimento (v2, flag `recebimento_v2`).
 *
 * Mercado Pago aparece sempre. Os outros só se estiverem registrados nesta
 * versão E com a flag `pagamentos_<id>` ligada na loja.
 */
export function provedoresVisiveis(t: Pick<Tenant, "recursos">): DefinicaoProvedor[] {
  return PROVEDORES.filter((id) => provedoresDePagamento.tem(id))
    .filter((id) => id === "mercadopago" || recursoAtivo(t, `pagamentos_${id}` as Recurso))
    .map((id) => provedoresDePagamento.obter(id));
}

export function provedorVisivel(t: Pick<Tenant, "recursos">, id: string): DefinicaoProvedor | null {
  return provedoresVisiveis(t).find((d) => d.id === id) ?? null;
}

export async function dadosDaTela(t: Tenant) {
  await garantirCredencialMercadoPago(t).catch(() => null);
  const loja = await prisma.tenant.findUniqueOrThrow({ where: { id: t.id }, include: { credenciaisPagamento: true } });
  return {
    provedores: provedoresVisiveis(loja).map((d) => ({
      id: d.id,
      nome: d.nome,
      tipoConexao: d.tipoConexao,
      capacidades: d.capacidades,
      campos: d.campos,
      guia: d.guia,
      oauthDisponivel: d.id === "mercadopago" ? mercadoPagoOAuthConfigurado() : Boolean(d.oauth),
    })),
    // MP legado reflete as colunas mp*: desconectado lá, não aparece como
    // Conectado aqui (o status da linha é do dia do backfill).
    credenciais: loja.credenciaisPagamento
      .filter((c) => !(ehLegadoMercadoPago(c) && !loja.mpAccessTokenEnc))
      .map((c) => credencialParaTela(c, loja.credencialPadraoId)),
  };
}
export type DadosDaTela = Awaited<ReturnType<typeof dadosDaTela>>;

/**
 * Separa o que o lojista digitou em segredos e públicos, pelos campos do
 * provedor. Campo fora da lista é descartado; obrigatório vazio vira recado.
 */
export function separarValores(def: DefinicaoProvedor, valores: unknown): { ok: true; ctx: ContextoProvedor; segredos: Record<string, string>; publicos: Record<string, string> } | { ok: false; mensagem: string } {
  const v = valores && typeof valores === "object" ? (valores as Record<string, unknown>) : {};
  const segredos: Record<string, string> = {};
  const publicos: Record<string, string> = {};
  for (const campo of def.campos) {
    const bruto = typeof v[campo.chave] === "string" ? (v[campo.chave] as string).trim() : "";
    if (!bruto) {
      if (campo.obrigatorio) return { ok: false, mensagem: `Preencha “${campo.rotulo}”.` };
      continue;
    }
    if (bruto.length > 4000) return { ok: false, mensagem: `“${campo.rotulo}” está grande demais. Confira se copiou só a chave.` };
    (campo.segredo ? segredos : publicos)[campo.chave] = bruto;
  }
  return { ok: true, ctx: { segredos, publicos }, segredos, publicos };
}

export function ehProvedorDaTela(id: unknown): id is ProvedorId {
  return typeof id === "string" && (PROVEDORES as readonly string[]).includes(id);
}

/** Cookie do estado do OAuth de provedor (não o do Mercado Pago, que tem o seu). */
export const COOKIE_ESTADO_OAUTH = "lojas_pag_oauth";

/** URL exata de volta do OAuth, a registrar no app do provedor. */
export function retornoDoOAuth(provedor: string): string {
  return `https://${process.env.LOJAS_BASE_DOMAIN ?? "lojas.avilaops.com"}/api/painel/recebimento/v2/conectar/${provedor}/retorno`;
}
