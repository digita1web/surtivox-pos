# Deuda técnica

Estado: **v1.1.4, pruebas con tiendas piloto** (`versionCode` 10, [app.json](apps/mobile/app.json)). No es un lanzamiento comercial. Este archivo es la lista de pendientes. Cada punto indica si fue **verificado** en el código o es una **hipótesis**. Última revisión: 2026-11-13 (19:24, UTC-5).

## Decisiones tomadas para la beta

- El respaldo en la nube es **gratis y está abierto a todos los propietarios** de tienda. La tarjeta de precio y el botón "Suscribirme" se ocultaron en [cloud-sync.tsx](apps/mobile/app/cloud-sync.tsx).
- El Worker de sync **no consulta `entitlements`**: no hay forma de limitar el uso por tienda.
- La app usa `DEFAULT_SYNC_URL` = `https://surtivox-sync.surtivox.workers.dev` ([sync.ts](apps/mobile/src/sync.ts)).
- Los avisos de la pantalla de nube dicen que es una versión de pruebas y que puede cambiar.

## Revisión del 2026-11-13

Hecha entre las 18:51 y las 19:24 (UTC-5). Cada punto dice si fue **verificado** (comando o prueba ejecutada) o es una **inferencia**.

### Cerrado hoy (commits locales y subidos a `main`)

- **Cursores de sync tras restaurar un respaldo** (`6ad3303`). `restoreFullBackup` ahora reinicia `last_pushed_at`, `last_pulled_at` y `last_synced_at` en la misma transacción ([restoreOps.ts](apps/mobile/src/restoreOps.ts)). Conserva `server_url` y `token`. Probado con SQLite real. **No se pudo probar en dispositivo contra la nube** (no se activó la nube).
- **Salida del modo desarrollador** (`f46ab3b`). Tocar la versión en Más con el modo activo pide confirmar y lo desactiva ([developerMode.ts](apps/mobile/src/developerMode.ts)).
- **CI** (`0d02877`). [ci.yml](.github/workflows/ci.yml) ejecuta `verify.sh`, `pnpm -r typecheck` y `pnpm test` en Node 22. Antes `apps/mobile` no tenía script `test` y los 460 tests móviles no corrían en los PR. **Verificado en Actions** (CI verde en `2cb7c73` y `e995351`).
- **Estado de la nube** (`4dc5d22`, `250409a`). Inicio, Más y Respaldo en la nube leen `sync_state` mediante [useCloudConnected.ts](apps/mobile/src/useCloudConnected.ts). La tarjeta de Más dice "Activado, pero aún no se ha sincronizado" hasta que haya una sincronización real.
- **Escáner de un código** (`c8acfaa`). [ScanModal.tsx](apps/mobile/src/pos/ScanModal.tsx) usa `ScannerCamera` y su máquina de estados; un test impide que otro archivo use `CameraView` directamente. **Verificado en teléfono** (ver abajo).
- **Pie de Más** (`3adae39`). Muestra la versión de `app.json` (`v1.1.4`). **Verificado en teléfono.**
- **Specs y documentación** (`f6ef2a9`, `52775ce`). Existen [ui-spec.md](docs/ui-spec.md), [core-spec.md](docs/core-spec.md) y [sync-spec.md](docs/sync-spec.md). Se corrigieron `architecture.md`, `development.md`, `database.md`, los README y DEPLOY de los Workers; `roadmap.md` lleva un aviso de que es el plan original.
- **Parches de Expo** (`2cb7c73`). Siete paquetes alineados con el SDK 57 (`expo` 57.0.33, `expo-sqlite` 57.0.5, `expo-updates` 57.0.28, `expo-constants`, `expo-linking`, `expo-router`, `expo-sharing`). El paso "Check Expo SDK alignment" volvió a pasar. **El fingerprint cambió** (`2d4f6ea4…` a `d38579f1…`, medido con `expo-updates fingerprint:generate`): los APK anteriores no reciben OTA de este código.
- **Build más rápido y release protegido** (`e995351`). Fuera de los tags el APK es solo `arm64-v8a`; los tags siguen con dos arquitecturas y una guarda que lee el APK con `aapt2`. Un tag `vX.Y.Z` debe coincidir con `app.json` ([releaseTag.ts](apps/mobile/src/releaseTag.ts)). Pages solo se despliega si cambia `landing/`. **Medido en Actions:** 18,2 min a 9,6 min (Gradle 16,9 a 7,5 min). La línea base de 18,2 min fue un build en frío; con caché caliente el histórico era de 9 a 13 min, así que la mejora real es menor y falta medir más corridas. **La ruta del tag (validación, dos arquitecturas y publicación) nunca se ha ejecutado con estos cambios.**

### Pruebas en dispositivo real hechas el 2026-11-13

