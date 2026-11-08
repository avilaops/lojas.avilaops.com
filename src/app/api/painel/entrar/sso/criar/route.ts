import { consultarIdentidadeSSO } from "@/lib/sso-servidor";
import { configOIDC } from "@/lib/oidc";
import { headers } from "next/headers";
import { abrirSessao } from "@/lib/sessao";
import { configSSO, } from "@/lib/sso";
import { criarLojaPeloSSO, origemConfere } from "@/lib/sso-cadastro";
import { normalizarHost } from "@/lib/tenant";

export const dynamic = "force-dynamic";

function irPara(caminho: string) {
  return new Response(null, { status: 303, headers: { location: caminho } });
}

/** Confirmação de `/criar/sso`. Confere origem, selo e a sessão no Auth de novo. */
export async function POST(request: Request) {
  const cfg = configSSO();
  const base = (process.env.LOJAS_BASE_DOMAIN ?? "lojas.avilaops.com").toLowerCase();
  const h = await headers();
  if (!cfg || normalizarHost(h.get("host")) !== base) return new Response(null, { status: 404 });
  const oidc = configOIDC();
  if (oidc ? h.get("origin") !== oidc.origem : !origemConfere(h.get("origin"), base)) return new Response("Origem não permitida.", { status: 403 });

  const form = await request.formData().catch(() => null);
  const selo = form?.get("selo");
  const r = await consultarIdentidadeSSO(cfg);
  const res = await criarLojaPeloSSO(r, typeof selo === "string" ? selo : null);

  if (res.tipo === "criada") {
    await abrirSessao(res.tenant.slug);
    return irPara("/painel");
  }
  if (res.tipo === "existente") {
    await abrirSessao(res.slug, res.operadorId);
    return irPara("/painel");
  }
  if (res.recado === "selo" || res.recado === "sem-sessao") return irPara("/criar/sso");
  return irPara(`/entrar?sso=${res.recado}`);
}
