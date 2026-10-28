import { z, type ZodTypeAny } from "zod";
import { ConsultaDeCupom, ErroDeCupom, OpcoesDaConsultaDeCupom, RespostaDeCupom } from "../../src/lib/api-cupom-contrato";
import { CODIGOS_DE_ERRO } from "../../src/lib/api-resposta";

type Schema = Record<string, unknown>;

/** Fail closed: no refs, transforms, custom refinements or silent omission. */
export function exportSchema(schema: ZodTypeAny): Schema {
  if (schema instanceof z.ZodOptional) return exportSchema(schema.unwrap());
  if (schema instanceof z.ZodString) {
    const result: Schema = { type: "string" };
    let bounded = false;
    for (const check of schema._def.checks) {
      if (check.kind === "trim" && !bounded && !result["x-trim"]) result["x-trim"] = true;
      else if (check.kind === "min") { result["x-minLengthUtf16"] = Math.max(Number(result["x-minLengthUtf16"] ?? 0), check.value); bounded = true; }
      else if (check.kind === "max") { result["x-maxLengthUtf16"] = Math.min(Number(result["x-maxLengthUtf16"] ?? Infinity), check.value); bounded = true; }
      else throw new Error("UNSUPPORTED_ZOD_STRING_CHECK");
    }
    return result;
  }
  if (schema instanceof z.ZodNumber) {
    const result: Schema = { type: "number" };
    for (const check of schema._def.checks) {
      if (check.kind === "int") result.type = "integer";
      else if (check.kind === "min" && check.inclusive) result.minimum = Math.max(Number(result.minimum ?? -Infinity), check.value);
      else if (check.kind === "max" && check.inclusive) result.maximum = Math.min(Number(result.maximum ?? Infinity), check.value);
      else throw new Error("UNSUPPORTED_ZOD_NUMBER_CHECK");
    }
    return result;
  }
  if (schema instanceof z.ZodEnum) return { type: "string", enum: schema.options };
  if (schema instanceof z.ZodArray) {
    if (schema._def.exactLength) throw new Error("UNSUPPORTED_ZOD_ARRAY_LENGTH");
    return { type: "array", items: exportSchema(schema.element),
      ...(schema._def.minLength ? { minItems: schema._def.minLength.value } : {}),
      ...(schema._def.maxLength ? { maxItems: schema._def.maxLength.value } : {}) };
  }
  if (schema instanceof z.ZodObject) {
    if (!(schema._def.catchall instanceof z.ZodNever)) throw new Error("UNSUPPORTED_ZOD_CATCHALL");
    const shape = schema.shape as Record<string, ZodTypeAny>;
    return { type: "object", properties: Object.fromEntries(Object.entries(shape).map(([key, value]) => [key, exportSchema(value)])),
      required: Object.entries(shape).filter(([, value]) => !(value instanceof z.ZodOptional)).map(([key]) => key),
      additionalProperties: schema._def.unknownKeys !== "strict" };
  }
  throw new Error("UNSUPPORTED_ZOD_TYPE");
}

export function exportCupomContract() {
  return { schemaVersion: "lojas-payload-contract/1", operation: "POST /api/v1/vitrine/cupom",
    authorization: OpcoesDaConsultaDeCupom, errorStatuses: CODIGOS_DE_ERRO,
    request: exportSchema(ConsultaDeCupom), response: exportSchema(RespostaDeCupom), error: exportSchema(ErroDeCupom) };
}