- **Dispositivo:** Redmi Note 9 (`M2003J15SC`), Android 12, arm64, sin tiendas reales.
- **APK probado:** artefacto `app-release-apk` del build de `2cb7c73` (run `43492991628`), `versionCode` 10, firmado con la llave de producción (huella SHA-256 `e798f4a4…1cc32d`, idéntica a la esperada y a la del APK ya instalado; se actualizó con `adb install -r` sin perder datos). **No incluye** `e995351`.
- **Arranque y navegación:** sin cierres en toda la sesión (0 `FATAL EXCEPTION` en `logcat`).
- **Respaldo y restauración** (con el `expo-sqlite` 57.0.5 nativo): se cargó el catálogo de ejemplo (100 productos) y se hizo la venta INV-0001. "Guardar copia en el teléfono" guardó y verificó 231 registros en `surtivox-backup-20261113.json` (90 491 bytes; 12 migraciones, 100 productos, 100 movimientos de stock y 1 venta). Se hizo INV-0002 **después** del respaldo y se restauró: "Restauración completa, 231 registros en 20 tablas". Resultado: INV-0002 desapareció, INV-0001 siguió, el stock del aceite volvió a 9 y siguen los 100 productos. Una venta nueva se numeró INV-0002 (sin duplicar) y los datos sobrevivieron a un cierre forzado de la app.
- **Cámara** (con `ScanModal` nuevo): activa con el escáner abierto, **liberada** al ir a segundo plano y al bloquear la pantalla, y **reanudada sola** al volver o desbloquear (medido con `dumpsys media.camera`). Con el permiso revocado: "Necesitamos permiso para usar la cámara" y "Permitir"; el diálogo del sistema aparece; tras negar, "La cámara está bloqueada en los ajustes del teléfono" y "Abrir ajustes", que abre los ajustes de la app; al conceder el permiso y volver, la cámara arrancó sola. Se leyó un código real.
- **Venta sin stock:** en Productos, "Agregar" mete el producto sin aviso; en el cobro aparece "Sin stock: … Puedes venderlo con confirmación" y al completar "¿Deseas venderlo de todas formas?". Cancelar no vende; confirmar vende (INV-0003, cambio correcto).
- **Anulación repetida:** se anuló INV-0003 con tres toques seguidos en el botón de confirmar. El stock de ese producto quedó en 0 (no en 1) y "Total de Hoy" bajó a $19.000 (INV-0001 + INV-0002). **No se pudo comprobar** que el segundo y el tercer toque llegaran a ejecutar una anulación; solo se comprobó que el inventario quedó consistente.
- **No se pudo verificar:** la copia automática previa a restaurar (`safety/`, está en el almacenamiento privado y la app no es depurable), los cursores de sync tras restaurar (la nube no se activó), ni el aspecto visual (la sesión no ve imágenes). Se leyó la interfaz con `uiautomator`.
- **Estado en que quedó el teléfono:** catálogo de ejemplo cargado (100 productos), tres ventas (dos vigentes y una anulada) y una carpeta `Download/SurtivoxRespaldos/` con un respaldo. La carga del catálogo ocurrió, con probabilidad, por toques desviados de la automatización; no se confirmó que no la hiciera una persona.

### Hallazgos nuevos del 2026-11-13

- ~~**Respaldo: Android 11 o superior rechaza la carpeta Descargas.**~~ *Cerrado el 2026-11-13 19:33 (UTC-5, `6125bd6`):* el subtítulo ahora dice "Elige o crea una carpeta dentro de Descargas" y un test impide volver a sugerir la raíz. *Hallazgo original, verificado en Android 12:* [data.tsx](apps/mobile/app/data.tsx) dice "Elige una carpeta (por ejemplo Descargas)" y [backup.ts](apps/mobile/src/backup.ts) abre el selector en `Download`, pero el sistema responde "No se puede usar esta carpeta. Para proteger tu privacidad, elige otra carpeta" y no deja usarla (el botón "Usar esta carpeta" no avanza). Se completó creando una subcarpeta (`SurtivoxRespaldos`). Corrección mínima: cambiar el texto a "Crea una carpeta dentro de Descargas". Sin probar en Android 10 o inferior.
- ~~**Productos y Ventas no se refrescan tras vender en la misma pestaña.**~~ *Corregido el 2026-11-13 19:33 (UTC-5, `cb3e996`), pendiente de verificar en dispositivo.* El carrito y el cobro viven en el layout de pestañas, así que una venta puede cerrarse con cualquier pestaña enfocada. *Reproducido antes del cambio:* tras vender 1 unidad desde Productos la lista siguió mostrando "10 en stock" (el dato era 9) y tras vender INV-0004 desde Ventas la lista siguió mostrando 2 pedidos cuando había 3; al cambiar de pestaña los datos eran correctos. Las tres pestañas (Inicio, Productos, Ventas) recargan ahora con `salesVersion` ([salesRefreshWiring.test.ts](apps/mobile/src/salesRefreshWiring.test.ts)). **Falta comprobar con el siguiente APK de CI** que vender desde Productos y desde Ventas, y anular una venta, actualizan la lista; la anulación ya no llama a `refresh()` directo y depende de ese mecanismo.
- **Ventas: las ventas anuladas no aparecen en la lista**, ni con "Todo el tiempo". *Observación, sin verificar* si existe otro filtro o pantalla para verlas.
- **Dependabot (2026-11-13).** Hay 10 PR abiertos y sus ejecuciones fallan ("Run Dependabot"; no se vio el motivo). Cuatro suben `expo`, `expo-sqlite`, `expo-status-bar` y `expo-camera` al SDK 58, que no es compatible con React Native 0.86; uno sube `wrangler` de 3.x a 4.x; cinco actualizan GitHub Actions a versiones mayores y tocan los workflows de firma y build. **No fusionarlos sin revisar.**
- **`expo install --check` rompe el build en cada parche nuevo de Expo.** *Verificado el 2026-11-13* (siete paquetes un parche atrás impidieron compilar el APK). Decidir si el check sigue siendo estricto o pasa a advertencia.
- **`expo install --fix` puede dejar el trabajo a medias** con una red lenta: dejó `pnpm-lock.yaml` y `package.json` inconsistentes y `pnpm install --frozen-lockfile` fallaba. Verificar siempre con `--frozen-lockfile` y `expo install --check`.
- **Compilar en este equipo no es posible:** el NDK 27.1.12297006 de `~/Android/Sdk/ndk/` es una carpeta vacía (resto de una descarga fallida del 2026-10-28) y React Native 0.86 exige esa versión. `sdkmanager` no lee las variables de proxy: necesita `--proxy_host 192.168.49.1 --proxy_port 8228`. Mientras tanto, los APK de prueba salen del artefacto de CI.
- **Pagos: `/pagos/crear` autentica contra `sync_tokens`** ([payments-worker/src/index.ts](apps/payments-worker/src/index.ts), `authorized`), tabla que el sync-worker vacía al migrar tokens a `shop_keys` (hash). Con el código actual, una tienda registrada no podría autorizar el pago. **Inferencia por lectura de código; el Worker de pagos no está desplegado.** Pospuesto con el resto del cobro.
- **Pull sin tope de filas y sin cuota por tienda.** El sync gratuito no limita registros exitosos ni filas por tienda (ver [sync-spec.md](docs/sync-spec.md), "No implementado"). Pendiente de decisión del tope.

