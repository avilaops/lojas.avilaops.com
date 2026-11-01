import type { ProjetoSobMedidaPainel } from "@/lib/painel-sob-medida";
import ImprimirFichaSobMedida from "./ImprimirFichaSobMedida";

const data = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});

function Campo({ termo, valor }: { termo: string; valor: React.ReactNode }) {
  return <div><dt>{termo}</dt><dd>{valor}</dd></div>;
}

export default function FichaTecnicaSobMedida({ projeto }: { projeto: ProjetoSobMedidaPainel }) {
  const ficha = projeto.fichaTecnica;
  const telefone = projeto.telefone?.replace(/\D/g, "");
  const dimensoes = `${ficha.dimensoes.larguraCm} × ${ficha.dimensoes.alturaCm} × ${ficha.dimensoes.profundidadeCm} cm`;

  return (
    <article className="ficha-sob-medida">
      <header className="ficha-sob-medida-cabecalho">
        <div>
          <p>Projeto sob medida</p>
          <h2>{projeto.referencia}</h2>
          <span>{data.format(projeto.criadoEm)} · {projeto.estado}</span>
        </div>
        <ImprimirFichaSobMedida />
      </header>

      <section className="ficha-sob-medida-grade" aria-label="Ficha técnica da configuração">
        <figure className="ficha-sob-medida-previa">
          {/* A otimização do Next não repassa a sessão ao buscar a rota privada. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/painel/sob-medida/${encodeURIComponent(projeto.id)}/previa.svg`} alt={`Prévia técnica da configuração ${projeto.referencia}`} width="960" height="640" />
          <figcaption>Prévia conceitual v{ficha.previaVersao}, derivada da ficha técnica v{ficha.versao}.</figcaption>
        </figure>

        <dl className="ficha-sob-medida-campos">
          <Campo termo="Dimensões externas" valor={dimensoes} />
          <Campo termo="Material externo" valor={ficha.materialExterno.rotulo} />
          <Campo termo="Acabamento" valor={ficha.acabamento.rotulo} />
          <Campo termo="Abertura" valor={ficha.tampa.rotulo} />
          <Campo termo="Base" valor={ficha.mobilidade.rotulo} />
          <Campo termo="Divisórias" valor={ficha.divisorias} />
          <Campo termo="Quantidade" valor={ficha.quantidade} />
          <Campo termo="Contrato" valor={`Configurador v${ficha.contratoVersao} · Ficha v${ficha.versao} · Prévia v${ficha.previaVersao}`} />
          {ficha.referenciaOrigem && <Campo termo="Configuração de origem" valor={ficha.referenciaOrigem} />}
        </dl>
      </section>

      {ficha.observacoes && (
        <section className="ficha-sob-medida-bloco">
          <h3>Observações técnicas</h3>
          <p>{ficha.observacoes}</p>
        </section>
      )}

      <section className="ficha-sob-medida-bloco ficha-sob-medida-contato">
        <h3>Contato da solicitação</h3>
        <p><strong>{projeto.nome}</strong></p>
        <div className="ficha-sob-medida-nao-imprimir">
          {projeto.email && <a className="btn-secundario" href={`mailto:${projeto.email}`}>Enviar e-mail</a>}
          {telefone && <a className="btn-secundario" href={`https://wa.me/${telefone}`} target="_blank" rel="noopener">Abrir WhatsApp</a>}
        </div>
        <p className="ficha-sob-medida-contato-impresso">{[projeto.email, projeto.telefone].filter(Boolean).join(" · ")}</p>
      </section>

      <p className="ficha-sob-medida-aviso">Sujeito à validação da fábrica; não é desenho liberado para fabricação.</p>
    </article>
  );
}
