import { spawnSync } from "node:child_process";
import { readFileSync,readdirSync } from "node:fs";
import assert from "node:assert/strict";
import path from "node:path";

// Apenas o container local criado para esta tarefa. Nunca usa DATABASE_URL.
const CONTAINER="lojas-db-test";
const banco=`lojas_migracao_${Date.now()}_test`;
function psql(sql:string,db=banco) {
  const r=spawnSync("docker",["exec","-i",CONTAINER,"psql","-U","postgres","-d",db,"-v","ON_ERROR_STOP=1","-At"],{input:sql,encoding:"utf8",maxBuffer:10*1024*1024});
  if(r.status!==0)throw new Error(r.stderr||r.stdout);
  return r.stdout.trim();
}
const literal=(v:string)=>`'${v.replace(/'/g,"''")}'`;
psql(`CREATE DATABASE "${banco}";`,"postgres");
const migrations=path.resolve("prisma/migrations");
for(const nome of readdirSync(migrations).filter(n=>n<"20260912150000" && /^\d/.test(n)).sort()) psql(readFileSync(path.join(migrations,nome,"migration.sql"),"utf8"));
const arquivo=process.argv[2];
if(!arquivo)throw new Error("Informe o snapshot público do catálogo a reconciliar.");
const produtos=JSON.parse(readFileSync(arquivo,"utf8"));
for(const id of new Set<string>(produtos.map((p:{tenantId:string})=>p.tenantId))) psql(`INSERT INTO "Tenant" (id,slug,nome,"atualizadoEm") VALUES (${literal(id)},${literal('copia-'+id)},'Cópia QA',now());`);
for(const p of produtos) {
  // Categoria não é copiada: esta prova verifica identidade e dados comerciais.
  delete p.categoriaId;
  const campos=Object.keys(p);
  psql(`INSERT INTO "Produto" (${campos.map(k=>'"'+k+'"').join(',')}) SELECT ${campos.map(k=>'"'+k+'"').join(',')} FROM jsonb_populate_record(NULL::"Produto", ${literal(JSON.stringify(p))}::jsonb);`);
}
psql(`CREATE TABLE catalogo_antes AS SELECT * FROM "Produto";`);
const sql=readFileSync(path.join(migrations,"20260912150000_catalogo_padronizado/migration.sql"),"utf8");
psql(sql);
const erros=psql(`SELECT count(*) FROM catalogo_antes a LEFT JOIN "Produto" p ON p.id=a.id LEFT JOIN "Variante" v ON v."produtoId"=p.id AND v.padrao LEFT JOIN "PrecoVariante" pr ON pr."varianteId"=v.id LEFT JOIN "SaldoEstoque" s ON s."varianteId"=v.id WHERE p.id IS NULL OR v.id IS NULL OR (a.slug,a.nome,a."tenantId",a.ativo,a."precoCentavos",a."precoDeCentavos",a.estoque) IS DISTINCT FROM (p.slug,p.nome,p."tenantId",p.ativo,pr."valorCentavos",pr."comparacaoCentavos",s.fisico) OR nullif(a.sku,'') IS DISTINCT FROM v.sku OR nullif(a.gtin,'') IS DISTINCT FROM v.gtin;`);
assert.equal(erros,"0");
assert.equal(Number(psql('SELECT count(*) FROM "Variante"')),produtos.length);
assert.equal(Number(psql('SELECT count(*) FROM "HistoricoCatalogo"')),produtos.length);
console.log(JSON.stringify({banco,produtos:produtos.length,divergencias:Number(erros),resultado:"migração reconciliada"}));
