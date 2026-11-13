# Spec: dominio (`packages/pos-core`, `packages/types`)

## Alcance

Lógica pura de dominio y tipos compartidos. Aplica a `packages/pos-core/` y `packages/types/`.

## Reglas

- Sin dependencias de plataforma. Ningún archivo importa `react`, `react-native`, `expo*`, `zustand` ni SQLite. Hoy `pos-core` solo depende de `@surtivox/types`.
- Sin paso de compilación. Los paquetes exportan sus `.ts` (`"main": "src/index.ts"`). Node (tests) y Metro (app) los consumen directo, por eso los imports relativos llevan la extensión `.ts`.
- Funciones pequeñas, puras y probables por separado. No hay clases con estado.
- Cualquier cambio de lógica de dinero se entrega con un test que se pueda ejecutar.

## Dinero

- El dinero es un entero de unidades menores: `Minor`. Las tasas son enteros en puntos básicos: `Bps` (1 % = 100). Nunca `float`.
- `asMinor` y `asBps` son solo casts: no validan. Quien los llama valida antes.
- Los decimales de la moneda viven en la configuración de la tienda (`CurrencyConfig.decimals`), no en el valor.
- Toda la aritmética pasa por `money.ts`. `roundHalfAwayFromZero` es el único punto de redondeo de la app y solo se aplica donde un porcentaje produce una fracción de unidad menor. No se redondea en ningún otro lugar.
- Convertir a texto o desde texto del usuario se hace con `format`, `fromMajorString` y `toMajorNumber`.

## Módulos de `pos-core`

| Archivo | Responsabilidad |
|---|---|
| `money.ts` | Aritmética de `Minor`/`Bps`, redondeo, conversión y formato |
| `pricing.ts` | Precios, impuestos y descuentos |
| `profit.ts` | Utilidad |
| `csv.ts` | Lectura y escritura de CSV |
| `suggestReorder.ts` | Sugerencia de pedidos |
| `suggest.ts` | Sugerencias de precio y margen |
| `recoveryKit.ts` | Kit de recuperación: 8 palabras = 80 bits de entropía + 8 bits de checksum; deriva el token que se envía al servidor |
| `recoveryWords.ts` | Lista de 2048 palabras del kit |

## Tipos (`@surtivox/types`)

- `Minor`, `Bps`, `Id` (string generado en el borde, nunca autoincremental).
- `SyncFields`: `id, created_at, updated_at, device_id, version`. Toda entidad sincronizable los lleva.
- `SoftDelete`: `deleted_at`. Los maestros se borran de forma lógica; el borrado viaja por sincronización como una actualización de fila.

## Restricciones de compatibilidad

- No cambiar el contenido ni el orden de `recoveryWords.ts` sin un plan: el índice de cada palabra forma parte del kit. Cambiar una palabra invalida los kits que la usan (el servidor no se ve afectado, solo guarda el hash de la llave).
- No cambiar los dominios de hash `surtivox-kit-v1` y `surtivox-shop-v2` de `recoveryKit.ts`: cambian el token que recibe el servidor.

## Pruebas

```bash
cd packages/pos-core && node --test
```

Hay pruebas de `money`, `pricing`, `csv`, `suggestReorder`, `suggest` y `recoveryKit`, y una de fuzz (`test/fuzz.test.ts`). `profit.ts` no tiene un archivo de prueba propio. El gate del repo es `bash scripts/verify.sh` (solo `apps/mobile`) más `pnpm -r typecheck` y `pnpm test`.
