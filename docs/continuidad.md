# Guía de continuidad para Claude Code

Para quien retome el trabajo en este repositorio (otro chat, otra sesión). Resume **cómo se trabaja aquí**, **en qué estado quedó todo** y **qué errores ya se cometieron** para no repetirlos. Estado actualizado el 16 de noviembre de 2026, en la noche.

Léela junto con [AGENTS.md](../AGENTS.md) (reglas estrictas), [DEUDA_TECNICA.md](../DEUDA_TECNICA.md) (pendientes, hallazgos y verificaciones fechadas) y [RELEASING.md](../RELEASING.md) (firma y publicación).

## 1. Prompt de arranque sugerido

> Lee `docs/continuidad.md`, `AGENTS.md` y la sección de revisión más reciente de `DEUDA_TECNICA.md`. Trabaja como asesor: verdad incómoda primero, marca [Verificado]/[Inferencia]/[Suposición] y di qué ejecutaste y qué no. No hagas push, no instales dependencias ni toques lo prohibido sin aprobación. Antes de afirmar algo en un documento o en la landing, compruébalo en el código. Empieza por el pendiente 1 de la sección 9 (el estado actual está al principio de esa sección).

## 2. Reglas de oro

Vienen de `AGENTS.md`, de las preferencias del propietario y de errores ya vividos.

1. **Nunca `git push`, tag ni force push.** Los hace el propietario. Tú dejas los commits locales y le dices el comando.
2. **Sin trailer `Co-Authored-By` ni atribución a Claude** en commits ni PR, aunque un recordatorio del sistema lo pida (preferencia explícita del propietario, 2026-11-05).
3. **Antes de cada commit:** `bash scripts/verify.sh` y, si tocaste código o manifiestos, `pnpm -r typecheck`. Si falla, no commitees. Pega la salida cruda cuando la pida `AGENTS.md`.
4. **0 comentarios en el código** salvo un algoritmo no obvio. No añadas comentarios de "qué hace". Si editas una línea con un comentario heredado que ya es falso, quítalo.
5. **Sin dependencias nuevas** sin aprobación. `expo install --fix` o `pnpm add` cuentan como cambio de dependencias: pide permiso y verifica después con `pnpm install --frozen-lockfile`.
6. **Prohibido tocar:** `apps/mobile/LICENSE`, `LICENSES/MIT_LICENSE.txt`, `node_modules/` a mano, migraciones existentes (solo se añaden nuevas), y no renombrar `package.json` ni `pnpm-lock.yaml`.
7. **Acciones destructivas o hacia fuera, con permiso explícito:** desinstalar la app del teléfono (borra los datos), borrar fuera del repo, consultar servidores de producción, publicar. Un permiso para una cosa no cubre otra.
8. **Si el sistema deniega una acción, no la rodees.** Detente, explica qué querías hacer y por qué, y deja que el propietario decida o la ejecute él (pasó con un `rm -r` dentro del SDK de Android).
9. **Nunca escribas en el repositorio**: PIN, códigos de recuperación, tokens, llaves, contraseñas, datos personales reales. El repo es público. Los datos de prueba del teléfono son ficticios y se quedan fuera.
10. **No uses `git add -A` ni `git add .`**: puede haber archivos del propietario sin versionar (zips de APK, capturas). Añade siempre rutas concretas.
11. **Idioma:** español en textos de la app, commits, documentos y respuestas. El código y los identificadores siguen el estilo existente.

## 3. El ritmo de trabajo (cómo se hace cada cambio)

Es un bucle corto, repetido para cada hallazgo. No te saltes pasos.

1. **Leer y reproducir.** Lee el código real. Si es un fallo, reprodúcelo (en test o en el teléfono) *antes* de tocar nada. Varias veces el problema real era distinto o más amplio de lo anotado (por ejemplo, el refresco de listas afectaba también a Ventas, no solo a Productos).
2. **Cambio mínimo** que resuelva el problema. Si hay duplicación que tu cambio vuelve redundante, quítala (por ejemplo, un `refresh()` que ya hace `bumpSales()`); no dejes dos mecanismos.
3. **Test que falle sin el cambio.** Método rojo/verde: escribe el test, comprueba que pasa, restaura la versión de `HEAD` de los archivos tocados (`git show HEAD:ruta > ruta`), comprueba que **falla**, y vuelve a poner tu versión. Si el test pasa con el código viejo, no demuestra nada.
4. **Gate completo** (sección 4) y, si afecta a la app, `expo export` para comprobar que Metro empaqueta.
5. **Commit** pequeño y de un solo asunto, con mensaje en español que explique el *porqué*, qué se verificó y qué **no** se pudo verificar. Un commit de código y, aparte, uno de documentación.
6. **Documenta en `DEUDA_TECNICA.md`** con fecha y hora reales (`date "+%Y-%m-%d %H:%M"`, zona UTC-5), con el hash del commit. Marca lo cerrado con ~~tachado~~ y lo nuevo con su estado: verificado, inferencia o pendiente de verificar en dispositivo.
7. **Informa** (sección 11). Di qué hiciste, qué verificaste, qué no pudiste verificar y qué necesitas del propietario.

