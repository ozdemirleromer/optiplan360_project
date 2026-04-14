import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function getArgValue(args, flagName) {
  const index = args.indexOf(flagName);
  if (index === -1) {
    return null;
  }
  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${flagName} icin deger girilmelidir.`);
  }
  return value;
}

function typeOfValue(value) {
  if (Array.isArray(value)) {
    return "array";
  }
  if (value === null) {
    return "null";
  }
  return typeof value;
}

function validate(schema, value, path, errors, strictEnum) {
  if (!schema || typeof schema !== "object") {
    return;
  }

  if (Array.isArray(schema.type)) {
    const actualType = typeOfValue(value);
    const ok = schema.type.includes(actualType);
    if (!ok) {
      errors.push(`${path}: type beklenen ${schema.type.join("|")} gelen ${actualType}`);
      return;
    }
  } else if (typeof schema.type === "string") {
    const actualType = typeOfValue(value);
    if (actualType !== schema.type) {
      errors.push(`${path}: type beklenen ${schema.type} gelen ${actualType}`);
      return;
    }
  }

  if (schema.enum) {
    const ok = schema.enum.some((item) => item === value);
    if (!ok) {
      if (strictEnum) {
        errors.push(`${path}: enum disi deger ${String(value)}`);
        return;
      }
    }
  }

  if (schema.type === "object") {
    const required = schema.required ?? [];
    for (const key of required) {
      if (!(key in value)) {
        errors.push(`${path}.${key}: zorunlu alan eksik`);
      }
    }

    const properties = schema.properties ?? {};

    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!(key in properties)) {
          errors.push(`${path}.${key}: additionalProperties izin verilmiyor`);
        }
      }
    }

    for (const [key, childSchema] of Object.entries(properties)) {
      if (key in value) {
        validate(childSchema, value[key], `${path}.${key}`, errors, strictEnum);
      }
    }
    return;
  }

  if (schema.type === "array") {
    if (!Array.isArray(value)) {
      errors.push(`${path}: array bekleniyor`);
      return;
    }
    const itemSchema = schema.items;
    if (itemSchema) {
      for (let index = 0; index < value.length; index += 1) {
        validate(itemSchema, value[index], `${path}[${index}]`, errors, strictEnum);
      }
    }
  }
}

const args = process.argv.slice(2);
const schemaArg = getArgValue(args, "--schema");
const inputArg = getArgValue(args, "--input");
const strictEnum = args.includes("--strict-enum");

if (!schemaArg || !inputArg) {
  throw new Error("Kullanim: node scripts/validate_json_report.mjs --schema <schemaPath> --input <inputPath>");
}

const schemaPath = resolve(process.cwd(), schemaArg);
const inputPath = resolve(process.cwd(), inputArg);

const schema = JSON.parse(readFileSync(schemaPath, "utf8"));
const payload = JSON.parse(readFileSync(inputPath, "utf8"));

const errors = [];
validate(schema, payload, "$", errors, strictEnum);

if (errors.length > 0) {
  console.error("[validate-json-report] Rapor dogrulamasi basarisiz:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log(`[validate-json-report] OK: ${inputArg}`);
