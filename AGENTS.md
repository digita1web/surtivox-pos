# AGENTS.md

## Enrutamiento

| Ruta | Spec |
|---|---|
| `apps/mobile/app/` | `docs/ui-spec.md` |
| `apps/mobile/src/pos/` | `docs/ui-spec.md` |
| `packages/pos-core/` | `docs/core-spec.md` |
| `packages/types/` | `docs/core-spec.md` |
| `apps/sync-worker/` | `docs/sync-spec.md` |

## Reglas estrictas

- 0 comentarios en código salvo algoritmo no obvio.
- No tocar `node_modules/`.
- No renombrar `package.json` ni `pnpm-lock.yaml`.
- No instalar dependencias sin aprobación.
- Dependencia autorizada: `expo-splash-screen` (aprobada para el splash nativo).
- Dependencia autorizada: `expo-image-manipulator` (aprobada para comprimir fotos de productos).
- No hacer push.

## Verificación

Antes de cada commit ejecutar `bash scripts/verify.sh` y pegar la salida cruda. Si falla, no commitear.

## Prohibido

- Force push.
- Tocar `apps/mobile/LICENSE` (licencia MIT de Expo).
- Tocar `LICENSES/MIT_LICENSE.txt` (aviso MIT original de OpenPocket POS).

El `LICENSE` de la raíz (licencia propietaria) sí puede modificarse.
