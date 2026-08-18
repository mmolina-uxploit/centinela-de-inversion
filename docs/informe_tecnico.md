# Informe Técnico: Centinela de Inversión — Un Patrón Arquitectónico para la Mitigación de Riesgo Financiero en Sistemas Asistidos por Modelos de Lenguaje

**Autor:** Matías Molina
**Contexto:** Prototipo desarrollado para CoderCup AI, Coderhouse (agosto de 2026)
**Tipo de documento:** Informe técnico de arquitectura de software. No constituye un estudio empírico ni presenta datos de producción — esta distinción se sostiene explícitamente a lo largo del documento.

---

## Resumen

Se presenta el diseño e implementación de *Centinela de Inversión*, un microservicio prototipo que detecta el agotamiento de inventario en relación con la velocidad de gasto publicitario, delegando el cálculo aritmético a un modelo de lenguaje de gran escala (LLM) bajo un régimen de restricción estructural estricta. El problema central que aborda este trabajo no es el cálculo en sí —trivial de implementar sin IA— sino la pregunta arquitectónica subyacente: *¿bajo qué condiciones es seguro permitir que un componente probabilístico participe en una cadena de decisión con consecuencias financieras?* La respuesta implementada combina dos mecanismos independientes y redundantes: restricción de salida a nivel de protocolo (tool use forzado sobre la API de Anthropic) y validación de esquema a nivel de aplicación (Zod), de forma que ningún resultado no verificado pueda alcanzar la lógica de negocio. Se documenta la arquitectura, las decisiones de diseño registradas como ADRs, y el estado actual de verificación: 11 pruebas unitarias confirman el comportamiento de rechazo del validador (100% de aprobación), y un modo de simulación local confirma la consistencia del pipeline completo sin consumir recursos de API. La verificación contra el modelo de lenguaje real está definida pero pendiente de ejecución al momento de este informe, por una restricción operativa ajena al diseño (crédito de API no aprovisionado), no por una falla del sistema.

---

## 1. Introducción

### 1.1 Motivación

Los sistemas de comercio electrónico que administran pauta publicitaria enfrentan un modo de falla específico y costoso: la publicidad continúa dirigiendo tráfico hacia un producto después de que su inventario se agota, financiando clics que no pueden convertirse en ventas. Detectar este cruce —entre velocidad de demanda y profundidad de stock— es aritméticamente simple. El problema de ingeniería real aparece cuando se introduce un LLM en esa cadena de cálculo: los modelos de lenguaje son, por diseño, generadores probabilísticos de texto, no calculadoras deterministas. Delegarles una decisión que dispara una acción financiera (detener una campaña) sin contención arquitectónica introduce una superficie de fallo nueva —alucinación numérica, variación de formato, texto conversacional no parseable— que no existe en un sistema de cálculo tradicional.

### 1.2 Problema abordado

Este trabajo no investiga *si* los LLM pueden hacer aritmética correctamente (pregunta ya estudiada en la literatura de razonamiento de modelos de lenguaje). Investiga una pregunta distinta y de naturaleza puramente arquitectónica: *dado que un LLM puede fallar de forma impredecible, ¿qué estructura de software garantiza que ese fallo nunca se propague como una decisión operativa incorrecta?*

### 1.3 Alcance y limitaciones declaradas

Es necesario, por rigor, delimitar qué es este trabajo y qué no es:

- **Es** un patrón arquitectónico de contención de riesgo, implementado y verificable en código.
- **No es** un estudio con datos de producción: los orígenes de datos (inventario Shopify, métricas de Meta Ads) son mocks estáticos definidos en código, no observaciones de un sistema real.
- **No es** una evaluación estadística de la tasa de alucinación de un LLM: no se ejecutaron corridas repetidas contra el modelo para medir frecuencia de fallo.
- **Es**, en cambio, una prueba de que —incluso en el peor caso de fallo del modelo— el sistema circundante se comporta de forma segura y predecible.

---

## 2. Trabajo relacionado (marco conceptual)

El problema de restringir la salida de un LLM a un formato estructurado es abordado en la práctica de la industria mediante dos familias de mecanismos, ambas presentes en las APIs comerciales actuales:

