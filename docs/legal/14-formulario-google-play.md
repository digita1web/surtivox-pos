# Formulario de seguridad de datos y privacidad de Google Play

> **BORRADOR — requiere revisión de abogado colombiano antes de publicarse.**
> Respuestas sugeridas, coherentes con [00-inventario-de-datos.md](00-inventario-de-datos.md). **Nada se ha enviado a Google.** Las respuestas definitivas las decide el dueño; una respuesta falsa o incoherente con la política de privacidad puede causar el rechazo o la retirada de la app.

## Fuentes y qué está verificado

| Tema | Fuente abierta el 2026-11-06 |
|---|---|
| Qué debe declararse, qué es "recopilar" y "compartir", cifrado y eliminación | https://support.google.com/googleplay/android-developer/answer/10787469 |
| Política de privacidad, divulgación destacada y consentimiento | https://support.google.com/googleplay/android-developer/answer/10144311 |
| Eliminación de cuenta y datos | https://support.google.com/googleplay/android-developer/answer/13327111 |

La lista exacta de tipos de datos y el texto literal de cada pregunta **no los abrí** (solo dos preguntas aparecen citadas en la fuente: "Is this data processed ephemerally?" y "Is this data collected, shared, or both?"). Los nombres de categorías que uso abajo son los habituales del formulario y están **NO VERIFICADOS** contra Play Console: hay que cotejarlos al llenar el formulario.

## 1. Reglas de la fuente que condicionan las respuestas
- "Recopilar" = transmitir datos fuera del dispositivo, incluidos los datos seudónimos. No hace falta declarar el procesamiento solo en el dispositivo.
- **No es "compartir"** transferir a un proveedor de servicios que procesa los datos por encargo del desarrollador (Cloudflare para el respaldo) ni una acción iniciada por el usuario. *Interpretación:* el envío a Cloudflare cae en "proveedor de servicios".
- Un dato es obligatorio si la función principal lo necesita; si alguna versión lo exige, no se declara opcional.
- El formulario pregunta si **todos** los datos recopilados se cifran en tránsito y si se ofrece **una forma de pedir su eliminación** (puede marcarse si se eliminan o anonimizan automáticamente en un plazo de 90 días).
- La política de privacidad debe estar enlazada en Play Console y dentro de la app, ser una URL pública que no sea PDF, e incluir contacto, tipos de datos, con quién se comparten, seguridad, y **retención y eliminación**.

## 2. Respuestas sugeridas por tipo de dato

**Alcance:** la app es de uso sin conexión; "recopilar" ocurre **solo** cuando el usuario activa el respaldo en la nube o el catálogo, y en las consultas de red (sección 3).

