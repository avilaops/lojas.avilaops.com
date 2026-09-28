import { ImageResponse } from "next/og";
import { marcaQuadradaDa, tenantAtual, temaDo } from "@/lib/tenant";
import { corTextoLegivel } from "@/lib/tema";

/**
 * Imagem de compartilhamento da LOJA (WhatsApp, Instagram, Google): nome,
 * slogan e logo sobre a cor primária. Gerada por loja, sem o lojista fazer nada.
 * A plataforma (lojas.avilaops.com) tem a própria em src/app/plataforma/.
 */
export const runtime = "nodejs";
// O alt é estático (o Next avalia fora do request), então ele descreve o que a
// imagem é, e não de que loja — "Loja" não dizia nem uma coisa nem outra.
export const alt = "Imagem de compartilhamento da loja";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const t = await tenantAtual();
  const tema = t ? temaDo(t) : null;
  const fundo = tema?.corPrimaria ?? "#2563eb";
  const texto = corTextoLegivel(fundo, tema?.corPrimariaTexto ?? "#ffffff");
  const nome = t?.nome ?? "Lojas by Avila Ops";
  const slogan = t?.slogan ?? "";
  const marca = t ? marcaQuadradaDa(t) : null;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: fundo, color: texto, fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          {marca ? (
            // O ladrilho do favicon, não o logo cru: arte transparente feita
            // para papel branco pode sumir sobre a cor primária da loja. Ver
            // `marcaQuadradaDa`.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={marca} alt="" width={96} height={96} style={{ width: 96, height: 96, objectFit: "contain", borderRadius: 24 }} />
          ) : (
            <div style={{ width: 96, height: 96, borderRadius: 24, background: texto, color: fundo, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 56, fontWeight: 800 }}>{nome.slice(0, 1).toUpperCase()}</div>
          )}
          <div style={{ fontSize: 44, fontWeight: 700 }}>{nome}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {slogan && <div style={{ fontSize: 60, fontWeight: 800, lineHeight: 1.1, maxWidth: 1000 }}>{slogan}</div>}
          <div style={{ fontSize: 26, opacity: 0.85 }}>{`${t?.dominioPrincipal ?? (t ? `${t.slug}.lojas.avilaops.com` : "lojas.avilaops.com")} · PIX, cartão e boleto`}</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