## Estado de la infraestructura (Cloudflare)

Desplegado por la API REST el 2026-11-04, porque Wrangler 3.114 falla con `fetch failed` detrás del proxy de este equipo (el proxy es la única salida a Internet).

| Worker | D1 enlazada | Notas |
|---|---|---|
| `surtivox-sync` | `surtivox-sync` (`1faf3ce0-aa7a-414d-bc0e-e28d9be9d336`) | 16 tablas. `sync_tokens` empezó vacía. |
| `surtivox-catalog` | `surtivox-catalog` (`b6740661-3359-4780-aff9-6cd5624992a7`) | Cron `17 3 * * *`. `CATALOG_SALT` rotada a un valor aleatorio. |
| `surtivox-market` | no usa D1 | Precios de referencia. |
| `surtivox-pagos` | **no desplegado** | Ver sección de cobro. |

El duplicado `surtivox-catalogo` fue borrado. El token de API usado para el despliegue debe revocarse.

## P1 · Integridad del sync

- **Cursor del servidor (P1-2).** *Verificado.* El cursor de pull es el mayor `updated_at`/`created_at` que puso el dispositivo ([sync-worker/src/index.ts](apps/sync-worker/src/index.ts), [mobile/src/sync.ts](apps/mobile/src/sync.ts)). Una venta creada sin conexión y subida tarde no llega a un dispositivo que ya avanzó su cursor. Solución: columna asignada por el servidor (`server_seq` o `received_at`) y paginar por ella. **Requiere migración de D1 y cambio de contrato.**
- **Pull sin paginar.** *Verificado.* Una tienda grande se descarga en una sola respuesta.
- **Sync de varias tiendas (P2-5).** *Verificado.* `changedSinceSql` no filtra por tienda y hay un solo cursor `last_pushed_at`. El servidor descarta lo ajeno, pero no hay prueba.
- **Reloj del dispositivo.** El último que escribe gana según `updated_at` del dispositivo: un reloj adelantado siempre gana.
- **Borrados.** Solo hay borrado lógico en productos, clientes, proveedores y personal. `categories` no tiene `deleted_at`.
- **`image_uri` local se sincroniza** como ruta que no sirve en otro dispositivo.
- **`restoreFromCloud` borra todas las tiendas locales**, no solo la vinculada.

## Seguridad

- **Tokens de sync en texto plano en D1** (`sync_tokens.token`). *Parcialmente superado (2026-11-13):* el código del Worker guarda el hash en `shop_keys` y migra y borra los tokens heredados al primer uso ([sync-worker/src/index.ts](apps/sync-worker/src/index.ts)). **No se verificó si el Worker desplegado incluye ese cambio** (la sección del kit de recuperación dice que faltaba desplegar).
- **Sin rate limit** en sync, pagos ni catálogo. CORS abierto (`*`).
- **El registro (`/sync/register`) ya no permite tomar una tienda ajena**, pero se apoya en que el primero que registra gana. Reinstalar la app o "Borrar todo" pierde el token: la tienda solo se recupera con el código original. Mostrar y recordar el código al activar la nube.
- **Ids con `Math.random`** ([id.ts](apps/mobile/src/id.ts)). Usar `expo-crypto`.
- **PIN con `cyrb53` y sal de `Math.random`** ([roles.ts](apps/mobile/src/roles.ts)). Un PIN de 4 dígitos se revierte al instante desde un respaldo o desde D1, y el hash viaja por el sync.
- **`allowBackup="true"`** en el manifest de Android: la copia automática a Google Drive incluye fiado y token.
- **El respaldo JSON incluye `local_settings`** (`catalog_install_id`, `developer_mode`, `last_error`).
- **`last_error`** se trunca a 300 caracteres y se redacta (Bearer, cadenas hexadecimales largas, códigos de tienda y palabras del kit) con `redactSecrets` ([diagnostics.ts](apps/mobile/src/diagnostics.ts), [redact.ts](apps/mobile/src/redact.ts)). *Verificado en el código el 2026-11-13; corrige la nota anterior.*
- **Catálogo comunitario (P2-9).** El `install_id` lo elige el cliente: dos ids inventados alcanzan el umbral de consenso. Falta limitar por IP.
- **Política de privacidad del catálogo** sigue en borrador sin publicar ([docs/privacidad-catalogo-borrador.md](docs/privacidad-catalogo-borrador.md)).
- **Revocar** cualquier token de API de Cloudflare que se haya compartido.

## Cobro y suscripción

*Verificado:* la app todavía no puede cobrar.