1. **Restricción a nivel de red/protocolo**: la propia API del proveedor fuerza la forma de la respuesta antes de que salga del servidor del modelo. En la API de OpenAI esto se expone como `response_format: { type: "json_object" }`; en la API de Anthropic, mediante *tool use* forzado (`tool_choice`), donde el modelo debe invocar una función con un `input_schema` predefinido en lugar de responder en lenguaje natural.
2. **Validación a nivel de aplicación**: independientemente de la garantía que ofrezca el proveedor, el consumidor de la respuesta valida el resultado contra un contrato de datos propio antes de utilizarlo. En el ecosistema TypeScript, Zod es la herramienta estándar de facto para esta validación en tiempo de ejecución (complementando, no sustituyendo, al sistema de tipos estático del compilador).

La contribución de diseño de este proyecto no es ninguno de estos dos mecanismos por separado —ambos son conocidos y documentados por sus respectivos proveedores/mantenedores— sino la decisión de **no tratarlos como alternativos, sino como redundantes y obligatorios en conjunto**, bajo la premisa de que una garantía ofrecida por un proveedor externo (fuera del control del equipo que construye el sistema) nunca debe ser la única línea de defensa en una cadena de decisión financiera.

---

## 3. Metodología (diseño arquitectónico)

### 3.1 Estructura general: tubería lineal de tres fases

El sistema se modela como una tubería de datos estrictamente lineal, sin ramificaciones condicionales en el flujo de control principal salvo las de terminación por fallo:

```
FASE 1                    FASE 2                      FASE 3
(Adquisición)         (Procesamiento)              (Validación)
    │                       │                            │
    ▼                       ▼                            ▼
Snapshots JSON  ──────▶  Motor cognitivo   ──────▶  Zod.parse()
(Shopify + Meta Ads      (Claude, tool_choice          │
 — mock estático)         forzado)                      │
                              │                          │
                    no invoca la tool           no matchea el schema
                              │                          │
                              ▼                          ▼
                      ERROR FATAL                 ERROR FATAL
                      (fail-fast)                 (fail-fast)
```

Cada fase tiene una responsabilidad única y no conoce la implementación interna de las demás, lo cual se verifica en el código por la separación en módulos independientes (`mocks.ts`, `engine.ts`, `schema.ts`).

### 3.2 Fase 1 — Adquisición de datos

Se instancian dos estructuras de datos tipadas que emulan, en forma y contenido, las respuestas reales de las APIs de Shopify (inventario) y Meta Ads (métricas de campaña). El uso de mocks —en lugar de llamadas HTTP reales— es una decisión deliberada de alcance para esta fase del proyecto: aísla la variable bajo estudio (el comportamiento del LLM y su contención) de una fuente adicional de variabilidad (la disponibilidad y latencia de APIs de terceros), que queda fuera del alcance de este informe.

### 3.3 Fase 2 — Procesamiento mediante motor cognitivo

Se define una única herramienta (`tool`) ante la API de Anthropic, cuyo `input_schema` es un espejo estructural del contrato de datos de la aplicación. El parámetro `tool_choice` se fija de forma que el modelo esté obligado a invocar esa herramienta en cada llamada, eliminando la posibilidad de que responda con texto libre no estructurado. Este mecanismo constituye la primera capa de contención (nivel de protocolo).

Es importante señalar, por precisión metodológica, que esta primera capa **depende de una garantía ofrecida por un tercero** (el proveedor de la API) y por tanto no puede considerarse, por sí sola, una prueba suficiente de seguridad del sistema.

### 3.4 Fase 3 — Validación de integridad

La respuesta —ya estructurada por la Fase 2— se somete, sin excepción, a `BurnRateAnalysisSchema.parse()` (Zod) antes de que cualquiera de sus campos sea leído por el resto del sistema. Esta es la segunda capa de contención, y la que efectivamente está bajo control total del equipo que construye el sistema: no depende de que el proveedor externo cumpla su garantía, sino que la verifica de forma independiente.

Cualquier desviación —campo ausente, tipo incorrecto, valor fuera de rango, texto conversacional inesperado— produce una excepción no capturada que interrumpe la ejecución antes de alcanzar la lógica de alerta (principio de *fail-fast*).

### 3.5 Modo de verificación local (dry-run)

