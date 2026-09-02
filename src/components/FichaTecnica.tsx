/**
 * Características do produto, no formato que todo marketplace usa.
 *
 * O campo `atributos` existe no banco desde sempre, livre, e nenhuma tela
 * mostrava. Sem ele a página do produto vira dois parágrafos de texto corrido,
 * e quem compra peça técnica não lê parágrafo: procura a linha da bitola, da
 * amperagem, da classificação. É por isso que Mercado Livre e Amazon põem
 * característica em lista de duas colunas, e não em prosa.
 *
 * A ordem das chaves é a ordem do objeto, então quem cadastra decide o que
 * aparece primeiro. Valor vazio não vira linha em branco: some.
 */
export default function FichaTecnica({ atributos }: { atributos: Record<string, unknown> }) {
  const linhas = Object.entries(atributos)
    .filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== "")
    .map(([chave, valor]) => [rotulo(chave), String(valor)] as const);

  if (linhas.length === 0) return null;

  return (
    <section className="ficha-tecnica">
      <h2>Características</h2>
      <dl>
        {linhas.map(([nome, valor]) => (
          <div key={nome}>
            <dt>{nome}</dt>
            <dd>{valor}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/**
 * O rótulo que o comprador lê.
 *
 * Separar por maiúscula sozinho não basta: `poloEPosicao` virava "Polo
 * EPosicao" e `classificacaoAws` saía sem acento, porque o nome da chave em
 * JSON não carrega acentuação. Palavra técnica em ficha de produto errada é
 * pior que ausente, então as que se repetem têm tradução própria e o resto cai
 * na regra geral.
 */
const ROTULOS: Record<string, string> = {
  classificacaoAws: "Classificação AWS",
  bitola: "Bitola",
  correnteIndicada: "Corrente indicada",
  poloEPosicao: "Polo e posição",
  limiteResistencia: "Limite de resistência",
  limiteEscoamento: "Limite de escoamento",
  alongamento: "Alongamento",
  charpy: "Charpy",
  composicaoDeposito: "Composição do depósito",
  unidadeVenda: "Unidade de venda",
  fabricacao: "Fabricação",
  composicao: "Composição",
  identificacao: "Identificação",
  processo: "Processo",
  corrente: "Corrente",
  aplicacao: "Aplicação",
  diametro: "Diâmetro",
  espessura: "Espessura",
  furo: "Furo",
  referencia: "Referência",
  liga: "Liga",
};

function rotulo(chave: string): string {
  if (ROTULOS[chave]) return ROTULOS[chave];
  // Chave que o lojista inventou: separa por maiúscula e arruma a primeira.
  const comEspaco = chave
    .replace(/([a-z\d])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    .toLowerCase();
  const siglas = new Set(["aws", "din", "hb", "hrc", "mpa", "cc", "ca", "tig", "mig"]);
  return comEspaco
    .split(" ")
    .map((p) => (siglas.has(p) ? p.toUpperCase() : p))
    .join(" ")
    .replace(/^./, (c) => c.toUpperCase());
}
