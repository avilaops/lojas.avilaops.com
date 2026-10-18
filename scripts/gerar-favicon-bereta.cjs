const fs = require("node:fs/promises");
const path = require("node:path");
const sharp = require("sharp");

const origem = process.argv[2];
if (!origem) throw new Error("Informe o PNG do símbolo da Bereta.");

const destino = path.join(process.cwd(), "public", "media", "bereta", "brand", "favicon");

async function pngQuadrado(tamanho, margem = 0.08) {
  const area = Math.round(tamanho * (1 - margem * 2));
  const simbolo = await sharp(origem)
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .resize(area, area, { fit: "contain" })
    .png()
    .toBuffer();

  return sharp({
    create: {
      width: tamanho,
      height: tamanho,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 1 },
    },
  })
    .composite([{ input: simbolo, gravity: "center" }])
    .png()
    .toBuffer();
}

function icoComPng(png, tamanho) {
  const cabecalho = Buffer.alloc(22);
  cabecalho.writeUInt16LE(0, 0);
  cabecalho.writeUInt16LE(1, 2);
  cabecalho.writeUInt16LE(1, 4);
  cabecalho[6] = tamanho === 256 ? 0 : tamanho;
  cabecalho[7] = tamanho === 256 ? 0 : tamanho;
  cabecalho[8] = 0;
  cabecalho[9] = 0;
  cabecalho.writeUInt16LE(1, 10);
  cabecalho.writeUInt16LE(32, 12);
  cabecalho.writeUInt32LE(png.length, 14);
  cabecalho.writeUInt32LE(22, 18);
  return Buffer.concat([cabecalho, png]);
}

async function main() {
  await fs.mkdir(destino, { recursive: true });
  const [png96, png180, png192, png256, png512] = await Promise.all([
    pngQuadrado(96),
    pngQuadrado(180),
    pngQuadrado(192),
    pngQuadrado(256),
    pngQuadrado(512),
  ]);

  const pngBase64 = png512.toString("base64");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><image width="512" height="512" href="data:image/png;base64,${pngBase64}"/></svg>\n`;
  const manifesto = {
    name: "Bereta Rodas",
    short_name: "Bereta",
    icons: [
      { src: "/media/bereta/brand/favicon/web-app-manifest-192x192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
      { src: "/media/bereta/brand/favicon/web-app-manifest-512x512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
    ],
    theme_color: "#080808",
    background_color: "#080808",
    display: "standalone",
    start_url: "/",
  };

  await Promise.all([
    fs.writeFile(path.join(destino, "favicon-96x96.png"), png96),
    fs.writeFile(path.join(destino, "apple-touch-icon.png"), png180),
    fs.writeFile(path.join(destino, "web-app-manifest-192x192.png"), png192),
    fs.writeFile(path.join(destino, "web-app-manifest-512x512.png"), png512),
    fs.writeFile(path.join(destino, "favicon.ico"), icoComPng(png256, 256)),
    fs.writeFile(path.join(destino, "favicon.svg"), svg),
    fs.writeFile(path.join(destino, "site.webmanifest"), `${JSON.stringify(manifesto, null, 2)}\n`),
  ]);
}

main().catch((erro) => {
  console.error(erro);
  process.exitCode = 1;
});
