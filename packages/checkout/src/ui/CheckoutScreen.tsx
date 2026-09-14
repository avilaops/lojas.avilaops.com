"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  apenasDigitos,
  buscarEnderecoPorCep,
  mascararCelular,
  mascararCep,
  mascararDocumento,
  validarCelular,
  validarCep,
  validarDocumento,
} from "../core/brasil.ts";
import { calcularTotais, formatarBRL, opcoesDeParcelamento } from "../core/totais.ts";
import type {
  Cliente,
  EnderecoEntrega,
  ItemCarrinho,
  MeioPagamento,
  OpcaoFrete,
  ResultadoPagamento,
} from "../core/types.ts";
import { FRETE_RETIRADA_ID } from "../core/types.ts";

type Passo = "identificacao" | "entrega" | "pagamento";

const PASSOS: Array<{ id: Passo; rotulo: string }> = [
  { id: "identificacao", rotulo: "Identificação" },
  { id: "entrega", rotulo: "Entrega" },
  { id: "pagamento", rotulo: "Pagamento" },
];

export interface CheckoutScreenProps {
  itens: ItemCarrinho[];
  /** Opções de frete já cotadas para o carrinho. Inclua a retirada, se houver. */
  fretes: OpcaoFrete[];
  /** Meios aceitos. A ordem é a exibida. */
  meiosPagamento?: MeioPagamento[];
  /**
   * Envia o pedido ao servidor, que recalcula o total e cobra no gateway.
   *
   * A tela nunca fala com o Mercado Pago direto: o access token só existe no
   * servidor, e o total precisa ser recalculado longe do navegador.
   */
  aoFinalizar: (dados: {
    cliente: Cliente;
    entrega: EnderecoEntrega | null;
    freteId: string;
    meioPagamento: MeioPagamento;
    parcelas: number;
    cartaoToken?: string;
    bandeira?: string;
  }) => Promise<ResultadoPagamento>;
  /** Cotação de frete por CEP, quando a loja recota ao saber o destino. */
  aoInformarCep?: (cep: string) => Promise<OpcaoFrete[]>;
  /**
   * Disparado quando a pessoa conclui o passo de identificação (nome, e-mail,
   * celular válidos). É o gancho do carrinho abandonado: a loja já sabe quem
   * é antes de saber se vai pagar. Falha aqui nunca trava o checkout.
   */
  aoIdentificar?: (cliente: Cliente) => void | Promise<void>;
  /**
   * Dados que a loja já conhece (comprador logado). Preenchem os campos na
   * primeira renderização; a pessoa continua livre para editar.
   */
  clienteInicial?: Partial<Cliente>;
  enderecoInicial?: Partial<EnderecoEntrega>;
  desconto?: number;
  /**
   * Campos de cartão do provedor, injetados de fora.
   *
   * É este buraco que mantém a tela agnóstica: quem usa Mercado Pago passa o
   * `MercadoPagoCardBrick`, quem usa outro provedor passa o equivalente dele, e
   * o CheckoutScreen continua sem importar gateway nenhum.
   *
   * Quando fornecido, o próprio slot dispara o pagamento pela tokenização , o
   * botão "Pagar" da tela some no passo de cartão para não existirem dois
   * botões de submissão disputando o mesmo clique.
   */
  slotCartao?: (contexto: {
    totalEmCentavos: number;
    emailCliente: string;
    aoTokenizar: (dados: {
      token: string;
      parcelas: number;
      bandeira?: string;
    }) => void | Promise<void>;
  }) => React.ReactNode;
}

const VAZIO_CLIENTE: Cliente = {
  nome: "",
  sobrenome: "",
  email: "",
  telefone: "",
  documento: "",
};

const VAZIO_ENDERECO: EnderecoEntrega = {
  cep: "",
  logradouro: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "",
  uf: "",
};

const ROTULO_MEIO: Record<MeioPagamento, { titulo: string; sub: string }> = {
  pix: { titulo: "PIX", sub: "Aprovação em segundos" },
  cartao: { titulo: "Cartão de crédito", sub: "Parcelamento sem juros" },
  boleto: { titulo: "Boleto bancário", sub: "Compensa em até 3 dias úteis" },
};

