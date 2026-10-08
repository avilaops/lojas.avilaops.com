import type { Tenant } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { prisma } from "./db";
import { emitir } from "./eventos";
import { avisarBuscadores } from "./indexnow";
import { esquecerTenantEmCache, urlDaLoja } from "./tenant";

/**
 * Provisionamento de uma loja: o que a C2TI faz à mão em "2 a 4 horas de
 * júnior", aqui é uma função.
 *
 * Passos, cada um idempotente e registrado em `Tenant.provisionamento`:
 *   dns  → zona na Cloudflare (padrão avilaops.com) apontando para a plataforma
 *   mail → domínio + caixa `contato@` + aliases no mail.avilaops.com,
 *          com MX/SPF/DKIM/DMARC gravados na mesma zona
 *   n8n  → evento "loja.provisionada" (boas-vindas, treinamento, follow-up)
 *
 * Passo sem credencial configurada fica "pendente", não "erro": a loja já
 * responde no subdomínio da plataforma desde o INSERT, então nada disto
 * bloqueia a aprovação do cliente.
 */

type Resultado = Record<string, string>;

// ── Cloudflare ─────────────────────────────────────────────────────────

const CF = "https://api.cloudflare.com/client/v4";

/**
 * Token com escopo (Bearer) quando existir; senão e-mail + chave global. A chave
 * global abre a conta inteira — é o que temos hoje no tokens.env, e a troca por
 * token restrito está anotada como pendência de segurança.
 */
function cabecalhosCloudflare(): Record<string, string> {
  if (process.env.CLOUDFLARE_TOKEN) return { authorization: `Bearer ${process.env.CLOUDFLARE_TOKEN}` };
  return { "x-auth-email": process.env.CLOUDFLARE_EMAIL ?? "", "x-auth-key": process.env.CLOUDFLARE_API_GLOBAL_KEY ?? "" };
}

function cloudflareConfigurada(): boolean {
  return Boolean(process.env.CLOUDFLARE_ACCOUNT_ID && (process.env.CLOUDFLARE_TOKEN || (process.env.CLOUDFLARE_EMAIL && process.env.CLOUDFLARE_API_GLOBAL_KEY)));
}

