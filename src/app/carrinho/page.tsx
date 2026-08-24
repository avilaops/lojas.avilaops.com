import type { Metadata } from "next";
import { exigirTenant, lojaVende, tenantPublico } from "@/lib/tenant";
import CarrinhoClient from "./CarrinhoClient";

export const metadata: Metadata = { title: "Carrinho", robots: { index: false } };

export default async function Carrinho() {
  const t = await exigirTenant();
  return <CarrinhoClient loja={tenantPublico(t)} vende={lojaVende(t)} />;
}
