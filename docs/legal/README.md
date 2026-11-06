# Paquete legal de Surtivox POS (Colombia)

> **BORRADOR — requiere revisión de abogado colombiano antes de publicarse.**
> **Nada de esta carpeta está listo para publicarse sin esa revisión.** No es asesoría jurídica y no garantiza cumplimiento. Elaborado el 2026-11-06 a partir del código y de fuentes consultadas ese día; lo que no se pudo abrir está marcado **NO VERIFICADO**.

## Orden de lectura

| # | Documento | Para qué sirve | Quién lo lee |
|---|---|---|---|
| 1 | [00-inventario-de-datos.md](00-inventario-de-datos.md) | Qué datos trata la app de verdad, con ruta y línea | Todos |
| 2 | [01-marco-normativo.md](01-marco-normativo.md) | Qué exige la norma (con fuentes) y la tabla obligación → brecha | Abogado |
| 3 | [92-brechas-tecnicas-a-cerrar.md](92-brechas-tecnicas-a-cerrar.md) | Qué falta construir o verificar, priorizado | Dueño |
| 4 | [91-preguntas-para-el-abogado.md](91-preguntas-para-el-abogado.md) | Preguntas concretas sin respuestas inventadas | Abogado |
| 5 | [90-pendientes-del-dueno.md](90-pendientes-del-dueno.md) | Datos que solo el dueño conoce (marcadores `[[POR COMPLETAR]]`) | Dueño |
| 6 | [10-politica-tratamiento-datos.md](10-politica-tratamiento-datos.md) | Borrador de política de tratamiento | Abogado |
| 7 | [11-terminos-y-condiciones.md](11-terminos-y-condiciones.md) | Borrador de términos de uso | Abogado |
| 8 | [12-politica-catalogo-comunitario.md](12-politica-catalogo-comunitario.md) | Aviso opt-in del catálogo, conciliado con el código | Abogado |
| 9 | [13-aviso-corto-en-la-app.md](13-aviso-corto-en-la-app.md) | Textos breves para dentro de la app y cuáles quedaron desactualizados | Dueño y abogado |
| 10 | [14-formulario-google-play.md](14-formulario-google-play.md) | Respuestas sugeridas para Google Play | Dueño |
| 11 | [15-procedimiento-derechos-del-titular.md](15-procedimiento-derechos-del-titular.md) | Cómo atender consultas, reclamos y supresión | Dueño |

## Reglas de este paquete
- **No inventa datos.** Razón social, NIT, domicilio, teléfono, correo de reclamos, fechas y plazos de retención son marcadores.
- **Tres niveles separados:** la norma (con fuente), la app (con ruta) y la interpretación (marcada).
- **No promete lo que el código no hace.** Si algo no se puede cumplir hoy, está en [92](92-brechas-tecnicas-a-cerrar.md).
- **No modifica la app.** Si se aprueban los textos, cambiar `legalText.ts` exige subir `LEGAL_VERSION`, actualizar `landing/privacidad.html` y `landing/terminos.html` y ajustar `landingLegal.test.ts`.
