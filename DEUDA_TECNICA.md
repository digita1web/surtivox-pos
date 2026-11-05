# Deuda técnica

Estado: **v1.0.3 beta de pruebas internas** (`versionCode` 6). No es un lanzamiento comercial. Este archivo es la lista de pendientes para la v1.0.4. Cada punto indica si fue **verificado** en el código o es una **hipótesis**.

## Decisiones tomadas para la beta

- El respaldo en la nube es **gratis y está abierto a todos los propietarios** de tienda. La tarjeta de precio y el botón "Suscribirme" se ocultaron en [cloud-sync.tsx](apps/mobile/app/cloud-sync.tsx).
- El Worker de sync **no consulta `entitlements`**: no hay forma de limitar el uso por tienda.
- La app usa `DEFAULT_SYNC_URL` = `https://surtivox-sync.surtivox.workers.dev` ([sync.ts](apps/mobile/src/sync.ts)).
- Los avisos de la pantalla de nube dicen que es una versión de pruebas y que puede cambiar.

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

- **Tokens de sync en texto plano en D1** (`sync_tokens.token`). Guardar el hash SHA-256.
- **Sin rate limit** en sync, pagos ni catálogo. CORS abierto (`*`).
- **El registro (`/sync/register`) ya no permite tomar una tienda ajena**, pero se apoya en que el primero que registra gana. Reinstalar la app o "Borrar todo" pierde el token: la tienda solo se recupera con el código original. Mostrar y recordar el código al activar la nube.
- **Ids con `Math.random`** ([id.ts](apps/mobile/src/id.ts)). Usar `expo-crypto`.
- **PIN con `cyrb53` y sal de `Math.random`** ([roles.ts](apps/mobile/src/roles.ts)). Un PIN de 4 dígitos se revierte al instante desde un respaldo o desde D1, y el hash viaja por el sync.
- **`allowBackup="true"`** en el manifest de Android: la copia automática a Google Drive incluye fiado y token.
- **El respaldo JSON incluye `local_settings`** (`catalog_install_id`, `developer_mode`, `last_error`).
- **`last_error`** se trunca a 300 caracteres pero no se redacta ([diagnostics.ts](apps/mobile/src/diagnostics.ts)).
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
- **Dos fuentes de verdad de la suscripción.** Inicio y Más usan el IAP de `expo-iap` ([subscription.ts](apps/mobile/src/subscription.ts)); la pantalla de nube usa el estado de `sync_state`. En la beta, Inicio y Más siguen diciendo "Opcional" aunque la nube esté activa.
- **`paywall.tsx` sigue existiendo** y se alcanza por deep link `surtivoxpos://paywall`. Muestra "USD 5/mes". Eliminarlo junto con el IAP.
- Quitar `expo-iap` cambia el fingerprint nativo (`runtimeVersion`): los APK ya instalados dejan de recibir OTA.
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

- **Respaldo marcado como hecho aunque se cancele (P2-3).** Si el usuario cancela el diálogo de compartir, `last_backup_at` se escribe igual. El archivo queda en `cacheDirectory`, que el sistema puede limpiar.
- **Restauración parcial (P2-4).** [backup.ts](apps/mobile/src/backup.ts) solo reemplaza las tablas presentes en el archivo, sin `PRAGMA foreign_key_check` y sin reiniciar `sync_state`.
- Los archivos de `safety/` (`pre-migracion-*.db` y `surtivox-antes-de-restaurar-*.json`) **no tienen pantalla de restauración**.
- Si una migración falla, el error no se guarda en `last_error` y se muestra crudo y en inglés ([_layout.tsx](apps/mobile/app/_layout.tsx)). Decidir si una copia previa fallida debe bloquear la migración.
- `collectFullBackup` carga toda la base en memoria.
- **Modo desarrollador sin salida** salvo "Borrar todo" ([more.tsx](apps/mobile/app/(tabs)/more.tsx)).
- Borradores con `track_inventory = 0`: anulación y devolución usan el valor actual del producto, no el movimiento original. Si algún día se activa el inventario, repondrán stock que nunca se descontó.
- `repos.ts` sigue siendo un archivo de ~1.500 líneas con SQL repetido.
- Textos técnicos y en inglés en errores del servidor sin traducir fuera de los códigos conocidos ([syncErrors.ts](apps/mobile/src/syncErrors.ts)).
- Accesibilidad: sin revisar con fuente al 200 % ni en pantallas pequeñas.

