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
type RespostaCnpjWs = Record<string, unknown> & {
  estabelecimento?: Record<string, unknown> & {
    estado?: Record<string, unknown>;
    cidade?: Record<string, unknown>;
  };
};

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

export function normalizarDadosCnpjWs(dados: RespostaCnpjWs): DadosCnpj {
  const estabelecimento = dados.estabelecimento ?? {};
  const estado = estabelecimento.estado ?? {};
  const cidade = estabelecimento.cidade ?? {};
  return {
    cnpj: texto(estabelecimento.cnpj).replace(/\D/g, ""),
    razaoSocial: texto(dados.razao_social),
    nomeFantasia: texto(estabelecimento.nome_fantasia),
    email: texto(estabelecimento.email).toLowerCase(),
    telefone: [texto(estabelecimento.ddd1), texto(estabelecimento.telefone1)].join("").replace(/\D/g, ""),
    endereco: {
      cep: texto(estabelecimento.cep).replace(/\D/g, ""),
      logradouro: [texto(estabelecimento.tipo_logradouro), texto(estabelecimento.logradouro)].filter(Boolean).join(" "),
      numero: texto(estabelecimento.numero),
      complemento: texto(estabelecimento.complemento),
      bairro: texto(estabelecimento.bairro),
      cidade: texto(cidade.nome),
      uf: texto(estado.sigla).toUpperCase(),
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
    if (resposta.ok) return normalizarDadosCnpj(await resposta.json() as RespostaBrasilApi);
  } catch {}

  // Consulta pública de contingência. A tela não pode afirmar que uma empresa
  // não existe só porque um fornecedor gratuito respirou fundo por oito
  // segundos — especialmente depois que o lojista já digitou tudo certo.
  try {
    const resposta = await fetch(`https://publica.cnpj.ws/cnpj/${cnpj}`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 86_400 },
    });
    if (resposta.ok) return normalizarDadosCnpjWs(await resposta.json() as RespostaCnpjWs);
  } catch {}

  return null;
}
