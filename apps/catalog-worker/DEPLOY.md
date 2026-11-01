# Desplegar el catálogo comunitario

## Requisitos

- Cuenta de Cloudflare con Workers y D1.
- Wrangler disponible en el entorno.
- Revisar los límites vigentes del plan gratuito en la documentación de Cloudflare antes de producción.

## Crear la base

```bash
cd apps/catalog-worker
npx wrangler d1 create surtivox-catalog
```

Copia el `database_id` mostrado por Cloudflare y reemplaza `REPLACE_WITH_DATABASE_ID` en `wrangler.toml`.

## Cargar el esquema

```bash
npx wrangler d1 execute surtivox-catalog --remote --file=./schema.sql
```

## Configurar el secreto y el umbral

```bash
npx wrangler secret put CATALOG_SALT
```

`CATALOG_MIN_CONTRIBUTORS` está en `wrangler.toml` y tiene valor piloto `2`.

## Desplegar

```bash
npx wrangler deploy
```

La URL resultante se configura en `apps/mobile/src/catalog.ts` como `CATALOG_URL`.

## Verificar

```bash
curl https://surtivox-catalog.<subdominio>.workers.dev/health
```

No se registran `install_id`, cuerpos de petición ni tokens de sincronización.
