import { readFile } from "node:fs/promises";
import { GoogleAuth } from "google-auth-library";
const auth = new GoogleAuth({ keyFile: "D:/avilaops.com/ferramentas/google/contatos-424700-279e058fa322.json", scopes: ["https://www.googleapis.com/auth/drive"] });
const { token } = await (await auth.getClient()).getAccessToken();
const arq = "D:/avilaops.com/comandeiro.com.br/operacao/minas.comandeiro.com.br/assets/catalogo/minas-espetinhos/finais-v2/frango.webp";
const conteudo = await readFile(arq);
const limite = "-------314159265358979323846";
const corpo = Buffer.concat([
  Buffer.from(`--${limite}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name: "Frango.webp", parents: ["11CzrOQ81NaomXJkeSdjnFPP1KoHi_rTw"] })}\r\n--${limite}\r\nContent-Type: image/webp\r\n\r\n`),
  conteudo,
  Buffer.from(`\r\n--${limite}--\r\n`),
]);
const r = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,owners(emailAddress)", {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": `multipart/related; boundary=${limite}` },
  body: corpo,
});
console.log(r.status, (await r.text()).slice(0, 400));
