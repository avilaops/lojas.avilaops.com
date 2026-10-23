import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { registrarEntradaEquipe } from "@/lib/entrada-equipe";
import { configSSO, CAMINHO_RETORNO } from "@/lib/sso";
import { normalizarHost } from "@/lib/tenant";

export const dynamic = "force-dynamic";

// Apenas uma escolha explícita de entrada cria a autorização temporária para listar lojas.
export async function GET() {
  const cfg = configSSO();
  const base = (process.env.LOJAS_BASE_DOMAIN ?? "lojas.avilaops.com").toLowerCase();
  if (!cfg || normalizarHost((await headers()).get("host")) !== base)
    return new Response(null, { status: 404 });
  await registrarEntradaEquipe();
  const response = NextResponse.redirect(new URL(CAMINHO_RETORNO, `https://${base}`));
  response.headers.set("Cache-Control", "no-store");
  return response;
}