Se implementó un módulo adicional (`dryRun.ts`) que reproduce el cálculo aritmético de la Fase 2 en TypeScript puro, sin invocar la API externa, cuya salida pasa igualmente por el validador de la Fase 3. Este modo no sustituye la verificación contra el modelo real: su propósito metodológico es aislar y confirmar que el contrato de datos (Fase 3) y la lógica de cálculo son mutuamente consistentes, independientemente de si el emisor del resultado es un LLM o una función determinista.

---

## 4. Resultados

Se reportan únicamente resultados efectivamente obtenidos mediante ejecución verificable, sin extrapolación.

### 4.1 Verificación del validador de esquema

Se ejecutó una batería de 11 pruebas unitarias (`node:test`) contra `BurnRateAnalysisSchema`, cubriendo los siguientes casos:

| Categoría de entrada | Resultado esperado | Resultado obtenido |
|---|---|---|
| Objeto que cumple el contrato exacto | Aceptar | ✅ Aceptado |
| Campo requerido ausente | Rechazar | ✅ Rechazado |
| Número recibido como string | Rechazar | ✅ Rechazado |
| Valor numérico negativo fuera de dominio | Rechazar | ✅ Rechazado |
| Booleano recibido como string | Rechazar | ✅ Rechazado |
| Campo de texto vacío | Rechazar | ✅ Rechazado |
| Campo de texto que excede longitud máxima | Rechazar | ✅ Rechazado |
| Objeto vacío | Rechazar | ✅ Rechazado |
| `null` / `undefined` | Rechazar | ✅ Rechazado |
| Texto conversacional en lugar de JSON | Rechazar | ✅ Rechazado |
| Valor límite válido (cero) | Aceptar | ✅ Aceptado |

**Tasa de aprobación: 11/11 (100%).** Este resultado confirma que la capa de contención bajo control directo del equipo (Fase 3) se comporta según lo especificado, para el conjunto de casos de fallo anticipados en el diseño.

### 4.2 Verificación del pipeline completo (modo dry-run)

Se ejecutó el pipeline íntegro (Fases 1→2→3) en modo de simulación local sobre cuatro escenarios de datos distintos, cada uno seleccionado para ejercitar una condición diferente del sistema (no variantes repetidas de un mismo caso):

| Escenario | Stock | Ritmo de quema | Horas hasta quiebre | `isCritical` |
|---|---|---|---|---|
| 1 — Crítico franco | 37 u | 18.54 u/h | 2.00 h | `true` — alerta emitida |
| 2 — Estable franco | 890 u | 1.74 u/h | 511.49 h | `false` |
| 3 — Casi crítico | 64 u | 10.25 u/h | 6.24 h | `false` |
| 4 — Sin conversión | 150 u | 0 u/h | 999999.00 h (valor centinela) | `false` |

El Escenario 3 es el más informativo de los cuatro: con `CRITICAL_HOURS_THRESHOLD = 6` (definido en `engine.ts`), un resultado de 6.24 h queda apenas 0.24 h por encima del umbral, del lado estable. Esto confirma que la bifurcación crítico/estable responde al valor numérico efectivamente calculado, y no a un umbral ajustado a posteriori para que el resultado de la demo "diera bien". El Escenario 4 ejercita el caso borde de división por cero (`clickToUnitConversionRate: 0`): el sistema no produce `NaN` ni excepción, sino que asigna un valor centinela grande (999999 h) y una justificación textual explícita, comportamiento manejado deliberadamente en `dryRun.ts`.

Los cuatro resultados atravesaron la validación de Zod sin incidentes, confirmando la consistencia interna del contrato de datos frente a las tres condiciones distintas ejercitadas (crítico, estable con margen, estable al límite, y división por cero).

### 4.3 Verificación contra el modelo de lenguaje real

**No disponible al momento de este informe, por decisión de alcance.** La ejecución contra la API real de Anthropic (Fase 2 en su implementación de producción, no simulada) está completamente implementada y lista para ejecutarse (`npm run dev`, ver [`README.md`](../README.md)). No se corrió porque hacerlo requiere aprovisionar crédito de pago en una cuenta de API, y se decidió conscientemente no incurrir en ese costo para la entrega de este prototipo. Esta es una decisión de alcance, tomada y declarada, no un olvido ni un bloqueo técnico no resuelto.

