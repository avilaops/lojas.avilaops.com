import { ImageResponse } from "next/og";
import { tenantAtual, temaDo } from "@/lib/tenant";
import { corTextoLegivel } from "@/lib/tema";

/** Favicon da loja: inicial do nome sobre a cor primária. Gerado por loja. */
export const runtime = "nodejs";
export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default async function Icon() {
  const t = await tenantAtual();
  const tema = t ? temaDo(t) : null;
  const fundo = tema?.corPrimaria ?? "#2563eb";
  const texto = corTextoLegivel(fundo, tema?.corPrimariaTexto ?? "#ffffff");
  const inicial = (t?.nome ?? "L").trim().slice(0, 1).toUpperCase();
  const raio = tema?.raio === "reto" ? 0 : tema?.raio === "redondo" ? 32 : 14;
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: fundo, color: texto, borderRadius: raio, fontSize: 40, fontWeight: 800, fontFamily: "sans-serif" }}>{inicial}</div>,
    { ...size },
  );
}
