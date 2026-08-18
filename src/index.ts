import Anthropic from "@anthropic-ai/sdk";
import {
  metaAdsCampaignMock,
  metaAdsCampaignStableMock,
  metaAdsCampaignBorderlineMock,
  metaAdsCampaignNoConversionMock,
  shopifyInventoryMock,
  shopifyInventoryStableMock,
  shopifyInventoryBorderlineMock,
  shopifyInventoryNoConversionMock,
  type MetaAdsCampaignSnapshot,
  type ShopifyInventorySnapshot,
} from "./mocks.js";
import { calculateBurnRate } from "./engine.js";
import { calculateBurnRateDryRun } from "./dryRun.js";
import type { BurnRateAnalysis } from "./schema.js";

interface Scenario {
  label: string;
  inventory: ShopifyInventorySnapshot;
  campaign: MetaAdsCampaignSnapshot;
}

/**
 * Cuatro escenarios, cada uno pensado para ejercitar algo distinto del
 * pipeline (no variantes repetidas del mismo caso):
 *  1. Crítico franco — dispara la alerta con margen amplio.
 *  2. Estable franco — confirma que el sistema no alarma de más.
 *  3. Casi crítico — el resultado cae apenas por encima del umbral
 *     (CRITICAL_HOURS_THRESHOLD en engine.ts), para mostrar que el corte
 *     responde al número calculado, no a un umbral elegido a conveniencia.
 *  4. Sin conversión — clickToUnitConversionRate en 0, ejercita la
 *     división por cero manejada explícitamente en dryRun.ts.
 */
const SCENARIOS: Scenario[] = [
  { label: "Escenario 1 — Zapatilla (crítico franco)", inventory: shopifyInventoryMock, campaign: metaAdsCampaignMock },
  { label: "Escenario 2 — Remera (estable franco)", inventory: shopifyInventoryStableMock, campaign: metaAdsCampaignStableMock },
  { label: "Escenario 3 — Mochila (casi crítico)", inventory: shopifyInventoryBorderlineMock, campaign: metaAdsCampaignBorderlineMock },
  { label: "Escenario 4 — Gorra (sin conversión)", inventory: shopifyInventoryNoConversionMock, campaign: metaAdsCampaignNoConversionMock },
];

function formatAlert(scenario: Scenario, analysis: BurnRateAnalysis): string {
  const lines = [
    "🚨 ALERTA CRÍTICA — CENTINELA DE INVERSIÓN 🚨",
    "─".repeat(50),
    `Producto:            ${scenario.inventory.productTitle}`,
    `Campaña:              ${scenario.campaign.campaignName}`,
    `Stock disponible:     ${scenario.inventory.unitsAvailable} unidades`,
    `Ritmo de quema:       ${analysis.unitsBurnedPerHour.toFixed(2)} u/h`,
    `Horas hasta quiebre:  ${analysis.hoursUntilStockout.toFixed(2)} h`,
    `Razonamiento:         ${analysis.reasoning}`,
    "─".repeat(50),
    "ACCIÓN RECOMENDADA: detener el gasto publicitario en esta campaña.",
  ];
  return lines.join("\n");
}

function formatStable(analysis: BurnRateAnalysis): string {
  return [
    "✅ Situación estable. No se requiere acción.",
    `   Horas hasta quiebre de stock: ${analysis.hoursUntilStockout.toFixed(2)} h`,
    `   Razonamiento: ${analysis.reasoning}`,
  ].join("\n");
}

async function analyzeScenario(
  scenario: Scenario,
  isDryRun: boolean,
  client: Anthropic | null,
): Promise<void> {
  console.log(`\n▶ ${scenario.label}`);

  // Fases 1→2→3: mocks ya instanciados (mocks.ts) → motor cognitivo
  // (real o dry-run) → validación Zod obligatoria.
  const analysis = isDryRun
    ? calculateBurnRateDryRun(scenario.inventory, scenario.campaign)
    : await calculateBurnRate(client as Anthropic, scenario.inventory, scenario.campaign);

  console.log(analysis.isCritical ? formatAlert(scenario, analysis) : formatStable(analysis));
}

async function main(): Promise<void> {
  // Modo dry-run: calcula localmente en vez de llamar a Claude. Pensado
  // para desarrollar/probar Fases 1 y 3 sin necesitar crédito de API.
  // No es el pipeline oficial del README — ver src/dryRun.ts.
  const isDryRun = process.env["CENTINELA_DRY_RUN"] === "true";

  let client: Anthropic | null = null;
  if (!isDryRun) {
    const apiKey = process.env["ANTHROPIC_API_KEY"];
    if (!apiKey) {
      throw new Error(
        "Falta ANTHROPIC_API_KEY en el entorno. Definila antes de correr el sistema.",
      );
    }
    client = new Anthropic({ apiKey });
  }

  console.log(
    isDryRun
      ? "Centinela de Inversión [MODO DRY-RUN — sin llamada a la API]"
      : "Centinela de Inversión — analizando snapshots actuales...",
  );

  // Secuencial a propósito: cada escenario termina de imprimir antes de
  // que arranque el siguiente, para que la salida en consola sea legible.
  for (const scenario of SCENARIOS) {
    await analyzeScenario(scenario, isDryRun, client);
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error("\n❌ ERROR FATAL — el proceso se interrumpió antes de emitir un resultado no confiable.");
  console.error(`   ${message}`);
  process.exitCode = 1;
});
