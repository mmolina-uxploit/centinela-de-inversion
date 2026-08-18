import { BurnRateAnalysisSchema, type BurnRateAnalysis } from "./schema.js";
import { CRITICAL_HOURS_THRESHOLD } from "./engine.js";
import type { MetaAdsCampaignSnapshot, ShopifyInventorySnapshot } from "./mocks.js";

/**
 * MODO DRY-RUN — herramienta de desarrollo, no parte del pipeline oficial.
 *
 * Calcula el mismo Burn Rate que se le pediría al motor cognitivo, pero
 * en TypeScript puro, sin llamar a la API de Anthropic. Sirve para
 * verificar las Fases 1 y 3 del pipeline (mocks → validación Zod → alerta)
 * sin gastar crédito, mientras no haya API key con saldo disponible.
 *
 * El resultado igual se hace pasar por BurnRateAnalysisSchema.parse():
 * el objetivo es probar que el contrato de datos es correcto, no saltearlo.
 * No reemplaza la Fase D (verificación contra el modelo real) — un cálculo
 * local no prueba que `tool_choice` y el parseo de la respuesta del LLM
 * funcionen contra una salida real, solo que la lógica y el schema son
 * consistentes entre sí.
 */
export function calculateBurnRateDryRun(
  inventory: ShopifyInventorySnapshot,
  campaign: MetaAdsCampaignSnapshot,
): BurnRateAnalysis {
  const unitsBurnedPerHour = campaign.clicksLastHour * campaign.clickToUnitConversionRate;

  const hoursUntilStockout =
    unitsBurnedPerHour > 0 ? inventory.unitsAvailable / unitsBurnedPerHour : Infinity;

  const isCritical = hoursUntilStockout < CRITICAL_HOURS_THRESHOLD;

  const reasoning =
    unitsBurnedPerHour > 0
      ? `[DRY-RUN] A ${unitsBurnedPerHour.toFixed(2)} u/h, el stock de ${inventory.unitsAvailable} unidades se agota en ${hoursUntilStockout.toFixed(2)} h.`
      : `[DRY-RUN] La campaña no genera conversión proyectada (0 u/h); no hay agotamiento previsible.`;

  // Zod no acepta Infinity con .nonnegative() de forma útil para un jurado
  // que lea la alerta, así que lo tapamos a un techo arbitrario grande
  // solo para este caso borde de "cero quema" — no aplica en el pipeline
  // real, donde clicksLastHour > 0 en los mocks.
  const safeHours = Number.isFinite(hoursUntilStockout) ? hoursUntilStockout : 999_999;

  return BurnRateAnalysisSchema.parse({
    unitsBurnedPerHour,
    hoursUntilStockout: safeHours,
    isCritical,
    reasoning,
  });
}