| Tipo de dato (categoría de Play, NO VERIFICADA) | ¿Se recopila? | ¿Se comparte? | Obligatorio u opcional | Finalidad sugerida | Evidencia en el código |
|---|---|---|---|---|---|
| Información personal: nombre | Sí, **solo con la nube activa** (nombre de clientes, proveedores, personal y tienda) | No (proveedor de servicios) | **Opcional** | Funcionalidad de la app | [sync.ts:35-52](../../packages/database/src/sync.ts#L35-L52) |
| Información personal: correo electrónico | Sí, solo con la nube (clientes, proveedores, tienda) | No | Opcional | Funcionalidad | idem |
| Información personal: número de teléfono | Sí, solo con la nube | No | Opcional | Funcionalidad | idem |
| Información personal: dirección | Sí, solo con la nube | No | Opcional | Funcionalidad | idem |
| Información financiera: otra (ventas, pagos, fiados, deudas de clientes) | Sí, solo con la nube | No | Opcional | Funcionalidad | `sales`, `payments`, `customer_ledger` |
| Identificadores de dispositivo u otros | Sí, **solo con el catálogo aceptado**: identificador aleatorio de instalación (se guarda como huella) | No | Opcional | Funcionalidad | [catalog.ts:34](../../apps/mobile/src/catalog.ts#L34) |
| Fotos y vídeos | **No** (las fotos se quedan en el teléfono) | — | — | — | [sync.ts:54](../../packages/database/src/sync.ts#L54) |
| Ubicación | **No** | — | — | — | Manifest sin permisos de ubicación |
| Contactos, micrófono, audio | **No** | — | — | — | Manifest |
| Actividad en la app (códigos de barras consultados) | Sí: el código se envía a Surtivox y a Open Food Facts al consultar un producto, junto con la IP del teléfono | **Sí con Open Food Facts** si se considera un tercero que no procesa por nuestro encargo (*Interpretación*, decidir) | Opcional (la consulta ocurre al escanear un código desconocido) | Funcionalidad | [lookup.ts:45](../../apps/mobile/src/pos/lookup.ts#L45) |
| Información y rendimiento de la app: registros de fallos y diagnóstico | **No** se envían fuera del teléfono | — | — | — | [diagnostics.ts](../../apps/mobile/src/diagnostics.ts) |

**Dirección IP:** los servidores la reciben en cada conexión; además la tabla `kit_attempts` guarda la IP de los intentos fallidos. Si Play Console tiene una categoría para ello (**NO VERIFICADO**), declararla como recopilada, opcional (solo con la nube) y para seguridad/prevención de fraude.

## 3. Consultas de red sin consentimiento de nube
Aun sin activar nada: actualizaciones (Expo), código de barras (Open Food Facts y catálogo de Surtivox) y precios (EAN a Surtivox). Se declara en la política de privacidad. Decidir con el abogado si requieren una divulgación destacada previa (la política de Datos de usuario pide divulgación dentro de la app cuando el uso de datos puede no ser esperado; *Interpretación*: consultar un código que el propio usuario escanea es esperado, pero queda para el abogado).

## 4. Preguntas generales del formulario

| Pregunta | Respuesta sugerida | Condición |
|---|---|---|
| ¿Todos los datos recopilados se cifran en tránsito? | **Sí** (HTTPS) | Solo si se confirma que **todas** las URL son HTTPS: `DEFAULT_SYNC_URL`, `CATALOG_URL`, `MARKET_PRICES_URL`, `u.expo.dev`, `world.openfoodfacts.org` lo son |
| ¿Ofreces una forma de pedir la eliminación de los datos? | **Depende.** Hoy solo por correo y manual; no hay herramienta. **BRECHA.** | Si el dueño se compromete a atender la supresión manual, puede marcarse "sí" con la URL de [15-procedimiento-derechos-del-titular.md](15-procedimiento-derechos-del-titular.md) publicada; si no, no marcar |
| Enlace a la política de privacidad | `[[POR COMPLETAR: URL pública de la política; hoy landing/privacidad.html en GitHub Pages]]` | Debe ser una página, no PDF, y mencionar el nombre de la app o de la entidad de la ficha |
| ¿Cumples las políticas de familias? | `[[POR COMPLETAR]]` (la app no se dirige a menores) | — |

## 5. Eliminación de cuenta
La política de Google se aplica a apps que permiten crear cuenta; **las cuentas creadas y usadas sin conexión no cuentan** (fuente 13327111). Surtivox no tiene registro con correo ni contraseña. Con la nube activa, el servidor crea una "tienda" asociada a una llave. *Interpretación:* podría considerarse una cuenta de la app; si así fuera, haría falta una vía dentro de la app y un **enlace web** de eliminación, y hoy no existen. Decisión del abogado (pregunta 12) y brecha B1 en [92-brechas-tecnicas-a-cerrar.md](92-brechas-tecnicas-a-cerrar.md).

## 6. Compras
`expo-iap` con el SKU `cloud_sync_monthly`. En Play Console, la declaración de políticas de pago y suscripciones es aparte; hoy no se cobra. `[[POR COMPLETAR: confirmar si la primera versión publicada incluirá compras en la app]]`

## 7. Lo que NO VERIFICADO
Texto literal del formulario vigente, lista exacta de categorías, si existe una categoría para direcciones IP, requisitos de la declaración de permisos, y la política de familias.
