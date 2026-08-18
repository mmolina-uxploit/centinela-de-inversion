# ADR 002: Motor Cognitivo Anthropic vía Tool Use Forzado

## 1. Contexto Operativo

El README de especificación (`README_Centinela_de_Inversion.md`) permite
elegir entre el SDK oficial de OpenAI o el de Anthropic como motor
cognitivo, y describe la restricción de salida estructurada con la
sintaxis específica de OpenAI: `response_format: { type: "json_object" }`.

Este proyecto se construye con el SDK de Anthropic. La API de Anthropic no
expone un parámetro `response_format`; forzar una salida estructurada
equivalente requiere un mecanismo distinto. Era necesario decidir cuál, y
dejar registrado que la ausencia del parámetro exacto mencionado en el
README no es un incumplimiento de la especificación, sino la adaptación
correcta de su *intención* al SDK elegido.

## 2. Decisión Arquitectónica

Se implementa **tool use forzado** (`tool_choice: { type: "tool", name: ... }`)
como mecanismo de restricción de salida:

- Se define una única herramienta (`record_burn_rate_analysis`) cuyo
  `input_schema` es, campo por campo, un espejo del contrato de datos
  real (`BurnRateAnalysisSchema` en `src/schema.ts`).
- `tool_choice` obliga al modelo a invocar esa herramienta en cada
  llamada — no puede optar por responder con texto libre.
- La respuesta se extrae del bloque `tool_use` de la API (no de texto
  parseado) y **igual** se somete a `Zod.parse()` antes de ser asignada a
  cualquier variable operativa, exactamente como exige ADR-001 sección 2.
  Tool use forzado no reemplaza la validación Zod: reduce la probabilidad
  de que haga falta rechazar algo, pero la validación sigue siendo la
  única puerta de entrada.

Esta decisión no es una alternativa más débil a `response_format`: es una
restricción *más* estricta, porque el modelo valida su salida contra un
schema (`input_schema`) en el momento mismo de generarla, en vez de
generar JSON libre que recién se valida después.

Es importante no leer esto como "tool use forzado hace innecesaria la
validación Zod de la Fase 3" — es la lectura contraria a la intención de
esta decisión. `tool_choice` es una garantía que depende de un proveedor
externo (Anthropic); `Zod.parse()` es una garantía que depende únicamente
de este código. Mantener ambas capas activas al mismo tiempo, verificando
en esencia la misma propiedad desde dos lugares distintos, es deliberado:
ver [informe técnico, Sección 5.1](informe_tecnico.md#51-sobre-la-redundancia-como-principio-de-diseño-no-como-desperdicio)
para el argumento completo de por qué esa redundancia es la característica
de seguridad central del sistema, no una ineficiencia a eliminar.

## 3. Consecuencias

- El código no incluye ninguna rama para OpenAI. Migrar de motor cognitivo
  en el futuro implica reescribir `src/engine.ts` (llamada a la API +
  extracción de la respuesta), sin tocar `src/schema.ts`, `src/mocks.ts`
  ni `src/index.ts` — el contrato de datos es independiente del proveedor.
- El `input_schema` de la tool se mantiene escrito a mano en
  `src/engine.ts`, sin depender de una librería de conversión
  Zod→JSON-Schema, porque es un único objeto chico. Esto es una decisión
  deliberada de legibilidad para este prototipo: le permite a cualquiera
  que audite el código confirmar a simple vista que el contrato que ve el
  modelo y el contrato que valida Zod dicen lo mismo, sin depender de una
  transformación automática. Si el contrato creciera en tamaño o en
  número de variantes, este acoplamiento manual dejaría de ser sostenible
  y correspondería introducir una única fuente de verdad generada a
  partir del schema de Zod.
- Existe un modo de desarrollo (`src/dryRun.ts`, activado por
  `CENTINELA_DRY_RUN=true`) que calcula el mismo resultado localmente,
  sin invocar la API. Este modo prueba que el contrato de datos y la
  lógica de cálculo son consistentes entre sí, pero **no** prueba que
  `tool_choice` y la extracción de la respuesta funcionen contra el
  modelo real — esa verificación solo la cubre una corrida en modo real
  (`npm run dev`).
