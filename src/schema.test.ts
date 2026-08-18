import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { BurnRateAnalysisSchema } from "./schema.js";

/**
 * Prueba el corazón del ADR-001: que Zod efectivamente rechaza cualquier
 * respuesta que no matchee el contrato exacto (fail-fast), y acepta las
 * que sí lo hacen. Sin esto, "validamos con Zod" es una afirmación no
 * verificada — estos tests son la evidencia de que la puerta cierra.
 *
 * Corre con: node --import tsx --test src/schema.test.ts
 * (o `npm test`, ver package.json)
 */

const VALID_ANALYSIS = {
  unitsBurnedPerHour: 18.54,
  hoursUntilStockout: 2.0,
  isCritical: true,
  reasoning: "A 18.54 u/h, el stock se agota en 2 horas.",
};

describe("BurnRateAnalysisSchema", () => {
  it("acepta un objeto que cumple el contrato exacto", () => {
    const result = BurnRateAnalysisSchema.parse(VALID_ANALYSIS);
    assert.deepEqual(result, VALID_ANALYSIS);
  });

  it("rechaza cuando falta un campo requerido", () => {
    const { reasoning, ...withoutReasoning } = VALID_ANALYSIS;
    assert.throws(() => BurnRateAnalysisSchema.parse(withoutReasoning));
  });

  it("rechaza cuando un número llega como string (alucinación típica del LLM)", () => {
    assert.throws(() =>
      BurnRateAnalysisSchema.parse({ ...VALID_ANALYSIS, hoursUntilStockout: "2.0" }),
    );
  });

  it("rechaza unitsBurnedPerHour negativo", () => {
    assert.throws(() =>
      BurnRateAnalysisSchema.parse({ ...VALID_ANALYSIS, unitsBurnedPerHour: -5 }),
    );
  });

  it("rechaza isCritical como string en vez de boolean", () => {
    assert.throws(() => BurnRateAnalysisSchema.parse({ ...VALID_ANALYSIS, isCritical: "true" }));
  });

  it("rechaza reasoning vacío", () => {
    assert.throws(() => BurnRateAnalysisSchema.parse({ ...VALID_ANALYSIS, reasoning: "" }));
  });

  it("rechaza reasoning que excede el máximo (texto conversacional colado)", () => {
    const wallOfText = "A".repeat(281);
    assert.throws(() =>
      BurnRateAnalysisSchema.parse({ ...VALID_ANALYSIS, reasoning: wallOfText }),
    );
  });

  it("rechaza un objeto completamente vacío", () => {
    assert.throws(() => BurnRateAnalysisSchema.parse({}));
  });

  it("rechaza null y undefined", () => {
    assert.throws(() => BurnRateAnalysisSchema.parse(null));
    assert.throws(() => BurnRateAnalysisSchema.parse(undefined));
  });

  it("rechaza cuando el modelo devuelve texto conversacional en vez de JSON", () => {
    assert.throws(() =>
      BurnRateAnalysisSchema.parse("Claro, aquí está el análisis que pediste: ..."),
    );
  });

  it("acepta hoursUntilStockout en cero (agotamiento inmediato)", () => {
    const result = BurnRateAnalysisSchema.parse({ ...VALID_ANALYSIS, hoursUntilStockout: 0 });
    assert.equal(result.hoursUntilStockout, 0);
  });
});
