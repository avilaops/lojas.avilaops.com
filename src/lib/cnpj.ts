export interface DadosCnpj {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string;
  email: string;
  telefone: string;
  endereco: {
    cep: string;
    logradouro: string;
    numero: string;
    complemento: string;
    bairro: string;
    cidade: string;
    uf: string;
  };
}

type RespostaBrasilApi = Record<string, unknown>;

const texto = (valor: unknown) => typeof valor === "string" ? valor.trim() : "";

export function normalizarDadosCnpj(dados: RespostaBrasilApi): DadosCnpj {
  return {
    cnpj: texto(dados.cnpj).replace(/\D/g, ""),
    razaoSocial: texto(dados.razao_social),
    nomeFantasia: texto(dados.nome_fantasia),
    email: texto(dados.email).toLowerCase(),
    telefone: texto(dados.ddd_telefone_1).replace(/\D/g, ""),
    endereco: {
      cep: texto(dados.cep).replace(/\D/g, ""),
      logradouro: [texto(dados.descricao_tipo_de_logradouro), texto(dados.logradouro)].filter(Boolean).join(" "),
      numero: texto(dados.numero),
      complemento: texto(dados.complemento),
      bairro: texto(dados.bairro),
      cidade: texto(dados.municipio),
      uf: texto(dados.uf).toUpperCase(),
    },
  };
}

export async function consultarCnpj(cnpjBruto: string): Promise<DadosCnpj | null> {
  const cnpj = cnpjBruto.replace(/\D/g, "");
  if (cnpj.length !== 14) return null;

  try {
    const resposta = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 86_400 },
    });
    if (!resposta.ok) return null;
    return normalizarDadosCnpj(await resposta.json() as RespostaBrasilApi);
  } catch {
    return null;
  }
}
