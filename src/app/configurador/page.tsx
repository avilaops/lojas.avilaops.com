import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ConfiguradorClient from "./ConfiguradorClient";
import { recursoAtivo } from "@/lib/recursos";
import { exigirTenant } from "@/lib/tenant";
import "./configurador.css";

export const metadata: Metadata = {
  title: "Crie sua caixa térmica sob medida",
  description: "Configure medidas e características da sua caixa térmica e envie a ficha para análise da fábrica.",
  alternates: { canonical: "/configurador" },
};

export default async function ConfiguradorPage() {
  const tenant = await exigirTenant();
  if (!recursoAtivo(tenant, "configurador_sob_medida")) notFound();
  return <ConfiguradorClient nomeDaLoja={tenant.nome} slugDaLoja={tenant.slug} whatsapp={tenant.whatsapp} />;
}
