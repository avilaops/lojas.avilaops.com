import { GoogleAuth } from "google-auth-library";
const auth = new GoogleAuth({ keyFile: "D:/avilaops.com/ferramentas/google/contatos-424700-279e058fa322.json", scopes: ["https://www.googleapis.com/auth/drive"] });
const { token } = await (await auth.getClient()).getAccessToken();
const RAIZ = "1ISF_byYgGFnJoZNH5NuaCEC31Dd_9c0i";

async function pasta(nome, pai) {
  const r = await fetch("https://www.googleapis.com/drive/v3/files?supportsAllDrives=true&fields=id,name", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name: nome, parents: [pai], mimeType: "application/vnd.google-apps.folder" }),
  });
  if (!r.ok) throw new Error(`${nome}: ${r.status} ${(await r.text()).slice(0,200)}`);
  const j = await r.json();
  return j.id;
}

const m = {};
m.produtos   = await pasta("01 · Artes dos Produtos", RAIZ);
m.cardapio   = await pasta("02 · Cardápio", RAIZ);
m.identidade = await pasta("03 · Identidade Visual", RAIZ);
m.acervo     = await pasta("04 · Acervo (uso interno)", RAIZ);
m.originais  = await pasta("Arquivos originais", m.acervo);
m.semMarca   = await pasta("Geradas sem marca", m.acervo);
m.historico  = await pasta("Versões anteriores", m.acervo);
console.log(JSON.stringify(m, null, 2));
