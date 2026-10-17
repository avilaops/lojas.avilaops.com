import assert from "node:assert/strict";
import test from "node:test";
import { TenantAtualizacaoSchema, TenantEntradaSchema } from "./admin-schemas";

// Os ids de pixel são interpolados em script em linha (`src/components/Pixels.tsx`).
// O que impede um id de fechar a string ou a tag é o formato exigido na entrada:
// as três portas (admin POST e PATCH, painel da loja) passam por estes schemas.

const CAMPOS = ["gtmId", "ga4Id", "googleAdsId", "metaPixelId", "tiktokPixelId"] as const;

const VALIDOS: Record<(typeof CAMPOS)[number], string[]> = {
  gtmId: ["GTM-PFBBR3GG", "GTM-ABC123"],
  ga4Id: ["G-ABCD123456", "g-abcd123456"],
  googleAdsId: ["AW-123456789", "aw-12345678901"],
  metaPixelId: ["123456", "1234567890123456"],
  tiktokPixelId: ["C4A1B2C3D4E5F6G7H8I9", "cabc1234567890abcdef"],
};

const aceita = (campo: string, valor: unknown) => TenantAtualizacaoSchema.safeParse({ [campo]: valor }).success;

test("id de pixel bem formado entra, e nulo apaga", () => {
  for (const campo of CAMPOS) {
    for (const valor of VALIDOS[campo]) assert.equal(aceita(campo, valor), true, `${campo}=${valor}`);
    assert.equal(aceita(campo, null), true, `${campo}=null`);
  }
});

test("id de pixel com aspas, </script> ou qualquer coisa além do formato é recusado", () => {
  for (const campo of CAMPOS) {
    const bom = VALIDOS[campo][0];
    const ruins = [
      `${bom}'`,
      `${bom}"`,
      `${bom}');alert(1);//`,
      `${bom}</script><script>alert(1)</script>`,
      `</script>${bom}`,
      `${bom}\\`,
      `${bom}\n`,
      `${bom} `,
      ` ${bom}`,
      `${bom}\`\${alert(1)}`,
      `${bom}<!--`,
      "",
    ];
    for (const valor of ruins) assert.equal(aceita(campo, valor), false, `${campo}=${JSON.stringify(valor)}`);
  }
});

test("a criação de loja exige o mesmo formato que a edição", () => {
  for (const campo of CAMPOS) {
    assert.equal(TenantEntradaSchema.shape[campo].safeParse(VALIDOS[campo][0]).success, true, campo);
    assert.equal(TenantEntradaSchema.shape[campo].safeParse(`${VALIDOS[campo][0]}');alert(1);//`).success, false, campo);
    assert.equal(TenantEntradaSchema.shape[campo].safeParse("</script>").success, false, campo);
  }
});
