import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { GoogleAuth } from "google-auth-library";

/**
 * Sobe o acervo da Brasa Mineira para a pasta Material Marketing do cliente.
 *
 * Sucessor do subir-artes-brasa.mjs: aquele mandava uma pasta local para um id
 * de pasta no Drive; aqui o mapa das seis pastas está fixo, porque a estrutura
 * que o cliente vê já está definida e não deve variar a cada execução.
 *
 * Upload retomável (e não multipart) porque o cardápio A4 tem 7,8 MB, acima do
 * limite de 5 MB do multipart.
 */

const CHAVE = "D:/avilaops.com/ferramentas/google/contatos-424700-279e058fa322.json";
const BASE = "D:/avilaops.com/comandeiro.com.br/operacao/minas.comandeiro.com.br";
const ACERVO = `${BASE}/assets/catalogo/minas-espetinhos`;

const auth = new GoogleAuth({ keyFile: CHAVE, scopes: ["https://www.googleapis.com/auth/drive"] });
const { token } = await (await auth.getClient()).getAccessToken();

const PASTAS = {
  identidade: "1T5qCRTmqLPP3XIkxTnYQNVfcitCLNgD8",
  cardapio: "1J5UdQIGFAdOZ3_IgBc4tLtP2R6IhfdVz",
  produtos: "1c1ESXUgbjpUQv7qcsMgQQ2-Sez0Vnzx-",
  originais: "1EAIstVUGAeN4zqdv7mlWR9Rx_RRvc6Md",
  semMarca: "1I1tqPMrEiMLiMGFaDPBtG3BGCrSyo-vp",
};

const TIPOS = {
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".pdf": "application/pdf",
  ".svg": "image/svg+xml",
  ".html": "text/html",
};

/** Nomes de arquivo viram títulos legíveis: o cliente lê isso no Drive. */
function titulo(nome) {
  const ext = path.extname(nome);
  const base = path
    .basename(nome, ext)
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
  return base + ext;
}

async function subir(arquivo, nome, paiId) {
  const conteudo = await readFile(arquivo);
  const tipo = TIPOS[path.extname(arquivo).toLowerCase()] ?? "application/octet-stream";

  const inicio = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": tipo,
        "X-Upload-Content-Length": String(conteudo.length),
      },
      body: JSON.stringify({ name: nome, parents: [paiId] }),
    },
  );
  if (!inicio.ok) throw new Error(`início ${inicio.status}: ${(await inicio.text()).slice(0, 200)}`);

  const destino = inicio.headers.get("location");
  const envio = await fetch(destino, {
    method: "PUT",
    headers: { "Content-Type": tipo, "Content-Length": String(conteudo.length) },
    body: conteudo,
  });
  if (!envio.ok) throw new Error(`envio ${envio.status}: ${(await envio.text()).slice(0, 200)}`);
  return envio.json();
}

async function lote(rotulo, origem, paiId, filtro = () => true) {
  const nomes = (await readdir(origem, { withFileTypes: true }))
    .filter((d) => d.isFile() && filtro(d.name))
    .map((d) => d.name)
    .sort();

  console.log(`\n${rotulo} (${nomes.length})`);
  let ok = 0;
  for (const nome of nomes) {
    try {
      await subir(path.join(origem, nome), titulo(nome), paiId);
      ok += 1;
      process.stdout.write(".");
    } catch (erro) {
      falhas.push({ rotulo, nome, erro: erro.message });
      process.stdout.write("x");
    }
  }
  console.log(` ${ok}/${nomes.length}`);
  return ok;
}

const falhas = [];
let total = 0;

// Artes finais dos produtos — o que o cliente usa no dia a dia.
total += await lote("Produtos", `${ACERVO}/finais-v2`, PASTAS.produtos);

// Identidade: logo oficial tratado e o original enviado pelo cliente.
total += await lote("Identidade", `${ACERVO}/identidade`, PASTAS.identidade);

// Cardápio: PDFs de impressão e o preview para conferência rápida.
total += await lote("Cardápio", `${ACERVO}/cardapio-impresso`, PASTAS.cardapio, (n) =>
  /\.(pdf|png)$/i.test(n),
);

// Acervo de origem, guardado longe do material de uso.
total += await lote("Versões anteriores › Arquivos originais", `${ACERVO}/originais`, PASTAS.originais);
total += await lote("Versões anteriores › Sem marca", `${ACERVO}/geradas-sem-marca`, PASTAS.semMarca);
total += await lote("Versões anteriores › Histórico", `${ACERVO}/historico`, PASTAS.originais);

console.log(`\n\n${total} arquivos enviados`);
if (falhas.length) {
  console.log(`\n${falhas.length} falhas:`);
  for (const f of falhas) console.log(`  ${f.rotulo} / ${f.nome}: ${f.erro}`);
  process.exitCode = 1;
}
