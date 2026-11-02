# surtivox-pagos

Worker de pagos para la suscripción de respaldo en la nube de Surtivox POS.

## Fase 1

- `POST /pagos/crear`.
- Recibe `store_id` y `token`.
- Valida que el token pertenezca a la tienda en la tabla `sync_tokens` de la D1 de sincronización.
- Fija el monto en 2.000.000 centavos COP: 20.000 COP.
- Fija la duración en 30 días.
- Crea una referencia única `SVX-...`.
- Guarda una intención pendiente en `payment_intents`.
- Genera la firma SHA-256 con el orden `referencia + monto_en_centavos + moneda + secreto`.
- Devuelve la URL de Checkout de Wompi.

Ejemplo de respuesta:

```json
{
  "reference": "SVX-1760000000000-ABCD1234",
  "url": "https://checkout.wompi.co/p/?public-key=...&reference=...&signature%3Aintegrity=..."
}
```

## D1

Este Worker reutiliza la misma base D1 del Worker de sincronización porque necesita validar `sync_tokens`. No crees una base separada para esta fase.

1. Copia el `database_id` real de `surtivox-production` en `wrangler.toml`.
2. Aplica el esquema de pagos sobre esa base:

```bash
pnpm db:schema
```

## Secretos

Configura los secretos con Wrangler. No deben escribirse en el repositorio, en `wrangler.toml` ni en mensajes de commit.

```bash
pnpm exec wrangler secret put WOMPI_PUBLIC_KEY
pnpm exec wrangler secret put WOMPI_PRIVATE_KEY
pnpm exec wrangler secret put WOMPI_INTEGRITY_SECRET
pnpm exec wrangler secret put WOMPI_EVENTS_SECRET
```

- `WOMPI_PUBLIC_KEY`: llave pública usada en la URL de Checkout.
- `WOMPI_PRIVATE_KEY`: llave privada para operaciones futuras del servidor.
- `WOMPI_INTEGRITY_SECRET`: secreto usado para calcular la firma de integridad.
- `WOMPI_EVENTS_SECRET`: secreto reservado para validar los webhooks.

## Pendiente para siguientes fases

- Webhook de Wompi y validación de su checksum.
- Activación de `entitlements` tras un pago aprobado.
- Reintentos e idempotencia de eventos.
- Validación de la suscripción en el Worker de sincronización.
