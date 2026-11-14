# Spec: app móvil (`apps/mobile/app/`, `apps/mobile/src/pos/`)

## Alcance

Pantallas (Expo Router en `app/`), componentes del punto de venta (`src/pos/`) y la lógica de aplicación de `src/` que las sirve. La lógica de dominio vive en `packages/pos-core` (ver `core-spec.md`) y la sincronización en `apps/sync-worker` (ver `sync-spec.md`).

## Estructura

- Pestañas (`app/(tabs)/`): Inicio, Productos, Nueva venta, Ventas, Más. El resto son rutas sueltas en `app/`, más `app/customer/` y `app/sale/`.
- `src/repos.ts` concentra las consultas SQL. Las operaciones con varias escrituras viven en módulos `*Ops.ts` (`saleOps`, `checkoutOps`, `returnOps`, `staffOps`, `kitOps`, `recoveryOps`, `reportOps`, `restoreOps`).
- Los `*Ops.ts` reciben la base como parámetro (`Pick<SQLiteDatabase, ...>`), no llaman a `getDb()`. Así se prueban con `node:sqlite` y las migraciones reales, sin Expo.
- Toda operación que escribe en más de una tabla va dentro de `withTransactionAsync`.

## Estado

- El carrito y el cobro (`CartBar`, `CheckoutSheet`) viven en el layout de pestañas: una venta puede completarse o anularse con cualquier pestaña enfocada. Una pantalla de pestaña que liste ventas o stock debe leer `salesVersion` de `useCheckoutUI` y ponerlo entre las dependencias de su `useFocusEffect` (Inicio, Productos y Ventas lo hacen; lo vigila `salesRefreshWiring.test.ts`).

- SQLite es la fuente de verdad. Zustand solo guarda estado efímero de interfaz (`cart.ts`, `session.ts`, `productWizardStore.ts`); nunca datos durables del negocio.
- Los reportes consultan la base, no el estado en memoria.
- El stock se deriva de `stock_movements`; no existe una columna de stock editable.
- Los productos con `track_inventory = 0` no mueven stock. Decídelo con `tracksInventory` (`src/pos/stockPolicy.ts`), no con comparaciones sueltas.

## Dinero y texto

- El dinero se muestra con `format` de `pos-core`, nunca con formato a mano ni con `float`. La moneda por defecto es COP con 0 decimales (`APP_CURRENCY`).
- Todo texto visible al usuario va en español y no expone términos técnicos ni mensajes crudos de error (URL, token, nombres de tablas).
- Los controles interactivos llevan `accessibilityLabel` o `accessibilityRole` cuando el texto no basta.

## Permisos

- Roles: propietario, administrador, cajero (`src/roles.ts`). Vender está permitido a todos; el resto se controla por capacidad (`can(role, capability)`).
- `src/routeAccess.ts` mapea rutas a capacidades y `app/_layout.tsx` redirige a Inicio si el rol no la tiene.
- Este control es solo de interfaz: el servidor no conoce roles.

## Nube y suscripción

- "Nube activa" se decide con `sync_state` mediante `useCloudConnected` (`src/useCloudConnected.ts`). Inicio, Más y Respaldo en la nube usan la misma fuente. Una pantalla nueva no decide el estado de la nube por su cuenta.
- `src/subscription.ts` (`expo-iap`) y `app/paywall.tsx` son código heredado. Ninguna pantalla activa debe importar `subscription.ts` (lo vigila `cloudStatusWiring.test.ts`).
- `startSubscriptionPayment` (`src/payments.ts`) aún no tiene llamadores: el cobro con Wompi no está conectado a la app.
- El modo desarrollador se activa con 7 toques sobre la versión en Más y se desactiva tocándola de nuevo (`src/developerMode.ts`). Solo controla la configuración técnica de servidor.

## Respaldo local

- `restoreOps.applyBackupOn` reemplaza los datos dentro de una transacción y reinicia los cursores de sincronización. `restoreFullBackup` crea antes una copia en `safety/` y no restaura si esa copia falla.
- Al iniciar, `initDatabase` copia la base antes de migraciones pendientes y corre `PRAGMA quick_check(1)` como máximo una vez cada 24 horas.

## Cámara

`src/pos/cameraMachine.ts` define las fases `idle`, `starting`, `ready`, `retrying`, `failed`, `denied` y `blocked`. La cámara se libera al perder el foco o pasar a segundo plano. `ScannerCamera.tsx` aplica esa máquina y es el único componente que usa `CameraView` o `useCameraPermissions`; lo vigila `src/pos/cameraWiring.test.ts`. Lo usan `app/scan.tsx` (escáner de ventas) y `ScanModal.tsx` (lectura de un solo código, abierto desde `app/(tabs)/products.tsx` y `app/add-product.tsx`). Una pantalla nueva con cámara debe usar `ScannerCamera`.

## Pruebas

- `bash scripts/verify.sh` corre el typecheck y los tests de `apps/mobile`. Se ejecuta antes de cada commit.
- Los tests de lógica usan `node:sqlite` con las migraciones reales. Los tests de "wiring" (`*Wiring.test.ts`) leen el código fuente de las pantallas para fijar contratos entre ellas.
- No hay pruebas de renderizado de componentes: los cambios de interfaz se validan además en un dispositivo.
- Sin comentarios en el código, salvo para un algoritmo no obvio.
