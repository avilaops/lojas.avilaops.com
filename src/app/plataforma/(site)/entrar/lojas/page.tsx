import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { configSSO, consultarSSO, COOKIE_SSO } from "@/lib/sso";
import { lojasAutorizadas } from "@/lib/acessos-loja";

export const dynamic = "force-dynamic";
export default async function EscolherLoja() {
  const cfg = configSSO();
  if (!cfg) redirect("/entrar");
  const r = await consultarSSO(cfg, (await cookies()).get(COOKIE_SSO)?.value);
  if (r.tipo !== "ok") redirect("/entrar");
  const lojas = await lojasAutorizadas(r.email);
  if (!lojas.length) redirect("/entrar?sso=sem-loja");
  return <main className="pl-site-claro pl-auth-pagina"><div className="pl-auth-simples">
    <span>Minha conta</span><h1>Escolha sua loja</h1>
    <p className="mt-3 text-sm">{r.email} · Só aparecem lojas às quais sua conta tem acesso.</p>
    <ul className="mt-6 grid gap-3">{lojas.map(loja => <li key={loja.id}>
      <form method="post" action="/api/painel/entrar/lojas">
        <input type="hidden" name="slug" value={loja.slug}/>
        <button type="submit" className="w-full min-h-11 rounded-lg border p-4 text-left">{loja.nome}</button>
      </form>
    </li>)}</ul>
  </div></main>;
}
