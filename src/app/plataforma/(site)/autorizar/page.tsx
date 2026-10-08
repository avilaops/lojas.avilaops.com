import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import AutorizarConexao from "@/components/painel/AutorizarConexao";
import { clientePorId } from "@/lib/mcp-conexoes";
import { abrirPedido, COOKIE_DO_PEDIDO } from "@/lib/mcp-oauth";
import { permite } from "@/lib/operadores";
import { sessaoDoPainel } from "@/lib/sessao";

export const metadata: Metadata = {
  title: "Conectar assistente",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

const RECUSAS: Record<string, string> = {
  cliente: "Este assistente não está registrado no conector. Remova o conector no assistente e adicione de novo.",
  retorno: "O endereço de retorno do pedido não confere com o que o assistente registrou. Por segurança, a conexão não foi aberta.",
};

function Aviso({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="pl-site-claro pl-auth-pagina">
      <div className="pl-auth-simples">
        <span>Conector de IA</span>
        <h1>{titulo}</h1>
        {children}
      </div>
    </div>
  );
}

/**
 * A tela em que o lojista autoriza um assistente a agir pela loja.
 *
 * O pedido chega no cookie assinado por `/oauth/authorize`. Quem não está
 * logado vai ao `/entrar` e volta para cá pelo painel, que confere o mesmo
 * cookie: assim as três portas de entrada (login único, Google, senha)
 * terminam na autorização sem que nenhuma precise saber dela.
 *
 * O que o lojista precisa ler antes de dizer sim: qual loja, qual assistente e
 * **para onde o acesso vai**. O nome quem escolhe é o cliente, e qualquer um
 * pode se registrar como "Claude"; o endereço de retorno é o que não se forja.
 */
export default async function AutorizarPage({ searchParams }: { searchParams: Promise<{ recusa?: string }> }) {
  const { recusa } = await searchParams;
  if (recusa) {
    return (
      <Aviso titulo="Não foi possível conectar.">
        <p>{RECUSAS[recusa] ?? RECUSAS.cliente}</p>
      </Aviso>
    );
  }

  const pedido = abrirPedido((await cookies()).get(COOKIE_DO_PEDIDO)?.value);
  if (!pedido) {
    return (
      <Aviso titulo="Este pedido de conexão venceu.">
        <p>Volte ao assistente e peça para conectar a loja de novo. O pedido vale por dez minutos.</p>
        <p className="pl-auth-links"><Link href="/painel/ia">Ir para o painel</Link></p>
      </Aviso>
    );
  }

  const s = await sessaoDoPainel();
  if (!s) redirect("/entrar");

  const cliente = await clientePorId(pedido.clienteId);
  if (!cliente) {
    return (
      <Aviso titulo="Não foi possível conectar.">
        <p>{RECUSAS.cliente}</p>
      </Aviso>
    );
  }

  const destino = new URL(pedido.retorno);
  const naMaquina = destino.protocol === "http:";

  return (
    <div className="pl-site-claro pl-auth-pagina">
      <div className="pl-auth-simples">
        <span>Conector de IA</span>
        <h1>Conectar {cliente.nome} à loja {s.tenant.nome}?</h1>
        <p>
          O assistente vai agir na loja em seu nome, dentro do que você marcar abaixo. Tudo o que ele fizer fica
          registrado em Painel, IA e API, e você pode desconectar quando quiser.
        </p>
        <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          O acesso será entregue a{" "}
          <strong>{naMaquina ? "um programa neste computador" : destino.host}</strong>.{" "}
          {naMaquina
            ? "Só continue se foi você quem acabou de pedir a conexão em um programa instalado aqui."
            : "Só continue se foi você quem acabou de pedir a conexão nesse endereço."}
        </p>
        <AutorizarConexao
          podeAutorizar={permite(s.papel, "configuracoes")}
          planoPermite={s.tenant.plano === "LOJA_PRO"}
          lojaAtiva={s.tenant.status === "ATIVA"}
        />
      </div>
    </div>
  );
}
