import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { exigirTenant, lojaVende, tenantPublico } from "@/lib/tenant";
import CheckoutClient from "./CheckoutClient";

export const metadata: Metadata = { title: "Finalizar compra", robots: { index: false } };

export default async function Checkout() {
  const t = await exigirTenant();
  if (!lojaVende(t)) redirect("/carrinho");
  return <CheckoutClient loja={tenantPublico(t)} />;
}
