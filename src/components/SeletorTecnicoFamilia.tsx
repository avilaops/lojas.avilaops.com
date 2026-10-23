import type { MedidaDisponivel } from "@/components/FiltrosProdutos";
import type { AtributoBuscaTecnica, ConfiguracaoBuscaTecnica } from "@/lib/busca-tecnica-familia";

const PREFIXO = {
  diametroInternoMm: "di",
  diametroExternoMm: "de",
  alturaMm: "alt",
  espessuraMm: "esp",
  secaoMm: "sec",
  larguraMm: "larg",
  comprimentoMm: "comp",
} as const;

const ROTULO_ATRIBUTO: Record<AtributoBuscaTecnica, string> = {
  perfil: "Perfil",
  material: "Material",
  dureza: "Dureza",
  vedacao: "Tipo de vedação",
};

const TITULO_DESENHO: Record<ConfiguracaoBuscaTecnica["familia"], string> = {
  retentor: "Como medir um retentor",
  oring: "Como medir um O-ring",
  rolamento: "Como medir um rolamento",
  correia: "Como medir uma correia",
  "vedacao-hidraulica": "Como medir uma vedação hidráulica",
};

function DesenhoMedicao({ configuracao }: { configuracao: ConfiguracaoBuscaTecnica }) {
  const correia = configuracao.familia === "correia";
  return (
    <figure className="busca-tecnica-desenho">
      <svg viewBox="0 0 180 92" role="img" aria-label={TITULO_DESENHO[configuracao.familia]}>
        {correia ? (
          <>
            <path d="M35 70 C12 42 28 12 60 15 H120 C152 12 168 42 145 70 C126 89 54 89 35 70Z" fill="none" stroke="currentColor" strokeWidth="7" />
            <path d="M42 47 H138" stroke="currentColor" strokeWidth="2" />
            <path d="M42 41 V53 M138 41 V53" stroke="currentColor" strokeWidth="2" />
          </>
        ) : (
          <>
            <circle cx="90" cy="46" r="34" fill="none" stroke="currentColor" strokeWidth="8" />
            <path d="M56 46 H124 M56 40 V52 M124 40 V52" stroke="currentColor" strokeWidth="2" />
            {configuracao.medidas.includes("secaoMm") && <path d="M116 21 L132 9 M112 16 L121 29" stroke="currentColor" strokeWidth="2" />}
          </>
        )}
      </svg>
      <figcaption>
        {correia
          ? "Use o comprimento indicado pelo fabricante ou a referência de medição da correia aberta."
          : "Meça a peça sem deformar. Diâmetros e seção são informados em milímetros."}
      </figcaption>
    </figure>
  );
}

export default function SeletorTecnicoFamilia({ configuracao, medidas, valores, facetas, perfis = [] }: {
  configuracao: ConfiguracaoBuscaTecnica;
  medidas: MedidaDisponivel[];
  valores: Record<string, string | undefined>;
  facetas: Partial<Record<Exclude<AtributoBuscaTecnica, "perfil">, string[]>>;
  perfis?: string[];
}) {
  const disponiveis = new Map(medidas.map((medida) => [medida.campo, medida]));
  return (
    <fieldset className="busca-tecnica-familia rounded-lg border border-border/70 bg-background/40 p-3">
      <legend className="px-1 text-sm font-semibold">Buscar pela especificação da peça</legend>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_180px]">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {configuracao.medidas.flatMap((campo) => {
            const medida = disponiveis.get(campo);
            if (!medida) return [];
            const prefixo = PREFIXO[campo];
            return [
              <label key={campo} className="grid gap-1 text-xs text-muted-foreground">
                <span>{medida.rotulo} <span>(mm)</span></span>
                <span className="flex items-center gap-1">
                  <input name={`${prefixo}_de`} aria-label={`${medida.rotulo} mínimo em mm`} defaultValue={valores[`${prefixo}_de`] ?? ""} placeholder="de" inputMode="decimal" className="h-11 w-full rounded-lg border border-border bg-background px-2 text-sm" />
                  <span aria-hidden>–</span>
                  <input name={`${prefixo}_ate`} aria-label={`${medida.rotulo} máximo em mm`} defaultValue={valores[`${prefixo}_ate`] ?? ""} placeholder="até" inputMode="decimal" className="h-11 w-full rounded-lg border border-border bg-background px-2 text-sm" />
                </span>
              </label>,
            ];
          })}
          {configuracao.atributos.map((atributo) => {
            const opcoes = atributo === "perfil" ? perfis : (facetas[atributo] ?? []);
            if (!opcoes.length) return null;
            return (
              <label key={atributo} className="grid gap-1 text-xs text-muted-foreground">
                <span>{ROTULO_ATRIBUTO[atributo]}</span>
                <select name={atributo} aria-label={ROTULO_ATRIBUTO[atributo]} defaultValue={valores[atributo] ?? ""} className="h-11 rounded-lg border border-border bg-background px-3 text-sm">
                  <option value="">Todos</option>
                  {opcoes.map((opcao) => <option key={opcao}>{opcao}</option>)}
                </select>
              </label>
            );
          })}
        </div>
        <DesenhoMedicao configuracao={configuracao} />
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Correspondência dimensional ajuda a selecionar candidatos, mas não confirma compatibilidade. Confira perfil, material, aplicação e código na ficha.</p>
    </fieldset>
  );
}