- [payments.ts](apps/mobile/src/payments.ts) tiene `CHECKOUT_ENDPOINT = ''` y **ya no lo llama ninguna pantalla** (código muerto hasta conectar el pago).
- El Worker de pagos solo expone `POST /pagos/crear`. **No hay webhook**, no se escribe `entitlements` y no hay conciliación de `wompi_tx_id`.
- Las tablas `payment_intents`, `entitlements` y `wompi_events` **no existen** en la D1 `surtivox-sync` (falta aplicar [payments-worker/schema.sql](apps/payments-worker/schema.sql)).
- Los secretos `WOMPI_*` no están configurados.
- Círculo sin salida: `/pagos/crear` exige un token ya registrado en `sync_tokens`, y registrarlo exige sincronizar. El token debería emitirse al crear el pago.
- Falta idempotencia: cada llamada crea un `payment_intent` nuevo.
- **Dos fuentes de verdad de la suscripción.** *Resuelto en las pantallas el 2026-11-13:* Inicio, Más y Respaldo en la nube usan `sync_state` ([useCloudConnected.ts](apps/mobile/src/useCloudConnected.ts)) y un test impide que otra pantalla vuelva a usar [subscription.ts](apps/mobile/src/subscription.ts). `subscription.ts`, `paywall.tsx` y `expo-iap` siguen existiendo sin uso.
- **`paywall.tsx` sigue existiendo** y se alcanza por deep link `surtivoxpos://paywall`. Muestra "USD 5/mes". Eliminarlo junto con el IAP.
- Quitar `expo-iap` cambia el fingerprint nativo (`runtimeVersion`): los APK ya instalados dejan de recibir OTA. El fingerprint ya cambió el 2026-11-13 por los parches de Expo, así que quitarlo antes del próximo release no añade un corte de OTA; quitarlo después sí.
- **Precios inconsistentes** en el código: "$2/mes", "$5.00", "USD 5/mes", "≈ 20.000 COP". El cargo real es 20.000 COP. Definir un solo precio y moneda.
- Decidir si el Worker de pagos conserva la D1 compartida con sync o se separa con un Service Binding.

## Legal y privacidad (pendiente de revisión por un abogado colombiano)

- **Los textos de la app son un borrador sin revisión legal** ([legalText.ts](apps/mobile/src/legalText.ts)). Describen el comportamiento real del código, pero no los ha aprobado un abogado. Al cambiarlos hay que subir `LEGAL_VERSION` en [legal.ts](apps/mobile/src/legal.ts): la app vuelve a pedir la aceptación.
- **Faltan el domicilio y el teléfono del responsable** (Mateo Castro). Hoy solo figura el correo.
- **La web repite los textos de la app.** [privacidad.html](landing/privacidad.html) y [terminos.html](landing/terminos.html) contienen las secciones de la app palabra por palabra (privacidad 1 a 9 y términos 1 a 11) y añaden las propias del sitio. [landingLegal.test.ts](apps/mobile/src/landingLegal.test.ts) falla si se desalinean. Si cambias [legalText.ts](apps/mobile/src/legalText.ts), actualiza las dos páginas y sube `LEGAL_VERSION`. Los borradores internos viven en `docs/`, fuera de lo que publica GitHub Pages.
- **Conservación:** el aviso dice "mientras el servicio esté activo o hasta que solicites su supresión". No hay plazos definidos ni herramienta para borrar datos del servidor: hoy una solicitud de supresión es manual.
- **Transferencia internacional** (Cloudflare, Expo) sin clasificar; verificar con el abogado y, si aplica, el Registro Nacional de Bases de Datos.
- **La prueba de aceptación vive solo en el teléfono** (`legal_accepted_version` y `legal_accepted_at` en `local_settings`). Es evidencia débil.
- **Consultas de código de barras sin consentimiento:** al escanear un código desconocido la app consulta Open Food Facts y el catálogo de Surtivox (solo el código y la IP). Está declarado en el aviso; decidir si requiere opt-in.
- **Catálogo comunitario:** el aviso inicial es opt-in (nunca preseleccionado). No cambiarlo a opt-out: la autorización debe ser previa y expresa (Ley 1581, art. 9).
- **Contraste:** `muted`, `faint`, `dangerText` y `warnText` cumplen 4,5:1 en todas las superficies y en ambos temas, con test ([themeContrast.test.ts](apps/mobile/src/themeContrast.test.ts)). `danger` y `warn` quedan para rellenos, bordes e iconos y un test impide usarlos como color de texto. **Siguen por debajo de AA en modo claro** `accent` como texto (2,8 a 3,1:1; es la identidad de la marca y se decidió no tocarlo) y `ok` (2,4:1). El texto blanco sobre `danger` da 3,9:1 en claro y 3,4:1 en oscuro, y sobre `warn` 2,4:1; no se midieron los botones con `accentFg`. Los iconos de `warn` (2,1 a 2,4:1) tampoco llegan a 3:1.
- **Pendiente de prueba en dispositivo:** instalación limpia; actualización desde v1.0.3 con tienda existente (debe mostrar los términos y luego la pregunta del catálogo si no se respondió); fuente al 200 %; TalkBack; aviso de la nube con fuente grande.

## Kit de recuperación (2026-11-05)

Implementado sin desplegar: llave de 8 palabras generada en el teléfono, huella en el servidor, rotación y límite de intentos. Diseño en [apps/sync-worker/README.md](apps/sync-worker/README.md).