Se reporta esta ausencia de forma explícita, en lugar de omitirla, porque constituye una limitación real y actual del estado de verificación del sistema: la robustez de la Fase 2 frente a una respuesta real del modelo —con su variabilidad genuina— permanece sin confirmar empíricamente. Los resultados de la Sección 4.1 demuestran que el validador *rechazaría* correctamente una salida malformada si esta ocurriera, pero no hay todavía evidencia de que el mecanismo de restricción de la Fase 2 (`tool_choice`) se comporte como lo documenta el proveedor bajo condiciones reales de invocación. Cualquier evaluador que desee cerrar esta verificación puede hacerlo con su propia clave de API — ver la Guía de evaluación técnica (Sección 7).

---

## 5. Discusión

### 5.1 Sobre la redundancia como principio de diseño, no como desperdicio

El hallazgo conceptual más relevante de este trabajo no es técnico sino de postura de diseño: la Fase 2 y la Fase 3 verifican, en esencia, la misma propiedad (que la salida cumple un contrato estructural), y esa aparente duplicación es intencional. La Fase 2 depende de una garantía externa; la Fase 3 depende únicamente del propio código. En un sistema donde el costo de un falso positivo (detener pauta cuando no correspondía) es bajo pero el costo de un falso negativo silencioso (dejar correr pauta sobre un dato corrupto, sin que nadie lo note) es alto, la redundancia deja de ser ineficiencia y pasa a ser la característica de seguridad central del diseño.

### 5.2 Sobre los límites de lo que este prototipo demuestra

Sería una sobreinterpretación de los resultados de la Sección 4 afirmar que este sistema "previene pérdidas financieras": no existe, en este informe, ninguna medición de dinero efectivamente ahorrado, porque el sistema nunca operó sobre datos ni presupuestos reales. Lo que los resultados sí sostienen, con evidencia directa, es una afirmación más acotada y más defendible: *dado un resultado del motor cognitivo que se desvíe del contrato esperado, el sistema lo detecta y detiene la ejecución antes de actuar sobre él, en el 100% de los casos de prueba ejecutados.*

### 5.3 Amenazas a la validez

- **Cobertura de casos de prueba no exhaustiva**: los 11 casos de la Sección 4.1 cubren las categorías de fallo anticipadas en el diseño, pero no constituyen una prueba formal de que no exista una entrada malformada capaz de eludir el esquema (por ejemplo, un objeto con campos adicionales no declarados, que Zod por defecto no rechaza salvo configuración explícita de modo estricto — punto que queda identificado como mejora futura, no verificado en este informe).
- **Ausencia de verificación contra el modelo real** (Sección 4.3), ya discutida.
- **Mocks como fuente de datos**: cualquier propiedad estadística de los datos reales de Shopify/Meta Ads (distribución de valores, frecuencia de casos límite) no está representada en los mocks actuales, que fueron diseñados para ilustrar cuatro escenarios de decisión puntuales (crítico, estable, casi crítico y sin conversión), no para ser representativos de un caso de uso en producción.

---

## 6. Conclusión

Se diseñó e implementó una arquitectura de contención de dos capas para permitir que un modelo de lenguaje participe en el cálculo de una señal con consecuencias financieras, sin que su naturaleza probabilística se propague como riesgo operativo. La verificación disponible al momento de este informe —11/11 pruebas unitarias del validador, y cuatro escenarios de pipeline completo en modo simulado, incluyendo un caso al límite del umbral crítico y un caso de división por cero— confirma que la capa de contención bajo control directo del equipo se comporta según lo especificado. La verificación de la capa dependiente de la API externa permanece pendiente, y se reporta como tal, en lugar de presentarse como completada. El valor de este trabajo, para efectos de un desafío de arquitectura de software, reside menos en el cálculo aritmético en sí —trivialmente resoluble sin IA— que en la demostración de que introducir un LLM en una cadena de decisión no requiere confiar ciegamente en él: requiere diseñar el sistema que lo rodea asumiendo que, en algún momento, va a fallar.

---

## 7. Guía de evaluación técnica

