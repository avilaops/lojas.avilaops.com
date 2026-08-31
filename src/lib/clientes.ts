import { prisma } from "./db";
import { STATUS_VENDA } from "./relatorio";

/**
 * Quem já comprou na loja.
 *
 * A plataforma não obriga ninguém a criar conta para comprar, então a lista de
 * clientes não pode sair da tabela de contas: sairia quase vazia. A pessoa é
 * identificada pelo e-mail do pedido, e a conta (`Comprador`), quando existe,
 * só acrescenta endereço e nome melhor.
 *
 * "Gasto" conta apenas pedido que virou dinheiro (ver STATUS_VENDA): carrinho
 * abandonado no Pix não é faturamento, e mostrar como se fosse faria o lojista
 * tomar decisão em cima de número que não existe.
 */
export interface ClienteDaLoja {
  email: string;
  nome: string;
  telefone: string;
  documento: string;
  temConta: boolean;
  pedidos: number;
  gastoCentavos: number;
  primeiraCompra: Date;
  ultimaCompra: Date;
  endereco: string;
}

export async function clientesDaLoja(tenantId: string): Promise<ClienteDaLoja[]> {
  const [compradores, pedidos] = await Promise.all([
    prisma.comprador.findMany({ where: { tenantId }, include: { enderecos: true }, orderBy: { criadoEm: "asc" } }),
    prisma.pedido.findMany({
      where: { tenantId },
      select: { clienteEmail: true, clienteNome: true, clienteTelefone: true, clienteDocumento: true, totalCentavos: true, status: true, criadoEm: true },
    }),
  ]);

  const porEmail = new Map<string, ClienteDaLoja>();

  for (const p of pedidos) {
    const chave = p.clienteEmail.toLowerCase();
    const conta = STATUS_VENDA.includes(p.status as (typeof STATUS_VENDA)[number]);
    const atual = porEmail.get(chave);
    if (atual) {
      atual.pedidos += 1;
      if (conta) atual.gastoCentavos += p.totalCentavos;
      if (p.criadoEm < atual.primeiraCompra) atual.primeiraCompra = p.criadoEm;
      if (p.criadoEm > atual.ultimaCompra) atual.ultimaCompra = p.criadoEm;
    } else {
      porEmail.set(chave, {
        email: chave,
        nome: p.clienteNome,
        telefone: p.clienteTelefone,
        documento: p.clienteDocumento,
        temConta: false,
        pedidos: 1,
        gastoCentavos: conta ? p.totalCentavos : 0,
        primeiraCompra: p.criadoEm,
        ultimaCompra: p.criadoEm,
        endereco: "",
      });
    }
  }

  for (const c of compradores) {
    const chave = c.email.toLowerCase();
    const e = c.enderecos[0];
    const endereco = e ? `${e.logradouro}, ${e.numero} - ${e.bairro}, ${e.cidade}/${e.uf} ${e.cep}` : "";
    const atual = porEmail.get(chave);
    if (atual) {
      atual.temConta = true;
      atual.endereco = endereco;
      atual.nome = c.nome || atual.nome;
    } else {
      porEmail.set(chave, {
        email: chave,
        nome: c.nome,
        telefone: c.telefone ?? "",
        documento: c.documento ?? "",
        temConta: true,
        pedidos: 0,
        gastoCentavos: 0,
        primeiraCompra: c.criadoEm,
        ultimaCompra: c.criadoEm,
        endereco,
      });
    }
  }

  return [...porEmail.values()].sort((a, b) => b.gastoCentavos - a.gastoCentavos);
}