- **Falta aplicar la migración D1 y desplegar el Worker antes de publicar el APK** (orden en el reporte de la entrega). Si el APK nuevo sale antes, `/sync/rotate` responde 404 y la activación de la nube falla.
- **La lista de 2048 palabras requiere revisión humana** (palabras ofensivas, coloquialismos de Colombia). La escribí yo y solo comprobé ortografía contra el diccionario del sistema; el test valida unicidad, longitud, primeras 4 letras únicas y ausencia de homófonos obvios, no el buen gusto.
- **Lista de palabras cambiada (2026-11-06):** se sustituyeron 40 palabras sensibles en el mismo índice (`recoveryWords.ts`). Un kit generado antes de este cambio que contenga alguna de ellas **ya no se puede recuperar** con la lista nueva: se rechaza como "El kit no es válido" o, peor, se interpreta como otra llave. Quien tenga un kit de prueba debe usar "Cambiar llave" y guardar el kit nuevo. El servidor no cambió: solo guarda una huella de la llave, no las palabras. La lista dejó de estar ordenada alfabéticamente a propósito para no mover índices.
- **Fase de QR bloqueada:** no hay generador de QR ni `react-native-svg`. Tampoco `react-native-view-shot` (sin "Guardar imagen"), `expo-secure-store` ni `expo-local-authentication` ("Ver mi kit" solo lleva una advertencia, sin pedir el bloqueo del teléfono).
- **La entropía `E` se guarda en `local_settings`** (`kit_entropy_v1`) para poder volver a mostrar el kit. Se excluye de las copias JSON y de los diagnósticos, pero `allowBackup="true"` sigue copiando la base completa a Google Drive.
- **Sin sugerencias de palabras al escribir** en la pantalla de recuperar; el error dice qué palabra no existe.
- **"Copiar" usa el menú de compartir del sistema** (sin librería de portapapeles).
- **Versiones viejas de la app** no entienden el kit: un teléfono con la app anterior vinculado a una tienda rotada recibe 401 y no puede ingresar las palabras.
- **Sin probar en dispositivo:** pantallas del kit y de recuperar, compartir por WhatsApp, rotación contra el Worker real y el límite de intentos bajo D1 real.

## Asistente de producto desconocido (2026-11-06)

- **Sin probar en dispositivo:** pantallas, teclado, cámara del sistema, reanudación tras cierre real de la app y fuentes grandes. Solo hay pruebas de lógica, wiring y empaquetado.
- **Correo en el User-Agent de Open Food Facts:** se usa `LEGAL_CONTACT` ([legalText.ts](apps/mobile/src/legalText.ts)). El dueño confirmó `pragramademateo@gmail.com` como correo público de contacto (2026-11-06). Si cambia, se modifica solo `LEGAL_CONTACT`. Sin correo, el User-Agent sale sin contacto y no cumple el formato pedido.
- **Fotos de Open Food Facts sin atribución por foto:** la hoja de producto desconocido y el alta manual siguen descargando la imagen de esa fuente como foto del producto. La atribución está solo en Más → Licencias; no hay marca de origen por foto.
- **La hoja y el alta manual siguen precargando nombre e imagen de terceros** (el asistente no lo hace). Si se quiere eliminar esa precarga, es un cambio aparte.
- **Caché de Open Food Facts:** la consulta del alta manual ahora tiene caché de sesión de 12 horas en memoria; la persistente (`barcode_lookups`) solo la usa la hoja.
- **Marca y tamaño** se guardan dentro del nombre porque el producto no tiene esos campos; al catálogo se envía el nombre con la marca y el tamaño como presentación (máx. 20 caracteres).
- **Una sugerencia editada** (por ejemplo, el nombre sugerido por otra fuente al que se le cambia una letra) sigue pudiendo enviarse como aporte; solo se bloquea cuando queda idéntica a la sugerencia.
- **Cajeros:** el asistente no exige el permiso `products`, igual que la hoja actual; cualquier rol puede crear productos desde el escáner.
- **Un cierre de `scripts/verify.sh` con `GATE FAIL` que no pude reproducir** ocurrió una vez durante el desarrollo, tras restaurar un archivo de prueba de mutación; las cuatro ejecuciones siguientes dieron `GATE OK`.

## Rediseño visual "Mercado vibrante"

- **No se pudo capturar la app real.** No había teléfono ni emulador. Solo se comparó una maqueta HTML con los mismos números que el código (no es la app). Falta revisar en dispositivo: curvas del encabezado (`borderRadius: '50%'` en Android), sombras (`boxShadow`), tamaños con fuente grande y pantallas de 320 a 600 dp, en modo claro y oscuro.
- **El logotipo de "Trailer Rodante" no está en el proyecto.** El encabezado usa el nombre, el eslogan y el logotipo de la tienda (se cargan en Más → Perfil y recibos); sin logotipo muestra el icono genérico de tienda. No se fijó "Trailer Rodante" en el código porque la app admite varias tiendas.
- **La ilustración del bloque promocional es un recorte de la imagen de referencia** (`assets/promo/mas-ventas.webp`, 552x514) con el texto incluido en la imagen: no se traduce ni escala con el tamaño de letra. Conviene reemplazarla por una pieza diseñada a mayor resolución.
- **Apariencia:** Claro, Oscuro, Automático por hora (por defecto de 7:00 p. m. a 6:00 a. m., configurable) o Igual que el teléfono. La elección se guarda en `local_settings` (`appearance`, `night_from`, `night_until`) y se aplica desde [appearance.ts](apps/mobile/src/appearance.ts); el botón de luna/sol de Inicio alterna claro y oscuro. **Por defecto sigue siendo claro** (`DEFAULT_APPEARANCE`). Sin probar en dispositivo: el modo "Igual que el teléfono" (usa `Appearance.setColorScheme('unspecified')`), el cambio automático con la app abierta (revisa cada 60 s y al volver a la app) y los teclados y diálogos del sistema en oscuro.
- **Siempre claros aunque el modo sea oscuro:** la intro de arranque (`LaunchIntro`, aparece antes de leer la preferencia), la pantalla de error, el splash nativo y la tarjeta promocional de Inicio (es una imagen clara). La landing es solo clara.
- **Pendiente de la nueva identidad:** icono de la app (el launcher sigue con el fondo `#0B0E12` y el glifo anterior). El splash nativo ya es claro, pero **solo se ve con un APK nuevo**: el cambio de `app.json` altera el fingerprint y esa actualización no llega por OTA a los APK instalados.
- **Ajuste a la paleta pedida:** el texto secundario `#64736D` da 4,15:1 en el peor caso y se usa `#5E6C67` (4,58:1) para conservar el mínimo de 4,5:1 con test. Las superficies `surfaceAlt` y `chip` se aclararon un poco por el mismo motivo.
- **`ok` (verde brillante) como texto** sigue en 2,7:1 sobre blanco; solo se usa en fondos e importes de ayuda.