## Tests que faltan

- Parte de escritura de `processReturn` (hoy solo se prueba `assertReturnable`).
- `restoreFromCloud` con un fallo a mitad de la carga.
- `restoreFullBackup` con un respaldo parcial y con claves foráneas rotas.
- Handler completo de `POST /pagos/crear` (400, 401, 503, 201).
- Sync entre dos dispositivos contra el Worker (hoy el Worker se prueba con SQLite en memoria, no con D1 real).
- Concurrencia real de `expo-sqlite` en dispositivo (las pruebas de concurrencia corren en un solo hilo).
- Cámara, `quick_check`, copia previa a migrar y backups automáticos: solo hay pruebas puras, ninguna en dispositivo.

## Build, release y CI

- **Firma de release con la llave debug** (`android/app/debug.keystore`, generada por `prebuild`). Falta la llave de subida y el AAB. Cambiar de llave después obliga a los usuarios a desinstalar.
- [build-android.yml](.github/workflows/build-android.yml) ahora ejecuta `scripts/verify.sh`, `pnpm -r typecheck` y `pnpm test` antes de compilar, y fija las acciones por SHA. **Sin verificar en Actions:** los cambios de caché de Gradle y del job `plan` solo se comprobaron localmente (YAML y lógica de decisión); falta medir el primer build real en `main` y el siguiente build de tag. Sigue usando Node 22 (la CI de tests usa Node 24).
- `pnpm -r typecheck` no cubre `packages/types` (no tiene script `typecheck`).
- Los Workers `payments-worker` y `catalog-worker` no declaran `wrangler`, `typescript` ni `@types/node`; se resuelven por hoisting.
- **Hipótesis, sin verificar:** el manifest no incluye el header `expo-channel-name`, así que un `eas update` al canal `production` podría no llegar al APK compilado con Gradle fuera de EAS.
- `buildArchs` limita a arm64 y armeabi: no instala en emuladores x86_64.
- `runtimeVersion` por fingerprint: cualquier cambio nativo deja huérfano el APK anterior.
- Wrangler 3.114 no funciona detrás del proxy de este equipo; los despliegues se hicieron por la API REST. Actualizar Wrangler o desplegar desde otra red.

## Documentación

- [AGENTS.md](AGENTS.md) apunta a `docs/ui-spec.md`, `docs/core-spec.md` y `docs/sync-spec.md`, que **siguen sin existir** (verificado el 2026-11-05).
- `docs/architecture.md`, `docs/database.md`, `docs/development.md` y `docs/roadmap.md` pueden estar desactualizados.
- Los `README`/`DEPLOY.md` de los Workers deberían describir el despliegue por la API REST y los contratos nuevos de `/sync/register` y `/sync/push` (403 `store_already_claimed`, 413 `payload_too_large` y `too_many_rows`).

## Pruebas manuales en dispositivo real (pendientes)

- Dos teléfonos contra el Worker nuevo, uno vendiendo sin conexión; comprobar P1-2.
- Activar la nube, desactivarla y volver a activarla; vincular un segundo dispositivo con el código.
- Cortar la red durante una descarga de `restoreFromCloud`.
- Migración pendiente con copia previa; base corrupta a propósito; restauración de un respaldo antiguo.
- Cámara: permiso denegado y bloqueado, segundo plano, cambio de pestaña, gama baja.
- Venta con producto sin stock y con borrador; anular dos veces rápido; fiado con abono, anulación y devolución a la cuenta.
- OTA: publicar una actualización al canal y comprobar que llega al APK de CI.
