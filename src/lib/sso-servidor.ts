import { cookies } from "next/headers";
import { COOKIE_SSO, consultarSSO, type ConfigSSO } from "./sso";
import { configOIDC, consultarSessaoOIDC, COOKIE_SESSAO_OIDC } from "./oidc";

export async function consultarIdentidadeSSO(cfg: ConfigSSO) {
  const store = await cookies();
  const oidc = configOIDC();
  return oidc ? consultarSessaoOIDC(oidc, store.get(COOKIE_SESSAO_OIDC)?.value) : consultarSSO(cfg, store.get(COOKIE_SSO)?.value);
}
