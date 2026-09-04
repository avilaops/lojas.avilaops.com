import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { GoogleAuth } from "google-auth-library";

/**
 * Sobe as artes da Brasa Mineira para o Drive.
 *
 * Roda daqui porque é o projeto que já tem `google-auth-library` instalado e
 * a conta de serviço configurada — o mesmo caminho usado para baixar arquivos
 * do Drive em lote.
 *
 * Upload multipart pela API REST, e não pelo conector do chat: são 72
 * arquivos de 100 KB a 300 KB, e passar cada um em base64 pelo texto da
 * conversa gastaria contexto sem necessidade e levaria muito mais tempo.
 *
 * Uso:
 *   node subir-artes-brasa.mjs <pasta local> <id da pasta no Drive>
 */

const [pastaLocal, pastaDrive] = process.argv.slice(2);

if (!pastaLocal || !pastaDrive) {
  console.error("uso: node subir-artes-brasa.mjs <pasta local> <id no Drive>");
  process.exit(1);
}

const CHAVE = path.resolve(
  "../ferramentas/google/contatos-424700-279e058fa322.json",
);

const auth = new GoogleAuth({
  keyFile: CHAVE,
  scopes: ["https://www.googleapis.com/auth/drive"],
});

const client = await auth.getClient();
const { token } = await client.getAccessToken();

const TIPOS = {
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".pdf": "application/pdf",
  ".svg": "image/svg+xml",
  ".md": "text/markdown",
};

/**
 * Upload multipart: metadados e binário na mesma requisição.
 *
 * O `uploadType=multipart` aguenta até 5 MB, muito acima do maior arquivo
 * aqui (300 KB), então não vale a complexidade do upload retomável.
 */
async function subir(arquivo, nome, paiId) {
  const conteudo = await readFile(arquivo);
  const tipo = TIPOS[path.extname(nome).toLowerCase()] ?? "application/octet-stream";
  const limite = "-------314159265358979323846";

  const corpo = Buffer.concat([
    Buffer.from(
      `--${limite}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
        JSON.stringify({ name: nome, parents: [paiId] }) +
        `\r\n--${limite}\r\nContent-Type: ${tipo}\r\n\r\n`,
    ),
    conteudo,
    Buffer.from(`\r\n--${limite}--\r\n`),
  ]);

  const resposta = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": `multipart/related; boundary=${limite}`,
      },
      body: corpo,
    },
  );

  if (!resposta.ok) {
    throw new Error(`${resposta.status}: ${(await resposta.text()).slice(0, 300)}`);
  }

  return resposta.json();
}

const arquivos = (await readdir(pastaLocal, { withFileTypes: true }))
  .filter((d) => d.isFile() && !d.name.endsWith(".b64"))
  .map((d) => d.name)
  .sort();

let enviados = 0;
const falhas = [];

for (const nome of arquivos) {
  try {
    await subir(path.join(pastaLocal, nome), nome, pastaDrive);
    enviados += 1;
    console.log(`  ${nome}`);
  } catch (erro) {
    falhas.push({ nome, erro: erro.message });
    console.log(`  FALHOU ${nome}: ${erro.message}`);
  }
}

console.log(`\n${enviados}/${arquivos.length} enviados`);
if (falhas.length) process.exitCode = 1;
