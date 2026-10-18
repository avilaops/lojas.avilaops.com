import { ImageResponse } from "next/og";

export const alt = "Lojas Avila Ops: a loja virtual com a cara do seu negócio";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Mesmo desenho de public/media/marca/lojas-logo.svg. Vai como imagem porque o
// gerador de OG não desenha SVG em linha com traço e arco de forma confiável.
const LOGO = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="4 6 170 64"><g transform="translate(0 -3.5)"><path d="M8 16a4 4 0 0 1 4-4h12v14a8 8 0 0 1-16 0Z" fill="#0153FD"/><path d="M24 12h16v14a8 8 0 0 1-16 0Z" fill="#F72927"/><path d="M40 12h12a4 4 0 0 1 4 4v10a8 8 0 0 1-16 0Z" fill="#FDC403"/><path d="M14 40v13a3 3 0 0 0 3 3h30a3 3 0 0 0 3-3V40" fill="none" stroke="#16130F" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><path d="M25 56V45a7 7 0 0 1 14 0v11Z" fill="#16130F"/></g><g transform="translate(76 15)"><g fill="none" stroke="#16130F" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9v28"/><circle cx="22" cy="28" r="9"/><path d="M41 19v23a8 8 0 0 1-8 8"/><circle cx="60" cy="28" r="9"/><path d="M69 19v18"/><path d="M91 19h-7a4.5 4.5 0 0 0 0 9h2a4.5 4.5 0 0 1 0 9h-7"/></g><circle cx="41" cy="8" r="4" fill="#F72927"/></g></svg>`;
const LOGO_URI = `data:image/svg+xml;base64,${Buffer.from(LOGO).toString("base64")}`;

// Os tons das cenas da landing: a página é de quem vende, não da plataforma.
const TONS = ["#8d3f1f", "#1f3f9e", "#6f6449", "#16181d", "#2c7550", "#7c3b6b"];

export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", color: "#16130F", background: "#FBF8F4", fontFamily: "Arial, sans-serif" }}>
      <div style={{ display: "flex", height: 14 }}>
        <div style={{ flex: 1, background: "#0153FD" }} />
        <div style={{ flex: 1, background: "#F72927" }} />
        <div style={{ flex: 1, background: "#FDC403" }} />
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "64px 78px 58px" }}>
        <img src={LOGO_URI} width={238} height={90} alt="" />
        {/* Uma div por linha: o gerador de OG não quebra linha em <br />. */}
        <div style={{ marginTop: 64, display: "flex", flexDirection: "column", fontSize: 84, lineHeight: 1, letterSpacing: -3 }}>
          <span>A loja com a cara</span>
          <span>do seu negócio.</span>
        </div>
        <div style={{ marginTop: "auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ color: "#6A6259", fontSize: 24 }}>Pix na hora, sem comissão · por Avila Ops</span>
          <div style={{ display: "flex", gap: 10 }}>
            {TONS.map((cor) => <div key={cor} style={{ width: 34, height: 34, borderRadius: 999, background: cor }} />)}
          </div>
        </div>
      </div>
    </div>,
    size,
  );
}