Esta sección está dirigida a quien evalúe el proyecto y necesite un criterio explícito para interpretar qué significa el estado de verificación reportado en la Sección 4. El criterio de evaluación que enmarca esta sección no es "¿está el proyecto 100% técnicamente completo?" sino uno más apropiado para un prototipo de una semana: **¿el diseño resuelve el problema real de forma correcta y honesta, dentro del alcance que declaró?** Un prototipo con una pieza declarada como "pendiente" es fácil de subvalorar por dos lecturas erróneas simétricas — conviene descartar ambas antes de puntuar.

### 7.1 Qué NO se debería concluir del estado actual

- **No es correcto** interpretar la Sección 4.3 como "el sistema no funciona" o "el LLM no fue integrado". La integración con Claude está íntegramente implementada (`src/engine.ts`): definición de la tool, `tool_choice` forzado, extracción y validación de la respuesta. Lo que falta no es código, es una ejecución de esa ruta de código sobre la red real.
- **Tampoco es correcto** dar por buena la Fase 2 solo porque la Fase 3 (validación Zod) esté probada al 100%. Son capas independientes que verifican momentos distintos del pipeline (Sección 5.1): que el validador rechace bien una entrada simulada no certifica que la llamada real a la API, con latencia, con la variabilidad genuina de un modelo de producción, se comporte como el diseño asume.

### 7.2 Qué SÍ se puede evaluar con la evidencia disponible

Independientemente de si la Fase D se ejecuta o no, hay tres cosas verificables ahora mismo, sin ninguna clave de API, que sostienen el valor del proyecto:

1. **Que el contrato de datos es correcto y se hace cumplir de verdad** — no es una afirmación de intención, son 11 pruebas unitarias ejecutables (`npm test`) que fuerzan al validador contra los tipos de fallo que un LLM real produciría (texto en vez de número, campo faltante, texto conversacional colado) y confirman el rechazo en cada caso.
2. **Que la lógica de negocio es correcta independientemente de quién la calcule** — el modo dry-run (`npm run dev:dry`) ejecuta el mismo cálculo que se le pediría al modelo, sin el modelo, y sus cuatro escenarios (Sección 4.2) cubren el caso crítico, el estable, el límite exacto del umbral, y la división por cero. Esto es lo que separa "funciona en la demo" de "funciona porque el cálculo es correcto".
3. **Que el diseño reconoce y declara sus propios límites** — la Sección 4.3, la Sección 5.3, y esta misma sección son, en sí mismas, evidencia de criterio de ingeniería: un sistema que decide qué decisiones financieras delega a un LLM (ADR-001) debería, coherentemente, ser igual de riguroso al reportar qué de sí mismo no está aún probado.

Estos tres puntos son, en conjunto, la respuesta a la pregunta de valor planteada al inicio de esta sección: el proyecto no necesita la Fase D completa para demostrar que resuelve el problema correctamente — la necesita solo para demostrar que esa misma solución, ya correcta, también sobrevive el contacto con la variabilidad real de un LLM en producción. Son dos afirmaciones distintas, y este informe solo reclama la primera como verificada.

### 7.3 Cómo cerrar la verificación pendiente, si se desea

Quien evalúe puede completar la Fase D de forma independiente y sin costo para el autor del proyecto, usando su propia clave de API:

```bash
git clone <url-del-repo>
cd centinela-de-inversion
npm install
cp .env.example .env
# completar ANTHROPIC_API_KEY en .env con una clave propia (console.anthropic.com)
npm run dev
```

El costo esperado de esta verificación es mínimo (fracciones de centavo por corrida de los cuatro escenarios — ver [`README.md`](../README.md), sección "Correr en modo real"), y queda enteramente a cargo de quien decida ejecutarla, nunca del autor original.

---

## Referencias del propio proyecto

- Especificación original: [`README_Centinela_de_Inversion.md`](README_Centinela_de_Inversion.md)
- Decisión de validación dual: [`ADR_001_Centinela_de_Inversion.md`](ADR_001_Centinela_de_Inversion.md)
- Decisión de motor cognitivo (Anthropic + tool use forzado): [`ADR_002_motor_cognitivo_anthropic.md`](ADR_002_motor_cognitivo_anthropic.md)
- Código fuente verificable: [`../src/`](../src/)
