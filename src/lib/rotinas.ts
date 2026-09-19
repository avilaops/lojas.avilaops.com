/**
 * O catálogo de rotinas da plataforma e a matemática do "quando de novo".
 *
 * Até aqui quem chamava estes trabalhos de tempos em tempos era o n8n. Isso
 * colocava a parte mais crítica da operação — a fila de notificações do
 * Mercado Livre, que transforma venda em pedido e baixa estoque — na mão de um
 * serviço de fora: se ele parasse, ninguém ficava sabendo, e a loja voltava a
 * vender a mesma peça duas vezes. A plataforma passa a se agendar sozinha.
 *
 * Este arquivo é só definição e conta de calendário, sem banco e sem efeito:
 * é o que torna a regra "toda segunda às 7h" testável. Quem executa é
 * `src/lib/rotinas-executor.ts`, e quem acorda de minuto em minuto é
 * `src/lib/rotinas-agendador.ts`.
 */

/** O fuso do negócio. "3h" na tabela é 3h de Ribeirão Preto, não do servidor. */
export const FUSO_ROTINAS = "America/Sao_Paulo";

export type Cadencia =
  /** De N em N minutos, contados a partir do fim da execução anterior. */
  | { tipo: "intervalo"; minutos: number }
  /** Todo dia, no horário local. */
  | { tipo: "diaria"; hora: number; minuto?: number }
  /** Um dia da semana (0 = domingo), no horário local. */
  | { tipo: "semanal"; diaDaSemana: number; hora: number; minuto?: number };

export interface DefinicaoRotina {
  /**
   * Duas ou três palavras, para caber como título numa linha de celular.
   *
   * A frase inteira é descrição, não título: no painel da Ávila Ops ela saía
   * cortada em "Gera e publica em lote o …" em toda linha da lista. Quem lê a
   * tela lê isto; a frase fica ao lado, onde há largura.
   *
   * O teto de 22 caracteres foi medido, não estimado: num iPhone de 375 px
   * "Fila do Mercado Livre" (21) encostava na borda e "Anúncios do Mercado
   * Livre" (25) vazava 20 px. Os dois viraram "Vendas do ML" e "Anúncios do
   * ML", que também dizem melhor o que cada um faz — um traz venda para
   * dentro, o outro empurra anúncio para fora.
   */
  titulo: string;
  /** O que a rotina faz, em uma linha — é o que a tela de operação mostra. */
  descricao: string;
  cadencia: Cadencia;
  /**
   * Quanto tempo uma execução pode ficar de pé antes de ser considerada morta
   * e a trava liberada. Só importa quando um container cai no meio do trabalho.
   */
  travaMinutos: number;
  /**
   * Quantas falhas seguidas antes de a rotina ser considerada quebrada na
   * tela de operação. Rotina que a loja sente na hora tem teto baixo.
   */
  falhasAteAlerta: number;
}

/**
 * A fonte da verdade do que roda sozinho. A chave é estável e vai para o
 * banco: renomear aqui é migração, não refatoração.
 *
 * Cada trabalho aqui já existia como endpoint em `/api/admin/*` e continua
 * existindo — o endpoint virou o disparo manual, não mais o agendamento.
 */
export const ROTINAS = {
  "mercadolivre.avisos": {
    titulo: "Vendas do ML",
    descricao: "Fila do Mercado Livre: venda vira pedido e baixa estoque, envio vira rastreio",
    cadencia: { tipo: "intervalo", minutos: 5 },
    travaMinutos: 10,
    // Cada rodada perdida é janela para vender a mesma peça duas vezes.
    falhasAteAlerta: 2,
  },
  "mercadolivre.rodar": {
    titulo: "Anúncios do ML",
    descricao: "Publica o que o lojista aprovou e empurra preço e estoque para os anúncios",
    cadencia: { tipo: "intervalo", minutos: 60 },
    travaMinutos: 30,
    falhasAteAlerta: 3,
  },
  "automacoes.eventos": {
    titulo: "Fila de eventos",
    descricao: "Executa os eventos que a plataforma mesma resolve, hoje os que viram e-mail",
    cadencia: { tipo: "intervalo", minutos: 1 },
    travaMinutos: 5,
    // A cada minuto: é por aqui que sai a recuperação de senha quando o
    // disparo imediato não saiu (processo reiniciado, SMTP fora do ar).
    falhasAteAlerta: 2,
  },
  "carrinhos.verificar": {
    titulo: "Carrinho abandonado",
    descricao: "Marca carrinho parado há 45 min e emite carrinho.abandonado",
    cadencia: { tipo: "intervalo", minutos: 60 },
    travaMinutos: 15,
    falhasAteAlerta: 3,
  },
  "estoque.avisos": {
    titulo: "Voltou ao estoque",
    descricao: "Avisa quem esperava produto que voltou ao estoque",
    cadencia: { tipo: "intervalo", minutos: 60 },
    travaMinutos: 15,
    falhasAteAlerta: 3,
  },
  "pedidos.verificar": {
    titulo: "Pagamento pendente",
    descricao: "Confere no gateway os pedidos aguardando pagamento (Pix, boleto) dos últimos 7 dias",
    cadencia: { tipo: "intervalo", minutos: 60 },
    travaMinutos: 15,
    // Rede de segurança do webhook: dinheiro do lojista depende de estar de pé.
    falhasAteAlerta: 2,
  },
  "seo.categorias": {
    titulo: "SEO de categoria",
    descricao: "Gera e publica em lote o SEO de categoria pendente, fora do acesso público",
    cadencia: { tipo: "diaria", hora: 3 },
    travaMinutos: 30,
    falhasAteAlerta: 2,
  },
  "cobranca.verificar": {
    titulo: "Régua de cobrança",
    descricao: "Suspende loja que passou da tolerância e sincroniza as assinaturas",
    cadencia: { tipo: "diaria", hora: 6 },
    travaMinutos: 30,
    falhasAteAlerta: 2,
  },
  "relatorios.semanal": {
    titulo: "Relatório semanal",
    descricao: "Emite loja.relatorio-semanal por loja com movimento",
    cadencia: { tipo: "semanal", diaDaSemana: 1, hora: 7 },
    travaMinutos: 30,
    falhasAteAlerta: 1,
  },
} as const satisfies Record<string, DefinicaoRotina>;

