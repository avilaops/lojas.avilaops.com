import { readFile } from "node:fs/promises";
import { GoogleAuth } from "google-auth-library";
const CHAVE = "D:/avilaops.com/ferramentas/google/contatos-424700-279e058fa322.json";
const auth = new GoogleAuth({ keyFile: CHAVE, scopes: ["https://www.googleapis.com/auth/drive"] });
const client = await auth.getClient();
const { token } = await client.getAccessToken();
console.log("conta:", JSON.parse(await readFile(CHAVE, "utf8")).client_email);
const r = await fetch("https://www.googleapis.com/drive/v3/files/1FyXPGm8Fh3Jr9zfbq5OS80aTtU4NKsjw?fields=id,name,capabilities(canAddChildren,canEdit)&supportsAllDrives=true", { headers: { Authorization: `Bearer ${token}` } });
console.log(r.status, await r.text());
