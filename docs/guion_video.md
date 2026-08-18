# Guion — Video demo CoderCup AI (2:00 min)

> Formato: hablar a cámara o en voiceover mientras se muestra pantalla.
> Tiempos son orientativos — grabá cada bloque, cronometrá, y ajustá el
> ritmo de lectura antes de la toma final. Mejor un poco más rápido que
> pasarte de los 2 minutos.

---

## Bloque 1 — El problema (0:00 – 0:35)

**Qué mostrás:** cara a cámara, o una slide/imagen simple del problema
(opcional: captura de un panel de Meta Ads con una campaña activa).

**Qué decís** (guion, ~90 palabras):

> "Cuando manejás pauta publicitaria de e-commerce, hay un error que
> quema plata en silencio: la campaña sigue mandando clics a un
> producto que ya no tiene stock. Nadie se entera hasta que revisan el
> reporte del mes y ven que gastaron cientos de dólares en tráfico que
> no pudo comprar nada.
>
> Construí Centinela de Inversión: un sistema que cruza en tiempo real
> la velocidad de tu campaña con el stock disponible, y te avisa
> *antes* de que el producto se agote — no después."

---

## Bloque 2 — Cómo lo hice (0:35 – 1:20)

**Qué mostrás:** pantalla con el código — foco rápido en `engine.ts` y
`schema.ts`, o el diagrama del pipeline del README.

**Qué decís** (guion, ~110 palabras):

> "Lo interesante acá no es solo usar un LLM para calcular — es cómo lo
> contuve. Le pido a Claude que calcule la tasa de agotamiento, pero lo
> obligo a responder en un formato exacto usando *tool use forzado*, no
> texto libre.
>
> Y no confío ciegamente en eso: todo lo que devuelve el modelo pasa
> obligatoriamente por un validador de Zod antes de tocar cualquier
> variable del sistema. Si el modelo se desvía del formato esperado —
> aunque sea un poco — el sistema corta la ejecución al toque, en vez
> de arriesgarse a actuar sobre un dato corrupto.
>
> Es TypeScript estricto, cero base de datos, y toda la arquitectura
> quedó documentada en ADRs dentro del repo — la decisión, y el porqué
> de cada decisión."

---

## Bloque 3 — Cómo se usa (1:20 – 1:55)

**Qué mostrás:** terminal en vivo. Este es el momento clave — grabalo
en pantalla completa, texto grande.

**Qué decís mientras tipeás** (guion, ~70 palabras):

> "Se corre así de simple: cloná el repo, `npm install`, y
> `npm run dev:dry` — así, sin necesitar ninguna clave de API."

**[EJECUTÁ EN VIVO]:**

```bash
npm run dev:dry
```

*(Dejá que se vea el Escenario 1 completo en pantalla: la alerta
crítica con el emoji 🚨, las horas hasta quiebre, la recomendación de
frenar la pauta. Es el momento más visual del video — no lo cortes.)*

> "Ahí tenés: stock bajo, tráfico alto, el sistema calcula que en 2
> horas se agota, y te dice que frenés la campaña. Automático."

---

## Cierre (1:55 – 2:00)

**Qué decís** (guion, ~20 palabras):

> "Todo el código, los tests, y la documentación están en el repo.
> Gracias, CoderCup."

**Qué mostrás:** el link del repo en pantalla (texto grande, quieto
unos segundos para que se pueda leer o hacer captura):

```
github.com/mmolina-uxploit/centinela-de-inversion
```

---

## Checklist antes de grabar la toma final

- [ ] Practicá el Bloque 3 (comando en vivo) al menos una vez antes de
      grabar — confirmá que `npm run dev:dry` corre limpio en tu
      máquina en ese momento (`cd` a la carpeta correcta primero).
- [ ] Cronometrá una lectura completa en voz alta — si te pasás de
      2:00, cortá del Bloque 2 (es el más denso), no del Bloque 3 (es
      el que prueba que el proyecto funciona).
- [ ] Encuadre de terminal: aumentá el tamaño de fuente antes de
      grabar — lo que se lee cómodo en tu pantalla puede ser
      ilegible en un video de celular.
- [ ] Grabá el Bloque 3 por separado si te resulta más cómodo, y
      editalo después — no hace falta una sola toma continua.

## Nota sobre honestidad de contenido

Este guion dice "cruza en tiempo real la velocidad de tu campaña con
el stock" en términos generales del *diseño* del sistema — es preciso
sobre qué hace la arquitectura. No afirma en ningún punto que corrió
contra una cuenta real de Shopify o Meta Ads: los datos que se ven en
pantalla durante el Bloque 3 son mocks declarados como tales en el
propio repo (ver [`docs/informe_tecnico.md`](informe_tecnico.md),
Sección 1.3). Si en la grabación te preguntan o querés aclararlo vos
mismo, una frase como *"corrido acá con datos de ejemplo, pero la
misma lógica aplica con datos reales de Shopify y Meta Ads"* mantiene
el video alineado con lo que el proyecto realmente demuestra.