export type NomeDeRotina = keyof typeof ROTINAS;

export const NOMES_DE_ROTINA = Object.keys(ROTINAS) as NomeDeRotina[];

export function ehNomeDeRotina(nome: string): nome is NomeDeRotina {
  return Object.prototype.hasOwnProperty.call(ROTINAS, nome);
}

// --- Calendário -----------------------------------------------------------

const PARTES = new Intl.DateTimeFormat("en-CA", {
  timeZone: FUSO_ROTINAS,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

interface ParteLocal {
  ano: number;
  mes: number;
  dia: number;
  hora: number;
  minuto: number;
}

/** O relógio de parede em São Paulo no instante dado. */
function partesLocais(instante: Date): ParteLocal {
  const partes = new Map<string, string>(PARTES.formatToParts(instante).map((p) => [p.type as string, p.value]));
  const n = (chave: string) => Number(partes.get(chave));
  // 24 aparece em algumas plataformas no lugar de 0 para a meia-noite.
  const hora = n("hour") % 24;
  return { ano: n("year"), mes: n("month"), dia: n("day"), hora, minuto: n("minute") };
}

/** Quanto o relógio de São Paulo está à frente do UTC no instante dado. */
function deslocamentoMs(instante: Date): number {
  const local = partesLocais(instante);
  const comoSeFosseUtc = Date.UTC(local.ano, local.mes - 1, local.dia, local.hora, local.minuto);
  // Zera segundos dos dois lados para a diferença sair em minutos inteiros.
  const utc = Math.floor(instante.getTime() / 60_000) * 60_000;
  return comoSeFosseUtc - utc;
}

/**
 * O instante UTC em que o relógio de São Paulo marca a data e hora pedidas.
 *
 * Duas passadas porque o deslocamento depende do próprio instante: o palpite
 * serve só para descobrir qual deslocamento vale ali. O Brasil não tem horário
 * de verão desde 2019, mas a conta continua correta se voltar a ter.
 */
function instanteLocal(ano: number, mes: number, dia: number, hora: number, minuto: number): Date {
  const palpite = Date.UTC(ano, mes - 1, dia, hora, minuto);
  const primeira = new Date(palpite - deslocamentoMs(new Date(palpite)));
  return new Date(palpite - deslocamentoMs(primeira));
}

/**
 * Quando a rotina vence de novo, contado a partir de `depois` (exclusivo).
 *
 * Intervalo conta do fim da execução anterior, não de um relógio fixo: rotina
 * que demorou não dispara duas vezes em seguida para "recuperar o atraso".
 */
export function proximaExecucao(cadencia: Cadencia, depois: Date): Date {
  if (cadencia.tipo === "intervalo") {
    return new Date(depois.getTime() + cadencia.minutos * 60_000);
  }
  const minuto = cadencia.minuto ?? 0;
  const local = partesLocais(depois);
  for (let adiante = 0; adiante <= 8; adiante += 1) {
    // Somar dias no calendário UTC e reler o fuso evita erro de fim de mês.
    const dia = new Date(Date.UTC(local.ano, local.mes - 1, local.dia + adiante));
    const candidato = instanteLocal(
      dia.getUTCFullYear(),
      dia.getUTCMonth() + 1,
      dia.getUTCDate(),
      cadencia.hora,
      minuto,
    );
    if (candidato.getTime() <= depois.getTime()) continue;
    if (cadencia.tipo === "semanal" && diaDaSemanaLocal(candidato) !== cadencia.diaDaSemana) continue;
    return candidato;
  }
  // Inalcançável com cadências válidas; melhor um atraso do que um laço aberto.
  return new Date(depois.getTime() + 24 * 60 * 60_000);
}

/** 0 = domingo, no fuso do negócio. */
export function diaDaSemanaLocal(instante: Date): number {
  const local = partesLocais(instante);
  return new Date(Date.UTC(local.ano, local.mes - 1, local.dia)).getUTCDay();
}

const DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

/** A cadência em português, para a tela de operação não mostrar JSON. */
export function descreverCadencia(cadencia: Cadencia): string {
  if (cadencia.tipo === "intervalo") {
    if (cadencia.minutos < 60) return `a cada ${cadencia.minutos} min`;
    const horas = cadencia.minutos / 60;
    return horas === 1 ? "a cada hora" : `a cada ${horas} h`;
  }
  const relogio = `${String(cadencia.hora).padStart(2, "0")}:${String(cadencia.minuto ?? 0).padStart(2, "0")}`;
  if (cadencia.tipo === "diaria") return `todo dia às ${relogio}`;
  return `toda ${DIAS[cadencia.diaDaSemana]} às ${relogio}`;
}

/**
 * Se a rotina está atrasada a ponto de alguém precisar olhar.
 *
 * Tolerância proporcional à própria cadência: 5 minutos de atraso são normais
 * no relatório semanal e são sintoma na fila do Mercado Livre.
 */
export function atrasada(cadencia: Cadencia, proximaEm: Date, agora: Date): boolean {
  const passo = cadencia.tipo === "intervalo" ? cadencia.minutos : 60;
  const tolerancia = Math.max(5, passo) * 60_000 * 2;
  return agora.getTime() - proximaEm.getTime() > tolerancia;
}
