# Centinela de Inversión

Infraestructura de defensa financiera: cruza en tiempo real la velocidad de
tráfico publicitario (Meta Ads) con la profundidad de stock disponible
(Shopify) para detectar agotamiento logístico temprano y emitir una alerta
crítica que indique detener el gasto publicitario.

Prototipo construido para el **CoderCup AI** de Coderhouse.

Documentación completa en [`docs/`](docs/):
[`README_Centinela_de_Inversion.md`](docs/README_Centinela_de_Inversion.md) ·
[`ADR_001_Centinela_de_Inversion.md`](docs/ADR_001_Centinela_de_Inversion.md) ·
[`ADR_002_motor_cognitivo_anthropic.md`](docs/ADR_002_motor_cognitivo_anthropic.md) ·
[`informe_tecnico.md`](docs/informe_tecnico.md)

## Estado de verificación

> Esta sección distingue explícitamente qué está verificado por ejecución
> real de qué está pendiente, siguiendo el mismo criterio del
> [informe técnico](docs/informe_tecnico.md) (Sección 4): no se afirma más
> de lo que efectivamente se corrió.

| Componente | Estado | Evidencia |
|---|---|---|
| Validador Zod (Fase 3) | ✅ Verificado | 11/11 tests unitarios (`npm test`) |
| Pipeline completo, modo simulado | ✅ Verificado | 4 escenarios corridos con `npm run dev:dry` — ver tabla abajo |
| Motor cognitivo real (Fase 2, Claude) | ⏸ Pendiente | No ejecutado — cuenta de API sin crédito aprovisionado |

**Por qué está pendiente, no fallado:** la Fase 2 está completamente
implementada (`src/engine.ts`) y lista para ejecutarse; lo único que falta
es crédito cargado en la cuenta de Anthropic asociada. No es una
limitación de diseño ni un bug — es un paso operativo externo al código.

## Pipeline

```
┌─────────────────┐     ┌──────────────────────┐     ┌───────────────────┐
│  FASE 1 (mocks)  │     │  FASE 2 (motor)       │     │  FASE 3 (schema)   │
│                  │     │                        │     │                    │
│  Shopify JSON ───┼────▶│  Claude, tool_choice   │────▶│  Zod.parse()       │
│  Meta Ads JSON ──┘     │  forzado (o dryRun.ts) │     │                    │
└─────────────────┘     └──────────┬─────────────┘     └─────────┬──────────┘
                                    │                              │
                          no invoca la tool          no matchea el contrato
                                    │                              │
                                    ▼                              ▼
                          ❌ ERROR FATAL               ❌ ERROR FATAL
                          (fail-fast, se corta)        (fail-fast, se corta)

                                                        matchea ✓
                                                              │
                                                              ▼
                                                  ┌───────────────────────┐
                                                  │  isCritical?           │
                                                  ├───────────┬───────────┤
                                                  │   true    │   false   │
                                                  ▼           ▼
                                       🚨 ALERTA CRÍTICA   ✅ Estable
                                       (detener pauta)     (sin acción)
```

Cualquier desviación en Fase 2 o Fase 3 interrumpe el proceso antes de
llegar a emitir una alerta — nunca se asigna un resultado no validado a
una variable operativa (ADR-001, sección 3).

## Escenarios de mock

`src/mocks.ts` define cuatro pares inventario/campaña, cada uno pensado
para ejercitar una condición distinta del sistema (no variantes repetidas
de un mismo caso):

| # | Escenario | Horas hasta quiebre | Resultado (dry-run) |
|---|---|---|---|
| 1 | Crítico franco | 2.00 h | 🚨 Alerta |
| 2 | Estable franco | 511.49 h | ✅ Estable |
| 3 | Casi crítico | 6.24 h | ✅ Estable (0.24 h sobre el umbral de 6 h) |
| 4 | Sin conversión (0%) | 999999.00 h* | ✅ Estable |

\* Valor centinela, no resultado matemático — ver `dryRun.ts` para el
manejo explícito de división por cero.

