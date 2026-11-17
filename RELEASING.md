# Publicar Surtivox POS en Android

## Estado actual

El workflow `.github/workflows/build-android.yml` compila un APK de release con `./gradlew assembleRelease` y lo adjunta a un GitHub Release cuando se empuja un tag que empieza por `v`.

La firma de producción se inyecta en CI. Tras `expo prebuild`, el paso "Configurar firma de release" decodifica la llave desde los secretos y ejecuta `scripts/patch-android-signing.mjs`, que cambia la variante `release` de `apps/mobile/android/app/build.gradle` para leer la llave del entorno (lógica en `apps/mobile/src/androidSigning.ts`, con test). Después de compilar, "Verificar la firma del APK" ejecuta `apksigner` y muestra la huella del certificado.

- **Cualquier compilación (tag, `main` o manual):** el workflow falla en rojo si falta alguno de los cuatro secretos, si la llave no abre, si el parche no queda aplicado en `build.gradle`, si el APK sale con el certificado debug o si la huella del certificado no es la de producción (`EXPECTED_SHA256` en el paso "Verificar la firma del APK"). Si se rota la llave, hay que actualizar esa huella.

## Llave de subida

La llave debe crearse y custodiarse fuera del repositorio. Un ejemplo de creación es:

```bash
keytool -genkeypair -v \
  -storetype PKCS12 \
  -keystore surtivox-upload.keystore \
  -alias surtivox \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

No ejecutes este comando dentro del repositorio ni subas el archivo `.keystore` a Git. Guarda una copia segura de la llave y de sus contraseñas; perderlas impide publicar actualizaciones con la misma identidad.

## Secretos de GitHub

Cuando exista una configuración de firma, la llave y sus datos deben guardarse como secretos del repositorio o del environment de GitHub. Nombres recomendados:

- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

El contenido binario de la llave debe codificarse en base64 antes de guardarlo en el secreto. Los valores de las contraseñas no deben escribirse en el workflow, en la documentación ni en el historial de Git.

Las cuatro variables ya las lee el workflow. Hace falta cargarlas en GitHub (Settings, Secrets and variables, Actions) a partir de los archivos de la llave.

## Cambio de llave y datos de los usuarios

Los APK instalados hasta ahora (v1.0.3 y anteriores) están firmados con la llave debug. Android no permite actualizar una app con otra firma: hay que **desinstalar e instalar de nuevo**, y la base SQLite local se pierde. Antes de distribuir el primer APK con la llave de producción, cada usuario debe exportar una copia (Más, Datos) o tener la nube activa, y luego restaurar.

Después de ese cambio, la llave no puede volver a cambiarse sin repetir el proceso.

## Play Store

Google Play requiere un Android App Bundle (`.aab`), no el APK universal. La tarea pendiente es:

```bash
cd apps/mobile/android
./gradlew bundleRelease
```

El AAB solo debe generarse cuando exista una llave de subida propia y una configuración de firma revisada. Hasta entonces, el workflow sigue publicando el APK de release actual.

## Actualizaciones OTA y huella nativa

Desde la 1.1.8 la app puede recibir cambios de JavaScript sin instalar un APK nuevo (EAS Update). Al abrirla con internet, la app descarga la actualización en segundo plano y la aplica la siguiente vez que se abre desde cero. Las versiones 1.1.6 y anteriores **no** reciben OTA: no llevan canal. La 1.1.7 nunca se publicó: su build de tag falló en la firma por un cambio en la plantilla de Expo (detalle en `DEUDA_TECNICA.md`).

### Qué puede ir por OTA y qué no

`app.json` usa `runtimeVersion` con la política `fingerprint`: la huella resume todo lo nativo. Una OTA solo llega a los APK que tienen **exactamente la misma huella**. Comprobado el 2026-11-16 con `expo-updates fingerprint:generate`:

- **No cambian la huella:** cambios en `src/`, `app/`, textos, estilos o lógica en TypeScript. Eso va por OTA.
- **Sí la cambian:** agregar o quitar dependencias con código nativo, plugins, permisos, el ícono o el splash, **`version` y `versionCode` de `app.json`**, y el canal. Eso necesita un APK nuevo con su tag.

Por eso una OTA se publica **sin** subir la versión de `app.json`. La versión que muestra la app es la del APK.

### Canales

| Canal | Lo escuchan | De dónde sale |
|---|---|---|
| `production` | El APK de la release (el que descargan las tiendas) | Workflow de tag `v*` |
| `preview` | APK de `main` o compilados a mano (artefacto de Actions) | Cualquier build que no sea de tag |

`app.json` versionado trae `preview`. El paso "Fijar el canal de actualizaciones" (`scripts/set-update-channel.mjs`) lo cambia a `production` solo en los tags. Así, un build o un `eas update` hecho a mano desde un computador nunca cae en los teléfonos de las tiendas.

El build calcula la huella antes del prebuild, compila, y después **comprueba que la huella y el canal que quedaron dentro del APK** (`assets/fingerprint` y `assets/app.config`) sean los calculados. Si no coinciden, falla. La release publica `runtime-android.json` junto a `Surtivox.apk` y el resumen del job muestra canal y huella.

### Publicar una OTA

Requisito único: el secreto `EXPO_TOKEN` en GitHub (Settings → Secrets and variables → Actions), un token de acceso de la cuenta de Expo dueña del proyecto `e9fd4450-…`. Nunca se pega en el chat ni en el repo.

1. Con el cambio ya en una rama, ve a **Actions → Publicar actualización OTA → Run workflow**, elige la rama, `preview`, `publicar` y escribe qué cambia.
2. En un teléfono con un APK de `preview` de la **misma huella** (compara la huella del resumen de ambos workflows), cierra y abre la app dos veces y prueba el cambio.
3. Con el cambio en `main`, repite con `production`. El workflow:
   - exige que la corrida sea de `main`;
   - pasa el gate completo (`verify.sh`, typecheck y tests);
   - calcula la huella y la compara con `runtime-android.json` de la última release. Si no coincide, se detiene y dice que hace falta un APK nuevo.

`eas-cli` va fijado a una versión exacta (`27.2.0`). Para subirlo, cámbialo en el workflow y en su test (`otaWiring.test.ts`).

### Si una OTA sale mal

En el mismo workflow elige el canal y la acción **`volver-al-apk`**. Publica un "volver al código embebido": los teléfonos vuelven a correr el JavaScript que trae el APK la próxima vez que abran la app dos veces. Esta acción no pasa por el gate, para que sirva aunque `main` esté roto. Para volver a una OTA anterior concreta (en lugar del APK), desde un computador con sesión de Expo: `npx eas-cli@27.2.0 update:republish --group <id> --non-interactive` (el id sale de `eas update:list`).

Una OTA nunca toca la base de datos por sí sola, pero el JavaScript nuevo sí corre las migraciones al abrir. **No publiques por OTA una migración de SQLite** sin probarla antes en `preview`: volver al APK no deshace una migración ya aplicada.

## Medición del APK

El workflow ahora añade al resumen del job el tamaño del APK generado. No se debe afirmar un tamaño final hasta que una ejecución real del workflow lo muestre.

## Tag de release

Crear un tag `v*` dispara el workflow. No se creó ningún tag en esta tarea. El tag debe crearse únicamente después de revisar la firma, el tamaño y la instalación en un dispositivo real.
