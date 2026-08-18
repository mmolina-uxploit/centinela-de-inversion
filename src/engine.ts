import Anthropic from "@anthropic-ai/sdk";
import { BurnRateAnalysisSchema, type BurnRateAnalysis } from "./schema.js";
import type { MetaAdsCampaignSnapshot, ShopifyInventorySnapshot } from "./mocks.js";

/**
 * FASE 2 — Procesamiento algorítmico (motor cognitivo).
 *
 * El README pide `response_format: { type: "json_object" }`, que es
 * sintaxis específica de la API de OpenAI. La decisión de este proyecto
 * (confirmada por el usuario) es usar el SDK de Anthropic; el equivalente
 * funcional aquí es tool use forzado: se define una única herramienta cuyo
 * input_schema ES el contrato de datos, y `tool_choice` obliga al modelo a
 * invocarla siempre. Esto cumple la instrucción del ADR-001 ("restrinja su
 * respuesta a un objeto JSON puro, anulando su rol como procesador de
 * lenguaje natural") de forma al menos igual de estricta que json_object:
 * la salida no solo es JSON válido, está validada contra un schema en el
 * momento de generarse, no después.
 */

/** Debajo de este umbral de horas restantes, la situación es crítica. */
export const CRITICAL_HOURS_THRESHOLD = 6;

const TOOL_NAME = "record_burn_rate_analysis";

/**
 * input_schema de la tool, espejo manual de BurnRateAnalysisSchema.
 * Se mantiene a mano (sin librería de zod-to-json-schema) porque es un
 * único objeto chico y así el jurado puede auditar a simple vista que
 * ambos contratos —el que ve el modelo y el que valida Zod— dicen lo mismo.
 */
const ANALYSIS_TOOL: Anthropic.Tool = {
  name: TOOL_NAME,
  description:
    "Registra el resultado del análisis de tasa de agotamiento de stock frente al ritmo de gasto publicitario.",
  input_schema: {
    type: "object",
    properties: {
      unitsBurnedPerHour: {
        type: "number",
        description: "Unidades vendidas por hora al ritmo de clics y conversión actual.",
      },
      hoursUntilStockout: {
        type: "number",
        description: "Horas restantes hasta agotar el inventario disponible al ritmo actual.",
      },
      isCritical: {
        type: "boolean",
        description: `true si hoursUntilStockout es menor a ${CRITICAL_HOURS_THRESHOLD} horas.`,
      },
      reasoning: {
        type: "string",
        description: "Una oración breve que resume el cálculo. Sin texto conversacional adicional.",
      },
    },
    required: ["unitsBurnedPerHour", "hoursUntilStockout", "isCritical", "reasoning"],
  },
};

function buildPrompt(
  inventory: ShopifyInventorySnapshot,
  campaign: MetaAdsCampaignSnapshot,
): string {
  return `Sos el motor de cálculo del Centinela de Inversión. Tu única tarea es matemática, no conversacional.

INVENTARIO ACTUAL (Shopify):
${JSON.stringify(inventory, null, 2)}

CAMPAÑA ACTIVA (Meta Ads):
${JSON.stringify(campaign, null, 2)}

Calculá:
1. unitsBurnedPerHour = clicksLastHour * clickToUnitConversionRate
2. hoursUntilStockout = unitsAvailable / unitsBurnedPerHour
3. isCritical = true si hoursUntilStockout < ${CRITICAL_HOURS_THRESHOLD}
4. reasoning = una oración breve justificando el resultado

Invocá la herramienta ${TOOL_NAME} con el resultado. No respondas con texto fuera de la herramienta.`;
}

/**
 * Cruza inventario y campaña a través del motor cognitivo y devuelve un
 * BurnRateAnalysis ya validado. Nunca devuelve un objeto sin validar:
 * si el modelo no invoca la tool, o el input no matchea el schema, esta
 * función deja propagar la excepción (fail-fast, ADR-001 sección 3).
 */
export async function calculateBurnRate(
  client: Anthropic,
  inventory: ShopifyInventorySnapshot,
  campaign: MetaAdsCampaignSnapshot,
): Promise<BurnRateAnalysis> {
  const response = await client.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 512,
    tools: [ANALYSIS_TOOL],
    tool_choice: { type: "tool", name: TOOL_NAME },
    messages: [{ role: "user", content: buildPrompt(inventory, campaign) }],
  });

  const toolUseBlock = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
  );

  if (!toolUseBlock) {
    throw new Error(
      "Fallo de integridad: el motor cognitivo no invocó la herramienta esperada. " +
        "Respuesta cruda: " +
        JSON.stringify(response.content),
    );
  }

  // FASE 3 — validación de integridad obligatoria antes de asignar a
  // cualquier variable operativa. Si esto lanza, el proceso se interrumpe
  // (ver index.ts) tal como exige el README.
  return BurnRateAnalysisSchema.parse(toolUseBlock.input);
}
