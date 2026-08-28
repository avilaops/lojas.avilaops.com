import { cookies } from "next/headers";
import { COOKIE_MOTO, lerMoto, type Moto } from "./motos";

/**
 * A moto do comprador, no servidor. Prioridade: query string (URL própria,
 * indexável) > cookie (escolha feita no seletor). `?moto=todas` ignora o
 * cookie sem apagá-lo, para o "ver o catálogo inteiro".
 */
export async function minhaMoto(sp?: { marca?: string; modelo?: string; ano?: string; moto?: string }): Promise<Moto | null> {
  if (sp?.moto === "todas") return null;
  if (sp?.marca && sp?.modelo) return lerMoto({ marca: sp.marca, modelo: sp.modelo, ano: sp.ano });
  const c = (await cookies()).get(COOKIE_MOTO)?.value;
  if (!c) return null;
  try {
    return lerMoto(JSON.parse(decodeURIComponent(c)));
  } catch {
    return null;
  }
}
