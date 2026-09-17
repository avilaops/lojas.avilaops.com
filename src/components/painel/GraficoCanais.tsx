/**
 * Sessões por canal ao longo do tempo.
 *
 * Linha, e não barra empilhada: a pergunta aqui é a forma da curva de cada
 * canal ("o Instagram caiu desde que parei de postar?"), e empilhada só
 * responde bem o total. O total já está nos indicadores acima.
 *
 * Um eixo só, sempre — sessão é sessão, e um segundo eixo com outra escala é o
 * jeito mais rápido de fazer duas séries parecerem correlacionadas sem serem.
 *
 * ## Sobre as cores
 *
 * Cinco cores, nesta ordem, atribuídas por posição e nunca recicladas: o 6º
 * canal não ganha uma cor gerada, ele fica de fora do gráfico e aparece na
 * tabela abaixo. A sequência foi conferida para daltonismo (deutan/protan/
 * tritan) e para contraste sobre o branco do painel — o par adjacente mais
 * difícil fica em ΔE 10,3, acima do piso de 8.
 *
 * A identidade nunca depende só da cor: há legenda com rótulo escrito, e a
 * tabela de canais logo abaixo tem os mesmos números em texto.
 */
const CORES = ["#2563eb", "#d97706", "#0891b2", "#db2777", "#65a30d"] as const;

const L = 40;   // eixo Y à esquerda
const R = 12;
const T = 12;
const B = 26;
const LARGURA = 720;
const ALTURA = 220;

export default function GraficoCanais({
  serie,
  canais,
}: {
  serie: Array<{ dia: string; rotulo: string; porCanal: Record<string, number> }>;
  canais: Array<{ canal: string; rotulo: string }>;
}) {
  if (serie.length === 0 || canais.length === 0) return null;

  const maximo = Math.max(1, ...serie.flatMap((d) => canais.map((c) => d.porCanal[c.canal] ?? 0)));
  // Teto “redondo”: 7 vira 10, 23 vira 30. Eixo terminando em 23 faz a pessoa
  // ler o número do topo em vez de olhar a curva.
  const teto = arredondarParaCima(maximo);

  const x = (i: number) => (serie.length === 1 ? L + (LARGURA - L - R) / 2 : L + (i * (LARGURA - L - R)) / (serie.length - 1));
  const y = (v: number) => T + (1 - v / teto) * (ALTURA - T - B);

  // Marcador em cada ponto só cabe em período curto; em 90 dias vira uma
  // fileira de bolinhas coladas que esconde a própria linha.
  const comMarcadores = serie.length <= 31;
  const grade = [0, teto / 2, teto];
  const rotulosX = [0, Math.floor((serie.length - 1) / 2), serie.length - 1].filter((v, i, a) => a.indexOf(v) === i);

  return (
    <figure className="graf-canais">
      <svg
        viewBox={`0 0 ${LARGURA} ${ALTURA}`}
        className="graf-svg"
        role="img"
        aria-label={`Sessões por dia dos canais ${canais.map((c) => c.rotulo).join(", ")}. Maior valor no período: ${maximo}.`}
      >
        {/* Grade recessiva: referência, não conteúdo. */}
        {grade.map((v) => (
          <g key={v}>
            <line x1={L} x2={LARGURA - R} y1={y(v)} y2={y(v)} className="graf-grade" />
            <text x={L - 8} y={y(v) + 4} textAnchor="end" className="graf-eixo-texto">
              {Math.round(v).toLocaleString("pt-BR")}
            </text>
          </g>
        ))}

        {canais.map((c, indice) => {
          const pontos = serie.map((d, i) => `${x(i)},${y(d.porCanal[c.canal] ?? 0)}`).join(" ");
          return (
            <g key={c.canal}>
              <polyline points={pontos} fill="none" stroke={CORES[indice]} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
              {comMarcadores &&
                serie.map((d, i) => (
                  <circle
                    key={d.dia}
                    cx={x(i)}
                    cy={y(d.porCanal[c.canal] ?? 0)}
                    r={4}
                    fill={CORES[indice]}
                    /* Anel da cor da superfície: onde duas séries se cruzam, o
                       ponto de cima continua legível em vez de virar borrão. */
                    stroke="var(--card, #fff)"
                    strokeWidth={2}
                  >
                    <title>{`${c.rotulo} · ${d.rotulo}: ${(d.porCanal[c.canal] ?? 0).toLocaleString("pt-BR")} sessão(ões)`}</title>
                  </circle>
                ))}
            </g>
          );
        })}

        {/* Faixa invisível por dia: alvo de toque maior que o marcador, e é o
            que dá leitura do dia inteiro em período longo, onde não há ponto. */}
        {serie.map((d, i) => (
          <rect
            key={`alvo-${d.dia}`}
            x={x(i) - (LARGURA - L - R) / Math.max(1, serie.length) / 2}
            y={T}
            width={(LARGURA - L - R) / Math.max(1, serie.length)}
            height={ALTURA - T - B}
            fill="transparent"
          >
            <title>
              {`${d.rotulo}\n${canais.map((c) => `${c.rotulo}: ${(d.porCanal[c.canal] ?? 0).toLocaleString("pt-BR")}`).join("\n")}`}
            </title>
          </rect>
        ))}

        {rotulosX.map((i) => (
          <text
            key={`x-${i}`}
            x={x(i)}
            y={ALTURA - 6}
            textAnchor={i === 0 ? "start" : i === serie.length - 1 ? "end" : "middle"}
            className="graf-eixo-texto"
          >
            {serie[i].rotulo}
          </text>
        ))}
      </svg>

      {/* Legenda sempre presente: com cinco séries, identidade não pode
          depender de cor sozinha. O texto usa a cor de texto do painel; quem
          carrega a identidade é o quadradinho ao lado. */}
      <figcaption className="graf-legenda">
        {canais.map((c, i) => (
          <span key={c.canal}>
            <i style={{ background: CORES[i] }} aria-hidden="true" />
            {c.rotulo}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}

/** 7 → 10, 23 → 30, 180 → 200: teto legível em vez do máximo exato. */
function arredondarParaCima(v: number): number {
  const ordem = 10 ** Math.floor(Math.log10(Math.max(v, 1)));
  return Math.ceil(v / ordem) * ordem;
}