El Escenario 3 existe para demostrar que la bifurcación crítico/estable
responde al número calculado (`CRITICAL_HOURS_THRESHOLD` en `engine.ts`),
no a un umbral ajustado a posteriori para que la demo "dé bien". Estos
valores son datos ficticios escritos a mano — no provienen de una tienda
Shopify ni de una cuenta de Meta Ads reales (ver
[informe técnico, Sección 1.3](docs/informe_tecnico.md#13-alcance-y-limitaciones-declaradas)).

## Estructura del código

1. **[`src/mocks.ts`](src/mocks.ts)** — los cuatro snapshots de la tabla
   anterior.
2. **[`src/engine.ts`](src/engine.ts)** — motor cognitivo real: Claude
   vía tool use forzado calcula el Burn Rate. Ver
   [ADR-002](docs/ADR_002_motor_cognitivo_anthropic.md) para el porqué de
   `tool_choice` en vez de `response_format`.
3. **[`src/dryRun.ts`](src/dryRun.ts)** — modo de desarrollo: el mismo
   cálculo hecho en TypeScript puro, sin llamar a la API. Prueba que el
   contrato de datos y la lógica de cálculo son consistentes entre sí;
   no reemplaza una corrida contra el modelo real.
4. **[`src/schema.ts`](src/schema.ts)** — contrato Zod. Única puerta de
   entrada para cualquier resultado, venga del motor real o del dry-run.
5. **[`src/schema.test.ts`](src/schema.test.ts)** — 11 tests que prueban
   que el schema efectivamente rechaza inputs malformados (campo
   faltante, tipo incorrecto, texto conversacional, valores fuera de
   rango) y acepta los válidos.
6. **[`src/index.ts`](src/index.ts)** — orquesta los cuatro escenarios
   contra el motor real o dry-run, y formatea la salida en consola.

## Probar el proyecto (sin API key)

> Para quien solo quiere ver el sistema funcionar — evaluadores, jurado,
> o cualquiera clonando el repo por primera vez — este es el camino sin
> fricción: no requiere crear cuenta en Anthropic, cargar crédito, ni
> tocar `.env`.

```bash
git clone https://github.com/mmolina-uxploit/centinela-de-inversion.git
cd centinela-de-inversion
npm install
npm run dev:dry
```

Esto corre el pipeline completo (Fases 1 y 3 reales; Fase 2 simulada
localmente en `dryRun.ts`, mismo cálculo que se le pediría a Claude) sobre
los cuatro escenarios de `src/mocks.ts`, e imprime cada alerta o estado
estable en consola. Ver [Estado de verificación](#estado-de-verificación)
arriba para qué prueba exactamente este modo y qué no.

**Tests del validador** (Fase 3, sin API):

```bash
npm test
```

## Correr en modo real (contra Claude)

Para verificar la Fase 2 real (`tool_choice` forzado contra el modelo, no
su simulación local) hace falta una `ANTHROPIC_API_KEY` propia con
crédito cargado — la API no tiene tier gratuito.

**Esto usa tu key, no la de quien publicó el repo.** No hay ninguna
credencial incluida en este proyecto (`.env` está en `.gitignore` y nunca
se sube); cada quien que quiera correr el modo real paga su propio uso.
El costo es mínimo para este prototipo: el prompt de cada escenario es
corto y la respuesta es un objeto de 4 campos, del orden de fracciones de
centavo por corrida completa de los cuatro escenarios — el mínimo de
carga que ofrece [console.anthropic.com](https://console.anthropic.com/settings/billing)
(usualmente ~USD 5) alcanza para cientos de corridas.

```bash
cp .env.example .env
# completar ANTHROPIC_API_KEY en .env con tu propia key
npm run dev
```

Corre los mismos cuatro escenarios que el modo dry-run, pero delegando el
cálculo a Claude en cada uno (4 llamadas a la API por ejecución).

**Build de producción:**

```bash
npm run build
npm start
```

## Stack

- Node.js + TypeScript (`strict: true`)
- Zod para validación estructural
- `@anthropic-ai/sdk` como motor cognitivo
- Datos mock en memoria (sin DB, sin llamadas HTTP externas)
- `node:test` para tests unitarios (sin dependencias extra)