async function cf<T>(caminho: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${CF}${caminho}`, {
    ...init,
    headers: { ...cabecalhosCloudflare(), "content-type": "application/json", ...(init?.headers ?? {}) },
    signal: AbortSignal.timeout(15000),
  });
  const corpo = (await r.json()) as { success: boolean; result: T; errors?: Array<{ message: string }> };
  if (!corpo.success) throw new Error(corpo.errors?.map((e) => e.message).join("; ") || `Cloudflare ${r.status}`);
  return corpo.result;
}

interface Registro { type: string; name: string; content: string; priority?: number; proxied?: boolean }

async function garantirZona(dominio: string): Promise<{ id: string; name_servers: string[] }> {
  const existentes = await cf<Array<{ id: string; name_servers: string[] }>>(`/zones?name=${dominio}`);
  if (existentes[0]) return existentes[0];
  return cf(`/zones`, {
    method: "POST",
    body: JSON.stringify({ name: dominio, account: { id: process.env.CLOUDFLARE_ACCOUNT_ID }, type: "full" }),
  });
}

async function gravarRegistros(zoneId: string, registros: Registro[]) {
  const atuais = await cf<Array<{ id: string; type: string; name: string; content: string }>>(`/zones/${zoneId}/dns_records?per_page=500`);
  for (const reg of registros) {
    const nome = reg.name.toLowerCase();
    const igual = atuais.find((a) => a.type === reg.type && a.name.toLowerCase() === nome && a.content === reg.content);
    if (igual) continue;
    // Um registro do mesmo tipo/nome com conteúdo diferente é atualizado (MX e
    // TXT podem coexistir; A/AAAA/CNAME de um nome são substituídos).
    const substituivel = ["A", "AAAA", "CNAME"].includes(reg.type) ? atuais.find((a) => a.type === reg.type && a.name.toLowerCase() === nome) : undefined;
    if (substituivel) {
      await cf(`/zones/${zoneId}/dns_records/${substituivel.id}`, { method: "PUT", body: JSON.stringify({ ...reg, ttl: 1 }) });
    } else {
      await cf(`/zones/${zoneId}/dns_records`, { method: "POST", body: JSON.stringify({ ...reg, ttl: 1 }) });
    }
  }
}

async function passoDns(t: Tenant): Promise<string> {
  if (!cloudflareConfigurada()) return "pendente: credencial da Cloudflare ausente";
  if (!t.dominioPrincipal) return "pendente: loja sem domínio próprio";
  const ipv4 = process.env.LOJAS_IPV4;
  const ipv6 = process.env.LOJAS_IPV6;
  if (!ipv4) return "pendente: LOJAS_IPV4 ausente";

  const apex = t.dominioPrincipal.replace(/^www\./, "");
  const zona = await garantirZona(apex);
  const registros: Registro[] = [
    { type: "A", name: apex, content: ipv4, proxied: true },
    { type: "CNAME", name: `www.${apex}`, content: apex, proxied: true },
  ];
  if (ipv6) registros.push({ type: "AAAA", name: apex, content: ipv6, proxied: true });
  await gravarRegistros(zona.id, registros);

  const hosts = Array.from(new Set([...t.dominios, apex, `www.${apex}`]));
  await prisma.tenant.update({ where: { id: t.id }, data: { dominios: hosts } });
  return `ok: zona ${zona.id}; NS ${zona.name_servers.join(", ")}`;
}

// ── mail.avilaops.com ──────────────────────────────────────────────────

async function mail<T>(caminho: string, corpo: unknown): Promise<T> {
  const r = await fetch(`${process.env.MAIL_API_URL}${caminho}`, {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.MAIL_API_TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify(corpo),
    signal: AbortSignal.timeout(15000),
  });
  const dados = (await r.json().catch(() => ({}))) as T & { error?: { message?: string } };
  // 409 = já existe: idempotência, não erro.
  if (!r.ok && r.status !== 409) throw new Error(dados?.error?.message ?? `mail ${r.status}`);
  return dados;
}

interface DominioMail { id?: string; dns_records?: Array<{ type: string; host: string; value: string; priority?: number }> }

async function passoMail(t: Tenant): Promise<string> {
  if (!process.env.MAIL_API_URL || !process.env.MAIL_API_TOKEN) return "pendente: MAIL_API_TOKEN ausente";
  if (!t.dominioPrincipal) return "pendente: loja sem domínio próprio";
  const apex = t.dominioPrincipal.replace(/^www\./, "");

  const dominio = await mail<DominioMail>("/domains", { domain: apex, clientRef: `loja:${t.slug}` });

  // Registros de e-mail entram na mesma zona do passo dns, quando ela existir.
  if (dominio.dns_records?.length && cloudflareConfigurada()) {
    const zona = await garantirZona(apex);
    await gravarRegistros(
      zona.id,
      dominio.dns_records.map((r) => ({
        type: r.type,
        name: r.host === "@" ? apex : `${r.host}.${apex}`,
        content: r.value,
        priority: r.priority,
        proxied: false,
      })),
    );
  }

  const senha = randomBytes(12).toString("base64url");
  await mail("/mailboxes", {
    domain: apex,
    username: "contato",
    password: senha,
    display_name: t.nome,
    quota_gb: 5,
    notify_to: t.emailContato ?? undefined,
  });
  for (const alias of ["pedidos", "vendas"]) {
    await mail("/aliases", { domain: apex, alias, target: `contato@${apex}` }).catch(() => undefined);
  }

  // Só preenche quando a loja ainda não tem remetente: rodar o provisionamento
  // de novo não desfaz a escolha do lojista (a Vedashow assina como vendas@).
  await prisma.tenant.updateMany({ where: { id: t.id, emailRemetente: null }, data: { emailRemetente: `pedidos@${apex}` } });
  return `ok: contato@${apex} (senha enviada para ${t.emailContato ?? "ninguém, defina emailContato"})`;
}

// ── Orquestração ───────────────────────────────────────────────────────

async function executar(nome: string, fn: () => Promise<string>): Promise<string> {
  try {
    return await fn();
  } catch (erro) {
    console.error(`[provisionar] ${nome}:`, erro);
    return `erro: ${erro instanceof Error ? erro.message : String(erro)}`;
  }
}

export async function provisionarLoja(slug: string): Promise<Resultado> {
  const t = await prisma.tenant.findUniqueOrThrow({ where: { slug } });
  const passos: Resultado = { ...((t.provisionamento as Resultado) ?? {}) };

  passos.dns = await executar("dns", () => passoDns(t));
  const depoisDns = await prisma.tenant.findUniqueOrThrow({ where: { slug } });
  passos.mail = await executar("mail", () => passoMail(depoisDns));

  const tudoOk = Object.values(passos).every((v) => v.startsWith("ok"));
  const atualizado = await prisma.tenant.update({
    where: { id: t.id },
    data: { provisionamento: passos, ...(tudoOk && t.status === "PROVISIONANDO" ? { status: "ATIVA" } : {}) },
  });
  esquecerTenantEmCache(slug);

  // Loja nova nasce invisível: sem este empurrão, ela só entra no radar quando
  // o buscador a descobrir sozinho — o que leva semanas — ou quando o lojista
  // cadastrar o primeiro produto. Avisar na hora em que ela fica ATIVA é o
  // único momento em que dá para fazer isso sem depender de ninguém lembrar.
  if (atualizado.status === "ATIVA") {
    void avisarBuscadores(atualizado, ["/", "/produtos", "/sobre", "/contato"]);
  }

  // Sucesso e falha são eventos distintos: o n8n não deduz erro lendo os
  // passos, ele só reage ao tipo. `loja.ativada` sai uma vez só, na virada
  // para ATIVA — é o marco de "loja no ar" que conta prazo para o resto.
  const base = { slug, nome: atualizado.nome, url: urlDaLoja(atualizado), emailContato: atualizado.emailContato, whatsapp: atualizado.whatsapp };
  await emitir(tudoOk ? { tipo: "loja.provisionada", passos, ...base } : { tipo: "loja.provisionamento-falhou", passos, ...base });
  if (tudoOk && t.status === "PROVISIONANDO" && atualizado.status === "ATIVA") await emitir({ tipo: "loja.ativada", ...base });
  passos.n8n = process.env.N8N_WEBHOOK_URL ? "ok: evento emitido" : "pendente: N8N_WEBHOOK_URL ausente";
  await prisma.tenant.update({ where: { id: atualizado.id }, data: { provisionamento: passos } });

  return passos;
}

export async function anunciarLojaCriada(t: Tenant) {
  await emitir({ tipo: "loja.criada", slug: t.slug, nome: t.nome, url: urlDaLoja(t), emailContato: t.emailContato, whatsapp: t.whatsapp });
}