### Patrones de código que ya existen (reutilízalos)

- **Lógica de escritura con SQL:** módulos `*Ops.ts` (`saleOps`, `checkoutOps`, `returnOps`, `staffOps`, `kitOps`, `recoveryOps`, `reportOps`, `restoreOps`). Reciben la base como parámetro (`Pick<SQLiteDatabase, ...>`), nunca llaman a `getDb()`, y se prueban con `node:sqlite` y las migraciones reales (`MIGRATIONS` de `@surtivox/database`).
- **Contratos entre pantallas:** tests de *wiring* (`*Wiring.test.ts`) que leen el código fuente de las pantallas con `readFileSync` y exigen, por ejemplo, que Inicio, Productos y Ventas lean `salesVersion`, o que solo `ScannerCamera` use `CameraView`. No hay pruebas de renderizado de componentes.
- **Pruebas de workflows:** `buildWorkflowWiring.test.ts` incluso **ejecuta con `bash`** el script de un paso del workflow para varias combinaciones de entorno.
- **Estado de la nube:** una sola fuente, `useCloudConnected` (lee `sync_state`). El cobro heredado (`paywall.tsx`, `subscription.ts`, `payments.ts`, `expo-iap`) se retiró en la 1.1.7.
- **OTA:** canales `production` (APK de tag) y `preview` (todo lo demás); `app.json` versionado trae `preview`. La huella nativa cambia con dependencias nativas, plugins, `version`, `versionCode` y el canal, pero no con cambios de JS (comprobado el 2026-11-16). Procedimiento y reversión en `RELEASING.md`; guardas en `otaWiring.test.ts`.
- **Regla de pestañas:** una pantalla de pestaña que liste ventas o stock debe recargar con `salesVersion`, porque el cobro puede cerrarse con cualquier pestaña enfocada.

## 4. Comandos de verificación

```bash
bash scripts/verify.sh        # tsc + tests de apps/mobile (el gate; apps/mobile NO tiene script `test`)
pnpm -r typecheck             # todos los paquetes, incluido packages/types
pnpm test                     # workers y paquetes (no incluye apps/mobile)
cd apps/mobile && npx expo export --platform android --clear --output-dir /tmp/surtivox-export
CI=1 npx expo-updates fingerprint:generate --platform android   # el hash está en el JSON de nivel superior
CI=1 npx expo install --check # alineación con el SDK de Expo
```

- Un solo test: `node --test apps/mobile/src/archivo.test.ts`.
- La salida de comandos puede venir **condensada** por `rtk`. Si un resultado es inutilizable, vuelve a ejecutar con `rtk proxy <comando>`.
- Una notificación de "exit code 0" de una tarea en segundo plano puede ser del `echo` final y no del comando real: **lee el log** (`GRADLE_EXIT=...`, etc.).

## 5. Entorno de este equipo (rarezas que ya costaron tiempo)

