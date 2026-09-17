import { AlertTriangle, Award } from "lucide-react";

export type ReputacaoMlView = {
  nivel: string | null;
  selo: string | null;
  transacoes: number;
  concluidas: number;
  canceladas: number;
  reclamacoes: number | null;
  atrasos: number | null;
  cancelamentos: number | null;
  positivas: number | null;
  alertas: string[];
  medidoEm: string;
};

/** As cores do termômetro do ML, na ordem em que ele as usa. */
const NIVEL: Record<string, { rotulo: string; cor: string }> = {
  newbie: { rotulo: "Conta nova", cor: "bg-zinc-300" },
  "1_red": { rotulo: "Vermelho", cor: "bg-red-500" },
  "2_orange": { rotulo: "Laranja", cor: "bg-orange-500" },
  "3_yellow": { rotulo: "Amarelo", cor: "bg-yellow-400" },
  "4_light_green": { rotulo: "Verde-claro", cor: "bg-lime-500" },
  "5_green": { rotulo: "Verde", cor: "bg-emerald-600" },
};

const SELO: Record<string, string> = { platinum: "Mercado Líder Platinum", gold: "Mercado Líder Gold", silver: "Mercado Líder" };

const pct = (v: number | null) => (v == null ? "—" : `${v}%`);

/**
 * A saúde da conta no Mercado Livre.
 *
 * Mostra o número **e** o que fazer com ele. Reputação sem caminho é só uma
 * cor na tela: quem cai para laranja não precisa saber que caiu, precisa
 * saber que é o atraso no despacho que está puxando.
 */
export default function ReputacaoMl({ r }: { r: ReputacaoMlView }) {
  const nivel = r.nivel ? NIVEL[r.nivel] : null;
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        {nivel && (
          <span className="inline-flex items-center gap-2 text-sm">
            <i className={`h-3 w-3 rounded-full ${nivel.cor}`} aria-hidden />
            {nivel.rotulo}
          </span>
        )}
        {r.selo && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
            <Award size={13} /> {SELO[r.selo] ?? r.selo}
          </span>
        )}
        <span className="text-xs text-muted-foreground">
          medido em {new Date(r.medidoEm).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        {([
          ["Vendas concluídas", String(r.concluidas)],
          ["Reclamações", pct(r.reclamacoes)],
          ["Envios com atraso", pct(r.atrasos)],
          ["Cancelamentos", pct(r.cancelamentos)],
        ] as const).map(([rotulo, valor]) => (
          <div key={rotulo} className="rounded-lg border border-border p-3">
            <small className="text-xs uppercase text-muted-foreground">{rotulo}</small>
            <strong className="block text-xl">{valor}</strong>
          </div>
        ))}
      </div>

      {r.alertas.map((a) => (
        <p key={a} className="flex gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          <AlertTriangle size={16} className="mt-0.5 flex-none" /> {a}
        </p>
      ))}
    </div>
  );
}
