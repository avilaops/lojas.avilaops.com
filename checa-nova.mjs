import { GoogleAuth } from "google-auth-library";
const auth = new GoogleAuth({ keyFile: "D:/avilaops.com/ferramentas/google/contatos-424700-279e058fa322.json", scopes: ["https://www.googleapis.com/auth/drive"] });
const { token } = await (await auth.getClient()).getAccessToken();
const ID = "1ISF_byYgGFnJoZNH5NuaCEC31Dd_9c0i";
const h = { Authorization: `Bearer ${token}` };

const r = await fetch(`https://www.googleapis.com/drive/v3/files/${ID}?fields=id,name,mimeType,driveId,owners(emailAddress),capabilities(canAddChildren,canEdit)&supportsAllDrives=true`, { headers: h });
console.log("meta:", r.status, await r.text());

const f = await fetch(`https://www.googleapis.com/drive/v3/files?q='${ID}'+in+parents+and+trashed=false&fields=files(id,name,mimeType)&supportsAllDrives=true&includeItemsFromAllDrives=true&pageSize=100`, { headers: h });
console.log("\nconteudo:", f.status, f.ok ? JSON.stringify((await f.json()).files, null, 1) : await f.text());
