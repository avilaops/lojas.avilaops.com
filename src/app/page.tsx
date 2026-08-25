import { exigirTenant, lojaVende, temaDo } from "@/lib/tenant";
import { listarCategorias, listarProdutos } from "@/lib/catalogo";
import Classico from "@/components/home/Classico";
import Vitrine from "@/components/home/Vitrine";
import Editorial from "@/components/home/Editorial";
import Minimal from "@/components/home/Minimal";

/**
 * Página inicial: um de quatro layouts fixos (Tenant.tema.layout), todos
 * alimentados pelos mesmos dados. O lojista escolhe a composição; não
 * desenha. Ver src/lib/tema.ts (LAYOUTS).
 */
export default async function Home() {
  const t = await exigirTenant();
  const [categorias, destaques] = await Promise.all([listarCategorias(t.id), listarProdutos(t.id, { destaque: true })]);
  const vitrine = destaques.length ? destaques : await listarProdutos(t.id);
  const dados = { t, categorias, vitrine, temDestaques: destaques.length > 0, vende: lojaVende(t) };

  switch (temaDo(t).layout) {
    case "vitrine":
      return <Vitrine {...dados} />;
    case "editorial":
      return <Editorial {...dados} />;
    case "minimal":
      return <Minimal {...dados} />;
    default:
      return <Classico {...dados} />;
  }
}
