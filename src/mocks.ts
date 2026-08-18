/**
 * FASE 1 — Inyección de dependencias estáticas.
 *
 * Dos orígenes de datos mock que emulan las estructuras de respuesta reales
 * de Shopify API y Meta Ads API. En este prototipo viven como JSON estático
 * en memoria; en una siguiente iteración cada uno se reemplaza por su
 * llamada HTTP real sin tocar el resto del pipeline (los tipos ya son el
 * contrato).
 */

/** Emula GET /admin/api/{version}/products/{id}.json de Shopify. */
export interface ShopifyInventorySnapshot {
  productId: string;
  productTitle: string;
  /** Unidades disponibles en depósito ahora mismo. */
  unitsAvailable: number;
  /** Momento de la lectura, ISO 8601. */
  timestamp: string;
}

/** Emula GET /{ad-id}/insights de Meta Marketing API. */
export interface MetaAdsCampaignSnapshot {
  campaignId: string;
  campaignName: string;
  /** Clics acumulados en la última hora. */
  clicksLastHour: number;
  /** Gasto en USD consumido en la última hora. */
  spendLastHourUsd: number;
  /** Tasa de conversión histórica de clic a unidad vendida (0–1). */
  clickToUnitConversionRate: number;
  timestamp: string;
}

/** Escenario CRÍTICO: stock bajo, campaña de alto tráfico. */
export const shopifyInventoryMock: ShopifyInventorySnapshot = {
  productId: "prod_8842910",
  productTitle: "Zapatilla Urbana Modelo Aire — Talle 42",
  unitsAvailable: 37,
  timestamp: "2026-08-15T14:00:00Z",
};

export const metaAdsCampaignMock: MetaAdsCampaignSnapshot = {
  campaignId: "camp_2291847",
  campaignName: "Conversión — Retargeting Zapatilla Aire",
  clicksLastHour: 412,
  spendLastHourUsd: 186.5,
  clickToUnitConversionRate: 0.045,
  timestamp: "2026-08-15T14:00:00Z",
};

/** Escenario ESTABLE: stock amplio, campaña de bajo impacto relativo. */
export const shopifyInventoryStableMock: ShopifyInventorySnapshot = {
  productId: "prod_7719302",
  productTitle: "Remera Básica Algodón — Talle M",
  unitsAvailable: 890,
  timestamp: "2026-08-15T14:00:00Z",
};

export const metaAdsCampaignStableMock: MetaAdsCampaignSnapshot = {
  campaignId: "camp_1150238",
  campaignName: "Awareness — Remera Básica Catálogo",
  clicksLastHour: 58,
  spendLastHourUsd: 22.1,
  clickToUnitConversionRate: 0.03,
  timestamp: "2026-08-15T14:00:00Z",
};

/**
 * Escenario CASI CRÍTICO: el resultado cae cerca de CRITICAL_HOURS_THRESHOLD
 * (6 h, ver engine.ts). Sirve para demostrar que el corte crítico/estable
 * responde al número calculado, no a un umbral arbitrario elegido para
 * que "dé bien" en la demo.
 */
export const shopifyInventoryBorderlineMock: ShopifyInventorySnapshot = {
  productId: "prod_5563012",
  productTitle: "Mochila Urbana Impermeable 20L",
  unitsAvailable: 64,
  timestamp: "2026-08-15T14:00:00Z",
};

export const metaAdsCampaignBorderlineMock: MetaAdsCampaignSnapshot = {
  campaignId: "camp_3387410",
  campaignName: "Conversión — Mochila Urbana Lanzamiento",
  clicksLastHour: 205,
  spendLastHourUsd: 98.2,
  clickToUnitConversionRate: 0.05,
  timestamp: "2026-08-15T14:00:00Z",
};

/**
 * Escenario SIN CONVERSIÓN: clickToUnitConversionRate en 0 (campaña de
 * awareness puro, o tracking de conversión roto). Ejercita el caso borde
 * de división por cero en el cálculo de horas hasta agotamiento — ver el
 * manejo explícito en dryRun.ts y la instrucción equivalente en el prompt
 * de engine.ts.
 */
export const shopifyInventoryNoConversionMock: ShopifyInventorySnapshot = {
  productId: "prod_9911204",
  productTitle: "Gorra Logo Edición Limitada",
  unitsAvailable: 150,
  timestamp: "2026-08-15T14:00:00Z",
};

export const metaAdsCampaignNoConversionMock: MetaAdsCampaignSnapshot = {
  campaignId: "camp_4402198",
  campaignName: "Awareness — Gorra Edición Limitada",
  clicksLastHour: 340,
  spendLastHourUsd: 75.0,
  clickToUnitConversionRate: 0,
  timestamp: "2026-08-15T14:00:00Z",
};