/**
 * Tela de checkout em três passos.
 *
 * Três e não um: formulário único de vinte campos assusta no celular, e três e
 * não cinco porque cada passo a mais é uma chance de abandono. Identificação,
 * entrega e pagamento é o menor recorte que ainda deixa cada tela curta.
 *
 * O componente não conhece gateway nenhum , ele chama `aoFinalizar` e reage ao
 * `ResultadoPagamento`. É isso que permite a mesma tela servir clientes com
 * provedores diferentes.
 */
export default function CheckoutScreen({
  itens,
  fretes,
  meiosPagamento = ["pix", "cartao", "boleto"],
  aoFinalizar,
  aoInformarCep,
  aoIdentificar,
  clienteInicial,
  enderecoInicial,
  desconto = 0,
  slotCartao,
}: CheckoutScreenProps) {
  const [passo, setPasso] = useState<Passo>("identificacao");
  const [cliente, setCliente] = useState<Cliente>({ ...VAZIO_CLIENTE, ...clienteInicial });
  const [endereco, setEndereco] = useState<EnderecoEntrega>({ ...VAZIO_ENDERECO, ...enderecoInicial });
  const [opcoesFrete, setOpcoesFrete] = useState<OpcaoFrete[]>(fretes);
  const [freteId, setFreteId] = useState<string>(fretes[0]?.id ?? "");
  const [meio, setMeio] = useState<MeioPagamento>(meiosPagamento[0] ?? "pix");
  const [parcelas, setParcelas] = useState(1);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoPagamento | null>(null);

  const tituloRef = useRef<HTMLHeadingElement>(null);

  const frete = opcoesFrete.find((f) => f.id === freteId) ?? null;
  const retirada = frete?.id === FRETE_RETIRADA_ID;
  const totais = useMemo(
    () => calcularTotais({ itens, frete, desconto }),
    [itens, frete, desconto],
  );
  const parcelamento = useMemo(
    () => opcoesDeParcelamento({ total: totais.total }),
    [totais.total],
  );

  // Ao trocar de passo o foco vai para o título. Sem isso, quem navega por
  // teclado ou leitor de tela continua no fim do formulário anterior e não
  // recebe aviso de que a tela mudou.
  useEffect(() => {
    tituloRef.current?.focus();
  }, [passo]);

  function definirCliente<K extends keyof Cliente>(campo: K, valor: Cliente[K]) {
    setCliente((atual) => ({ ...atual, [campo]: valor }));
    setErros((atual) => {
      if (!atual[campo]) return atual;
      const proximo = { ...atual };
      delete proximo[campo];
      return proximo;
    });
  }

  async function preencherPorCep(valor: string) {
    const mascarado = mascararCep(valor);
    setEndereco((atual) => ({ ...atual, cep: mascarado }));
    if (!validarCep(mascarado)) return;

    setBuscandoCep(true);
    const achado = await buscarEnderecoPorCep(mascarado);
    setBuscandoCep(false);

    if (achado) {
      setEndereco((atual) => ({
        ...atual,
        cep: achado.cep,
        logradouro: achado.logradouro || atual.logradouro,
        bairro: achado.bairro || atual.bairro,
        cidade: achado.cidade,
        uf: achado.uf,
      }));
    }

    if (aoInformarCep) {
      const cotados = await aoInformarCep(apenasDigitos(mascarado));
      if (cotados.length) {
        setOpcoesFrete(cotados);
        setFreteId((atual) => (cotados.some((c) => c.id === atual) ? atual : cotados[0]!.id));
      }
    }
  }

  function validarIdentificacao(): boolean {
    const novos: Record<string, string> = {};
    if (cliente.nome.trim().length < 2) novos.nome = "Informe o seu nome.";
    if (cliente.sobrenome.trim().length < 2) novos.sobrenome = "Informe o sobrenome.";
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(cliente.email)) {
      novos.email = "E-mail inválido , é nele que o comprovante chega.";
    }
    if (!validarCelular(cliente.telefone)) {
      novos.telefone = "Celular com DDD, no formato (16) 99999-9999.";
    }
    if (!validarDocumento(cliente.documento)) {
      // A mensagem diz por que existe a exigência. "Documento inválido" faz o
      // cliente conferir a digitação; dizer que é para a nota fiscal explica
      // por que o campo não pode ser pulado.
      novos.documento = "CPF ou CNPJ inválido. Ele é obrigatório para a nota fiscal.";
    }
    setErros(novos);
    return Object.keys(novos).length === 0;
  }

  function validarEntrega(): boolean {
    if (retirada) return true;

    const novos: Record<string, string> = {};
    if (!validarCep(endereco.cep)) novos.cep = "CEP inválido.";
    if (endereco.logradouro.trim().length < 3) novos.logradouro = "Informe a rua.";
    if (!endereco.numero.trim()) novos.numero = "Informe o número, ou 'S/N'.";
    if (endereco.bairro.trim().length < 2) novos.bairro = "Informe o bairro.";
    if (endereco.cidade.trim().length < 2) novos.cidade = "Informe a cidade.";
    if (endereco.uf.trim().length !== 2) novos.uf = "UF com duas letras.";
    if (!freteId) novos.frete = "Escolha uma forma de entrega.";
    setErros(novos);
    return Object.keys(novos).length === 0;
  }

  function avancar() {
    setErroGeral(null);
    if (passo === "identificacao" && validarIdentificacao()) {
      setPasso("entrega");
      void Promise.resolve(aoIdentificar?.(cliente)).catch(() => undefined);
    }
    else if (passo === "entrega" && validarEntrega()) setPasso("pagamento");
  }

  async function finalizar(cartao?: { token: string; parcelas: number; bandeira?: string }) {
    setErroGeral(null);
    setEnviando(true);
    try {
      const res = await aoFinalizar({
        cliente: { ...cliente, telefone: apenasDigitos(cliente.telefone), documento: apenasDigitos(cliente.documento) },
        entrega: retirada ? null : endereco,
        freteId,
        meioPagamento: meio,
        parcelas: cartao?.parcelas ?? parcelas,
        ...(cartao?.token ? { cartaoToken: cartao.token } : {}),
        ...(cartao?.bandeira ? { bandeira: cartao.bandeira } : {}),
      });
      setResultado(res);
    } catch (e) {
      // Nunca vaza a mensagem crua do gateway para a tela: ela é código interno
      // e às vezes carrega detalhe de infraestrutura.
      setErroGeral(
        "Não foi possível concluir o pagamento agora. Nada foi cobrado. Tente novamente em instantes.",
      );
      if (typeof console !== "undefined") console.error(e);
    } finally {
      setEnviando(false);
    }
  }

  if (resultado) {
    return <ResultadoPanel resultado={resultado} total={totais.total} />;
  }

  return (
    <div className="ck-root">
      <div>
        <ol className="ck-steps">
          {PASSOS.map((p, i) => {
            const atualIdx = PASSOS.findIndex((x) => x.id === passo);
            const estado = i === atualIdx ? "atual" : i < atualIdx ? "concluido" : "futuro";
            return (
              <li key={p.id} className="ck-step" data-state={estado}>
                <span className="ck-step-num" aria-hidden="true">{i + 1}</span>
                {p.rotulo}
              </li>
            );
          })}
        </ol>

        {erroGeral && (
          <div className="ck-alert ck-alert--erro" role="alert" style={{ marginBottom: "1rem" }}>
            {erroGeral}
          </div>
        )}

        {passo === "identificacao" && (
          <section className="ck-card" aria-labelledby="ck-t-ident">
            <h2 className="ck-title" id="ck-t-ident" tabIndex={-1} ref={tituloRef}>
              Seus dados
            </h2>
            <div className="ck-grid">
              <Campo id="nome" rotulo="Nome" erro={erros.nome}>
                <input
                  id="nome" className="ck-input" autoComplete="given-name"
                  aria-invalid={Boolean(erros.nome)} aria-describedby={erros.nome ? "nome-erro" : undefined}
                  value={cliente.nome} onChange={(e) => definirCliente("nome", e.target.value)}
                />
              </Campo>
              <Campo id="sobrenome" rotulo="Sobrenome" erro={erros.sobrenome}>
                <input
                  id="sobrenome" className="ck-input" autoComplete="family-name"
                  aria-invalid={Boolean(erros.sobrenome)} aria-describedby={erros.sobrenome ? "sobrenome-erro" : undefined}
                  value={cliente.sobrenome} onChange={(e) => definirCliente("sobrenome", e.target.value)}
                />
              </Campo>
              <Campo id="email" rotulo="E-mail" erro={erros.email} full>
                <input
                  id="email" className="ck-input" type="email" inputMode="email" autoComplete="email"
                  aria-invalid={Boolean(erros.email)} aria-describedby={erros.email ? "email-erro" : undefined}
                  value={cliente.email} onChange={(e) => definirCliente("email", e.target.value)}
                />
              </Campo>
              <Campo id="telefone" rotulo="Celular" erro={erros.telefone}>
                <input
                  id="telefone" className="ck-input" inputMode="tel" autoComplete="tel"
                  placeholder="(16) 99999-9999"
                  aria-invalid={Boolean(erros.telefone)} aria-describedby={erros.telefone ? "telefone-erro" : undefined}
                  value={mascararCelular(cliente.telefone)}
                  onChange={(e) => definirCliente("telefone", apenasDigitos(e.target.value))}
                />
              </Campo>
              <Campo id="documento" rotulo="CPF ou CNPJ" erro={erros.documento}>
                <input
                  id="documento" className="ck-input" inputMode="numeric"
                  placeholder="000.000.000-00"
                  aria-invalid={Boolean(erros.documento)} aria-describedby={erros.documento ? "documento-erro" : undefined}
                  value={mascararDocumento(cliente.documento)}
                  onChange={(e) => definirCliente("documento", apenasDigitos(e.target.value))}
                />
              </Campo>
            </div>
          </section>
        )}

        {passo === "entrega" && (
          <>
            <section className="ck-card" aria-labelledby="ck-t-frete">
              <h2 className="ck-title" id="ck-t-frete" tabIndex={-1} ref={tituloRef}>
                Como você quer receber
              </h2>
              <div className="ck-options">
                {opcoesFrete.map((f) => (
                  <label key={f.id} className="ck-option">
                    <input
                      type="radio" name="frete" value={f.id}
                      checked={freteId === f.id} onChange={() => setFreteId(f.id)}
                    />
                    <span className="ck-option-body">
                      <span className="ck-option-title">{f.nome}</span>
                      <span className="ck-option-sub">
                        {f.prazoDiasUteis === 0
                          ? "Disponível conforme combinado"
                          : `Em até ${f.prazoDiasUteis} ${f.prazoDiasUteis === 1 ? "dia útil" : "dias úteis"}`}
                      </span>
                    </span>
                    <span className="ck-option-price">
                      {f.preco === 0 ? "Grátis" : formatarBRL(f.preco)}
                    </span>
                  </label>
                ))}
              </div>
              {erros.frete && <p className="ck-error" role="alert">{erros.frete}</p>}
            </section>

            {!retirada && (
              <section className="ck-card" aria-labelledby="ck-t-end">
                <h2 className="ck-title" id="ck-t-end">Endereço de entrega</h2>
                <div className="ck-grid">
                  <Campo id="cep" rotulo="CEP" erro={erros.cep}>
                    <input
                      id="cep" className="ck-input" inputMode="numeric" autoComplete="postal-code"
                      placeholder="00000-000"
                      aria-invalid={Boolean(erros.cep)} aria-describedby={erros.cep ? "cep-erro" : "cep-dica"}
                      value={endereco.cep} onChange={(e) => void preencherPorCep(e.target.value)}
                    />
                    {!erros.cep && (
                      <span className="ck-hint" id="cep-dica">
                        {buscandoCep ? "Buscando endereço…" : "Preenchemos o resto para você."}
                      </span>
                    )}
                  </Campo>
                  <Campo id="numero" rotulo="Número" erro={erros.numero}>
                    <input
                      id="numero" className="ck-input" autoComplete="address-line2"
                      aria-invalid={Boolean(erros.numero)}
                      value={endereco.numero}
                      onChange={(e) => setEndereco((a) => ({ ...a, numero: e.target.value }))}
                    />
                  </Campo>
                  <Campo id="logradouro" rotulo="Rua" erro={erros.logradouro} full>
                    <input
                      id="logradouro" className="ck-input" autoComplete="address-line1"
                      aria-invalid={Boolean(erros.logradouro)}
                      value={endereco.logradouro}
                      onChange={(e) => setEndereco((a) => ({ ...a, logradouro: e.target.value }))}
                    />
                  </Campo>
                  <Campo id="complemento" rotulo="Complemento (opcional)">
                    <input
                      id="complemento" className="ck-input"
                      value={endereco.complemento ?? ""}
                      onChange={(e) => setEndereco((a) => ({ ...a, complemento: e.target.value }))}
                    />
                  </Campo>
                  <Campo id="bairro" rotulo="Bairro" erro={erros.bairro}>
                    <input
                      id="bairro" className="ck-input"
                      aria-invalid={Boolean(erros.bairro)}
                      value={endereco.bairro}
                      onChange={(e) => setEndereco((a) => ({ ...a, bairro: e.target.value }))}
                    />
                  </Campo>
                  <Campo id="cidade" rotulo="Cidade" erro={erros.cidade}>
                    <input
                      id="cidade" className="ck-input"
                      aria-invalid={Boolean(erros.cidade)}
                      value={endereco.cidade}
                      onChange={(e) => setEndereco((a) => ({ ...a, cidade: e.target.value }))}
                    />
                  </Campo>
                  <Campo id="uf" rotulo="UF" erro={erros.uf}>
                    <input
                      id="uf" className="ck-input" maxLength={2}
                      aria-invalid={Boolean(erros.uf)}
                      value={endereco.uf}
                      onChange={(e) => setEndereco((a) => ({ ...a, uf: e.target.value.toUpperCase() }))}
                    />
                  </Campo>
                </div>
              </section>
            )}
          </>
        )}

        {passo === "pagamento" && (
          <section className="ck-card" aria-labelledby="ck-t-pag">
            <h2 className="ck-title" id="ck-t-pag" tabIndex={-1} ref={tituloRef}>
              Como você prefere pagar
            </h2>
            <div className="ck-options">
              {meiosPagamento.map((m) => (
                <label key={m} className="ck-option">
                  <input
                    type="radio" name="meio" value={m}
                    checked={meio === m} onChange={() => setMeio(m)}
                  />
                  <span className="ck-option-body">
                    <span className="ck-option-title">{ROTULO_MEIO[m].titulo}</span>
                    <span className="ck-option-sub">{ROTULO_MEIO[m].sub}</span>
                  </span>
                </label>
              ))}
            </div>

            {meio === "cartao" && (
              <div style={{ marginTop: "1rem" }}>
                {slotCartao ? (
                  // O slot traz os campos do provedor e dispara o pagamento
                  // pela própria tokenização.
                  slotCartao({
                    totalEmCentavos: totais.total,
                    emailCliente: cliente.email,
                    aoTokenizar: (dados) => finalizar(dados),
                  })
                ) : (
                  <>
                    <Campo id="parcelas" rotulo="Parcelamento">
                      <select
                        id="parcelas" className="ck-select"
                        value={parcelas} onChange={(e) => setParcelas(Number(e.target.value))}
                      >
                        {parcelamento.map((p) => (
                          <option key={p.parcelas} value={p.parcelas}>{p.rotulo}</option>
                        ))}
                      </select>
                    </Campo>
                    <p className="ck-hint" style={{ marginTop: "0.75rem" }}>
                      Os dados do cartão são digitados no campo seguro do provedor
                      de pagamento e não passam pelos nossos servidores.
                    </p>
                  </>
                )}
              </div>
            )}
          </section>
        )}

        <div className="ck-actions">
          {passo !== "identificacao" && (
            <button
              type="button" className="ck-btn ck-btn--ghost" disabled={enviando}
              onClick={() => setPasso(passo === "pagamento" ? "entrega" : "identificacao")}
            >
              Voltar
            </button>
          )}
          {/* No cartão com slot, quem submete é o formulário do provedor ,
              dois botões de pagamento na mesma tela geram cobrança duplicada
              quando a pessoa clica no que não tokeniza. */}
          {!(passo === "pagamento" && meio === "cartao" && slotCartao) && (
            <button
              type="button" className="ck-btn ck-btn--primary" disabled={enviando}
              onClick={() => (passo === "pagamento" ? void finalizar() : avancar())}
            >
              {enviando
                ? "Processando…"
                : passo === "pagamento"
                  ? `Pagar ${formatarBRL(totais.total)}`
                  : "Continuar"}
            </button>
          )}
        </div>
      </div>

      <aside className="ck-card ck-summary" aria-label="Resumo do pedido">
        <h2 className="ck-title">Resumo do pedido</h2>
        {itens.map((item) => (
          <div key={item.id} className="ck-summary-item">
            {item.imagem && <img className="ck-summary-thumb" src={item.imagem} alt="" />}
            <div className="ck-option-body">
              <span className="ck-option-title">{item.nome}</span>
              <span className="ck-option-sub">
                {item.quantidade} × {formatarBRL(item.precoUnitario)}
              </span>
            </div>
            <span className="ck-option-price">
              {formatarBRL(item.precoUnitario * item.quantidade)}
            </span>
          </div>
        ))}

        <div style={{ marginTop: "0.75rem" }}>
          <div className="ck-summary-line">
            <span>Subtotal</span>
            <span>{formatarBRL(totais.subtotal)}</span>
          </div>
          <div className="ck-summary-line">
            <span>Entrega</span>
            <span>
              {frete ? (totais.frete === 0 ? "Grátis" : formatarBRL(totais.frete)) : "A calcular"}
            </span>
          </div>
          {totais.desconto > 0 && (
            <div className="ck-summary-line">
              <span>Desconto</span>
              <span>− {formatarBRL(totais.desconto)}</span>
            </div>
          )}
          <div className="ck-summary-total">
            <span>Total</span>
            <span>{formatarBRL(totais.total)}</span>
          </div>
        </div>
      </aside>
    </div>
  );
}

