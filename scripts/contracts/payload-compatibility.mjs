const keys = {
  string: ["minLength", "maxLength", "x-trim"],
  integer: ["minimum", "maximum"], number: ["minimum", "maximum"],
  boolean: [], null: [], array: ["items", "minItems", "maxItems"],
  object: ["properties", "required", "additionalProperties"],
};
const record = value => value !== null && typeof value === "object" && !Array.isArray(value);

/** Deliberately a closed JSON Schema subset. Unknown semantics cannot pass. */
function validate(schema) {
  if (!record(schema) || !Object.hasOwn(keys, schema.type)) throw new Error("UNSUPPORTED_SCHEMA");
  const allowed = ["type", "enum", ...keys[schema.type]];
  if (Object.keys(schema).some(key => !allowed.includes(key))) throw new Error("UNSUPPORTED_SCHEMA_KEYWORD");
  if (schema.enum !== undefined && (!["string", "number", "integer", "boolean", "null"].includes(schema.type) ||
    !Array.isArray(schema.enum) || !schema.enum.length || schema.enum.some(value => !scalarFits(value, { ...schema, enum: undefined })))) throw new Error("UNSUPPORTED_SCHEMA_ENUM");
  for (const key of ["minimum", "maximum", "minLength", "maxLength", "minItems", "maxItems"]) {
    if (schema[key] !== undefined && (!Number.isFinite(schema[key]) ||
      (!key.endsWith("imum") && (!Number.isInteger(schema[key]) || schema[key] < 0)))) throw new Error("UNSUPPORTED_SCHEMA_BOUND");
  }
  if (schema["x-trim"] !== undefined && schema["x-trim"] !== true) throw new Error("UNSUPPORTED_SCHEMA_NORMALIZATION");
  for (const [min, max] of [["minimum", "maximum"], ["minLength", "maxLength"], ["minItems", "maxItems"]]) {
    if (schema[min] !== undefined && schema[max] !== undefined && schema[min] > schema[max]) throw new Error("UNSUPPORTED_SCHEMA_EMPTY_RANGE");
  }
  if (schema.type === "object") {
    if (!record(schema.properties) || !Array.isArray(schema.required) || typeof schema.additionalProperties !== "boolean" ||
      schema.required.some(key => typeof key !== "string" || !Object.hasOwn(schema.properties, key))) throw new Error("UNSUPPORTED_SCHEMA_OBJECT");
    Object.values(schema.properties).forEach(validate);
  }
  if (schema.type === "array") validate(schema.items);
}

function scalarFits(value, schema) {
  if (schema.enum && !schema.enum.includes(value)) return false;
  if (schema.type === "null") return value === null;
  if (schema.type === "string") return typeof value === "string" && value.length >= (schema.minLength ?? 0) && value.length <= (schema.maxLength ?? Infinity);
  if (schema.type === "boolean") return typeof value === "boolean";
  return typeof value === "number" && Number.isFinite(value) && (schema.type !== "integer" || Number.isInteger(value)) &&
    value >= (schema.minimum ?? -Infinity) && value <= (schema.maximum ?? Infinity);
}

// Is every value produced/accepted by `from` also accepted by `to`?
function subset(from, to, path, changes) {
  const fail = reason => changes.push({ path, reason });
  if (from.type !== to.type && !(from.type === "integer" && to.type === "number")) { fail("type_not_subset"); return; }
  if (from["x-trim"] !== to["x-trim"]) fail("normalization_changed");
  if (from.enum) {
    if (from.enum.some(value => !scalarFits(value, to))) fail("enum_not_subset");
  } else if (to.enum) fail("enum_restricts_values");
  for (const [min, max] of (from.enum ? [] : [["minimum", "maximum"], ["minLength", "maxLength"], ["minItems", "maxItems"]])) {
    const floor = min === "minimum" ? -Infinity : 0;
    if ((from[min] ?? floor) < (to[min] ?? floor)) fail(`${min}_not_subset`);
    if ((from[max] ?? Infinity) > (to[max] ?? Infinity)) fail(`${max}_not_subset`);
  }
  if (from.type === "array") subset(from.items, to.items, `${path}[]`, changes);
  if (from.type === "object") {
    for (const key of to.required) if (!from.required.includes(key)) changes.push({ path: `${path}.${key}`, reason: "required_not_guaranteed" });
    if (from.additionalProperties && !to.additionalProperties) fail("additional_properties_restricted");
    for (const [key, field] of Object.entries(from.properties)) {
      if (Object.hasOwn(to.properties, key)) subset(field, to.properties[key], `${path}.${key}`, changes);
      else if (!to.additionalProperties) changes.push({ path: `${path}.${key}`, reason: "property_not_accepted" });
    }
    if (from.additionalProperties) {
      for (const key of Object.keys(to.properties)) if (!Object.hasOwn(from.properties, key)) changes.push({ path: `${path}.${key}`, reason: "previously_unconstrained_property" });
    }
  }
}

export function comparePayloadSchemas(baseline, candidate) {
  for (const contract of [baseline, candidate]) {
    if (!record(contract)) throw new Error("UNSUPPORTED_SCHEMA_CONTRACT");
    validate(contract.request);
    validate(contract.response);
    if (contract.error !== undefined) validate(contract.error);
  }
  const changes = [];
  subset(baseline.request, candidate.request, "request", changes);
  subset(candidate.response, baseline.response, "response", changes);
  if (baseline.error && candidate.error) subset(candidate.error, baseline.error, "error", changes);
  else if (Boolean(baseline.error) !== Boolean(candidate.error)) changes.push({ path: "error", reason: "error_contract_changed" });
  for (const field of ["schemaVersion", "operation", "authorization", "errorStatuses"]) {
    if (JSON.stringify(baseline[field]) !== JSON.stringify(candidate[field])) changes.push({ path: field, reason: "protocol_changed" });
  }
  return { compatible: changes.length === 0, changes };
}