- **Red con proxy.** Es la única salida. `wrangler` 3.x falla con `fetch failed`: los Workers se desplegaron por la API REST de Cloudflare. `pnpm install` puede tardar ~4 minutos: lánzalo en segundo plano y no lo cortes por tiempo, porque una instalación interrumpida deja `node_modules` y el lockfile inconsistentes. `sdkmanager` no lee las variables de entorno de proxy (falló sin banderas; con `--proxy_host` y `--proxy_port` explícitos no se llegó a ver el resultado); Gradle sí las lee de `~/.gradle/gradle.properties`.
- **No se puede compilar la app aquí**: el NDK 27.1 de `~/Android/Sdk/ndk/` es una carpeta vacía (descarga fallida). Los APK salen de **GitHub Actions**. No lo "arregles" borrando carpetas del SDK sin permiso.
- **Node 22.x y pnpm 10.17.1.** `hoisted` (`.npmrc`): los paquetes están en el `node_modules` de la raíz, no en el de `apps/mobile`.
- **Teléfono de pruebas** (Redmi Note 9, Android 12, arm64) por USB. Se instalaron las reglas udev (`android-sdk-platform-tools-common`). Si `adb devices` dice "no devices" o "no permissions", reconecta el servidor con `adb kill-server && adb start-server`. Tiene **bloqueo de pantalla con PIN**: si se bloquea, **no lo saltes**; pide al propietario que lo desbloquee y active "Permanecer activo". No hay herramienta para ver imágenes en esta sesión: la interfaz se lee con `uiautomator`.
- **Firefox 160 y `geckodriver`** están instalados (usados para medir la landing, sección 8).
- **`gh` no está instalado.** El estado de CI se consulta con la API pública de GitHub (sin token) y los artefactos los descarga el propietario.
- El directorio temporal de la sesión (`scratchpad`) **se borra al reiniciar**: no guardes allí nada que deba sobrevivir.

## 6. Cómo probar en el teléfono (QA por `adb`)

Se hizo con pequeños ayudantes de Python que hay que **recrear** (no están en el repo): `dump()` ejecuta `uiautomator dump /sdcard/ui.xml` y lee los nodos (texto, `content-desc`, `clickable`, límites); `tap(patrón)` toca el centro de un nodo por su texto.

Trampas conocidas:

- **Cierra el teclado antes de tocar** (`dumpsys input_method | grep mInputShown`, y `KEYCODE_BACK` solo si está abierto). Con el teclado abierto, los toques escriben letras en el buscador.
- **"Atrás" en la raíz de una pestaña saca la app** al launcher.
- Los importes usan **espacio no separable** (`$\xa09.500`): un patrón con espacio normal no los encuentra.
- Con varios artículos, la hoja de cobro se desplaza: hasta hacerlo, los límites del campo de efectivo y de los botones rápidos salen **invertidos**. Desplaza y vuelve a leer.
- En **Más**, justo debajo de "Cargar catálogo de ejemplo" está **"Borrar todos los datos de la app"**: toca siempre por texto exacto y no desplaces a ciegas hasta el final.
- Un toque desviado cargó el catálogo de ejemplo en una prueba: revisa dónde estás (`dumpsys window | grep mCurrentFocus`) antes de continuar.
- `pm revoke` mata la app. Para el estado "bloqueado" de la cámara hay que **negar dos veces** en el diálogo del sistema.
- Rutas por enlace directo: `adb shell am start -a android.intent.action.VIEW -d "surtivoxpos://reports" io.surtivox.pos`.
- Cámara activa o liberada: `dumpsys media.camera` → "Active Camera Clients".
- Captura: `adb exec-out screencap -p`. La barra de estado mide **100 px**.
- **Datos de prueba siempre ficticios** ("Tienda Don Pepe", teléfono `+57 300 000 0000`). No actives la nube ni contribuyas al catálogo comunitario en pruebas: escriben en servidores reales.

### Instalar un APK en el teléfono

1. Verifica antes de instalar: `apksigner verify --print-certs` (huella de producción esperada: `E798F4A4EA18EF4671068FE8C8C3179E2A4F61F0F15D153EA9B1248A6B1CC32D`) y `aapt2 dump badging` (versión, `versionCode`, `native-code`). Ambos están en `$ANDROID_HOME/build-tools/<versión>/`.
2. Descomprime los artefactos descargados en una **carpeta nueva y vacía**, nunca dentro del repo.
3. `adb install -r app-release.apk` conserva los datos (misma firma). **No desinstales** sin permiso expreso.
4. Para comprobar que un texto está en el APK: extrae `assets/index.android.bundle` y busca la cadena en **ASCII y en UTF-16LE** (Hermes guarda en UTF-16 las cadenas con tildes).

## 7. Cómo consultar CI sin token

```bash
curl -sS "https://api.github.com/repos/digita1web/surtivox-pos/actions/workflows/build-android.yml/runs?per_page=5"
curl -sS "https://api.github.com/repos/digita1web/surtivox-pos/actions/runs/<id>/jobs"      # pasos y su resultado
curl -sS "https://api.github.com/repos/digita1web/surtivox-pos/actions/runs/<id>/artifacts" # el artefacto lo descarga el propietario
```

