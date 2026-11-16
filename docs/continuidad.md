# Guía de continuidad para Claude Code

Para quien retome el trabajo en este repositorio (otro chat, otra sesión). Resume **cómo se trabaja aquí**, **en qué estado quedó todo** y **qué errores ya se cometieron** para no repetirlos. Estado verificado el **2026-11-15, 19:55 (UTC-5)**.

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
- **Estado de la nube:** una sola fuente, `useCloudConnected` (lee `sync_state`). `subscription.ts` y `paywall.tsx` son código heredado sin uso real.
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

- Páginas: `index.html`, `privacidad.html`, `terminos.html`, `aviso-legal.html`; estilos `styles.css` (compartido) y `legal.css`; `app.js` (carga versión y tamaño del último release por la API de GitHub).
- **`index.html` se escribe a mano.** Se generó una vez con un script temporal que no está en el repo: edita el HTML directamente. Las **preguntas frecuentes visibles y el JSON-LD deben ser idénticos** (lo exige `landingStructure.test.ts`).
- **No cambies estos anclajes**: `#producto` y `#preguntas` (los enlazan las páginas legales), `#instala`, `#como-instalar`, `#inicio`, `#contenido`. La sección `#instala` está protegida por `landingInstall.test.ts` (botón, QR, "Google Play: próximamente", sin rastreadores).
- **Imágenes de la app:** WebP de 720×1493 (sin barra de estado), con ancho y alto declarados y `aspect-ratio: 720 / 1493` en `.phone-screen`; `landingImages.test.ts` lo comprueba. `og-image.png` se genera con `scripts/make-og-image.py`.
- **Cada afirmación de marketing se comprueba en el código antes de escribirla.** La landing antigua decía "productos más vendidos" (no existe) y "puedes revisar el código fuente" (contradice el aviso legal). `landingStructure.test.ts` prohíbe esas frases y exige los límites honestos (solo Android, sin Google Play, nube en pruebas, no es factura electrónica, aviso de marcas).
- **Paleta y contraste** fijados por `landingTheme.test.ts` (tokens de color y 4,5:1). `landingVersion.test.ts` obliga a que `softwareVersion` del JSON-LD coincida con `app.json`.
- **Cómo medir la maqueta sin ver la imagen:** Firefox no baja de ~488 px de ventana, así que se carga la página dentro de un `iframe` del ancho deseado (con la preferencia `privacy.file_unique_origin=false`) y se ejecuta JavaScript por `geckodriver` (API WebDriver) para medir: desbordes horizontales, imágenes rotas, objetivos táctiles menores de 40 px, texto menor de 12 px, **contraste real texto/fondo** y choques entre cajas (el teléfono trasero de la portada pisaba el texto a partir de 1.000 px y el comprobador de desbordes no lo veía). Hay que comprobar también las páginas legales tras cualquier cambio de `styles.css`.

## 9. Estado actual y pendientes (2026-11-15)

**Publicado:** el release `v1.1.5` (`versionCode` 11) es el "Latest" y está **verificado**. Lo publica `.github/workflows/build-android.yml`, que valida el tag con `scripts/check-release-tag.mjs` contra `apps/mobile/app.json`. El run #49 del tag terminó en verde, el asset `Surtivox.apk` (67 047 569 bytes, SHA-256 `d4eec978…45768b7`, igual al que publica GitHub) trae `arm64-v8a` y `armeabi-v7a` y está firmado con la clave de producción (`e798f4a4…1cc32d`). **No se deben mover ni recrear los tags `v1.1.4` ni `v1.1.5`.** `versionCode` no puede bajar: un fallo grave se arregla hacia adelante (1.1.6, 12).

**Verificado en el teléfono (2026-11-14):** actualización del 1.1.4 público al 1.1.5 con datos (tienda, productos, ventas, cliente y fiado se conservaron) e instalación limpia con onboarding en COP; detalle en `DEUDA_TECNICA.md`. La prueba usó el artefacto del run #47, no el APK público del release.

**En `main`** (resumen; el detalle con hashes está en `DEUDA_TECNICA.md`): cursores de sync reiniciados al restaurar un respaldo; salida del modo desarrollador; CI con el gate completo; estado de la nube unificado; `ScanModal` con la máquina de estados de la cámara; pie con la versión real; parches de Expo del SDK 57; build más rápido con `all_archs`; acciones de GitHub fijadas por SHA; moneda heredada al agregar una tienda y COP por defecto en el onboarding; capturas reales en README, landing y `og-image`; ids con `expo-crypto`; Worker de sync verificado; rediseño de la landing aprobado por el propietario.

