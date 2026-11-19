# Spec: sincronización (`apps/sync-worker`)

## Alcance

Worker de Cloudflare con D1 que reconcilia las tiendas entre dispositivos. La base SQLite del teléfono sigue siendo la fuente de verdad. Aplica a `apps/sync-worker/`. La lógica de tablas sincronizables está en `packages/database/src/sync.ts` y la comparten la app y el Worker. Los Workers `catalog-worker` y `payments-worker` tienen su propio README y no los cubre este spec.

## Endpoints

| Método | Ruta | Auth | Función |
|---|---|---|---|
| GET | `/` y `/health` | no | estado |
| GET | `/market-prices?ean=` | no | precios de referencia VTEX (no usa el token) |
| POST | `/sync/register` | Bearer | vincula un token a una tienda; idempotente |
| POST | `/sync/rotate` | Bearer | cambia la llave de la tienda (`{ newToken }`, 64 hex) |
| POST | `/sync/push` | Bearer | sube filas cambiadas de la tienda del token |
| GET | `/sync/pull?since=<ms>` | Bearer | baja las filas de la tienda cambiadas después del cursor |

CORS responde `*` con métodos `GET, POST, OPTIONS`.

## Autenticación

- Un token corresponde a una sola tienda. Un dispositivo solo lee y escribe filas de su tienda.
- El servidor guarda solo el hash: `shop_keys(store_id, key_hash, created_at, rotated_at)`, con `key_hash = SHA-256(token)`.
- `sync_tokens` es la tabla heredada con tokens en claro. Al primer uso de un token legado se copia hasheado a `shop_keys` y se borra de `sync_tokens`.
- `store_id` válido: `^[A-Za-z0-9_-]{1,128}$`. Longitud del token: de 12 a 256 caracteres.
- Un `store_id` ya reclamado no se puede reclamar con otro token (`403 store_already_claimed`). Un token ya ligado a otra tienda devuelve `409`.
- Intentos fallidos por IP (`CF-Connecting-IP`) en `kit_attempts`: 5 fallos libres por ventana de 10 minutos; luego un bloqueo de 60 s que se duplica hasta 1 h. Responde `429` con `Retry-After`. Los éxitos no escriben.
- Los roles (propietario, administrador, cajero) no existen en el servidor: se aplican solo en la app.

## Modelo de datos y conflictos

`SYNC_TABLES` está ordenada padres antes que hijos: `stores, categories, suppliers, staff, customers, products, sales, sale_items, payments, stock_movements, customer_ledger, returns, return_items, purchases, purchase_items`.

- Modo `mutable`: gana el último que escribe, por `updated_at` y luego `version`.
- Modo `append`: se inserta solo si no existe (`ON CONFLICT(id) DO NOTHING`); una repetición no hace nada.
- Alcance: `self` (stores), `column` (`store_id` propio) o `parent` (a través de la fila padre). En el servidor, una fila hija solo se inserta si su padre pertenece a la tienda que sube, y una fila mutable solo se sobrescribe si el `store_id` guardado coincide.
- Los borrados son lógicos (`deleted_at`) y viajan como actualizaciones.
- Columnas solo locales (por ejemplo `products.image_uri`) se envían siempre como `NULL`.
- Los cursores `last_pushed_at` y `last_pulled_at` viven en `sync_state` en el teléfono y conservan 30 s de solapamiento. Restaurar un respaldo local los reinicia a 0 (`restoreOps.ts`).

## Versión de esquema

- `SYNC_SCHEMA_VERSION` (hoy 2) vive en `packages/database/src/sync.ts`. `/health` la publica como `schemaVersion`; un Worker sin ese campo cuenta como 1.
- Antes de cada sincronización la app consulta `/health` y no envía nada si el servidor tiene una versión menor: un Worker viejo descartaría las tablas que no conoce mientras el cursor de push avanza.
- `sync_state.synced_schema` (local) guarda hasta qué versión se sincronizó el teléfono. Si es menor que la actual, tras el pull normal se piden una sola vez desde cero las tablas nuevas con `/sync/pull?since=0&tables=a,b`, porque el cursor único de pull ya pasó de largo esas filas.
- Las APK viejas ignoran en el pull las tablas que no conocen.
- Orden de despliegue: migración de D1, Worker, APK.

