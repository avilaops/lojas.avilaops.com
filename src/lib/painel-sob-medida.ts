import { prisma } from "./db";
import {
  analisarFichaTecnicaSobMedida,
  criarFichaTecnicaSobMedida,
  type FichaTecnicaSobMedida,
} from "./ficha-tecnica-sob-medida";

export interface RegistroProjetoSobMedida {
  id: string;
  referencia: string;
  referenciaOrigem: string | null;
  contratoVersao: number;
  fichaTecnicaVersao: number | null;
  previaVersao: number | null;
  fichaTecnica: unknown;
  configuracao: unknown;
  estado: string;
  resumo: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  criadoEm: Date;
}

export interface ProjetoSobMedidaPainel extends Omit<RegistroProjetoSobMedida, "fichaTecnica" | "configuracao"> {
  fichaTecnica: FichaTecnicaSobMedida;
}

export type BuscarRegistroProjetoSobMedida = (tenantId: string, id: string) => Promise<RegistroProjetoSobMedida | null>;

const buscarNoBanco: BuscarRegistroProjetoSobMedida = (tenantId, id) => prisma.solicitacaoSobMedida.findFirst({
  where: { id, tenantId },
  select: {
    id: true,
    referencia: true,
    referenciaOrigem: true,
    contratoVersao: true,
    fichaTecnicaVersao: true,
    previaVersao: true,
    fichaTecnica: true,
    configuracao: true,
    estado: true,
    resumo: true,
    nome: true,
    email: true,
    telefone: true,
    criadoEm: true,
  },
});

function fichaPersistidaValida(registro: RegistroProjetoSobMedida): FichaTecnicaSobMedida | null {
  if (registro.fichaTecnica === null || registro.fichaTecnicaVersao === null || registro.previaVersao === null) return null;
  const ficha = analisarFichaTecnicaSobMedida(registro.fichaTecnica);
  if (!ficha) return null;
  if (
    ficha.versao !== registro.fichaTecnicaVersao
    || ficha.previaVersao !== registro.previaVersao
    || ficha.referencia !== registro.referencia
    || ficha.referenciaOrigem !== registro.referenciaOrigem
    || ficha.contratoVersao !== registro.contratoVersao
  ) return null;
  return ficha;
}

function fichaLegada(registro: RegistroProjetoSobMedida): FichaTecnicaSobMedida | null {
  try {
    return criarFichaTecnicaSobMedida({
      referencia: registro.referencia,
      referenciaOrigem: registro.referenciaOrigem,
      contratoVersao: registro.contratoVersao,
      criadaEm: registro.criadoEm,
      configuracao: registro.configuracao,
    });
  } catch {
    return null;
  }
}

export async function buscarProjetoSobMedidaNoPainel(
  tenantId: string,
  id: string,
  buscar: BuscarRegistroProjetoSobMedida = buscarNoBanco,
): Promise<ProjetoSobMedidaPainel | null> {
  const registro = await buscar(tenantId, id);
  if (!registro) return null;

  const semSnapshot = registro.fichaTecnica === null
    && registro.fichaTecnicaVersao === null
    && registro.previaVersao === null;
  const fichaTecnica = semSnapshot ? fichaLegada(registro) : fichaPersistidaValida(registro);
  if (!fichaTecnica) return null;

  return {
    id: registro.id,
    referencia: registro.referencia,
    referenciaOrigem: registro.referenciaOrigem,
    contratoVersao: registro.contratoVersao,
    fichaTecnicaVersao: registro.fichaTecnicaVersao,
    previaVersao: registro.previaVersao,
    estado: registro.estado,
    resumo: registro.resumo,
    nome: registro.nome,
    email: registro.email,
    telefone: registro.telefone,
    criadoEm: registro.criadoEm,
    fichaTecnica,
  };
}
