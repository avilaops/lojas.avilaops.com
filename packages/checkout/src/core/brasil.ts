// Validação e formatação dos campos que todo checkout brasileiro precisa.
//
// Isto é código próprio de propósito. CPF, CNPJ e CEP são especificação
// pública e estável , depender de biblioteca externa para calcular dígito
// verificador significa carregar dependência, supply chain e breaking change
// por uma conta de módulo 11 que cabe em vinte linhas.

/** Só os dígitos. É nesta forma que documento e telefone viajam para a API. */
export function apenasDigitos(valor: string): string {
  return valor.replace(/\D/g, "");
}

/**
 * CPF pelo dígito verificador real, não por tamanho.
 *
 * Validar só o comprimento aceita "111.111.111-11", que é o que um bot digita
 * e o que um cliente distraído inventa quando não quer informar o documento.
 * O pedido só descobre o problema na hora de emitir a nota fiscal.
 */
export function validarCpf(valor: string): boolean {
  const cpf = apenasDigitos(valor);
  if (cpf.length !== 11) return false;
  // Todos os dígitos iguais passam no cálculo do módulo 11 e não são CPF.
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  const digito = (ate: number): number => {
    let soma = 0;
    for (let i = 0; i < ate; i += 1) {
      soma += Number(cpf[i]) * (ate + 1 - i);
    }
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };

  return digito(9) === Number(cpf[9]) && digito(10) === Number(cpf[10]);
}

/** CNPJ pelo dígito verificador, mesma lógica de módulo 11 com pesos próprios. */
export function validarCnpj(valor: string): boolean {
  const cnpj = apenasDigitos(valor);
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cnpj)) return false;

  const digito = (ate: number): number => {
    // Percorre da direita para a esquerda com pesos 2..9 reiniciando em 2.
    // O peso inicial é 2, não `ate - 7`: aquela versão deslocava a sequência
    // inteira em uma posição e reprovava CNPJ válido. Passava despercebida
    // porque continuava reprovando os inválidos também , o teste com um CNPJ
    // real é o que expôs.
    let peso = 2;
    let soma = 0;
    for (let i = ate - 1; i >= 0; i -= 1) {
      soma += Number(cnpj[i]) * peso;
      peso = peso === 9 ? 2 : peso + 1;
    }
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };

  return digito(12) === Number(cnpj[12]) && digito(13) === Number(cnpj[13]);
}

/** Aceita pessoa física ou jurídica , a loja vende para as duas. */
export function validarDocumento(valor: string): boolean {
  const digitos = apenasDigitos(valor);
  if (digitos.length === 11) return validarCpf(digitos);
  if (digitos.length === 14) return validarCnpj(digitos);
  return false;
}

export function tipoDocumento(valor: string): "CPF" | "CNPJ" | null {
  const digitos = apenasDigitos(valor);
  if (digitos.length === 11) return "CPF";
  if (digitos.length === 14) return "CNPJ";
  return null;
}

/**
 * Celular brasileiro: DDD válido (11 a 99) e nove dígitos começando em 9.
 *
 * O rigor aqui não é preciosismo. Este telefone é por onde o cliente recebe o
 * rastreio e por onde a loja resolve problema de entrega , número errado vira
 * pedido entregue sem ninguém para receber.
 */
export function validarCelular(valor: string): boolean {
  const tel = apenasDigitos(valor);
  if (tel.length !== 11) return false;
  const ddd = Number(tel.slice(0, 2));
  if (ddd < 11 || ddd > 99) return false;
  return tel[2] === "9";
}

export function validarCep(valor: string): boolean {
  return apenasDigitos(valor).length === 8;
}

// ── Máscaras ────────────────────────────────────────────────────────────────
// Aplicadas enquanto a pessoa digita, então precisam funcionar com valor
// incompleto: mascarar só no final faz o campo "pular" ao sair do foco.

export function mascararDocumento(valor: string): string {
  const d = apenasDigitos(valor).slice(0, 14);

  if (d.length <= 11) {
    return d
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2");
  }

  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

export function mascararCelular(valor: string): string {
  const d = apenasDigitos(valor).slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function mascararCep(valor: string): string {
  const d = apenasDigitos(valor).slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

// ── Endereço por CEP ────────────────────────────────────────────────────────

export interface EnderecoViaCep {
  cep: string;
  logradouro: string;
  bairro: string;
  cidade: string;
  uf: string;
}

/**
 * Consulta o ViaCEP para preencher o endereço.
 *
 * É o passo que mais reduz abandono no checkout brasileiro: o cliente digita
 * oito dígitos em vez de cinco campos. Falha de rede aqui devolve `null` em vez
 * de lançar , CEP não encontrado não pode travar a compra, os campos apenas
 * continuam abertos para digitação manual.
 */
export async function buscarEnderecoPorCep(
  cep: string,
  opcoes: { signal?: AbortSignal } = {},
): Promise<EnderecoViaCep | null> {
  const digitos = apenasDigitos(cep);
  if (digitos.length !== 8) return null;

  try {
    const resposta = await fetch(`https://viacep.com.br/ws/${digitos}/json/`, {
      signal: opcoes.signal,
    });
    if (!resposta.ok) return null;

    const dados = await resposta.json();
    if (dados.erro) return null;

    return {
      cep: mascararCep(digitos),
      logradouro: dados.logradouro ?? "",
      bairro: dados.bairro ?? "",
      cidade: dados.localidade ?? "",
      uf: dados.uf ?? "",
    };
  } catch {
    return null;
  }
}
