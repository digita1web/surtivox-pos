# Publicar Surtivox POS en Android

## Estado actual

El workflow `.github/workflows/build-android.yml` compila un APK de release con `./gradlew assembleRelease` y lo adjunta a un GitHub Release cuando se empuja un tag que empieza por `v`.

La firma de producción se inyecta en CI. Tras `expo prebuild`, el paso "Configurar firma de release" decodifica la llave desde los secretos y ejecuta `scripts/patch-android-signing.mjs`, que cambia la variante `release` de `apps/mobile/android/app/build.gradle` para leer la llave del entorno (lógica en `apps/mobile/src/androidSigning.ts`, con test). Después de compilar, "Verificar la firma del APK" ejecuta `apksigner` y muestra la huella del certificado.

- **Tag `v*`:** si falta el secreto `ANDROID_KEYSTORE_BASE64` o el APK queda con el certificado debug, el workflow falla y no se publica nada.
- **Compilaciones de `main` o manuales sin secretos:** se firman con la llave debug y el workflow lo avisa; ese APK no sirve para publicar.

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

`app.json` usa `runtimeVersion` con la política `fingerprint`. Cambiar permisos, plugins o arquitecturas nativas cambia la huella del runtime. Un teléfono con el APK anterior no recibirá por OTA el JavaScript de un runtime nuevo: debe instalar el APK nuevo. Las actualizaciones OTA deben publicarse solo para la misma huella nativa.

## Medición del APK

El workflow ahora añade al resumen del job el tamaño del APK generado. No se debe afirmar un tamaño final hasta que una ejecución real del workflow lo muestre.

## Tag de release

Crear un tag `v*` dispara el workflow. No se creó ningún tag en esta tarea. El tag debe crearse únicamente después de revisar la firma, el tamaño y la instalación en un dispositivo real.
