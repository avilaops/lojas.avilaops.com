// A lista /sites é por-usuário: cada SA vê só o que ela adicionou. Confirmar
// se a gemini@ enxerga os 16 do fluxo ou só os 3 dela prova isso.
const { GoogleAuth } = require("google-auth-library");
const fs = require("fs");
(async () => {
  const auth = new GoogleAuth({
    credentials: JSON.parse(fs.readFileSync(process.env.SA_JSON, "utf8")),
    scopes: ["https://www.googleapis.com/auth/webmasters"],
  });
  const { token } = await (await auth.getClient()).getAccessToken();
  const r = await fetch("https://www.googleapis.com/webmasters/v3/sites", {
    headers: { Authorization: "Bearer " + token },
  });
  const j = await r.json();
  console.log("a gemini@ enxerga", (j.siteEntry||[]).length, "propriedades:");
  (j.siteEntry||[]).forEach(s => console.log("  ", s.siteUrl, "|", s.permissionLevel));
})().catch(e => console.error("ERRO:", e.message));
