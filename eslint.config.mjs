import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypeScript,
  globalIgnores([".next/**", "node_modules/**", "next-env.d.ts"]),
  // Script `.cjs` é CommonJS por definição: `require` ali não é descuido.
  {
    files: ["**/*.cjs"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  // Dívida herdada, com endereço. Estas três regras do compilador do React
  // acusam nove pontos em cinco arquivos que estão em produção e sem prova
  // visual automatizada: busca e listas do painel que carregam dados dentro de
  // um efeito, e o formulário de cartão do Mercado Pago. Ficam como aviso para
  // o lint poder barrar TODO o resto no build; quem mexer num desses arquivos
  // resolve o aviso dele e tira o arquivo daqui.
  {
    files: [
      "src/components/painel/BuscaPainel.tsx",
      "src/components/painel/CatalogoLista.tsx",
      "src/components/painel/Inventario.tsx",
      "packages/checkout/src/ui/MercadoPagoCardBrick.tsx",
    ],
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/refs": "warn",
    },
  },
]);