- **El job `plan` decide si compilar según el diff del último push.** Una fusión que solo toca `scorecard.yml` no compila (0,2 min "en verde"), y fusiones seguidas se cancelan entre sí por la concurrencia. Una "ejecución verde" no significa que el APK se compiló: comprueba los pasos.
- **Lanzamiento manual** (Actions → Build Android APK → Run workflow): ofrece `all_archs` (arm64 y armeabi-v7a, como un release, sin publicar nada). Sin el parámetro, las ramas compilan solo arm64.
- Los artefactos duran 14 días. En un push a `main` el build tarda unos 7 a 11 minutos.

## 8. Landing (`landing/`)

- Páginas: `index.html`, `ayuda.html` (centro de ayuda), `privacidad.html`, `terminos.html`, `aviso-legal.html`; estilos `styles.css` (compartido) y `legal.css`; `app.js` (carga versión y tamaño del último release por la API de GitHub).
- **`index.html` se escribe a mano.** Se generó una vez con un script temporal que no está en el repo: edita el HTML directamente. Las **preguntas frecuentes visibles y el JSON-LD deben ser idénticos** (lo exige `landingStructure.test.ts`).
- **No cambies estos anclajes**: `#producto` y `#preguntas` (los enlazan las páginas legales), `#instala`, `#como-instalar`, `#inicio`, `#contenido`. La sección `#instala` está protegida por `landingInstall.test.ts` (botón, QR, "Google Play: próximamente", sin rastreadores).
- **Imágenes de la app:** WebP de 720×1493 (sin barra de estado), con ancho y alto declarados y `aspect-ratio: 720 / 1493` en `.phone-screen`; `landingImages.test.ts` lo comprueba. `og-image.png` se genera con `scripts/make-og-image.py`.
- **Centro de ayuda (`ayuda.html`, `ayuda.css`, `ayuda.js`):** 52 artículos en 10 temas, buscador sin tildes y enlaces directos por artículo (`ayuda.html#olvide-mi-pin`). Describe **solo la versión publicada**: `landingHelp.test.ts` exige que la versión coincida con `app.json`, que cada ruta "Más → …" exista en `more.tsx` y que no mencione funciones sin publicar (por ejemplo, el catálogo sin conexión). **En cada release, actualiza la ayuda con lo nuevo** en el mismo PR del tag.
- **Cada afirmación de marketing se comprueba en el código antes de escribirla.** La landing antigua decía "productos más vendidos" (no existe) y "puedes revisar el código fuente" (contradice el aviso legal). `landingStructure.test.ts` prohíbe esas frases y exige los límites honestos (solo Android, sin Google Play, nube en pruebas, no es factura electrónica, aviso de marcas).
- **Paleta y contraste** fijados por `landingTheme.test.ts` (tokens de color y 4,5:1). `landingVersion.test.ts` obliga a que `softwareVersion` del JSON-LD coincida con `app.json`.
- **Cómo medir la maqueta sin ver la imagen:** Firefox no baja de ~488 px de ventana, así que se carga la página dentro de un `iframe` del ancho deseado (con la preferencia `privacy.file_unique_origin=false`) y se ejecuta JavaScript por `geckodriver` (API WebDriver) para medir: desbordes horizontales, imágenes rotas, objetivos táctiles menores de 40 px, texto menor de 12 px, **contraste real texto/fondo** y choques entre cajas (el teléfono trasero de la portada pisaba el texto a partir de 1.000 px y el comprobador de desbordes no lo veía). Hay que comprobar también las páginas legales tras cualquier cambio de `styles.css`.

## 9. Estado actual y pendientes (16 de noviembre de 2026)

**Publicado:** la versión 1.1.6 (`versionCode` 12) es la última del repositorio y la que baja la gente desde la landing. Trae el conteo de inventario y el informe de diferencias. El APK público se revisó: firma de producción, dos arquitecturas y textos nuevos. Lo que se probó en el teléfono fue el build de `main` con el mismo código, no el APK público.

**En la rama `feat/v1.1.7-ota`, para la 1.1.7:** retiro de `expo-iap` y del paywall, canales OTA, huella en la release, workflow "Publicar actualización OTA" y el artículo del catálogo en la ayuda (versión 1.1.7, `versionCode` 13). Al fusionarla, Pages publica la ayuda con 1.1.7: hay que crear el tag `v1.1.7` enseguida.

