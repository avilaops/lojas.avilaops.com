import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { exigirTenant, lojaVende, tenantPublico } from "@/lib/tenant";
import CheckoutClient from "./CheckoutClient";
import { compradorAtual } from "@/lib/conta";
import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "Finalizar compra", robots: { index: false } };

export default async function Checkout() {
  const t = await exigirTenant();
  if (!lojaVende(t)) redirect("/carrinho");
  const c = await compradorAtual(t);
  const endereco = c ? await prisma.enderecoComprador.findFirst({ where: { compradorId: c.id }, orderBy: [{ principal: "desc" }] }) : null;
  return (
    <CheckoutClient
      loja={tenantPublico(t)}
      conta={c ? { nome: c.nome, email: c.email, telefone: c.telefone, documento: c.documento, endereco: endereco ? { cep: endereco.cep, logradouro: endereco.logradouro, numero: endereco.numero, complemento: endereco.complemento, bairro: endereco.bairro, cidade: endereco.cidade, uf: endereco.uf } : null } : null}
    />
  );
}
