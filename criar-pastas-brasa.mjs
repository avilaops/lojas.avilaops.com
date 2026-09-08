import { GoogleAuth } from "google-auth-library";

const auth = new GoogleAuth({
  keyFile: "D:/avilaops.com/ferramentas/google/contatos-424700-279e058fa322.json",
  scopes: ["https://www.googleapis.com/auth/drive"],
});
const { token } = await (await auth.getClient()).getAccessToken();

const RAIZ = "1FyXPGm8Fh3Jr9zfbq5OS80aTtU4NKsjw";

async function api(url, init = {}) {
  const r = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init.headers },
  });
  if (!r.ok) throw new Error(`${r.status}: ${(await r.text()).slice(0, 300)}`);
  return r.json();
}

/** Reaproveita a pasta se ela já existir, para não duplicar o que o cliente já vê. */
async function pasta(nome, pai) {
  const q = encodeURIComponent(
    `name = '${nome.replace(/'/g, "\'")}' and '${pai}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
  );
  const { files } = await api(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)&supportsAllDrives=true&includeItemsFromAllDrives=true`,
  );
  if (files.length) return files[0].id;

  const criada = await api(
    "https://www.googleapis.com/drive/v3/files?supportsAllDrives=true&fields=id,name",
    {
      method: "POST",
      body: JSON.stringify({ name: nome, parents: [pai], mimeType: "application/vnd.google-apps.folder" }),
    },
  );
  return criada.id;
}

const mapa = {};
mapa["Identidade"] = await pasta("Identidade", RAIZ);
mapa["Cardápio"] = await pasta("Cardápio", RAIZ);
mapa["Produtos"] = await pasta("Produtos", RAIZ);
mapa["Versões anteriores"] = await pasta("Versões anteriores", RAIZ);
mapa["Arquivos originais"] = await pasta("Arquivos originais", mapa["Versões anteriores"]);
mapa["Sem marca"] = await pasta("Sem marca", mapa["Versões anteriores"]);

console.log(JSON.stringify(mapa, null, 2));
