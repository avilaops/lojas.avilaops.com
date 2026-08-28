import { COOKIE_MOTO, lerMoto } from "@/lib/motos";

const UM_ANO = 60 * 60 * 24 * 365;

/** POST { marca, modelo, ano? } — guarda a moto do comprador por um ano. */
export async function POST(request: Request) {
  const moto = lerMoto(await request.json().catch(() => null));
  if (!moto) return Response.json({ erro: "Informe marca e modelo." }, { status: 422 });
  return Response.json(moto, {
    headers: { "set-cookie": `${COOKIE_MOTO}=${encodeURIComponent(JSON.stringify(moto))}; Path=/; Max-Age=${UM_ANO}; SameSite=Lax; Secure` },
  });
}

/** DELETE — esquece a moto. */
export async function DELETE() {
  return Response.json({ ok: true }, { headers: { "set-cookie": `${COOKIE_MOTO}=; Path=/; Max-Age=0; SameSite=Lax; Secure` } });
}
