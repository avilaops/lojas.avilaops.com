import { ImageResponse } from "next/og";

export const alt = "Lojas Avila Ops: sua loja começa bonita e cresce pronta";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", overflow: "hidden", color: "white", background: "#050814", fontFamily: "Arial, sans-serif" }}>
      <div style={{ position: "absolute", width: 660, height: 660, right: -80, top: -230, borderRadius: 999, background: "#183a9a", filter: "blur(20px)", opacity: .72 }} />
      <div style={{ position: "absolute", inset: 0, display: "flex", backgroundImage: "linear-gradient(rgba(255,255,255,.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.045) 1px, transparent 1px)", backgroundSize: "48px 48px", maskImage: "linear-gradient(90deg, black, transparent)" }} />
      <div style={{ position: "relative", width: "100%", padding: "70px 78px", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 54, height: 54, borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", color: "white", background: "#2f6bff", fontSize: 28, fontWeight: 800 }}>L</div>
          <div style={{ display: "flex", flexDirection: "column" }}><b style={{ fontSize: 24 }}>Lojas</b><span style={{ color: "#9ea8ba", fontSize: 12, letterSpacing: 3, textTransform: "uppercase" }}>por Avila Ops</span></div>
        </div>
        <div style={{ maxWidth: 820, marginTop: 78, display: "flex", flexDirection: "column" }}>
          <span style={{ color: "#8aa8ff", fontSize: 16, fontWeight: 700, letterSpacing: 4, textTransform: "uppercase" }}>Comércio digital, com identidade</span>
          <h1 style={{ margin: "22px 0 0", fontSize: 76, lineHeight: .96, letterSpacing: -5 }}>Sua loja começa bonita.<br />E cresce pronta.</h1>
        </div>
        <div style={{ marginTop: "auto", display: "flex", alignItems: "center", gap: 15, color: "#aeb7c8", fontSize: 18 }}><span style={{ color: "#70e0b5" }}>●</span> Design, vendas e automação em uma única operação.</div>
      </div>
    </div>,
    size,
  );
}