**v1.1.6 publicada (2026-11-16):** conteo físico, informe de diferencias, aviso semanal, textos sin "stock" y compuerta de versión de esquema del sync (`SYNC_SCHEMA_VERSION = 2`). El Worker de sync y la migración `0002_stock_counts.sql` de D1 ya están desplegados (`/health` responde `schemaVersion: 2`). Detalle, hashes y punto de restauración de D1 en `DEUDA_TECNICA.md`. **No se deben mover ni recrear los tags `v1.1.4`, `v1.1.5` ni `v1.1.6`.**

**Siguiente gran tarea: Entrega 2, catálogo estandarizado** en `catalog-data/` (licencia ODbL aprobada). La cifra de 200.000 productos es orientativa: se prioriza cobertura y calidad para tiendas de barrio colombianas. Orden: estructura y validador sin datos; generador con medición sobre datos sintéticos; propuesta de fuentes con licencia verificada (**no se ingiere ni se descarga ningún volcado sin aprobación del propietario**); integración en la app; publicación en R2 (requiere un token nuevo con permiso de R2, que el propietario guarda en `~/.config/surtivox/cf.env` con `read -rs`, nunca en el chat).

**Pendientes por orden:**

1. **Instalar el APK público del release** (`releases/latest/download/Surtivox.apk`) en el teléfono para confirmar la descarga directa. Necesita el teléfono conectado y desbloqueado; la instalación por USB en MIUI muestra un aviso de 7 s que hay que aceptar a tiempo.
2. **Nube y kit de recuperación en un dispositivo:** nunca se probaron de punta a punta en el teléfono.
3. **Cuota del sync gratuito (P1-1):** falta el número de filas por tienda; conviene medir antes la tienda más grande con una consulta de solo lectura que ejecuta el propietario. Va junto con la paginación de `/sync/pull` (P2-5), un solo despliegue (por la API REST) y el Worker antes que la app.
4. **Catálogo comunitario (P1-5):** decidir el umbral de consenso (hoy 2) y si se limita por IP.
5. **Pagos (pospuestos por el propietario):** el P0-1 sigue abierto: `/pagos/crear` valida contra `sync_tokens`, tabla que el sync vacía al migrar a `shop_keys`. Falta el webhook y `entitlements`.
6. **Menores:** `allowBackup="true"` (decisión de privacidad frente a comodidad), frase de "respaldo automático" en `paywall.tsx` (ruta heredada), `repos.ts` (1.200 líneas, sin leer entero), `roadmap.md` desactualizado. Opcional: captura real de la pantalla de fiado para la landing.

## 10. Decisiones del propietario (no las reabras ni decidas por él)

- **Moneda:** la app es para Colombia. COP por defecto. La moneda es **global** para todas las tiendas y no convierte precios; se cambia en Más. Agregar una tienda hereda la moneda de la activa y **ya no ofrece selector**.
- **Respaldo JSON con hashes de PIN:** aceptado para la Beta; a futuro se cifrará el archivo.
- **Release:** v1.1.5 publicada; no reutilizar tags. Los APK de `main` son solo arm64; los tags llevan las dos arquitecturas.
- **Dominio:** se queda el subdominio de GitHub Pages hasta validar la app con los primeros tenderos; no propongas comprar uno antes. Search Console y Bing los gestiona él; el código de verificación `<meta>` lo pasa y tú lo pones en la portada.
- **La nube** es gratis y "en pruebas"; **no** se promete sincronización automática (solo existe el botón).
- **Dependabot:** se ignoran saltos mayores de Expo, de `react-native-*`, `react` y `wrangler`, y mayores y menores de `react-native`.
- **Pendiente de su decisión:** tope de filas del sync, umbral del catálogo, retiro de `expo-iap`/`paywall`, `allowBackup`, si `roadmap.md` se reescribe.
- Los Workers los despliega él (por la API REST). Tú no ejecutas `wrangler deploy`, `wrangler secret put` ni `d1 execute`.

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

## 13. Lista de cierre de cada tarea

- [ ] Gate en verde (`verify.sh`, `typecheck`, y `expo export` si toca la app).
- [ ] Test rojo/verde demostrado.
- [ ] Sin comentarios nuevos, sin dependencias nuevas, sin trailer de atribución.
- [ ] `git status` revisado: solo las rutas que quieres commitear.
- [ ] `DEUDA_TECNICA.md` actualizado con fecha real y hash, sin PIN, códigos ni datos personales, con enlaces que existen.
- [ ] Informe al propietario: hecho, verificado, **no verificado**, necesita de él.
- [ ] Sin push, sin tag.
