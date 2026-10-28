import type { z } from "zod";
import type { ConsultaDeCupom, RespostaDeCupom } from "../../src/lib/api-cupom-contrato";
import type { ConsultaCupomV1, RespostaCupomV1 } from "../../examples/contracts/cupom-v1";

// Compilado pelo typecheck completo da imagem. A entrada fixa do consumidor
// precisa continuar aceita; a saída atual precisa caber no tipo v1 fixado.
export function fixedRequestIsAccepted(value: ConsultaCupomV1): z.input<typeof ConsultaDeCupom> { return value; }
export function currentResponseFitsV1(value: z.output<typeof RespostaDeCupom>): RespostaCupomV1 { return value.dados; }