function Campo({
  id, rotulo, erro, full, children,
}: {
  id: string;
  rotulo: string;
  erro?: string;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`ck-field${full ? " ck-field--full" : ""}`}>
      <label className="ck-label" htmlFor={id}>{rotulo}</label>
      {children}
      {erro && <span className="ck-error" id={`${id}-erro`} role="alert">{erro}</span>}
    </div>
  );
}

/**
 * Tela pós-cobrança.
 *
 * PIX e boleto voltam como "pendente", e isso é o normal, não um erro , o
 * pagamento só confirma pelo webhook. Por isso a tela do PIX mostra o QR e
 * segue esperando, em vez de declarar sucesso ou falha.
 */
function ResultadoPanel({ resultado, total }: { resultado: ResultadoPagamento; total: number }) {
  const [copiado, setCopiado] = useState(false);

  if (resultado.status === "recusado") {
    return (
      <div className="ck-root">
        <div className="ck-card">
          <div className="ck-alert ck-alert--erro" role="alert">
            {resultado.motivo ?? "Pagamento não autorizado."}
          </div>
          <p className="ck-hint" style={{ marginTop: "1rem" }}>
            Nada foi cobrado. Você pode tentar outro cartão ou pagar com PIX.
          </p>
        </div>
      </div>
    );
  }

  if (resultado.pix) {
    return (
      <div className="ck-root">
        <div className="ck-card ck-pix">
          <h2 className="ck-title">Pague {formatarBRL(total)} com PIX</h2>
          {resultado.pix.qrCodeBase64 && (
            <img
              className="ck-pix-qr"
              src={`data:image/png;base64,${resultado.pix.qrCodeBase64}`}
              alt="QR code para pagamento por PIX"
            />
          )}
          <p className="ck-hint">
            Abra o app do seu banco, escolha PIX e escaneie o código. A confirmação
            é automática.
          </p>
          <code className="ck-pix-code">{resultado.pix.copiaECola}</code>
          <button
            type="button"
            className="ck-btn ck-btn--primary"
            onClick={() => {
              void navigator.clipboard.writeText(resultado.pix!.copiaECola);
              setCopiado(true);
              window.setTimeout(() => setCopiado(false), 2500);
            }}
          >
            {copiado ? "Código copiado" : "Copiar código PIX"}
          </button>
        </div>
      </div>
    );
  }

  if (resultado.boleto) {
    return (
      <div className="ck-root">
        <div className="ck-card">
          <h2 className="ck-title">Boleto gerado</h2>
          <p className="ck-hint">
            O pagamento compensa em até 3 dias úteis. O pedido é separado depois da
            compensação.
          </p>
          <a
            className="ck-btn ck-btn--primary"
            href={resultado.boleto.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: "inline-flex", alignItems: "center", marginTop: "1rem" }}
          >
            Abrir boleto
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="ck-root">
      <div className="ck-card">
        <div className="ck-alert ck-alert--ok" role="status">
          {resultado.status === "aprovado"
            ? "Pagamento aprovado. Você vai receber a confirmação por e-mail."
            : "Pagamento em análise. Avisamos assim que for confirmado."}
        </div>
      </div>
    </div>
  );
}