## Personal y roles

- **El PIN es un candado de conveniencia, no una protección fuerte.** Son 4 dígitos con `cyrb53` (no criptográfico) y la huella viaja a la nube con el resto de `staff` para que otros dispositivos puedan autenticar. Quien tenga acceso a la base o al servidor puede recuperar un PIN en segundos. El límite de intentos protege solo contra quien usa la pantalla. Cambiarlo implica versionar el hash y decidir si la huella debe sincronizarse.
- **El bloqueo por intentos es local a cada dispositivo** (`local_settings`, clave `pin_guard:<id>`): el contador no se comparte entre teléfonos.
- **Quien borra la app o "Borrar todo" reinicia el control.** Es inherente a un esquema sin servidor.
- **Rutas protegidas por rol:** la lista está en [routeAccess.ts](apps/mobile/src/routeAccess.ts). Una pantalla nueva con permiso debe añadirse ahí; `/add-customer` queda abierta a propósito porque el cajero la usa al cobrar un fiado.
- **El rol de otra persona editada mientras está conectada** no se actualiza en su sesión hasta que se bloquee; solo se refresca la sesión propia.
- **Recuperación del propietario (implementada, sin cambios de esquema).** Código de 16 caracteres (80 bits) generado con el aleatorio de `expo-crypto`; se guarda solo una huella SHA-256 con sal en `local_settings` (`recovery_hash:<tienda>`, `recovery_salt:<tienda>`), que no se sincroniza a la nube. Se muestra una vez, se rota al usarse y tiene el mismo límite de intentos que el PIN. Detalles a recordar:
  - "Copiar" usa el menú de compartir del sistema porque no hay librería de portapapeles instalada (no se añadieron dependencias).
  - Las tiendas que ya existían no tienen código: ven un aviso en Inicio y un botón en Personal y roles.
  - Sin código y con un solo propietario, la única salida es borrar los datos de la app; restaurar una copia no ayuda porque trae las mismas huellas de PIN.
  - La huella del código viaja en las copias JSON (`local_settings`); el código en sí nunca se guarda.
  - Cualquiera con el código puede cambiar el PIN del propietario: hay que guardarlo fuera del teléfono.
  - El alfabeto del código de tienda de [sync.ts](apps/mobile/src/sync.ts) contiene la `L` aunque su comentario dice que no; el de recuperación sí la excluye. Es cosmético y no afecta a los códigos existentes.
- **Pendiente para la v1.0.4 (decidido, requiere migración o cambios estructurales):**
  1. **Registrar quién anula o devuelve.** Hoy solo la venta guarda quién la cobró (`sales.staff_id`); `returns` y las anulaciones no. Requiere una columna nueva y migración.
  2. **PIN más fuerte.** PIN de 6 dígitos para el propietario, hash versionado (SHA-256) con mejora silenciosa al iniciar sesión, y decidir si la huella del PIN debe sincronizarse a la nube.
  3. **Aprobación del supervisor** (PIN de un administrador) para descuentos grandes, anulaciones y devoluciones hechas por un cajero.
- Sin probar en dispositivo: pantalla de bloqueo con cuenta atrás, bloqueo automático al volver de otra app, la guardia de rutas, el flujo "¿Olvidaste tu PIN?" y la hoja del código con "Copiar o compartir".

## Landing

- **Invertida a tema claro** con la paleta de marca (variables de `landing/styles.css`; hay test en [landingTheme.test.ts](apps/mobile/src/landingTheme.test.ts)). La sección "Hecho para tienda de barrio" y la tarjeta final son verde oscuro a propósito.
- **Las imágenes `screen-*.webp` y `og-image.png` son maquetas HTML, no capturas de la app.** Se rehicieron en español y en tema claro con la paleta y los textos reales, pero sin teléfono ni emulador. Reemplazarlas por capturas reales cuando se compile la app. Los datos que muestran (Tienda Don Pepe, $ 186.400) son inventados.
- **Contraste y paleta:** los textos pequeños de la landing se agrandaron y los enlaces de la tarjeta final quedaron en blanco sólido; se sumaron mango, naranja, sol y coral de la app. Sin verificar en un móvil real; solo se revisó con Firefox headless.
- El enlace "Ver código fuente" del pie y de la tarjeta final se conserva aunque la licencia es propietaria; decidir si se renombra a "Ver repositorio".

## Fotos de productos

- **Las fotos no viajan entre dispositivos.** `image_uri` es una ruta local y desde v1.0.3 está marcada como "solo local" en [sync.ts](packages/database/src/sync.ts): no se envía y el pull no la sobrescribe. Un dispositivo nuevo o una restauración desde la nube muestra el producto sin foto.
- **El respaldo JSON no incluye los archivos de foto,** solo las rutas: tras restaurar o reinstalar, las fotos se pierden.
- **Plan para la nube (sin implementar):** Cloudflare R2 con objetos por contenido (`stores/<store_id>/products/<sha256>.webp`), columna nueva `image_key` (migración local y D1), subida y descarga por el Worker con token, cola con reintentos y descarga perezosa. Requiere permiso de R2 en el token, límites por tienda y actualizar la política de privacidad.
- **Quitar el fondo automáticamente:** descartado por ahora (módulo nativo que rompe OTA, rendimiento en gama baja, calidad sin medir, costo por imagen y privacidad). Si se retoma, guardar WebP con transparencia y pintar el fondo al mostrar.

## App móvil