## Límites de push

- Por solicitud: 500 filas y 1 000 000 bytes (`PUSH_LIMITS`), con `413` si se pasa.
- La app divide en lotes de hasta 200 filas y 300 000 bytes (`PUSH_BATCH`).

## Reglas de cambio

- Una tabla nueva sincronizable se agrega a `SYNC_TABLES` en `packages/database` y lleva migración nueva. No se editan migraciones existentes.
- El esquema del servidor está en `schema.sql` (idempotente). Las tablas nuevas de un despliegue llevan además un archivo en `migrations/` (hoy `0001_shop_keys.sql` y `0002_stock_counts.sql`), que se aplica antes de desplegar el Worker.
- Una tabla sincronizable nueva lleva `addedIn` con la versión en que entró y sube `SYNC_SCHEMA_VERSION`.
- Cambiar el contrato de un endpoint exige desplegar el Worker antes de publicar la app que lo usa.
- Nunca se registran tokens ni llaves en logs ni en mensajes de error.

## Tope diario y paginación

- **Qué se cuenta:** las filas que D1 escribió de verdad (`meta.rows_written` de cada sentencia del `batch`, que incluye los índices). Reenviar filas que el servidor ya tenía no gasta cupo. Si D1 no informa `rows_written`, se estiman 2 por fila cambiada. El uso se guarda en `store_usage` por día UTC: una fila por tienda y una con `store_id = '*'` para el total (el registro rechaza `*` como id de tienda).
- **Antes de aplicar** se estima `filas enviadas × 2` y se comprueba primero el tope de la tienda y después el general. Si cualquiera se pasaría, responde `429` con `retry-after` hasta la medianoche UTC y no aplica nada:
  - **Tope por tienda:** `QUOTA_DAILY_ROWS` (10.000 escritas por defecto, unas 5.000 filas enviadas; `0` lo desactiva) → `{"error":"quota_exceeded","scope":"store","limit","used"}`.
  - **Interruptor general:** `QUOTA_GLOBAL_ROWS` (85.000 por defecto, el 85 % de las 100.000 escrituras diarias del plan gratis de D1; `0` lo desactiva, por ejemplo con el plan pagado) → `{"error":"quota_exceeded","scope":"cloud"}`, sin revelar el uso de otras tiendas. El 15 % restante queda de reserva para registros, kits de recuperación y lo que no pasa por el push.
- La app muestra un mensaje para cada caso, distinto del de demasiados intentos. Las APK sin el mensaje nuevo muestran el de la tienda, que también dice que los datos están a salvo. Si la tabla `store_usage` no existe, no se bloquea a nadie.
- **Todo o nada:** todas las filas de un push van en un solo `batch`, que D1 aplica como una transacción y cuenta como una sola consulta. Si una sentencia falla, no queda nada aplicado ni se cobra cupo.
- **Pull paginado, solo si se pide:** con `limit` (máximo `PULL_MAX_PAGE`, 5.000 por defecto) el Worker recorre las tablas en orden y corta por `(tiempo, id)`; responde `more` y `next` (`tabla|tiempo|id`), que se envía como `after` en la página siguiente. Así no se pierden ni repiten filas aunque muchas compartan el mismo milisegundo. La app nueva pide páginas de 2.000 y aplica todo al final. Sin `limit` la respuesta es la de siempre: las APK anteriores no cambian.
- Orden de despliegue: aplicar `migrations/0003_store_usage.sql` y después desplegar el Worker (aunque sin la tabla el Worker no bloquea).

## No implementado

- No hay límite de filas totales por tienda, solo el diario. Un lote rechazado por el tope se reenvía completo al día siguiente.
- No hay verificación de suscripción ni consulta de `entitlements` en este Worker.
- `/sync/pull` sin `limit` (APK anteriores) sigue devolviendo todo en una sola respuesta.

## Pruebas

```bash
pnpm --filter @surtivox/database test
pnpm --filter ./apps/sync-worker test
```