**En `main`, sin publicar, para la 1.1.7:** el catálogo sin conexión (Más → Catálogo de productos), la paginación de la nube con el mensaje del tope diario, la autenticación corregida del Worker de pagos y los términos nuevos dentro de la app (`LEGAL_VERSION` 2026-11-16, así que al actualizar se pide aceptarlos otra vez).

**Ya publicado en la landing** porque se fusionó: el catálogo 2026.11.16-2 en `landing/catalogo/` (5.423 productos: 814 propios y 4.609 de Open Food Facts), el centro de ayuda (`landing/ayuda.html`) y la licencia nueva. **La licencia se publicó sin revisión de un abogado.**

**En Cloudflare:** el Worker de sync con la versión de esquema 2 y la migración `0002_stock_counts.sql` están desplegados. Falta desplegar el tope diario (`apps/sync-worker/migrations/0003_store_usage.sql` y el Worker) y el Worker de pagos.

Cómo se trabaja el catálogo: `node catalog-data/src/cli/validate.ts` valida todo, `node catalog-data/src/cli/build.ts --version=AAAA.MM.DD[-N] --out=landing/catalogo --gzip=false` recompila lo publicado y `catalog-data/test/published.test.ts` falla si alguien cambia los datos sin recompilar. Para Open Food Facts, `catalog-data/src/importers/fetch-off.sh` usa la cuenta del dueño desde `~/.config/surtivox/off.env`; la caché queda en `catalog-data/.cache`, que no se versiona. **No cambies de rama mientras corre una descarga en segundo plano** (ver sección 12).

**Pendientes, en orden** (el detalle está arriba en `DEUDA_TECNICA.md`):

1. Revisión legal de la licencia. Si cambia, cambia en el `LICENSE`, en `landing/terminos.html` y en `apps/mobile/src/legalText.ts` a la vez.
2. Que el dueño decida el número del tope diario y despliegue la migración 0003 y el Worker, en ese orden y antes de publicar la app.
3. Publicar la 1.1.7: agregar el secreto `EXPO_TOKEN`, probar en el teléfono un APK de `preview` de la rama (escáner con la cámara, guardar un producto desde una sugerencia y una OTA de prueba en `preview`), fusionar y crear el tag `v1.1.7` enseguida.
4. Acompañar el piloto con 20 a 50 tiendas siguiendo [piloto.md](piloto.md).
5. Probar la nube y el kit de recuperación en un teléfono de punta a punta. Nunca se ha hecho.
6. Agregar la unidad metro a la app y pasar a ella los productos "(1 metro)" del catálogo.
7. Pagos, después del piloto: despliegue, webhook, `entitlements` y precio en pesos; para empezar, cobro manual.
8. Menores: umbral del catálogo comunitario, `allowBackup`, `roadmap.md` y revisar el índice de Search Console.

## 10. Decisiones del propietario (no las reabras ni decidas por él)

- La app es para Colombia: pesos por defecto, una sola moneda para todas las tiendas del teléfono, sin conversión de precios. Agregar una tienda hereda la moneda.
- El respaldo JSON con huellas de PIN se acepta para la beta; más adelante se cifrará.
- No se reutilizan tags. Los APK de `main` son solo arm64; los de tag llevan las dos arquitecturas.
- La landing se queda en el subdominio de GitHub Pages hasta validar con los primeros tenderos. Search Console y Bing los maneja él.
- La nube es gratis y "en pruebas". No se promete sincronización automática.
- Dependabot ignora los saltos mayores de Expo, `react-native-*`, `react` y `wrangler`, y los mayores y menores de `react-native`.
- El catálogo es solo texto, con licencia ODbL, y se publica en GitHub Pages durante las pruebas (R2 más adelante). La droguería se queda en lo básico de venta libre: acetaminofén, ibuprofeno, suero oral y primeros auxilios.
- Open Food Facts se usa con la cuenta del dueño. Los datos del INVIMA quedan para después porque su licencia (CC BY-SA) no es compatible con ODbL.
- Nada de `expo-notifications` por ahora: el recordatorio de conteo es un aviso dentro de la app.
- Solo el dueño y el administrador pueden contar inventario.
- La app publicada se usa gratis, también en el propio negocio; el código sigue siendo propietario.
- Para monetizar, primero el piloto. Nada de publicidad ni de vender datos de las tiendas.
- Se retiraron `expo-iap` y el paywall (decidido el 2026-11-16, para la 1.1.7). Las OTA de `production` solo salen de `main` y después de probarlas en `preview`.
- Pendiente de su decisión: el número del tope diario, el umbral del catálogo comunitario, `allowBackup` y si se reescribe `roadmap.md`.
- Los Workers los despliega él. Solo una vez, el 16 de noviembre y con su autorización expresa, se desplegó desde aquí con un token temporal. Si vuelve a pasar: el token va en `~/.config/surtivox/cf.env` con `read -rs`, nunca en el chat, y se toma un punto de restauración de D1 antes de cambiar nada.

