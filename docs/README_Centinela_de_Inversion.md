# README: CENTINELA DE INVERSIÓN

> Documento de especificación original, convertido de PDF a Markdown para
> versionado en el repositorio. Contenido sin alterar respecto al PDF
> fuente.

## Naturaleza del Sistema

El Centinela de Inversión es una infraestructura de defensa financiera. El
comercio electrónico destruye liquidez al financiar pauta publicitaria
dirigida a productos sin inventario. Este microservicio elimina dicha
fricción operativa cruzando, en tiempo real, la velocidad de tráfico
entrante con la profundidad de stock disponible. El resultado es la
detección temprana del agotamiento logístico y la emisión de una alerta
crítica para detener el gasto publicitario.

## Especificación Tecnológica

Para garantizar un entorno de ejecución determinista y eliminar la
variabilidad inherente a los modelos de lenguaje, el desarrollo se
restringe al siguiente stack tecnológico:

- **Entorno de Ejecución:** Node.js.
- **Lenguaje:** TypeScript (bajo configuración `strict: true` para anular
  tipos implícitos y asegurar contratos de datos).
- **Validación Estructural:** Zod.
- **Motor Cognitivo:** SDK oficial de OpenAI o Anthropic.
- **Orígenes de Datos:** Archivos JSON estáticos en memoria (Mock Data)
  que emulan las estructuras de respuesta de Shopify API y Meta Ads API.

## Arquitectura de Ejecución para Agentes (Claude Code)

El código base debe estructurarse como una tubería de datos lineal. La
construcción del prototipo exige el desarrollo de tres fases operativas
inquebrantables.

Primero, la inyección de dependencias estáticas. El sistema debe
instanciar dos objetos JSON en el código; el primero representando el
volumen de inventario actual del producto y el segundo reflejando la
velocidad de clics y el capital consumido por hora en la campaña de
adquisición.

Segundo, el procesamiento algorítmico. El motor cognitivo recibe la
instrucción estricta de calcular la tasa de agotamiento (Burn Rate)
cruzando ambas variables de entrada. Esta interacción se ejecuta forzando
una salida estructurada a nivel de red (`response_format: { type:
"json_object" }`), prohibiendo cualquier generación de texto
conversacional.

Tercero, la validación de integridad. Antes de que el sistema asigne el
resultado a una variable operativa, la respuesta de la inteligencia
artificial debe ser parseada mediante un esquema predefinido de Zod. Si el
objeto carece del formato matemático exacto exigido, el proceso se
interrumpe mediante un error fatal. Si la validación es exitosa y el
tiempo proyectado es crítico, el sistema formatea e imprime la alerta
definitiva en la consola.
