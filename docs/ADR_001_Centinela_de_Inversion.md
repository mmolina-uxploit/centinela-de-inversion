# ADR 001: CONTROL ESTOCÁSTICO MEDIANTE VALIDACIÓN DE ESQUEMAS

> Documento de especificación original, convertido de PDF a Markdown para
> versionado en el repositorio. Contenido sin alterar respecto al PDF
> fuente.

## 1. Contexto Operativo

La delegación de decisiones financieras a modelos de lenguaje introduce
una vulnerabilidad estructural. La naturaleza probabilística de la
inteligencia artificial tiende a la generación de explicaciones
innecesarias y variaciones impredecibles en el formato de salida. Un
sistema diseñado para proteger presupuestos publicitarios no puede
depender de respuestas narrativas o de la extracción frágil de datos
mediante expresiones regulares. La infraestructura requiere variables
numéricas precisas e inmutables para interactuar con sistemas de
orquestación o bases de datos posteriores.

## 2. Decisión Arquitectónica

Se establece la implementación de una arquitectura de validación dual. A
nivel de red, se instruye a la API del motor cognitivo para que restrinja
su respuesta a un objeto JSON puro, anulando su rol como procesador de
lenguaje natural. A nivel de aplicación, se implementa TypeScript con
tipado estricto y Zod para la definición de esquemas. La respuesta de la
inteligencia artificial es interceptada en tiempo de ejecución y sometida
obligatoriamente a la función `Zod.parse()`.

## 3. Consecuencias

La adopción de este modelo transforma un generador probabilístico en un
componente lógico auditable, produciendo los siguientes efectos en la
base de código:

- Se establece un principio de fallo rápido (fail-fast). Cualquier
  desviación estocástica, alucinación o inyección de caracteres no
  previstos por parte del modelo genera una excepción inmediata. El error
  se captura y detiene la ejecución antes de corromper el flujo de
  información.
- Se garantiza la indemnidad de los sistemas dependientes. Al encapsular
  el razonamiento del modelo dentro de un contrato de datos validado
  rigurosamente por Zod, el código opera con certezas absolutas. Esto
  asegura que los comandos de detención de inversión se emitan únicamente
  bajo parámetros numéricos comprobables, protegiendo la integridad de la
  operación de negocio.