- **Respaldo marcado como hecho aunque se cancele (P2-3), parcialmente resuelto.** `expo-sharing` no informa si el usuario completó o canceló el diálogo, así que "Compartir copia" sigue marcando `last_backup_at` sin poder confirmarlo y el archivo queda en `cacheDirectory`. Se añadió "Guardar copia en el teléfono" ([backup.ts](apps/mobile/src/backup.ts), `saveBackupToDevice`): escribe en una carpeta elegida por el usuario con el Storage Access Framework, relee el archivo y comprueba que el conteo de registros coincide (`verifyBackupText`, con test) antes de marcar el respaldo. **Probado en dispositivo el 2026-11-13** (Android 12): selector, escritura, relectura y verificación funcionan, con la salvedad de que la carpeta Descargas se rechaza (ver hallazgos nuevos).
- **Restauración parcial (P2-4).** [backup.ts](apps/mobile/src/backup.ts) solo reemplaza las tablas presentes en el archivo y no ejecuta `PRAGMA foreign_key_check`. Desde el 2026-11-13 **sí reinicia los cursores de `sync_state`** ([restoreOps.ts](apps/mobile/src/restoreOps.ts)).
- Los archivos de `safety/` (`pre-migracion-*.db` y `surtivox-antes-de-restaurar-*.json`) **no tienen pantalla de restauración**.
- Si una migración falla, el error no se guarda en `last_error` y se muestra crudo y en inglés ([_layout.tsx](apps/mobile/app/_layout.tsx)). Decidir si una copia previa fallida debe bloquear la migración.
- `collectFullBackup` carga toda la base en memoria.
- ~~Modo desarrollador sin salida~~ *Cerrado el 2026-11-13* (`f46ab3b`): tocar la versión en Más lo desactiva.
- Borradores con `track_inventory = 0`: anulación y devolución usan el valor actual del producto, no el movimiento original. Si algún día se activa el inventario, repondrán stock que nunca se descontó.
- `repos.ts` sigue siendo un archivo grande (1.200 líneas el 2026-11-13) con SQL repetido. No se ha leído completo para medir la duplicación.
- Textos técnicos y en inglés en errores del servidor sin traducir fuera de los códigos conocidos ([syncErrors.ts](apps/mobile/src/syncErrors.ts)).
- Accesibilidad: sin revisar con fuente al 200 % ni en pantallas pequeñas.

## Dinero, facturas y fechas (2026-11-08)

Cerrado en esta revisión, con prueba en `apps/mobile/src` (`checkoutSale.test.ts`, `processReturn.test.ts`, `customerPayment.test.ts`, `saleDoubleTap.test.ts`, `returnDiscount.test.ts`, `returnMethods.test.ts`, `reportProfit.test.ts`, `reportPayments.test.ts`, `effectiveLines.test.ts`, `localTime.test.ts`, `numberCollision.test.ts`):

- **Descuento general mal repartido.** *Cerrado.* Las devoluciones y la utilidad usan el valor efectivo de cada renglón (total de la venta repartido por mayor resto, [effectiveLines.ts](apps/mobile/src/effectiveLines.ts)); lo guardado y lo que se sincroniza no cambió. Las devoluciones anteriores al arreglo conservan el valor que se reembolsó entonces.
- **Devolución en efectivo de una venta fiada.** *Cerrado.* Una venta fiada solo se devuelve a la cuenta del cliente; una venta pagada, por el mismo medio o a la cuenta (Nequi y Daviplata como transferencia, porque la base solo admite `cash`, `card`, `bank` y `account`).
- **Abono mayor que la deuda.** *Cerrado.* Se rechaza dentro de una transacción contra el saldo del libro.
- **Doble toque y número de factura.** *Cerrado.* Guarda con `useRef` en Cobrar y Abonar, operaciones idénticas simultáneas rechazadas y distintas puestas en fila ([serialQueue.ts](apps/mobile/src/serialQueue.ts)), y `INV-n` calculado dentro de la transacción con el mayor sufijo. El defecto real no era una factura repetida sino un error de la restricción única (`UNIQUE sales.store_id, sales.invoice_no`) que bloqueaba toda venta nueva cuando un número traído de otro teléfono dejaba el conteo por debajo del mayor.
- **Renombre por número repetido.** *Cerrado.* `resolveNumberCollision` sube `updated_at` y `version` de la fila local renombrada para que el cambio se envíe.
- **Abonos en el reporte.** *Cerrado.* Tarjeta aparte "Abonos de fiados recibidos"; no se suman a ventas ni a utilidad. El libro no guarda el medio de pago del abono.
- **Fechas del CSV y del nombre del respaldo.** *Cerrado.* Hora local del teléfono ([localTime.ts](apps/mobile/src/localTime.ts)).

Abierto, descubierto o confirmado en esta auditoría:

- **Ajuste manual de stock.** No existe: los únicos movimientos son `opening_stock`, `sale`, `sale_return` y `purchase`. Un conteo físico no se puede corregir.
- **Anulación y devolución dobles con dos teléfonos.** `voidSaleOn` y `assertReturnable` solo miran la base local; dos teléfonos que anulan o devuelven lo mismo antes de sincronizar reponen stock y acreditan saldo dos veces. Hacen falta ids determinísticos (por ejemplo `void:<sale_item_id>`) en los movimientos y asientos de anulación.
- **Categorías sin borrado lógico** (`categories` no tiene `deleted_at`).
- **Sincronización automática.** `syncNow` solo se llama desde [cloud-sync.tsx](apps/mobile/app/cloud-sync.tsx) con el botón; la pantalla promete "Respaldo automático".
- **Transacciones no exclusivas.** `anular` no pasa por la fila de [serialQueue.ts](apps/mobile/src/serialQueue.ts), y la descarga de la nube o la restauración corren con `foreign_keys` apagado en la única conexión mientras puede entrar una venta.
- **No existe la fiada parcial:** una venta fiada carga todo el total a la cuenta e ignora el monto recibido.
- **Cantidades enteras:** no hay venta por peso ni por fracción ([pricing.ts](packages/pos-core/src/pricing.ts)).
- **Descuento por renglón:** la venta no lo admite; solo hay descuento general.
- **Devoluciones previas al arreglo** que reembolsaron el valor sin descuento no se corrigen.
- **Fechas en ISO/UTC** que siguen en [diagnostics.ts](apps/mobile/src/diagnostics.ts) (texto de soporte) y en nombres de copias internas de `safety/`.
- **Sin probar en teléfono:** doble toque real, impresión del recibo con los valores nuevos y cambio de zona horaria del teléfono.

