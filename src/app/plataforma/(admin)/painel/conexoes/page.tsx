import type { Metadata } from "next"
import CabecalhoSecao from "@/components/painel/CabecalhoSecao"
import CentralConexoes from "@/components/painel/CentralConexoes"
import { permite } from "@/lib/operadores"
import { saudeDosCanais } from "@/lib/saude-canais"
import { sessaoDoPainel } from "@/lib/sessao"

export const metadata: Metadata = { title: "Conexões | Painel", robots: { index: false } }
export const dynamic = "force-dynamic"

export default async function Pagina() {
  const sessao = await sessaoDoPainel()
  if (!sessao) return null
  const dados = await saudeDosCanais(sessao.tenant.id)
  return <>
    <CabecalhoSecao titulo="Conexões" descricao="Saúde dos canais, autorizações, sincronizações e webhooks em um só lugar." />
    <CentralConexoes dados={dados} podeTestar={permite(sessao.papel, "configuracoes")} />
  </>
}