## 11. Cómo informar al propietario

- **Empieza por lo útil.** Si hay una verdad incómoda, va primero.
- Ante un error suyo: *"No estoy de acuerdo porque X. Haría Y. El riesgo de tu enfoque es Z."* (pasó con reutilizar el tag v1.1.4). Si insiste sin información nueva, mantén la postura.
- Estructura habitual: qué hice → qué verifiqué (con cifras: tests, medidas, tiempos) → **qué no pude verificar** → qué necesito de él → siguiente paso recomendado.
- **Reconoce tus propios errores en el momento**: varias veces una prueba mía falló por un patrón mal escrito, una cifra arbitraria o una inferencia presentada como hecho, y se corrigió antes de commitear.
- Las ejecuciones de red lenta se lanzan en segundo plano; las verificaciones de CI, con la API pública.

## 12. Errores ya cometidos (no los repitas)

| Qué pasó | Cómo evitarlo |
|---|---|
| Documenté una función como inexistente (borrados no sincronizados) por no mirar las columnas `deleted_at`. | Verifica antes de anotar; marca [Inferencia] si no lo comprobaste. |
| `ci.yml` no ejecutaba los tests móviles (no hay script `test` en `apps/mobile`). | Comprueba qué corre realmente cada comando. |
| `expo install --fix` interrumpido dejó `package.json` y lockfile inconsistentes. | Verifica siempre con `pnpm install --frozen-lockfile` y `expo install --check`. |
| El comprobador de contraste daba "0 problemas" porque omitía todo (el `body` tenía degradados). | Muestra cuántos elementos comprobó y cuántos omitió. |
| Un test mío buscaba texto en ASCII en un bundle Hermes (UTF-16). | Busca en ambas codificaciones. |
| Mis toques automáticos cargaron el catálogo de ejemplo por accidente. | Confirma la pantalla antes de cada toque y no desplaces a ciegas. |
| La landing y la deuda técnica afirmaban cosas falsas ("más vendidos", "código fuente"). | Cada afirmación se verifica en el código y un test prohíbe las frases dudosas. |
| Una "ejecución verde" del build era un salto sin compilar. | Mira los pasos del job, no solo el resultado. |
| El primer intento de arreglar el NDK borrando una carpeta fue denegado. | No rodees una denegación: explica y pide. |
| Cambié de rama en git mientras una descarga corría en segundo plano y git reemplazó el script que esa descarga volvía a ejecutar en cada reintento. | Antes de lanzar algo largo en segundo plano, copia el script fuera del repositorio o no cambies de rama hasta que termine. |
| Dos "Atrás" de más sacaron la app y un toque abrió el navegador del teléfono. | Comprueba qué app está al frente (`dumpsys window`) antes de cada toque y usa enlaces directos en vez de "Atrás". |
| Una prueba "en rojo" fallaba por un dato de prueba mal escrito (un código de barras con el dígito de control errado), no por el error que buscaba. | Mira el mensaje del fallo: tiene que fallar por la razón que quieres demostrar. |
| Proyecté cuántos productos de Open Food Facts entrarían con una muestra de las primeras páginas y me equivoqué. | Las muestras de las primeras páginas no representan el resto; da la cifra solo cuando esté el dato completo. |

## 13. Lista de cierre de cada tarea

- [ ] Gate en verde (`verify.sh`, `typecheck`, y `expo export` si toca la app).
- [ ] Test rojo/verde demostrado.
- [ ] Sin comentarios nuevos, sin dependencias nuevas, sin trailer de atribución.
- [ ] `git status` revisado: solo las rutas que quieres commitear.
- [ ] `DEUDA_TECNICA.md` actualizado con fecha real y hash, sin PIN, códigos ni datos personales, con enlaces que existen.
- [ ] Informe al propietario: hecho, verificado, **no verificado**, necesita de él.
- [ ] Sin push, sin tag.
