# 00 · Inventario real de datos de Surtivox POS

> **BORRADOR — requiere revisión de abogado colombiano antes de publicarse.**
> Elaborado el 2026-11-06 leyendo el repositorio. Describe lo que el código hace hoy, no lo que los textos legales prometen. No es asesoría jurídica.

Convenciones: las rutas son relativas a la raíz del repo. **NV** = no verificado (no se pudo confirmar con una fuente o con el código). Las interpretaciones se marcan *Interpretación*.

## 1. Resumen en una página

| Hecho | Evidencia |
|---|---|
| Sin conexión, todo vive en SQLite dentro del teléfono; Surtivox no recibe nada. | [apps/mobile/src/legalText.ts:61-63](../../apps/mobile/src/legalText.ts#L61-L63) |
| La app hace **consultas a internet aunque no actives nada**: actualizaciones (Expo), código de barras (Open Food Facts y catálogo de Surtivox) y precios de referencia. | [apps/mobile/app.json:75-79](../../apps/mobile/app.json#L75-L79), [lookup.ts:45](../../apps/mobile/src/pos/lookup.ts#L45), [catalog.ts:73](../../apps/mobile/src/catalog.ts#L73), [marketPrices.ts:121](../../apps/mobile/src/marketPrices.ts#L121) |
| Con el respaldo en la nube, **datos de clientes del tendero (nombre, teléfono, correo, dirección, notas) y su deuda de fiado se envían en claro** al servidor. | [packages/database/src/sync.ts:50-52](../../packages/database/src/sync.ts#L50-L52), `customer_ledger` en la misma lista |
| **No existe ninguna ruta del servidor para borrar datos** de una tienda ni para retirar una contribución al catálogo. | [apps/sync-worker/src/index.ts](../../apps/sync-worker/src/index.ts) (solo `register`, `push`, `pull`, `rotate`), [apps/catalog-worker/src/index.ts:186-192](../../apps/catalog-worker/src/index.ts#L186-L192) |
| "Borrar todos los datos de la app" borra el teléfono y la llave local, **no** el servidor. | [repos.ts:1325-1338](../../apps/mobile/src/repos.ts#L1325-L1338), [more.tsx:64](../../apps/mobile/app/(tabs)/more.tsx#L64) |
| No hay analítica, publicidad ni SDK de telemetría. | Búsqueda de `sentry`, `analytics`, `firebase`, `crashlytics`, `amplitude`, `mixpanel` en `package.json`, `app.json`, `src` y `app`: sin coincidencias de uso real. |
| Permisos de Android: cámara, internet, almacenamiento (solo hasta Android 12), vibración y una superposición. **No hay ubicación, contactos, micrófono ni notificaciones.** | [AndroidManifest.xml:2-8](../../apps/mobile/android/app/src/main/AndroidManifest.xml#L2-L8) |

## 2. Tabla por dato

### 2.1 Datos del negocio (el tendero)

| Dato | Nace en | Se guarda en | Sale del teléfono | A quién | Obligatorio | Conservación | Borrado |
|---|---|---|---|---|---|---|---|
| Nombre, dirección, teléfono, correo, sitio web, NIT/`tax_id`, eslogan, textos de recibo de la tienda | Onboarding y Más → Perfil ([Onboarding.tsx](../../apps/mobile/src/pos/Onboarding.tsx)) | SQLite `stores` | Solo con la nube activa (tabla `stores`) | Cloudflare D1 (`surtivox-sync`) | Solo el nombre | Teléfono: hasta que se borre. Servidor: sin plazo definido | Teléfono: Más → Borrar todos los datos. **Servidor: no existe** |
| Productos, categorías, precios de costo y venta, inventario, movimientos de stock | Pantallas de productos | SQLite | Con la nube activa | D1 | No | Igual que arriba | Igual que arriba |
| Ventas, ítems, pagos (efectivo, tarjeta, Nequi, etc.), devoluciones, compras | Cobro, devoluciones, compras | SQLite | Con la nube activa | D1 | No | Igual | Igual |
| Proveedores (nombre, teléfono, correo, dirección, notas) | Más → Proveedores | SQLite `suppliers` | Con la nube activa | D1 | No | Igual | Igual (`deleted_at` es borrado lógico, no físico) |
| Fotos de productos y logotipo | Cámara o galería ([images.ts:52-68](../../apps/mobile/src/pos/images.ts#L52-L68)) | Archivos en `documentDirectory/products/` y `branding/` ([images.ts:6-7](../../apps/mobile/src/pos/images.ts#L6-L7)) | **No.** `image_uri` está marcada como solo local ([sync.ts:54](../../packages/database/src/sync.ts#L54)) | Nadie | No | Hasta que se desinstale la app o se borren | "Borrar todos los datos" **no** borra los archivos de imagen (*Interpretación*, `resetAllData` solo ejecuta `DELETE` en SQLite) |

### 2.2 Datos de terceros que registra el tendero

| Dato | Nace en | Se guarda en | Sale | A quién | En claro | Conservación | Borrado |
|---|---|---|---|---|---|---|---|
| **Clientes**: nombre, teléfono, correo, dirección, notas | Más → Clientes, Cobro con fiado ([add-customer.tsx](../../apps/mobile/app/add-customer.tsx)) | SQLite `customers` | Con la nube activa | D1 | **Sí**, en claro | Sin plazo | Teléfono: borrado lógico por cliente y borrado total. Servidor: no existe |
| **Fiados y abonos** (`customer_ledger`: tipo, monto, nota) y saldo | Cobro con fiado, abonos | SQLite | Con la nube activa | D1 | **Sí** | Sin plazo | Igual |
| **Personal**: nombre, rol, `pin_salt`, `pin_hash` | Más → Personal y roles | SQLite `staff` | Con la nube activa (la huella del PIN también viaja) | D1 | Nombre y rol en claro; PIN solo como huella | Sin plazo | Igual |

*Interpretación:* los clientes del tendero y su deuda son datos personales de terceros que no aceptaron ningún aviso de Surtivox; el tendero decide cuáles registra. Ver preguntas 3 y 4 de [91-preguntas-para-el-abogado.md](91-preguntas-para-el-abogado.md).

### 2.3 Respaldo en la nube (opcional)

- **Qué sube:** las 15 tablas de `SYNC_TABLES` ([packages/database/src/sync.ts:32-92](../../packages/database/src/sync.ts#L32-L92)): `stores`, `categories`, `suppliers`, `staff`, `customers`, `products` (sin `image_uri`), `sales`, `sale_items`, `payments`, `stock_movements`, `customer_ledger`, `returns`, `return_items`, `purchases` y `purchase_items`.
- **Cuándo:** manualmente ("Sincronizar ahora") y al activar ([sync.ts](../../apps/mobile/src/sync.ts), `syncNow`). No hay sincronización en segundo plano.
- **Límites por envío:** 500 filas y 1.000.000 de bytes por push ([sync.ts:183](../../packages/database/src/sync.ts#L183)); la app sube por lotes.
- **Autenticación:** el teléfono envía `T = SHA-256("surtivox-shop-v2" ‖ E)` como token; el servidor guarda solo `H = SHA-256(T)` en `shop_keys` (migración [0001_shop_keys.sql](../../apps/sync-worker/migrations/0001_shop_keys.sql)). Las 8 palabras del kit y `E` **nunca salen del teléfono** ([kitOps.ts](../../apps/mobile/src/kitOps.ts)).
- **Qué más guarda el servidor:** `kit_attempts(bucket='ip:<IP>', failures, window_start, blocked_until)` con la **dirección IP** de quien falla la autenticación. **No hay limpieza de esa tabla** (hallazgo; ver brecha B7).
- **Tránsito:** HTTPS (`DEFAULT_SYNC_URL`, [sync.ts:34](../../apps/mobile/src/sync.ts#L34)). Cifrado en reposo en D1: **NV** (no se consultó documentación de Cloudflare sobre D1).
- **No está cifrado de extremo a extremo:** el servidor recibe los datos en claro (por diseño, para poder sincronizar).
- **Retención y borrado en servidor:** ninguno. "Desactivar respaldo" solo pone `server_url = NULL` ([syncState.ts](../../apps/mobile/src/syncState.ts)); los datos siguen en D1.
- **Observabilidad:** `[observability] enabled = true` en [apps/sync-worker/wrangler.toml:13](../../apps/sync-worker/wrangler.toml#L13) y [apps/catalog-worker/wrangler.toml:14](../../apps/catalog-worker/wrangler.toml#L14). Qué registra Cloudflare (IP, rutas, cabeceras) y por cuánto tiempo: **NV**.

### 2.4 Catálogo comunitario (opt-in)

| Aspecto | Realidad en el código |
|---|---|
| Consentimiento | Pregunta en el primer arranque y en [UnknownBarcodeSheet.tsx:139-160](../../apps/mobile/src/pos/UnknownBarcodeSheet.tsx#L139-L160); interruptor en Más → Privacidad ([more.tsx:242-245](../../apps/mobile/app/(tabs)/more.tsx#L242-L245)). Clave `catalog_opt_in` (`'1'`/`'0'`). Nunca preseleccionado. |
| Qué se envía | `install_id` (UUID aleatorio de la instalación, [catalog.ts:34](../../apps/mobile/src/catalog.ts#L34)), y por ítem: código de barras, nombre y presentación ([catalog.ts:143-160](../../apps/mobile/src/catalog.ts#L143-L160)). Hasta 20 ítems por envío. |
| Identificador pseudónimo | `contributor_hash = SHA-256(CATALOG_SALT + install_id)` ([catalog-worker index.ts:69-73](../../apps/catalog-worker/src/index.ts#L69-L73)). Lo que se guarda es el hash, no el `install_id`. |
| Qué conserva el servidor | `catalog_votes` (código, nombre normalizado, nombre visible, presentación, hash, fecha), `catalog_products` (ganador por consenso), `contribution_limits` (hash, día, conteo). |
| Consenso | `CATALOG_MIN_CONTRIBUTORS = "2"` ([wrangler.toml:7](../../apps/catalog-worker/wrangler.toml#L7)): un producto se publica cuando 2 aportantes distintos coinciden. |
| Cola de envío | `catalog_outbox` local, con reintentos y espera creciente ([catalogCore.ts](../../apps/mobile/src/catalogCore.ts)). |
| Limpieza | Un cron diario (`17 3 * * *`) borra de `contribution_limits` los días anteriores a 7 días ([index.ts:181-196](../../apps/catalog-worker/src/index.ts#L181-L196)). **No limpia `catalog_votes` ni `catalog_products`.** Que el cron esté activo en producción: **NV**. |
| Retiro | El interruptor solo detiene envíos futuros. **No existe retiro de contribuciones ya enviadas** (no hay ruta de borrado; el hash es irreversible para Surtivox sin el `install_id`). |
| Consulta | `GET /catalog/lookup?code=`: solo el código y la IP de la conexión llegan a Surtivox. Caché local de 30 días si se encontró, 3 si no ([catalogCore.ts:1-2](../../apps/mobile/src/catalogCore.ts#L1-L2)). La consulta ocurre aunque el usuario no haya aceptado participar. |

### 2.5 Consultas de código de barras y precios de referencia

| Servicio | Llamada | Datos | Cuándo | Dato del usuario que ve el tercero |
|---|---|---|---|---|
| Open Food Facts | `GET https://world.openfoodfacts.org/api/v2/product/<código>.json` con `User-Agent: SurtivoxPOS/1.0` ([lookup.ts:45-49](../../apps/mobile/src/pos/lookup.ts#L45-L49)) | Código de barras | Al escanear un código desconocido | IP del teléfono. País del servicio: operador es una asociación francesa; alojamiento en Francia según su página `/legal` (abierta el 2026-11-06). Política `/privacy` no abierta: **NV** qué registra. |
| Catálogo de Surtivox | `GET /catalog/lookup` | Código | Igual | IP |
| Precios de referencia | `GET …/market-prices?ean=` ([marketPrices.ts:121-126](../../apps/mobile/src/marketPrices.ts#L121-L126)) a `surtivox-market.surtivox.workers.dev`, que consulta a Éxito, Jumbo y Olímpica ([sync-worker marketPrices.ts:45-49](../../apps/sync-worker/src/marketPrices.ts#L45-L49)) | Solo el EAN. **No se envía ciudad ni ubicación.** | Al pedir precios | A Surtivox: IP. A los supermercados: solo el EAN, desde Cloudflare (no ven al usuario). |
| Límite de uso del Worker de precios | En memoria, por IP ([marketPrices.ts:167-177](../../apps/sync-worker/src/marketPrices.ts#L167-L177)) | IP | Cada petición | No se persiste. |

### 2.6 Permisos de Android

| Permiso | Para qué se usa realmente |
|---|---|
| `CAMERA` | Escanear códigos de barras y tomar fotos de productos ([app.json:18-20](../../apps/mobile/app.json#L18-L20)) |
| `READ_/WRITE_EXTERNAL_STORAGE` (máx. API 32) | Selector de fotos/archivos de copia; limitado a Android 12 o menor |
| `INTERNET` | Las consultas de las secciones 2.3 a 2.5 |
| `VIBRATE`, `SYSTEM_ALERT_WINDOW` | Vibración al escanear; superposición declarada por una dependencia (*Interpretación*: no se encontró uso propio; confirmar). |
| Sin ubicación, contactos, micrófono (`RECORD_AUDIO` removido), notificaciones | — |

### 2.7 Registro de errores, diagnósticos, telemetría

- **Último error** y **diagnóstico**: se guardan **solo en el teléfono** (`local_settings`, claves `last_error`) y se muestran en Más → Diagnóstico ([diagnostics.ts](../../apps/mobile/src/diagnostics.ts)). No se envían automáticamente. El usuario puede compartirlos manualmente.
- **Redactor de secretos:** oculta llaves hexadecimales largas, `Bearer …`, códigos heredados de 16 caracteres y 3 o más palabras consecutivas del kit ([redact.ts](../../apps/mobile/src/redact.ts)).
- **Telemetría remota:** ninguna.

### 2.8 Compras y suscripción

- Dependencia `expo-iap` y SKU `cloud_sync_monthly` ([subscription.ts:21](../../apps/mobile/src/subscription.ts#L21)). Google Play procesa el pago; la app solo ve el estado de la compra.
- **En la beta no se cobra:** el respaldo en la nube está abierto a todos ([DEUDA_TECNICA.md](../../DEUDA_TECNICA.md), "Decisiones tomadas para la beta"). El Worker de pagos **no está desplegado**. `CHECKOUT_ENDPOINT` está vacío ([payments.ts:4](../../apps/mobile/src/payments.ts#L4)).
- Datos personales que ve la app de Google Play: ninguno propio; qué ve Google: **NV** (depende de la ficha de la tienda y de la cuenta de pago).

### 2.9 Actualizaciones

- `expo-updates` con `checkAutomatically: "ON_LOAD"` y URL `https://u.expo.dev/<id>` ([app.json:75-79](../../apps/mobile/app.json#L75-L79)): al abrir la app consulta a Expo si hay JS nuevo.
- Expo documenta que para actualizaciones recoge el sistema operativo y tokens aleatorios, que puede procesar datos en Estados Unidos y que usa DPF y cláusulas tipo ([https://expo.dev/privacy](https://expo.dev/privacy), abierta el 2026-11-06; fecha de la política: 2026-11-02).
- GitHub Releases: solo si el usuario descarga el APK desde allí (la app no consulta GitHub). Qué registra GitHub: **NV**.

### 2.10 Respaldo automático de Android

- `android:allowBackup="true"` ([AndroidManifest.xml:16](../../apps/mobile/android/app/src/main/AndroidManifest.xml#L16)) y no hay `dataExtractionRules` ni `fullBackupContent`. *Interpretación:* en teléfonos con copias a Google activadas, la base SQLite completa (clientes, fiados, token de la nube y la entropía del kit en `local_settings`) puede copiarse a la cuenta de Google del usuario. Esto está registrado como deuda de seguridad ([DEUDA_TECNICA.md](../../DEUDA_TECNICA.md)).

### 2.11 Fotos y logotipo

Ver 2.1. No viajan a la nube; se pierden al desinstalar y no se incluyen en las copias JSON.

### 2.12 Copias de seguridad que genera el usuario

- JSON completo con tablas locales (excluye `sync_state`, `catalog_*` y las claves del kit; [backupFilters.ts](../../apps/mobile/src/backupFilters.ts)). Contiene clientes, fiados, personal y huellas de PIN. Lo guarda el usuario donde elija; Surtivox no lo recibe.
- CSV de productos y ventas.

### 2.13 Aceptación de términos

- `legal_accepted_version` y `legal_accepted_at` en `local_settings` ([legal.ts:7-12,45-49](../../apps/mobile/src/legal.ts#L7-L12)); versión actual `2026-11-04`. **Solo vive en el teléfono**: Surtivox no tiene copia de la prueba de aceptación.

## 3. Terceros que tratan datos

| Tercero | Para qué | Qué datos | País del servicio |
|---|---|---|---|
| Cloudflare (Workers, D1) | Respaldo, catálogo, precios | Todo lo de 2.3 y 2.4, IP | La ubicación de D1 y de los centros de datos **no está en el DPA**. El DPA v6.4 (3 abril 2026) menciona sede en San Francisco, EE. UU., y tratamiento posible fuera del EEE sin listar países; centros "geográficamente distribuidos" ([https://www.cloudflare.com/cloudflare-customer-dpa/](https://www.cloudflare.com/cloudflare-customer-dpa/), abierta 2026-11-06). **Región de D1: NV.** R2: **no se usa** hoy. |
| Expo (EAS Update) | Actualizaciones de JavaScript | SO, tokens aleatorios, IP | EE. UU. mencionado ([expo.dev/privacy](https://expo.dev/privacy)). Países concretos: NV. |
| Google (Play Billing, copia de Android, Play Store) | Compra, distribución, copia automática | Estado de compra; copia de la base si el usuario la activa | **NV** |
| GitHub | Distribución del APK | IP del que descarga | **NV** |
| Open Food Facts | Consulta de código de barras | Código, IP | Francia (alojamiento), según `/legal` |
| Éxito, Jumbo, Olímpica (VTEX) | Precios de referencia | Solo el EAN, desde Cloudflare | **NV** |
