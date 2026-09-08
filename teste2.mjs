import { GoogleAuth } from "google-auth-library";
const auth = new GoogleAuth({ keyFile: "D:/avilaops.com/ferramentas/google/contatos-424700-279e058fa322.json", scopes: ["https://www.googleapis.com/auth/drive"] });
const { token } = await (await auth.getClient()).getAccessToken();
// pastas filhas existentes: Cardapio, Identidade, Produtos, Versoes anteriores (criadas por nicolasrosaab)
for (const [nome, id] of [["Cardápio","1J5UdQIGFAdOZ3_IgBc4tLtP2R6IhfdVz"],["Identidade","1T5qCRTmqLPP3XIkxTnYQNVfcitCLNgD8"],["Produtos","1c1ESXUgbjpUQv7qcsMgQQ2-Sez0Vnzx-"]]) {
  const r = await fetch(`https://www.googleapis.com/drive/v3/files/${id}?fields=id,name,capabilities(canAddChildren)&supportsAllDrives=true`, { headers: { Authorization: `Bearer ${token}` } });
  console.log(nome, r.status, r.ok ? JSON.stringify((await r.json()).capabilities) : "sem acesso");
}
