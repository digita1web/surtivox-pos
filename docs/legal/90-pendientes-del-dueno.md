# 90 · Pendientes del dueño (marcadores `[[POR COMPLETAR]]`)

> **BORRADOR — requiere revisión de abogado colombiano antes de publicarse.**
> Total: **52 marcadores `[[POR COMPLETAR]]`** y **3 marcadores `[[ESCENARIO A o B]]`** en los documentos 10 a 15 (documentos 00 y 01 no los llevan). Columna **Bloquea**: sí = no se puede publicar sin ese dato.

## A. Identificación del responsable (datos que solo tú conoces)

| Dato que falta | Dónde se usa | Bloquea |
|---|---|---|
| Nombre completo o razón social | 10 §1; 11 §2 | **Sí** |
| Cédula o NIT | 10 §1; 11 §2 | **Sí** |
| Domicilio (dirección y ciudad) | 10 §1; 11 §2 | **Sí** (contenido mínimo, art. 13 Decreto 1377) |
| Teléfono de contacto | 10 §1; 11 §13 | **Sí** |
| Correo oficial de reclamos (hoy la app usa el de `LEGAL_CONTACT`; hay que confirmarlo) | 10 §1 y §5; 12 §9; 15 §1; 11 §13 | **Sí** |
| Persona o área que atiende los derechos | 10 §1; 15 §1 | **Sí** (art. 23 Decreto 1377) |
| Dónde se lleva el registro de solicitudes | 15 §1 | No |

## B. Versión y vigencia

| Dato | Dónde | Bloquea |
|---|---|---|
| Fecha de entrada en vigencia (política, términos, catálogo) | 10, 11, 12 | **Sí** |
| Número de versión; debe coincidir con `LEGAL_VERSION` | 10, 11, 12 | **Sí** |

## C. Decisiones de negocio y operación

| Decisión | Dónde | Bloquea |
|---|---|---|
| Plazo de retención de los datos en la nube | 10 §8 | **Sí** (Google exige declarar retención y eliminación) |
| Plazo de retención de votos del catálogo y del producto publicado | 12 §8; 10 §8 | No |
| Plazo de conservación de las IP de intentos fallidos (`kit_attempts`) | 10 §3.3 | No |
| Compromiso de ejecutar la supresión manual en el servidor y plazo | 10 §5; 15 §5C, §7 | **Sí** si se promete supresión |
| Exportación manual de datos del servidor | 15 §5A | No |
| Efecto de retirar un aporte sobre un nombre ya publicado | 12 §9; 15 §5D | No |
| Procedimiento ante incidentes de seguridad | 10 §7 | **Sí** (art. 17 informar violaciones a la SIC) |
| Precio único y moneda (el código tiene cuatro) | 11 §9 | Solo al activar el cobro |
| Si la primera versión publicada incluye compras | 14 §6 | Solo si hay compras |
| Qué pasa con los datos al terminar el servicio y plazo de aviso | 11 §12 | No |
| Confirmar que Surtivox no usa los datos de clientes para fines propios | 11 §7 | **Sí** |
| Confirmar con el dueño la frase "desactivar la nube no borra lo ya enviado" | 13 §4 | No |
| URL pública de la política (hoy `landing/privacidad.html`) | 14 §4 | **Sí** |
| Dónde se guarda el registro y quién lo lleva | 15 §1 | No |

## D. Datos técnicos que debes verificar en Cloudflare

| Dato | Dónde | Bloquea |
|---|---|---|
| País y región del servicio D1 | 10 §6; 12 §7 | **Sí** (transferencia internacional) |
| Que el cron del catálogo esté activo en producción | 00 §2.4; 12 §8 | No |

## E. Decisiones que toma el abogado (el dueño solo las transmite)

| Decisión | Dónde |
|---|---|
| Escenario A o B (responsable/encargado) | 10 §1; 11 §7; 15 §3 |
| Base legal de la transferencia/transmisión internacional | 10 §6 |
| Edad mínima de uso | 10 §2; 11 §4 |
| Evidencia de aceptación fuera del teléfono | 11 §1 |
| Alcance de la licencia propietaria frente a avisos de terceros | 11 §3 |
| Alcance de la limitación de responsabilidad | 11 §10 |
| Texto de retracto y devolución | 11 §9 |
| Jurisdicción y foro | 11 §14 |
| Alcance de la licencia del aporte al catálogo | 12 §11 |
| Revisión del texto sugerido para los clientes del tendero | 11 §7 |
| Familias (la app no se dirige a menores) | 14 §4 |

## F. Cómo usar esta lista
1. Llena la sección A y B: sin ella no se puede publicar nada.
2. Decide la sección C con la ayuda de [92-brechas-tecnicas-a-cerrar.md](92-brechas-tecnicas-a-cerrar.md): no prometas en la política lo que la app no hace.
3. Lleva la sección E y [91-preguntas-para-el-abogado.md](91-preguntas-para-el-abogado.md) a la reunión.