## Tests que faltan

- ~~Parte de escritura de `processReturn`~~ (cubierta el 2026-11-08 con SQLite en memoria; ver la sección de dinero).
- `restoreFromCloud` con un fallo a mitad de la carga.
- `restoreFullBackup` con un respaldo parcial y con claves foráneas rotas.
- Handler completo de `POST /pagos/crear` (400, 401, 503, 201).
- Sync entre dos dispositivos contra el Worker (hoy el Worker se prueba con SQLite en memoria, no con D1 real).
- Concurrencia real de `expo-sqlite` en dispositivo (las pruebas de concurrencia corren en un solo hilo).
- Cámara, `quick_check`, copia previa a migrar y backups automáticos: solo hay pruebas puras, ninguna en dispositivo.

## Build, release y CI

- **Firma de release (2026-11-05):** el workflow firma con una llave de producción leída de secretos de GitHub y falla si falta o si el APK sale con el certificado debug. **Verificado el 2026-11-13** en dos builds de `main` (`2cb7c73` y `e995351`): el paso "Verificar la firma del APK" pasó y el APK instalado en el teléfono tiene la huella `e798f4a4…`. Faltan respaldar la llave fuera de este equipo y el AAB (el workflow solo hace `assembleRelease`). Los APK instalados con la llave debug exigen desinstalar al pasar a la nueva: ver [RELEASING.md](RELEASING.md).
- [build-android.yml](.github/workflows/build-android.yml) ahora ejecuta `scripts/verify.sh`, `pnpm -r typecheck` y `pnpm test` antes de compilar, y fija las acciones por SHA. *Verificado en Actions el 2026-11-13* para los builds de `main`. Falta el primer build de **tag** con los cambios nuevos. `ci.yml` y este workflow usan ahora Node 22.
- `pnpm -r typecheck` no cubre `packages/types` (no tiene script `typecheck`).
- Los Workers `payments-worker` y `catalog-worker` no declaran `wrangler`, `typescript` ni `@types/node`; se resuelven por hoisting.
- **Hipótesis, sin verificar:** el manifest no incluye el header `expo-channel-name`, así que un `eas update` al canal `production` podría no llegar al APK compilado con Gradle fuera de EAS.
- `buildArchs` limita a arm64 y armeabi: no instala en emuladores x86_64. Desde el 2026-11-13 los APK de `main` son **solo arm64**; los tags compilan arm64 y armeabi-v7a.
- `runtimeVersion` por fingerprint: cualquier cambio nativo deja huérfano el APK anterior.
- Wrangler 3.114 no funciona detrás del proxy de este equipo; los despliegues se hicieron por la API REST. Actualizar Wrangler o desplegar desde otra red.

## Documentación

- ~~Los specs que AGENTS.md referencia no existían~~ *Cerrado el 2026-11-13* (`f6ef2a9`): existen `docs/ui-spec.md`, `docs/core-spec.md` y `docs/sync-spec.md`, escritos solo con lo verificado en el código.
- `docs/architecture.md`, `docs/database.md`, `docs/development.md` se corrigieron el 2026-11-13 (`52775ce`). [docs/roadmap.md](docs/roadmap.md) sigue siendo el plan original, con un aviso arriba; decidir si se reescribe.
- Los `README`/`DEPLOY.md` del sync y del catálogo ya no mandan a reemplazar placeholders de `database_id`. **Siguen sin describir el despliegue por la API REST**, que es el que se usó porque Wrangler 3.114 falla detrás del proxy de este equipo.

## Pruebas manuales en dispositivo real

**Hechas el 2026-11-13** en un Redmi Note 9 con Android 12 (detalle en la sección de esa fecha): respaldo guardado y verificado, restauración con datos posteriores al respaldo, numeración tras restaurar, persistencia tras cierre forzado, cámara (segundo plano, bloqueo de pantalla, permiso denegado, bloqueado, "Abrir ajustes" y reanudación), venta sin stock con confirmación y anulación repetida.

**Pendientes:**

- Dos teléfonos contra el Worker nuevo, uno vendiendo sin conexión; comprobar P1-2.
- Activar la nube, desactivarla y volver a activarla; vincular un segundo dispositivo con el código. Comprobar que los cursores se reinician tras restaurar un respaldo con la nube activa.
- Cortar la red durante una descarga de `restoreFromCloud`.
- Migración pendiente con copia previa; base corrupta a propósito; restauración de un respaldo hecho con una versión anterior de la app.
- Cámara en gama baja; cambio de pestaña con el escáner abierto.
- Venta con producto en borrador; fiado con abono, anulación y devolución a la cuenta; anular dos veces desde dos teléfonos.
- OTA: publicar una actualización al canal y comprobar que llega al APK de CI (hoy no puede llegar a los APK anteriores a `2cb7c73`).
- Tarjeta "Activado, pero aún no se ha sincronizado" con la nube activa (no se probó para no escribir en el Worker).
