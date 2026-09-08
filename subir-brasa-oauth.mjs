import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

/**
 * Sobe o acervo da Brasa Mineira para a pasta do Drive.
 *
 * Usa o token OAuth da conta pessoal (via `gcloud auth print-access-token`), e
 * não a conta de serviço: contas de serviço não têm cota de armazenamento e
 * recebem 403 em qualquer upload fora de um Drive Compartilhado. As pastas
 * podem ser criadas por elas — metadados não consomem cota —, mas os arquivos
 * precisam de um dono humano.
 *
 * Uso: node subir-brasa-oauth.mjs <token>
 */

const token = process.argv[2];
if (!token) {
  console.error("uso: node subir-brasa-oauth.mjs <token>");
  process.exit(1);
}

const ACERVO =
  "D:/avilaops.com/comandeiro.com.br/operacao/minas.comandeiro.com.br/assets/catalogo/minas-espetinhos";

const PASTAS = {
  produtos: "11CzrOQ81NaomXJkeSdjnFPP1KoHi_rTw",
  cardapio: "1jiXvNhjXk7kgMgn82e1DyxUQn-eCAzkN",
  identidade: "1uX3nI1zLTtvgj_D3rKSTX1-524m7UCu7",
  originais: "1eJCwabpJCXSvRa9WluXOFCV0aqC1mkhx",
  semMarca: "1gARkvbaae3BRSk8QYsRgHLgcW1rUthbl",
  historico: "1lfbceSm5IodY3QLaYA8Wt9HU415ekC-U",
};

const TIPOS = {
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".pdf": "application/pdf",
  ".html": "text/html",
};

/** O cliente lê estes nomes no Drive, então vão acentuados e capitalizados. */
const NOMES = {
  "agua-mineral-com-gas": "Água Mineral com Gás",
  "agua-mineral-sem-gas": "Água Mineral sem Gás",
  "carne-fraldinha": "Carne Fraldinha",
  "cerveja-amstel-lata": "Cerveja Amstel Lata",
  "cerveja-antarctica": "Cerveja Antarctica",
  coracao: "Coração",
  frango: "Frango",
  "heineken-long-neck": "Heineken Long Neck",
  "kafta-com-queijo": "Kafta com Queijo",
  "kafta-recheada-com-queijo": "Kafta Recheada com Queijo",
  linguica: "Linguiça",
  "linguica-apimentada": "Linguiça Apimentada",
  "medalhao-de-carne": "Medalhão de Carne",
  "medalhao-de-frango": "Medalhão de Frango",
  "medalhao-de-mandioca": "Medalhão de Mandioca",
  "medalhao-de-queijo": "Medalhão de Queijo",
  panceta: "Panceta",
  "pao-de-alho": "Pão de Alho",
  "queijo-coalho": "Queijo Coalho",
  "queijo-nozinho": "Queijo Nozinho",
  "refrigerante-lata": "Refrigerante Lata",
  "suco-del-valle-lata": "Suco Del Valle Lata",
  tulipa: "Tulipa",
  "logo-oficial": "Logo Oficial",
  "logo-brasa-mineira-original": "Logo Original (recebido do cliente)",
  "cardapio-brasa-mineira-A4": "Cardápio Brasa Mineira A4",
  "cardapio-minas-espetinhos-A4": "Cardápio Minas Espetinhos A4",
  "preview-brasa": "Prévia do Cardápio",
  preview: "Prévia do Cardápio (Minas Espetinhos)",
};

function titulo(nome) {
  const ext = path.extname(nome);
  const base = path.basename(nome, ext);
  const limpo = base.replace(/-v\d+(-recebida|-primeira-padronizacao)?$/, "");
  const sufixo = base.slice(limpo.length);
  const bonito = NOMES[limpo] ?? limpo.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return bonito + (sufixo ? ` ${sufixo.replace(/-/g, " ").trim()}` : "") + ext;
}

/**
 * Upload retomável: o cardápio A4 tem 7,8 MB, acima do limite de 5 MB do
 * multipart.
 */
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
  if (!inicio.ok) throw new Error(`início ${inicio.status}: ${(await inicio.text()).slice(0, 150)}`);

  const envio = await fetch(inicio.headers.get("location"), {
    method: "PUT",
    headers: { "Content-Type": tipo, "Content-Length": String(conteudo.length) },
    body: conteudo,
  });
  if (!envio.ok) throw new Error(`envio ${envio.status}: ${(await envio.text()).slice(0, 150)}`);
  return envio.json();
}

const falhas = [];

async function lote(rotulo, origem, paiId, filtro = () => true) {
  const nomes = (await readdir(origem, { withFileTypes: true }))
    .filter((d) => d.isFile() && filtro(d.name))
    .map((d) => d.name)
    .sort();

  process.stdout.write(`${rotulo.padEnd(34)} `);
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
  console.log(`  ${ok}/${nomes.length}`);
  return ok;
}

let total = 0;
total += await lote("01 Artes dos Produtos", `${ACERVO}/finais-v2`, PASTAS.produtos);
total += await lote("02 Cardápio", `${ACERVO}/cardapio-impresso`, PASTAS.cardapio, (n) => /\.(pdf|png)$/i.test(n));
total += await lote("03 Identidade Visual", `${ACERVO}/identidade`, PASTAS.identidade);
total += await lote("04 Acervo › Originais", `${ACERVO}/originais`, PASTAS.originais);
total += await lote("04 Acervo › Sem marca", `${ACERVO}/geradas-sem-marca`, PASTAS.semMarca);
total += await lote("04 Acervo › Versões anteriores", `${ACERVO}/historico`, PASTAS.historico);

console.log(`\n${total} arquivos enviados`);
if (falhas.length) {
  console.log(`\n${falhas.length} falhas:`);
  for (const f of falhas) console.log(`  ${f.rotulo} / ${f.nome}: ${f.erro}`);
  process.exitCode = 1;
}
