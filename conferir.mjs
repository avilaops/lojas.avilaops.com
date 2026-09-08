const token = process.argv[2];
const h = { Authorization: `Bearer ${token}` };
const PASTAS = {
  "01 · Artes dos Produtos": "11CzrOQ81NaomXJkeSdjnFPP1KoHi_rTw",
  "02 · Cardápio": "1jiXvNhjXk7kgMgn82e1DyxUQn-eCAzkN",
  "03 · Identidade Visual": "1uX3nI1zLTtvgj_D3rKSTX1-524m7UCu7",
  "  Arquivos originais": "1eJCwabpJCXSvRa9WluXOFCV0aqC1mkhx",
  "  Geradas sem marca": "1gARkvbaae3BRSk8QYsRgHLgcW1rUthbl",
  "  Versões anteriores": "1lfbceSm5IodY3QLaYA8Wt9HU415ekC-U",
};
for (const [nome, id] of Object.entries(PASTAS)) {
  const r = await fetch(`https://www.googleapis.com/drive/v3/files?q='${id}'+in+parents+and+trashed=false&fields=files(name,size)&pageSize=100&orderBy=name`, { headers: h });
  const { files } = await r.json();
  const mb = files.reduce((s, f) => s + Number(f.size ?? 0), 0) / 1048576;
  console.log(`\n${nome} — ${files.length} arquivos, ${mb.toFixed(1)} MB`);
  if (nome.startsWith("0")) for (const f of files) console.log(`   ${f.name}`);
}
