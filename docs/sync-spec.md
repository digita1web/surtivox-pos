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

## Límites de push

- Por solicitud: 500 filas y 1 000 000 bytes (`PUSH_LIMITS`), con `413` si se pasa.
- La app divide en lotes de hasta 200 filas y 300 000 bytes (`PUSH_BATCH`).

## Reglas de cambio

- Una tabla nueva sincronizable se agrega a `SYNC_TABLES` en `packages/database` y lleva migración nueva. No se editan migraciones existentes.
- El esquema del servidor está en `schema.sql` (idempotente). Las tablas nuevas de un despliegue llevan además un archivo en `migrations/` (hoy `0001_shop_keys.sql`), que se aplica antes de desplegar el Worker.
- Cambiar el contrato de un endpoint exige desplegar el Worker antes de publicar la app que lo usa.
- Nunca se registran tokens ni llaves en logs ni en mensajes de error.

## No implementado

- No hay cuota de filas por tienda ni límite de registros exitosos.
- No hay verificación de suscripción ni consulta de `entitlements` en este Worker.
- `/sync/pull` devuelve todas las filas posteriores al cursor en una sola respuesta, sin paginación.

## Pruebas

```bash
pnpm --filter @surtivox/database test
pnpm --filter ./apps/sync-worker test
```
