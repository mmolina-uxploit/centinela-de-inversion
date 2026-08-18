import { z } from "zod";

/**
 * FASE 3 — Contrato de validación de integridad.
 *
 * Este esquema es la única puerta de entrada por la que puede pasar una
 * respuesta del motor cognitivo hacia el resto del sistema (ADR-001,
 * sección 2). Nada se asigna a una variable operativa sin atravesar
 * `BurnRateAnalysisSchema.parse()` primero.
 *
 * Cualquier desviación —campo faltante, tipo incorrecto, alucinación,
 * texto conversacional colado— debe hacer fallar esto de inmediato
 * (fail-fast, ADR-001 sección 3), nunca llegar a la lógica de alerta.
 */
export const BurnRateAnalysisSchema = z.object({
  /** Unidades que se venden por hora al ritmo de clics/conversión actual. */
  unitsBurnedPerHour: z.number().nonnegative(),

  /** Horas restantes hasta agotar `unitsAvailable` al ritmo actual. */
  hoursUntilStockout: z.number().nonnegative(),

  /**
   * true si `hoursUntilStockout` cae por debajo del umbral crítico
   * (ver CRITICAL_HOURS_THRESHOLD en engine.ts) y por lo tanto corresponde
   * emitir la alerta de detención de pauta.
   */
  isCritical: z.boolean(),

  /** Una oración breve, sin relleno conversacional, que resume el hallazgo. */
  reasoning: z.string().min(1).max(280),
});

export type BurnRateAnalysis = z.infer<typeof BurnRateAnalysisSchema>;
