# Deuda técnica y estado del proyecto

Este archivo es la libreta del proyecto: dónde estamos, qué falta y qué se aprendió en el camino. Arriba va lo vigente; abajo queda el historial con el detalle técnico de cada revisión. Cuando algo no se pudo comprobar, se dice. Última actualización: 18 de noviembre de 2026, en la mañana.

## Dónde estamos

La versión publicada es la **1.1.8** (`versionCode` 14), en la release `v1.1.8` desde el 17 de noviembre. Es la que descarga cualquiera desde la landing. Todavía no es un lanzamiento comercial: estamos en pruebas con tiendas piloto. La 1.1.7 nunca se publicó: su build falló en la firma.

La 1.1.8 trae:

- El catálogo sin conexión: Más → Catálogo de productos. La tienda elige su tipo de negocio, descarga la lista y, al agregar un producto, la app le sugiere el nombre, la categoría, la unidad y el código. El precio siempre lo pone el tendero.
- La paginación de la descarga desde la nube y el mensaje del tope diario.
- Los términos nuevos (versión legal 2026-11-16). Al actualizar, la app pide aceptarlos otra vez.
- El retiro del cobro heredado (`expo-iap`, paywall).
- **Actualizaciones OTA**: es la primera versión que recibe cambios de JavaScript sin instalar un APK. Las 1.1.6 y anteriores no las reciben; esos teléfonos tienen que instalar la 1.1.8 una vez, encima y sin desinstalar.

**Las OTA ya funcionan de punta a punta.** Se publicaron dos en `production` y las dos llegaron a un Redmi con el APK de la release (comprobado en Más → Diagnóstico):

1. Diagnóstico muestra el canal y si el código viene del APK o de una OTA (actualización `01a1ec3e…`, workflow OTA #1).
2. La copia de seguridad previa a migraciones ya funciona (actualización `01a1eee5…`, workflow OTA #3; antes se probó en `preview` con el workflow #2). Ver "Lo que hicimos el 17 y 18 de noviembre".

Lo que está publicado en la landing (GitHub Pages):

- El catálogo 2026.11.16-2, con 5.423 productos: 814 que escribimos nosotros y 4.609 de Open Food Facts.
- El centro de ayuda en `ayuda.html`, con 53 artículos sobre la versión 1.1.8.
- Los términos y la licencia nuevos. Ojo: este texto se publicó sin que lo revisara un abogado. Ver pendientes.

En Cloudflare está desplegado el Worker de sync que entiende la versión de esquema 2 (conteos de inventario). No están desplegados ni el tope diario de la nube (falta la migración `0003_store_usage.sql` y el Worker nuevo) ni el Worker de pagos.

## Pendientes, en orden

1. **Revisar la licencia con un abogado.** El `LICENSE`, los términos de la landing y los de la app dicen ahora que la app se puede usar gratis, también para manejar tu propio negocio, y que el código no se puede copiar ni redistribuir. Antes decían que el "uso comercial" necesitaba licencia, lo cual chocaba con ofrecerla gratis a tiendas. El texto nuevo ya está en la landing; si el abogado pide cambios, hay que hacerlos en los tres lugares a la vez (un test exige que la app y la landing digan lo mismo).
2. **Decidir el tope diario de la nube y desplegarlo.** El Worker trae 20.000 filas por tienda al día como valor por defecto y se cambia con la variable `QUOTA_DAILY_ROWS` sin tocar código. El límite que importa es el de escrituras diarias de D1 en el plan gratuito, que se reparte entre todas las tiendas. Orden: aplicar `apps/sync-worker/migrations/0003_store_usage.sql`, desplegar el Worker y después publicar la app. Si el Worker sale sin la tabla, no bloquea a nadie.
3. **Probar en el teléfono dos cosas del catálogo**: escanear con la cámara y guardar un producto a partir de una sugerencia. Se quedaron sin probar en la 1.1.8. Si algo falla y el arreglo es solo de JavaScript, sale por OTA (primero `preview`, luego `production`; procedimiento en [RELEASING.md](RELEASING.md)).
4. **Averiguar qué cambia la compilación en la huella.** En CI, después de compilar, la huella calculada cambia (`def3c2…` → `d72058…` en `preview`, `a7a2f5…` → `e7724d…` en `production`). No afecta a los usuarios: el APK lleva la huella del árbol limpio gracias a `EXPO_UPDATES_FINGERPRINT_OVERRIDE`, que es la que calcula `eas update`. La lista de fuentes que cambian está en el log del paso "Diagnosticar si la compilación cambió las fuentes de la huella" (builds #69 y #70), que necesita la sesión de GitHub del dueño. En este computador las dos huellas coinciden.
5. **Arrancar el piloto con 20 a 50 tiendas.** La guía está en [docs/piloto.md](docs/piloto.md): a quién buscar, cómo instalarles la app, qué no prometerles, cómo medir sin rastrear a nadie y cómo preguntar por el precio.
6. **Probar la nube y el kit de recuperación en un teléfono de punta a punta.** Nunca se ha hecho con una tienda real.
7. **Agregar la unidad metro (`m`) a la app.** Ferreterías y mercerías venden cable, cuerda o malla por metro. Mientras tanto, en el catálogo esos productos se llaman "(1 metro)" y usan `unit`. Cuando la app tenga `m`, se marca como unidad de venta en `catalog-data` y se actualizan sus tests.
8. **Pagos, cuando el piloto diga que vale la pena.** La autenticación ya está corregida (P0-1). Faltan el despliegue, el webhook de Wompi, los `entitlements` y un precio en pesos. Para empezar se propone cobrar a mano: pago por Nequi y activación manual.
9. **Revocar el token de Cloudflare** del 16 de noviembre, si no se ha hecho. Quedó escrito en el historial de la conversación.
10. Pendientes menores de antes: el umbral del catálogo comunitario (hoy 2 votos), `allowBackup="true"`, `roadmap.md` desactualizado, y en Search Console revisar si Google ya indexó el sitio.

## Decisiones que siguen vigentes

- La nube es gratis mientras dure la prueba y no se promete sincronización automática: se sincroniza con el botón. La pantalla de la nube lo aclara.
- El Worker de sync no revisa suscripciones; por eso el tope diario es la única forma de limitar el uso.
- La app es para Colombia: pesos colombianos por defecto, la moneda es la misma para todas las tiendas del teléfono y no convierte precios.
- Mientras se valida con los primeros tenderos, la landing se queda en el subdominio de GitHub Pages y el catálogo se publica ahí mismo, no en R2.
- El catálogo es solo texto, sin fotos, y la droguería se queda en lo básico de venta libre.
- Primero el piloto, después cobrar. Nada de publicidad ni de vender datos de las tiendas.

## Datos que conviene tener a mano

- Base D1 de producción: `surtivox-sync` (`1faf3ce0-aa7a-414d-bc0e-e28d9be9d336`). Punto de restauración (Time Travel) tomado el 16 de noviembre antes de crear las tablas de conteo: `00000017-00000000-00005125-baebeed7d3ddc45a60278608f2ec528e`.
- APK publicado de la 1.1.6: `Surtivox.apk`, 67.109.293 bytes, SHA-256 `c19256d647281b8ec4fad6667e752d91f4edd292f205fe56b7128bf2ca256e1c`. Firma de producción con huella `e798f4a4…1cc32d`.
- Los tags `v1.1.4`, `v1.1.5` y `v1.1.6` no se mueven ni se recrean. El `versionCode` nunca baja.
- Las credenciales de Open Food Facts están en `~/.config/surtivox/off.env` (permisos 600, fuera del repositorio) y las usa `catalog-data/src/importers/fetch-off.sh`.

## Lo que hicimos el 17 y 18 de noviembre

**Firma (PR #35, `cfe54ee`).** Los builds #66 (`main`) y #67 (tag `v1.1.7`) fallaron en "Configurar firma de release": la plantilla que baja `expo prebuild` pasó de `signingConfig = signingConfigs.debug` a `signingConfig signingConfigs.debug` y la regex de `androidSigning.ts` exigía el `=`. Ahora el parche recorre los bloques de Groovy por llaves, ignorando comentarios y cadenas, y no depende de ese texto. La plantilla real de hoy quedó como fixture (`test-fixtures/build.gradle.call-syntax.template`). Como no se reutilizan tags, la versión pasó a 1.1.8 (`6f37e0a`).

**Huella (PR #36, `b456a79`).** El build #68 falló en mi guarda nueva: la huella calculada antes de compilar (`def3c2…`) no era la que Gradle metió en el APK (`d72058…`). `eas update` calcula sobre un checkout limpio, así que el APK tiene que llevar la limpia: el build la pasa a Gradle con `EXPO_UPDATES_FINGERPRINT_OVERRIDE` y un paso nuevo avisa, sin fallar, qué fuentes cambiaron al compilar. La causa de fondo sigue abierta (pendiente 4).

**Release (PR #44, `324aaa6`).** El tag `v1.1.8` (build #70) compiló bien, pero "Publicar release" falló: el paso leía `release-apk/runtime-android.json` con `require()`, que con una ruta relativa busca un paquete en `node_modules`. Todos los workflows leen ahora los JSON con `fs.readFileSync` y el test ejecuta ese paso con la ruta relativa, como en CI.

**Release a mano.** La v1.1.8 se publicó subiendo los artefactos del build #70. La primera vez se adjuntó por error un APK 1.1.5 viejo (`versionCode` 11) que estaba en la misma carpeta: los teléfonos con 1.1.6 no podían instalarlo (Android no baja de versión) y las instalaciones nuevas recibían la 1.1.5. Se detectó leyendo el APK con `aapt2` y el digest de la API de GitHub, y se reemplazó por el correcto (sha256 `73563764…`, huella `a7a2f59a…`, canal `production`).

**Diagnóstico (`6fa6dd5`).** Más → Diagnóstico muestra el canal de actualizaciones y si el código en uso es el del APK o una OTA. Fue la primera OTA.

**Copia previa a migraciones (PR #45, `927a80e`).** *Verificado en el teléfono:* `db.ts` copiaba la base con `FileSystem.copyAsync({ from: db.databasePath })`, pero `databasePath` es una ruta normal y `expo-file-system/legacy` la toma como nombre de un recurso de Android ("No resource found"). La copia nunca se hizo en Android: el error se guardaba y las migraciones corrían sin red de seguridad (pasó al migrar a la 1.1.6 el 16 de noviembre). Por lo mismo Diagnóstico decía "Base de datos: No disponible". `toFileUri()` convierte la ruta en `file://` y un test impide pasar `databasePath` sin convertir. Salió por OTA: en `preview` y en `production`, Diagnóstico pasó a mostrar "Base de datos: 408.0 KB". El "Último error" del 16 de noviembre se queda guardado hasta que ocurra otro error.

## Lo que hicimos el 16 de noviembre

Fue un día largo. Esto es lo principal, en orden.

**Conteo de inventario (1.1.6).** Se puede contar el inventario producto por producto, escaneando o buscando, y la app muestra cuánto esperaba según el sistema, cuánto se contó y la diferencia en unidades y en plata a costo. Cada diferencia queda como un ajuste registrado a nombre de quien contó; nunca se edita ni se borra un movimiento. El informe separa faltantes de sobrantes, se filtra por fechas y por persona y se comparte por WhatsApp o en PDF, con un lenguaje que no acusa a nadie. Solo el dueño y el administrador pueden contar. Hay un aviso opcional en Inicio si pasan 7 días sin contar; no usamos notificaciones del sistema para no tocar la parte nativa.

Para que la nube aguantara las tablas nuevas sin dañar a quienes tienen la versión anterior, la app y el Worker ahora se dicen qué versión de esquema manejan. Si la app es más nueva que el servidor, no sube nada y avisa. Si un teléfono viene de una versión vieja, trae una sola vez lo que se perdió. Lo probamos con el Worker real en tests y lo desplegamos en Cloudflare con autorización del dueño, tomando antes un punto de restauración de la base.

**Prueba en el teléfono.** En el Redmi Note 9, con datos inventados, instalamos la 1.1.5 pública, hicimos ventas y un fiado, y actualizamos encima. No se perdió nada y el conteo funcionó de punta a punta. Esa prueba dejó tres arreglos: el informe tenía márgenes dobles, el botón de borrar búsqueda decía "Clear search" para el lector de pantalla y las unidades no tenían plural ("10 botella").

**Release 1.1.6.** Publicado y comprobado descargando el APK público: firma de producción, `versionCode` 12, las dos arquitecturas y los textos nuevos dentro. Las capturas de la landing y del README se tomaron otra vez con la versión nueva. Lo que no hicimos fue instalar ese APK público en el teléfono; lo que se probó fue el build de `main`, con el mismo código.

**Catálogo de productos.** Armamos `catalog-data/`, una base de productos solo de texto, con licencia ODbL. Tiene categorías con emoji, unidades iguales a las de la app, un registro de fuentes con su licencia y un validador que rechaza cualquier dato de una fuente que el dueño no haya aprobado. De ahí salen paquetes SQLite por tipo de negocio que la app descarga, verifica y usa sin internet. Lo medimos con 200.000 productos inventados: el paquete de una tienda pesaba 14 MB y la búsqueda mientras se escribe tardaba 14 ms en el computador.

Las fuentes: 814 productos escritos por nosotros (ferretería, papelería, frutas, genéricos de tienda y una droguería mínima, solo con analgésicos comunes, suero oral y primeros auxilios) y los productos vendidos en Colombia que hay en Open Food Facts. Open Food Facts no deja pasar de la página 10 sin cuenta; el dueño creó una, guardó las credenciales fuera del repositorio y con eso bajamos las 10.101 fichas. Entraron 4.609. El resto quedó por fuera por no tener nombre en español, categoría reconocible, marca o código válido. Al revisar a mano encontramos errores en los datos de origen (chorizos y yogures marcados como huevos, gaseosas como dulces) y los corregimos con reglas probadas. Los datos del gobierno (INVIMA) se dejaron para después porque su licencia no es compatible con la nuestra.

En el teléfono el catálogo funcionó en modo avión: "tinto" sugiere el tinto, "clavo" encuentra las puntillas y un código de Pony Malta se completa solo. No se pudo probar el escáner de la cámara, porque por cable no hay cómo apuntarla.

**Centro de ayuda.** 52 artículos en 10 temas con buscador. Cada afirmación se comprobó contra la app publicada, y un test revisa que cada ruta "Más → …" que se menciona exista de verdad.

**Antes de cobrar.** Corregimos la autenticación del Worker de pagos (P0-1): buscaba la llave en una tabla que el sync vacía, así que nadie podía pagar. Agregamos el tope diario de la nube y la descarga por páginas, sin cambiar nada para las versiones viejas. Reescribimos la licencia para que no contradiga la app gratuita y escribimos la guía del piloto. Lo de cobrar queda para después del piloto.

**Errores nuestros que vale la pena recordar.** Cambiar de rama en git mientras corría la descarga de Open Food Facts reemplazó el script por la versión vieja; la descarga en curso no se afectó, pero un reintento habría salido sin sesión, así que la relanzamos desde una copia fuera del repositorio. En el teléfono, dos "Atrás" de más sacaron la app y un toque abrió el navegador; desde ahí se comprueba la pantalla antes de cada toque. Y un par de pruebas "en rojo" fallaban por un dato de prueba mal escrito y no por el error que buscábamos; se repitieron hasta que fallaron por la razón correcta.

---

Lo que sigue es el registro anterior, con más detalle técnico. Se conserva tal cual.

## SEO de la landing (2026-11-15 20:15)

Commit `448e574`: título con marca y palabras clave, `h1` con la marca, datos estructurados (`SoftwareApplication`, `Organization`, `WebSite`), sitemap con `lastmod`, página 404 con `noindex` y `landingSeo.test.ts`. **Verificado** con el gate; **no verificado:** que Google o Bing lo hayan indexado (una búsqueda previa no encontró nada del sitio).

- **Decisión del propietario:** se mantiene el subdominio `digita1web.github.io/surtivox-pos/`. No se compra un dominio propio hasta validar la app con los primeros tenderos. Un dominio propio rankea mejor; al comprarlo hay que cambiar canonical, Open Graph, sitemap, JSON-LD, `robots.txt` y `pages.yml` (CNAME).
- **Search Console (2026-11-15 20:35, según el propietario; no verificable desde aquí):** propiedad `https://digita1web.github.io/surtivox-pos/` verificada con el archivo `landing/google5786bf3359978603.html` (commit `c2b8b31`). **No borrar ese archivo:** Google lo vuelve a comprobar y la propiedad se pierde sin él. Sitemap enviado e indexación de la portada solicitada.
- **Pendiente del propietario:** importar la propiedad en Bing Webmaster Tools; rellenar "Website", descripción y topics del repositorio en GitHub; revisar en Search Console, pasados unos días, el informe de páginas indexadas y las búsquedas por "Surtivox".

## Prueba de actualización 1.1.4 → 1.1.5 (2026-11-14, 20:59)

Redmi Note 9 por adb, con datos de prueba ficticios. APK 1.1.4: el público de `releases/download/v1.1.4/Surtivox.apk` (`versionCode` 10). APK 1.1.5: artefacto del run #47, `versionCode` 11, 67 MB (las dos arquitecturas), firma de producción `e798f4a4…`. **Verificado** salvo que diga lo contrario.

- Se instaló la 1.1.4 limpia, se creó una tienda (quedó en USD, el comportamiento antiguo), dos productos (Aceite 8 en stock, Arroz 3), una venta con Nequi (INV-0001), un cliente y una venta a fiado (INV-0002).
- Se instaló la 1.1.5 encima con `adb install -r`, sin desinstalar. Se conservaron la tienda, los dos productos, las dos ventas ($27,400 en el día), el cliente con $4,200 de fiado pendiente y la moneda USD de la tienda existente.
- El Arroz pasó de mostrar 2 a mostrar 1 en stock. La cuenta correcta es 3 − 1 − 1 = 1: la 1.1.4 enseñaba una lista desactualizada tras vender (el fallo de refresco ya corregido), no hubo pérdida de datos.
- Instalación limpia de la 1.1.5: el onboarding abre con COP preseleccionado en el paso de moneda.
- Las tiendas que ya se crearon en USD con la 1.1.4 siguen en USD; se cambia en Más. No se migra la moneda a propósito.
- **No probado:** la ruta de etiqueta (validación, dos arquitecturas y release) y la nube con el kit de recuperación en un dispositivo.

## Revisión del 2026-11-14

Pruebas en el Redmi Note 9 (Android 12) entre las 15:59 y las 17:00 (UTC-5); este bloque se escribió el 2026-11-14 16:47. Cada punto es **verificado** salvo que diga lo contrario. La sesión no ve imágenes: la interfaz se leyó con `uiautomator`.

**APK probado:** el artefacto de CI que instaló el propietario el 2026-11-14 a las 15:57: `versionCode` 10, solo `arm64-v8a`, firma de producción (`e798f4a4…`). Incluye `cecfe5b` (se vio el texto "Guarda tu tienda en la nube con un toque"), por lo que lleva el refresco de listas y los ids con `expo-crypto`; el commit exacto del build no se determinó.

- **Refresco de listas tras vender o anular (cerrado, `cb3e996`).** Productos pasó de 8 a 7 en stock al vender en la misma pestaña; Ventas pasó de "1 pedido" a "2 pedidos" al vender desde esa pestaña; al anular volvió a "1 pedido" tras cerrar la alerta, **sin el `refresh()` directo** que se quitó; el stock cuadró (7 = 8 − 1 − 1 + 1). Los ids nuevos de `expo-crypto` no dieron errores al crear ventas, productos y personal.
- **PIN.** Se rechazan un PIN débil (`1234`) y PIN que no coinciden, con mensajes en español. Intentos fallidos: sin aviso en el 1 y el 2, "Te quedan 2 intentos" y "1 intento" en el 3 y el 4, bloqueo de 30 s con cuenta atrás en el 5 y de unos 60 s en el siguiente. El PIN correcto **se rechaza durante el bloqueo** y entra al expirar. Bloqueo automático en 1 minuto: no bloquea tras 15 s fuera de la app y sí tras 75 s.
- **Código de recuperación.** La hoja del código aparece al crear al primer propietario; "Copiar o compartir" abre el selector del sistema. "¿Olvidaste el PIN del propietario?" rechaza un código incorrecto ("Te quedan 4 intentos"), con el correcto restablece el PIN y **emite un código nuevo**; el PIN anterior deja de funcionar y el nuevo entra.
- **Guardia de rutas por rol.** Un cajero queda bloqueado ("Tu rol (Cajero) no permite abrir esta sección.") al abrir por enlace directo `reports`, `staff`, `data`, `cloud-sync`, `store-settings` y `paywall`; el propietario abre `reports`, `staff` y `data`.
- **Respaldo con personal y PIN.** Guardar copia: 258 registros, verificada. Se hizo una venta y se añadió un cajero **después** de la copia; al restaurar ("258 registros en 20 tablas") desaparecieron ambos, quedaron las 2 personas y el PIN del cajero siguió funcionando.
- **Los PIN viajan en la copia.** *Decisión del propietario (2026-11-14 16:56): para la Beta se acepta así; a futuro, cifrar el archivo de respaldo.* *Verificado en el JSON:* `staff` incluye `pin_hash` y `pin_salt` de cada persona, y `local_settings` incluye `recovery_hash` y `recovery_salt`. No incluye el token de la nube ni `sync_state`. Confirma la hipótesis de la sección de seguridad: quien tenga el archivo tiene los hashes de los PIN (que son de 4 dígitos). No se probó cuánto tarda revertirlos.
- **Varias tiendas.** Una tienda nueva numera sus facturas por separado (`INV-0001`) y carga su propio catálogo de ejemplo.

### Hallazgos nuevos del 2026-11-14

- ~~**Agregar tienda puede cambiar la moneda de todas las tiendas.**~~ *Cerrado el 2026-11-14 16:56 (UTC-5, `38ca054`):* la tienda nueva hereda la moneda de la tienda activa (`currencyCodeForNewShop`, COP si no hay o es desconocida), se quitó el selector de moneda de ese formulario y la pantalla ya no llama a `setAppCurrency` ni a `updateAllStoreCurrencies`; la moneda global se cambia en Más. Un test lo fija. **Verificado en el teléfono el 2026-11-14 18:27 (UTC-5)** con el artefacto del run #45 de «Build Android APK» (`workflow_dispatch` sobre `13b3563`, `versionCode` 10, firma `e798f4a4…`, solo arm64; instalado con `adb install -r` conservando los datos): el formulario dice "Moneda: COP. Es la misma de tus otras tiendas; puedes cambiarla en Más." y no tiene selector; con la moneda global en EUR dice EUR (hereda de la tienda activa, no del teléfono ni fija en COP); al crear una tienda sin tocar nada, la moneda global sigue en COP y las tres tiendas (Martin SAS, Tienda Don Pepe y la nueva) aparecen en COP, y Don Pepe conserva sus 10 pedidos con importes `$ 84.000`. La tienda de prueba creada se llama "Tienda Prueba Moneda" y sigue en el teléfono. *Quedan sin cambiar:* ~~el onboarding de la primera tienda usaba el locale del teléfono~~ *(cerrado el 2026-11-14 18:41, `c4a9c74`: la primera tienda empieza en COP, el selector sigue disponible y `defaultCurrencyFor` se eliminó; sin verificar en una instalación limpia)*, y cambiar la moneda en Más sigue aplicándose a todas las tiendas sin convertir precios. *Hallazgo original, verificado en el código y observado en el teléfono:* [new-shop.tsx](apps/mobile/app/new-shop.tsx) toma la moneda por defecto de la configuración regional del teléfono (`defaultCurrencyFor`, que devuelve `USD` si la región no está en su lista) y al crear llama a `setAppCurrency` y a `updateAllStoreCurrencies`, que cambia la moneda de **todas** las tiendas sin convertir precios. En la prueba, al crear una tienda sin tocar el selector (queda bajo el pliegue), toda la app pasó a mostrar `$18,000` en vez de `$ 18.000`. *No se leyó la configuración regional del teléfono* (se perdió la conexión). Corrección mínima: que el valor inicial sea la moneda global actual y no la del teléfono, y confirmar antes de cambiar la de las demás tiendas.
- ~~**El teléfono de pruebas quedó con la moneda global en USD**~~ *Corregido a mano el 2026-11-14 17:19 (UTC-5):* se volvió a COP desde Más y los importes volvieron a mostrarse como `$ 53.000`.
- **Entorno: faltan reglas `udev` para `adb`.** Cada vez que el teléfono se reenumera por USB, `adb` pierde permisos ("insufficient permissions for device: missing udev rules"); pasó cuatro veces. Se arregla con las reglas udev de Android (paquete `android-sdk-platform-tools-common`, requiere `sudo`) o reconectando el cable.
- **Con varios artículos, la hoja de cobro necesita desplazarse** para llegar al campo de efectivo recibido y a los montos rápidos: sus límites de pantalla salían invertidos hasta desplazar. *Inferido de `uiautomator`; no se vio la pantalla.*
- ~~**Capturas reales para la landing y el README.**~~ *Aprobadas por el propietario y aplicadas el 2026-11-14 17:41 (UTC-5).* Se tomaron el 2026-11-14 en el Redmi Note 9 con una tienda ficticia ("Tienda Don Pepe", teléfono `+57 300 000 0000`, moneda COP). Los textos de cada pantalla se revisaron sin hallar datos personales; **no se comprobó sobre los píxeles (no hay OCR) y la sesión no pudo ver las imágenes**. La carpeta temporal de revisión se borró. Los PIN y el código de recuperación de prueba no se anotan en este repositorio.

## Revisión del 2026-11-13

Hecha entre las 18:51 y las 19:24 (UTC-5). Cada punto dice si fue **verificado** (comando o prueba ejecutada) o es una **inferencia**.

### Cerrado hoy (commits locales y subidos a `main`)

- **Cursores de sync tras restaurar un respaldo** (`6ad3303`). `restoreFullBackup` ahora reinicia `last_pushed_at`, `last_pulled_at` y `last_synced_at` en la misma transacción ([restoreOps.ts](apps/mobile/src/restoreOps.ts)). Conserva `server_url` y `token`. Probado con SQLite real. **No se pudo probar en dispositivo contra la nube** (no se activó la nube).
- **Salida del modo desarrollador** (`f46ab3b`). Tocar la versión en Más con el modo activo pide confirmar y lo desactiva ([developerMode.ts](apps/mobile/src/developerMode.ts)).
- **CI** (`0d02877`). [ci.yml](.github/workflows/ci.yml) ejecuta `verify.sh`, `pnpm -r typecheck` y `pnpm test` en Node 22. Antes `apps/mobile` no tenía script `test` y los 460 tests móviles no corrían en los PR. **Verificado en Actions** (CI verde en `2cb7c73` y `e995351`).
- **Estado de la nube** (`4dc5d22`, `250409a`). Inicio, Más y Respaldo en la nube leen `sync_state` mediante [useCloudConnected.ts](apps/mobile/src/useCloudConnected.ts). La tarjeta de Más dice "Activado, pero aún no se ha sincronizado" hasta que haya una sincronización real.
- **Escáner de un código** (`c8acfaa`). [ScanModal.tsx](apps/mobile/src/pos/ScanModal.tsx) usa `ScannerCamera` y su máquina de estados; un test impide que otro archivo use `CameraView` directamente. **Verificado en teléfono** (ver abajo).
- **Pie de Más** (`3adae39`). Muestra la versión de `app.json` (`v1.1.4`). **Verificado en teléfono.**
- **Specs y documentación** (`f6ef2a9`, `52775ce`). Existen [ui-spec.md](docs/ui-spec.md), [core-spec.md](docs/core-spec.md) y [sync-spec.md](docs/sync-spec.md). Se corrigieron `architecture.md`, `development.md`, `database.md`, los README y DEPLOY de los Workers; `roadmap.md` lleva un aviso de que es el plan original.
- **Parches de Expo** (`2cb7c73`). Siete paquetes alineados con el SDK 57 (`expo` 57.0.33, `expo-sqlite` 57.0.5, `expo-updates` 57.0.28, `expo-constants`, `expo-linking`, `expo-router`, `expo-sharing`). El paso "Check Expo SDK alignment" volvió a pasar. **El fingerprint cambió** (`2d4f6ea4…` a `d38579f1…`, medido con `expo-updates fingerprint:generate`): los APK anteriores no reciben OTA de este código.
- **Build más rápido y release protegido** (`e995351`). Fuera de los tags el APK es solo `arm64-v8a`; los tags siguen con dos arquitecturas y una guarda que lee el APK con `aapt2`. Un tag `vX.Y.Z` debe coincidir con `app.json` ([releaseTag.ts](apps/mobile/src/releaseTag.ts)). Pages solo se despliega si cambia `landing/`. **Medido en Actions:** 18,2 min (`2cb7c73`, en frío) a 9,6 min (`e995351`) y 8,9 min (`96ef554`); Gradle 16,9 a 7,5 min. La línea base de 18,2 min fue un build en frío; con caché caliente el histórico era de 9 a 13 min, así que la mejora real es menor y falta medir más corridas. **La ruta del tag (validación, dos arquitecturas y publicación) nunca se ha ejecutado con estos cambios.**

### Pruebas en dispositivo real hechas el 2026-11-13

- **Dispositivo:** Redmi Note 9 (`M2003J15SC`), Android 12, arm64, sin tiendas reales.
- **APK probado:** artefacto `app-release-apk` del build de `2cb7c73` (run `43492991628`), `versionCode` 10, firmado con la llave de producción (huella SHA-256 `e798f4a4…1cc32d`, idéntica a la esperada y a la del APK ya instalado; se actualizó con `adb install -r` sin perder datos). **No incluye** `e995351`.
- **Arranque y navegación:** sin cierres en toda la sesión (0 `FATAL EXCEPTION` en `logcat`).
- **Respaldo y restauración** (con el `expo-sqlite` 57.0.5 nativo): se cargó el catálogo de ejemplo (100 productos) y se hizo la venta INV-0001. "Guardar copia en el teléfono" guardó y verificó 231 registros en `surtivox-backup-20261113.json` (90 491 bytes; 12 migraciones, 100 productos, 100 movimientos de stock y 1 venta). Se hizo INV-0002 **después** del respaldo y se restauró: "Restauración completa, 231 registros en 20 tablas". Resultado: INV-0002 desapareció, INV-0001 siguió, el stock del aceite volvió a 9 y siguen los 100 productos. Una venta nueva se numeró INV-0002 (sin duplicar) y los datos sobrevivieron a un cierre forzado de la app.
- **Cámara** (con `ScanModal` nuevo): activa con el escáner abierto, **liberada** al ir a segundo plano y al bloquear la pantalla, y **reanudada sola** al volver o desbloquear (medido con `dumpsys media.camera`). Con el permiso revocado: "Necesitamos permiso para usar la cámara" y "Permitir"; el diálogo del sistema aparece; tras negar, "La cámara está bloqueada en los ajustes del teléfono" y "Abrir ajustes", que abre los ajustes de la app; al conceder el permiso y volver, la cámara arrancó sola. Se leyó un código real.
- **Venta sin stock:** en Productos, "Agregar" mete el producto sin aviso; en el cobro aparece "Sin stock: … Puedes venderlo con confirmación" y al completar "¿Deseas venderlo de todas formas?". Cancelar no vende; confirmar vende (INV-0003, cambio correcto).
- **Anulación repetida:** se anuló INV-0003 con tres toques seguidos en el botón de confirmar. El stock de ese producto quedó en 0 (no en 1) y "Total de Hoy" bajó a $19.000 (INV-0001 + INV-0002). **No se pudo comprobar** que el segundo y el tercer toque llegaran a ejecutar una anulación; solo se comprobó que el inventario quedó consistente.
- **No se pudo verificar:** la copia automática previa a restaurar (`safety/`, está en el almacenamiento privado y la app no es depurable), los cursores de sync tras restaurar (la nube no se activó), ni el aspecto visual (la sesión no ve imágenes). Se leyó la interfaz con `uiautomator`.
- **Estado en que quedó el teléfono:** catálogo de ejemplo cargado (100 productos), tres ventas (dos vigentes y una anulada) y una carpeta `Download/SurtivoxRespaldos/` con un respaldo. La carga del catálogo ocurrió, con probabilidad, por toques desviados de la automatización; no se confirmó que no la hiciera una persona.

### Hallazgos nuevos del 2026-11-13

- ~~**Respaldo: Android 11 o superior rechaza la carpeta Descargas.**~~ *Cerrado el 2026-11-13 19:33 (UTC-5, `6125bd6`):* el subtítulo ahora dice "Elige o crea una carpeta dentro de Descargas" y un test impide volver a sugerir la raíz. *Hallazgo original, verificado en Android 12:* [data.tsx](apps/mobile/app/data.tsx) dice "Elige una carpeta (por ejemplo Descargas)" y [backup.ts](apps/mobile/src/backup.ts) abre el selector en `Download`, pero el sistema responde "No se puede usar esta carpeta. Para proteger tu privacidad, elige otra carpeta" y no deja usarla (el botón "Usar esta carpeta" no avanza). Se completó creando una subcarpeta (`SurtivoxRespaldos`). Corrección mínima: cambiar el texto a "Crea una carpeta dentro de Descargas". Sin probar en Android 10 o inferior.
- ~~**Productos y Ventas no se refrescan tras vender en la misma pestaña.**~~ *Corregido el 2026-11-13 19:33 (UTC-5, `cb3e996`), pendiente de verificar en dispositivo.* El carrito y el cobro viven en el layout de pestañas, así que una venta puede cerrarse con cualquier pestaña enfocada. *Reproducido antes del cambio:* tras vender 1 unidad desde Productos la lista siguió mostrando "10 en stock" (el dato era 9) y tras vender INV-0004 desde Ventas la lista siguió mostrando 2 pedidos cuando había 3; al cambiar de pestaña los datos eran correctos. Las tres pestañas (Inicio, Productos, Ventas) recargan ahora con `salesVersion` ([salesRefreshWiring.test.ts](apps/mobile/src/salesRefreshWiring.test.ts)). **Falta comprobar con el siguiente APK de CI** que vender desde Productos y desde Ventas, y anular una venta, actualizan la lista; la anulación ya no llama a `refresh()` directo y depende de ese mecanismo.
- **Ventas: las ventas anuladas no aparecen en la lista**, ni con "Todo el tiempo". *Observación, sin verificar* si existe otro filtro o pantalla para verlas.
- **Dependabot (2026-11-13).** Había 10 PR abiertos y sus ejecuciones fallaban ("Run Dependabot"; no se vio el log). Cuatro subían `expo`, `expo-sqlite`, `expo-status-bar` y `expo-camera` al SDK 58, que no es compatible con React Native 0.86; uno subía `wrangler` de 3.x a 4.x; cinco actualizan GitHub Actions a versiones mayores y tocan los workflows de firma y build. *Configurado el 2026-11-13 19:43 (UTC-5):* [dependabot.yml](.github/dependabot.yml) ignora las subidas mayores de `expo`, `expo-*`, `@expo/*`, `react-native-*` y `wrangler`, y las mayores y minor de `react-native`, `react` y `@types/react` (en React Native 0.x una minor rompe compatibilidad); un test ([dependabotConfig.test.ts](apps/mobile/src/dependabotConfig.test.ts)) comprueba que toda dependencia de `apps/mobile` con rango `~` quede cubierta. *Verificado en la API de GitHub el 2026-11-13 19:49 (UTC-5):* tras el push de `96ef554`, `dependabot[bot]` cerró por sí mismo los PR 14, 15, 17 y 18 (a las 19:47 del 2026-11-13) y borró sus ramas; no se fusionó ninguno (`main` sigue en Expo 57). La causa del cierre no la informa la API; por la hora y el actor, lo más probable es que fueran las reglas nuevas. **Sigue abierto el PR 16** (`expo-status-bar` 57.0.1 a 58.0.4, sin cambios desde el 2026-11-10): cerrarlo con `@dependabot close` si Dependabot no lo cierra tras un "Check for updates". Los PR de GitHub Actions se recrearon con otros números: 19 y 20 (`codeql-action` 3.38.2 a 4.39.3, analyze e init), 21 (`checkout` 4 a 7), y siguen el 3 (`setup-node` 4.4.0 a 7.1.0) y el 6 (`scorecard-action` 2.4.4 a 2.5.0). **Revisados el 2026-11-14 15:16 (UTC-5)** con la API pública de GitHub: los cuatro SHA nuevos (`checkout` v7.0.1, `setup-node` v7.1.0, `codeql-action` v4.39.3, `scorecard-action` v2.5.0) **coinciden con sus etiquetas oficiales**. PR 21 (`checkout`): CI y CodeQL verdes y mezcla limpia; `checkout` desde v5 usa Node 24 y pide runner 2.327.1 o superior (los de GitHub lo cumplen); también cambia `pages.yml` de `@v4` a `@v7`, que sigue **sin fijar por SHA**. PR 3 (`setup-node`): checks verdes pero la rama está desactualizada (parte de `3adae39`, anterior a los cambios de `build-android.yml`); desde la v5 el caché automático por `packageManager` no afecta porque los workflows ya fijan `cache: pnpm`; pedir `@dependabot rebase` antes de fusionar. PR 19 y 20 (`codeql-action` analyze e init): **su análisis falló** (`Analyze: failure`) porque cada uno cambia solo una de las dos acciones del mismo job y mezcla v3 con v4; además dejan el comentario `# v3` y **no tocan** `codeql-action/upload-sarif`, que [scorecard.yml](.github/workflows/scorecard.yml) sigue usando en v3. No fusionarlos por separado. *Hecho el 2026-11-14 15:25 (UTC-5):* `init`, `analyze` y `upload-sarif` quedaron juntos en el SHA de la v4.39.3 (`33d7b85…`) en un solo commit, con un test que exige que sigan unificados ([workflowPins.test.ts](apps/mobile/src/workflowPins.test.ts)); se comprobó en la API que las tres acciones existen en ese SHA, corren en Node 24 y aceptan `languages`, `queries` y `sarif_file`. **Verificado en Actions el 2026-11-14 17:42 (UTC-5):** con `7570178` pasaron CodeQL (`init` y `analyze` en v4), Scorecard (`upload-sarif` en v4) y el resto de los workflows. *Estado verificado en la API el 2026-11-14 18:03 (UTC-5):* **no queda ningún PR abierto.** Los PR 14, 15, 16, 17 y 18 se cerraron sin fusionar (Dependabot, 2026-11-13 19:47 a 19:56) y los 19 y 20 se cerraron sin fusionar el 2026-11-14 15:32; el propietario fusionó el 3 (`setup-node` v7.1.0), el 21 (`checkout` v7.0.1) y el 6 (`scorecard-action` v2.5.0) el 2026-11-14 a las 17:57 y 17:58. **Los builds posteriores a esas fusiones no validaron `build-android.yml`:** el de `c13cc35` y el de `b812f81` se cancelaron entre sí y el de `13b3563` se saltó (0,2 min) porque su diff solo tocaba `scorecard.yml`; el último build real (`3199aa2`, 9,3 min) es anterior y usa las acciones viejas. `ci.yml` y CodeQL sí pasaron con `checkout` v7. *Resuelto el 2026-11-14 18:27:* el propietario ejecutó «Build Android APK» a mano (run #45, `workflow_dispatch` sobre `13b3563`) y terminó en verde en 6,7 min; sus pasos `Checkout` (v7.0.1), `Setup Node.js` (v7.1.0), tipos y tests, firma y arquitecturas pasaron (verificado en la API). **La ruta de tag (validación del tag, dos arquitecturas y publicación del release) sigue sin ejecutarse con estos cambios.** *Desde `a3ea7b3` (2026-11-14 18:41) el lanzamiento manual tiene el parámetro `all_archs`:* compila y verifica las dos arquitecturas como un release, sin publicar nada; todavía no se ha ejecutado. PR 6 (`scorecard-action`): rama de 2026-10-27, sin validar (ese workflow no corre en PR); las notas de Scorecard v5.6.0 dicen que quien usa CLI o API no cambia nada y solo se retiró la app alojada de Allstar, que aquí no se usa. ~~**Pendiente aparte:** `pages.yml` usaba acciones por etiqueta, no por SHA.~~ *Cerrado el 2026-11-14 15:27 (UTC-5):* [pages.yml](.github/workflows/pages.yml) fija las cuatro acciones por SHA (`checkout` v7.0.1, `configure-pages` v5.0.0, `upload-pages-artifact` v3.0.1, `deploy-pages` v4.0.5; las tres últimas son las versiones a las que apuntaban sus etiquetas móviles, verificado en la API). Un test ([workflowPins.test.ts](apps/mobile/src/workflowPins.test.ts)) exige que toda acción externa de todos los workflows esté fijada por SHA de 40 caracteres y con su versión en un comentario. *Verificado en Actions el 2026-11-14 17:42:* el primer despliegue de Pages con las acciones fijadas por SHA (`7570178`) terminó bien. **Efecto en el PR 21:** también cambiaba `pages.yml` (`@v4` a `@v7`), así que tras subir este cambio puede quedar con conflicto; si pasa, comentar `@dependabot rebase`.
- **`expo install --check` rompe el build en cada parche nuevo de Expo.** *Verificado el 2026-11-13* (siete paquetes un parche atrás impidieron compilar el APK). Decidir si el check sigue siendo estricto o pasa a advertencia.
- **`expo install --fix` puede dejar el trabajo a medias** con una red lenta: dejó `pnpm-lock.yaml` y `package.json` inconsistentes y `pnpm install --frozen-lockfile` fallaba. Verificar siempre con `--frozen-lockfile` y `expo install --check`.
- **Compilar en este equipo no es posible:** el NDK 27.1.12297006 de `~/Android/Sdk/ndk/` es una carpeta vacía (resto de una descarga fallida del 2026-10-28) y React Native 0.86 exige esa versión. `sdkmanager` no lee las variables de proxy: necesita `--proxy_host 192.168.49.1 --proxy_port 8228`. Mientras tanto, los APK de prueba salen del artefacto de CI.
- **Pagos: `/pagos/crear` autentica contra `sync_tokens`** ([payments-worker/src/index.ts](apps/payments-worker/src/index.ts), `authorized`), tabla que el sync-worker vacía al migrar tokens a `shop_keys` (hash). Con el código actual, una tienda registrada no podría autorizar el pago. **Inferencia por lectura de código; el Worker de pagos no está desplegado.** Pospuesto con el resto del cobro.
- ~~**La pantalla de nube prometía "Respaldo automático".**~~ *Cerrado el 2026-11-13 20:04 (`cecfe5b`):* `syncNow` solo se llama con el botón, así que la promesa era falsa y una tienda que la creyera perdería ventas al dañarse el teléfono. Ahora dice "Guarda tu tienda en la nube con un toque". La misma frase seguía en `paywall.tsx`, retirado el 2026-11-16. Si se quiere sincronización automática, es una función nueva.
- **Pull sin tope de filas y sin cuota por tienda.** El sync gratuito no limita registros exitosos ni filas por tienda (ver [sync-spec.md](docs/sync-spec.md), "No implementado"). Pendiente de decisión del tope.

## Estado de la infraestructura (Cloudflare)

Desplegado por la API REST el 2026-11-04, porque Wrangler 3.114 falla con `fetch failed` detrás del proxy de este equipo (el proxy es la única salida a Internet).

| Worker | D1 enlazada | Notas |
|---|---|---|
| `surtivox-sync` | `surtivox-sync` (`1faf3ce0-aa7a-414d-bc0e-e28d9be9d336`) | 16 tablas. `sync_tokens` empezó vacía. |
| `surtivox-catalog` | `surtivox-catalog` (`b6740661-3359-4780-aff9-6cd5624992a7`) | Cron `17 3 * * *`. `CATALOG_SALT` rotada a un valor aleatorio. |
| `surtivox-market` | no usa D1 | Precios de referencia. |
| `surtivox-pagos` | **no desplegado** | Ver sección de cobro. |

El duplicado `surtivox-catalogo` fue borrado. El token de API usado para el despliegue debe revocarse.

## P1 · Integridad del sync

- **Cursor del servidor (P1-2).** *Verificado.* El cursor de pull es el mayor `updated_at`/`created_at` que puso el dispositivo ([sync-worker/src/index.ts](apps/sync-worker/src/index.ts), [mobile/src/sync.ts](apps/mobile/src/sync.ts)). Una venta creada sin conexión y subida tarde no llega a un dispositivo que ya avanzó su cursor. Solución: columna asignada por el servidor (`server_seq` o `received_at`) y paginar por ella. **Requiere migración de D1 y cambio de contrato.**
- **Pull sin paginar.** *Verificado.* Una tienda grande se descarga en una sola respuesta.
- **Sync de varias tiendas (P2-5).** *Verificado.* `changedSinceSql` no filtra por tienda y hay un solo cursor `last_pushed_at`. El servidor descarta lo ajeno, pero no hay prueba.
- **Reloj del dispositivo.** El último que escribe gana según `updated_at` del dispositivo: un reloj adelantado siempre gana.
- **Borrados.** Solo hay borrado lógico en productos, clientes, proveedores y personal. `categories` no tiene `deleted_at`.
- **`image_uri` local se sincroniza** como ruta que no sirve en otro dispositivo.
- **`restoreFromCloud` borra todas las tiendas locales**, no solo la vinculada.

## Seguridad

- **Tokens de sync en texto plano en D1** (`sync_tokens.token`). *Parcialmente superado (2026-11-13):* el código del Worker guarda el hash en `shop_keys` y migra y borra los tokens heredados al primer uso ([sync-worker/src/index.ts](apps/sync-worker/src/index.ts)). **No se verificó si el Worker desplegado incluye ese cambio** (la sección del kit de recuperación dice que faltaba desplegar).
- **Sin rate limit** en sync, pagos ni catálogo. CORS abierto (`*`).
- **El registro (`/sync/register`) ya no permite tomar una tienda ajena**, pero se apoya en que el primero que registra gana. Reinstalar la app o "Borrar todo" pierde el token: la tienda solo se recupera con el código original. Mostrar y recordar el código al activar la nube.
- ~~**Ids con `Math.random`**~~ *Cerrado el 2026-11-13 20:04 (UTC-5, `03cfd67`):* [id.ts](apps/mobile/src/id.ts) usa `Crypto.randomUUID()` de `expo-crypto`. Sin verificar en dispositivo. **Queda un detalle sin decidir:** `DEVICE_ID` se genera en cada arranque, así que `device_id` de las filas identifica un lanzamiento de la app y no un teléfono.
- **PIN con `cyrb53` y sal de `Math.random`** ([roles.ts](apps/mobile/src/roles.ts)). Un PIN de 4 dígitos se revierte al instante desde un respaldo o desde D1, y el hash viaja por el sync.
- **`allowBackup="true"`** en el manifest de Android: la copia automática a Google Drive incluye fiado y token.
- **El respaldo JSON incluye los hashes de PIN y `local_settings`** (verificado el 2026-11-14; ver la revisión de esa fecha). *Aceptado para la Beta; cifrar el archivo a futuro.* Además incluye `local_settings` completo, con claves como `catalog_install_id`, `developer_mode` y `last_error` cuando existen.
- **`last_error`** se trunca a 300 caracteres y se redacta (Bearer, cadenas hexadecimales largas, códigos de tienda y palabras del kit) con `redactSecrets` ([diagnostics.ts](apps/mobile/src/diagnostics.ts), [redact.ts](apps/mobile/src/redact.ts)). *Verificado en el código el 2026-11-13; corrige la nota anterior.*
- **Catálogo comunitario (P2-9).** El `install_id` lo elige el cliente: dos ids inventados alcanzan el umbral de consenso. Falta limitar por IP.
- **Política de privacidad del catálogo** sigue en borrador sin publicar ([docs/privacidad-catalogo-borrador.md](docs/privacidad-catalogo-borrador.md)).
- **Revocar** cualquier token de API de Cloudflare que se haya compartido.

## Cobro y suscripción

*Verificado:* la app todavía no puede cobrar.

- La app no tiene código de cobro: `payments.ts` (con `CHECKOUT_ENDPOINT = ''` y sin llamadores) se retiró el 2026-11-16. El cliente del pago se escribe de nuevo cuando se conecte.
- El Worker de pagos solo expone `POST /pagos/crear`. **No hay webhook**, no se escribe `entitlements` y no hay conciliación de `wompi_tx_id`.
- Las tablas `payment_intents`, `entitlements` y `wompi_events` **no existen** en la D1 `surtivox-sync` (falta aplicar [payments-worker/schema.sql](apps/payments-worker/schema.sql)).
- Los secretos `WOMPI_*` no están configurados.
- Círculo sin salida: `/pagos/crear` exige un token ya registrado en `sync_tokens`, y registrarlo exige sincronizar. El token debería emitirse al crear el pago.
- Falta idempotencia: cada llamada crea un `payment_intent` nuevo.
- ~~**Dos fuentes de verdad de la suscripción, `paywall.tsx` por deep link con "USD 5/mes" y `expo-iap` sin uso.**~~ *Cerrado el 2026-11-16 (sale en la 1.1.8):* se borraron `paywall.tsx`, `subscription.ts` y `payments.ts`, se quitó `expo-iap` (dependencia y plugin) y la ruta `/paywall`. `cloudStatusWiring.test.ts` falla si alguno vuelve. Cambió la huella nativa, pero la 1.1.6 de todos modos no podía recibir OTA (su APK no lleva canal: revisado en `assets/app.config`).
- **Precios inconsistentes** en el código: "$2/mes", "$5.00", "USD 5/mes", "≈ 20.000 COP". El cargo real es 20.000 COP. Definir un solo precio y moneda.
- Decidir si el Worker de pagos conserva la D1 compartida con sync o se separa con un Service Binding.

## Legal y privacidad (pendiente de revisión por un abogado colombiano)

- **Los textos de la app son un borrador sin revisión legal** ([legalText.ts](apps/mobile/src/legalText.ts)). Describen el comportamiento real del código, pero no los ha aprobado un abogado. Al cambiarlos hay que subir `LEGAL_VERSION` en [legal.ts](apps/mobile/src/legal.ts): la app vuelve a pedir la aceptación.
- **Faltan el domicilio y el teléfono del responsable** (Mateo Castro). Hoy solo figura el correo.
- **La web repite los textos de la app.** [privacidad.html](landing/privacidad.html) y [terminos.html](landing/terminos.html) contienen las secciones de la app palabra por palabra (privacidad 1 a 9 y términos 1 a 11) y añaden las propias del sitio. [landingLegal.test.ts](apps/mobile/src/landingLegal.test.ts) falla si se desalinean. Si cambias [legalText.ts](apps/mobile/src/legalText.ts), actualiza las dos páginas y sube `LEGAL_VERSION`. Los borradores internos viven en `docs/`, fuera de lo que publica GitHub Pages.
- **Conservación:** el aviso dice "mientras el servicio esté activo o hasta que solicites su supresión". No hay plazos definidos ni herramienta para borrar datos del servidor: hoy una solicitud de supresión es manual.
- **Transferencia internacional** (Cloudflare, Expo) sin clasificar; verificar con el abogado y, si aplica, el Registro Nacional de Bases de Datos.
- **La prueba de aceptación vive solo en el teléfono** (`legal_accepted_version` y `legal_accepted_at` en `local_settings`). Es evidencia débil.
- **Consultas de código de barras sin consentimiento:** al escanear un código desconocido la app consulta Open Food Facts y el catálogo de Surtivox (solo el código y la IP). Está declarado en el aviso; decidir si requiere opt-in.
- **Catálogo comunitario:** el aviso inicial es opt-in (nunca preseleccionado). No cambiarlo a opt-out: la autorización debe ser previa y expresa (Ley 1581, art. 9).
- **Contraste:** `muted`, `faint`, `dangerText` y `warnText` cumplen 4,5:1 en todas las superficies y en ambos temas, con test ([themeContrast.test.ts](apps/mobile/src/themeContrast.test.ts)). `danger` y `warn` quedan para rellenos, bordes e iconos y un test impide usarlos como color de texto. **Siguen por debajo de AA en modo claro** `accent` como texto (2,8 a 3,1:1; es la identidad de la marca y se decidió no tocarlo) y `ok` (2,4:1). El texto blanco sobre `danger` da 3,9:1 en claro y 3,4:1 en oscuro, y sobre `warn` 2,4:1; no se midieron los botones con `accentFg`. Los iconos de `warn` (2,1 a 2,4:1) tampoco llegan a 3:1.
- **Pendiente de prueba en dispositivo:** instalación limpia; actualización desde v1.0.3 con tienda existente (debe mostrar los términos y luego la pregunta del catálogo si no se respondió); fuente al 200 %; TalkBack; aviso de la nube con fuente grande.

## Kit de recuperación (2026-11-05)

Implementado sin desplegar: llave de 8 palabras generada en el teléfono, huella en el servidor, rotación y límite de intentos. Diseño en [apps/sync-worker/README.md](apps/sync-worker/README.md).

- ~~**Falta aplicar la migración D1 y desplegar el Worker antes de publicar el APK.**~~ *Verificado como desplegado el 2026-11-14 18:41 (UTC-5), con autorización del propietario, contra `https://surtivox-sync.surtivox.workers.dev`:* `GET /health` responde 200 con 15 tablas; `POST /sync/rotate` sin credenciales y con un cuerpo inválido responde 400 `invalid_request` (un Worker anterior al kit respondería 401, como la ruta inexistente de control); y una petición con un token inventado a `/sync/pull` responde 401 limpio y no 500, lo que indica que las tablas `shop_keys` y `kit_attempts` existen. **Efecto de la prueba:** esas peticiones con credenciales inválidas anotaron 2 fallos en el contador de la IP de este equipo (5 libres cada 10 minutos). *Sin verificar:* el comportamiento completo del kit (activar, rotar, recuperar con un teléfono real), que siguen sin probarse en dispositivo contra este Worker.
- **La lista de 2048 palabras requiere revisión humana** (palabras ofensivas, coloquialismos de Colombia). La escribí yo y solo comprobé ortografía contra el diccionario del sistema; el test valida unicidad, longitud, primeras 4 letras únicas y ausencia de homófonos obvios, no el buen gusto.
- **Lista de palabras cambiada (2026-11-06):** se sustituyeron 40 palabras sensibles en el mismo índice (`recoveryWords.ts`). Un kit generado antes de este cambio que contenga alguna de ellas **ya no se puede recuperar** con la lista nueva: se rechaza como "El kit no es válido" o, peor, se interpreta como otra llave. Quien tenga un kit de prueba debe usar "Cambiar llave" y guardar el kit nuevo. El servidor no cambió: solo guarda una huella de la llave, no las palabras. La lista dejó de estar ordenada alfabéticamente a propósito para no mover índices.
- **Fase de QR bloqueada:** no hay generador de QR ni `react-native-svg`. Tampoco `react-native-view-shot` (sin "Guardar imagen"), `expo-secure-store` ni `expo-local-authentication` ("Ver mi kit" solo lleva una advertencia, sin pedir el bloqueo del teléfono).
- **La entropía `E` se guarda en `local_settings`** (`kit_entropy_v1`) para poder volver a mostrar el kit. Se excluye de las copias JSON y de los diagnósticos, pero `allowBackup="true"` sigue copiando la base completa a Google Drive.
- **Sin sugerencias de palabras al escribir** en la pantalla de recuperar; el error dice qué palabra no existe.
- **"Copiar" usa el menú de compartir del sistema** (sin librería de portapapeles).
- **Versiones viejas de la app** no entienden el kit: un teléfono con la app anterior vinculado a una tienda rotada recibe 401 y no puede ingresar las palabras.
- **Sin probar en dispositivo:** pantallas del kit y de recuperar, compartir por WhatsApp, rotación contra el Worker real y el límite de intentos bajo D1 real.

## Asistente de producto desconocido (2026-11-06)

- **Sin probar en dispositivo:** pantallas, teclado, cámara del sistema, reanudación tras cierre real de la app y fuentes grandes. Solo hay pruebas de lógica, wiring y empaquetado.
- **Correo en el User-Agent de Open Food Facts:** se usa `LEGAL_CONTACT` ([legalText.ts](apps/mobile/src/legalText.ts)). El dueño confirmó `pragramademateo@gmail.com` como correo público de contacto (2026-11-06). Si cambia, se modifica solo `LEGAL_CONTACT`. Sin correo, el User-Agent sale sin contacto y no cumple el formato pedido.
- **Fotos de Open Food Facts sin atribución por foto:** la hoja de producto desconocido y el alta manual siguen descargando la imagen de esa fuente como foto del producto. La atribución está solo en Más → Licencias; no hay marca de origen por foto.
- **La hoja y el alta manual siguen precargando nombre e imagen de terceros** (el asistente no lo hace). Si se quiere eliminar esa precarga, es un cambio aparte.
- **Caché de Open Food Facts:** la consulta del alta manual ahora tiene caché de sesión de 12 horas en memoria; la persistente (`barcode_lookups`) solo la usa la hoja.
- **Marca y tamaño** se guardan dentro del nombre porque el producto no tiene esos campos; al catálogo se envía el nombre con la marca y el tamaño como presentación (máx. 20 caracteres).
- **Una sugerencia editada** (por ejemplo, el nombre sugerido por otra fuente al que se le cambia una letra) sigue pudiendo enviarse como aporte; solo se bloquea cuando queda idéntica a la sugerencia.
- **Cajeros:** el asistente no exige el permiso `products`, igual que la hoja actual; cualquier rol puede crear productos desde el escáner.
- **Un cierre de `scripts/verify.sh` con `GATE FAIL` que no pude reproducir** ocurrió una vez durante el desarrollo, tras restaurar un archivo de prueba de mutación; las cuatro ejecuciones siguientes dieron `GATE OK`.

## Rediseño visual "Mercado vibrante"

- **No se pudo capturar la app real.** No había teléfono ni emulador. Solo se comparó una maqueta HTML con los mismos números que el código (no es la app). Falta revisar en dispositivo: curvas del encabezado (`borderRadius: '50%'` en Android), sombras (`boxShadow`), tamaños con fuente grande y pantallas de 320 a 600 dp, en modo claro y oscuro.
- **El logotipo de "Trailer Rodante" no está en el proyecto.** El encabezado usa el nombre, el eslogan y el logotipo de la tienda (se cargan en Más → Perfil y recibos); sin logotipo muestra el icono genérico de tienda. No se fijó "Trailer Rodante" en el código porque la app admite varias tiendas.
- **La ilustración del bloque promocional es un recorte de la imagen de referencia** (`assets/promo/mas-ventas.webp`, 552x514) con el texto incluido en la imagen: no se traduce ni escala con el tamaño de letra. Conviene reemplazarla por una pieza diseñada a mayor resolución.
- **Apariencia:** Claro, Oscuro, Automático por hora (por defecto de 7:00 p. m. a 6:00 a. m., configurable) o Igual que el teléfono. La elección se guarda en `local_settings` (`appearance`, `night_from`, `night_until`) y se aplica desde [appearance.ts](apps/mobile/src/appearance.ts); el botón de luna/sol de Inicio alterna claro y oscuro. **Por defecto sigue siendo claro** (`DEFAULT_APPEARANCE`). Sin probar en dispositivo: el modo "Igual que el teléfono" (usa `Appearance.setColorScheme('unspecified')`), el cambio automático con la app abierta (revisa cada 60 s y al volver a la app) y los teclados y diálogos del sistema en oscuro.
- **Siempre claros aunque el modo sea oscuro:** la intro de arranque (`LaunchIntro`, aparece antes de leer la preferencia), la pantalla de error, el splash nativo y la tarjeta promocional de Inicio (es una imagen clara). La landing es solo clara.
- **Pendiente de la nueva identidad:** icono de la app (el launcher sigue con el fondo `#0B0E12` y el glifo anterior). El splash nativo ya es claro, pero **solo se ve con un APK nuevo**: el cambio de `app.json` altera el fingerprint y esa actualización no llega por OTA a los APK instalados.
- **Ajuste a la paleta pedida:** el texto secundario `#64736D` da 4,15:1 en el peor caso y se usa `#5E6C67` (4,58:1) para conservar el mínimo de 4,5:1 con test. Las superficies `surfaceAlt` y `chip` se aclararon un poco por el mismo motivo.
- **`ok` (verde brillante) como texto** sigue en 2,7:1 sobre blanco; solo se usa en fondos e importes de ayuda.

## Personal y roles

- **El PIN es un candado de conveniencia, no una protección fuerte.** Son 4 dígitos con `cyrb53` (no criptográfico) y la huella viaja a la nube con el resto de `staff` para que otros dispositivos puedan autenticar. Quien tenga acceso a la base o al servidor puede recuperar un PIN en segundos. El límite de intentos protege solo contra quien usa la pantalla. Cambiarlo implica versionar el hash y decidir si la huella debe sincronizarse.
- **El bloqueo por intentos es local a cada dispositivo** (`local_settings`, clave `pin_guard:<id>`): el contador no se comparte entre teléfonos.
- **Quien borra la app o "Borrar todo" reinicia el control.** Es inherente a un esquema sin servidor.
- **Rutas protegidas por rol:** la lista está en [routeAccess.ts](apps/mobile/src/routeAccess.ts). Una pantalla nueva con permiso debe añadirse ahí; `/add-customer` queda abierta a propósito porque el cajero la usa al cobrar un fiado.
- **El rol de otra persona editada mientras está conectada** no se actualiza en su sesión hasta que se bloquee; solo se refresca la sesión propia.
- **Recuperación del propietario (implementada, sin cambios de esquema).** Código de 16 caracteres (80 bits) generado con el aleatorio de `expo-crypto`; se guarda solo una huella SHA-256 con sal en `local_settings` (`recovery_hash:<tienda>`, `recovery_salt:<tienda>`), que no se sincroniza a la nube. Se muestra una vez, se rota al usarse y tiene el mismo límite de intentos que el PIN. Detalles a recordar:
  - "Copiar" usa el menú de compartir del sistema porque no hay librería de portapapeles instalada (no se añadieron dependencias).
  - Las tiendas que ya existían no tienen código: ven un aviso en Inicio y un botón en Personal y roles.
  - Sin código y con un solo propietario, la única salida es borrar los datos de la app; restaurar una copia no ayuda porque trae las mismas huellas de PIN.
  - La huella del código viaja en las copias JSON (`local_settings`); el código en sí nunca se guarda.
  - Cualquiera con el código puede cambiar el PIN del propietario: hay que guardarlo fuera del teléfono.
  - El alfabeto del código de tienda de [sync.ts](apps/mobile/src/sync.ts) contiene la `L` aunque su comentario dice que no; el de recuperación sí la excluye. Es cosmético y no afecta a los códigos existentes.
- **Pendiente para la v1.0.4 (decidido, requiere migración o cambios estructurales):**
  1. **Registrar quién anula o devuelve.** Hoy solo la venta guarda quién la cobró (`sales.staff_id`); `returns` y las anulaciones no. Requiere una columna nueva y migración.
  2. **PIN más fuerte.** PIN de 6 dígitos para el propietario, hash versionado (SHA-256) con mejora silenciosa al iniciar sesión, y decidir si la huella del PIN debe sincronizarse a la nube.
  3. **Aprobación del supervisor** (PIN de un administrador) para descuentos grandes, anulaciones y devoluciones hechas por un cajero.
- Sin probar en dispositivo: pantalla de bloqueo con cuenta atrás, bloqueo automático al volver de otra app, la guardia de rutas, el flujo "¿Olvidaste tu PIN?" y la hoja del código con "Copiar o compartir".

## Landing

- **Invertida a tema claro** con la paleta de marca (variables de `landing/styles.css`; hay test en [landingTheme.test.ts](apps/mobile/src/landingTheme.test.ts)). La sección "Hecho para tienda de barrio" y la tarjeta final son verde oscuro a propósito.
- ~~**Las imágenes `screen-*.webp` y `og-image.png` eran maquetas HTML.**~~ *Cerrado el 2026-11-14 17:41 (UTC-5, `5cbe5b1` y `293676f`):* `screen-home`, `screen-checkout` y `screen-reports` son capturas reales sin barra de estado, a 720×1493 (no 1600): el HTML declara esa altura y el marco del teléfono usa `aspect-ratio: 720 / 1493`, porque con 9 / 20 recortaría los lados del teléfono grande y dejaría un hueco en los pequeños. [og-image.png](landing/assets/og-image.png) se genera con [make-og-image.py](scripts/make-og-image.py) a partir de `screen-home.webp`; el script comprueba que nada se salga ni se solape, y los contrastes de texto salen entre 4,6:1 y 14,1:1. Las cuatro capturas del README se actualizaron (`510540e`). Un test ([landingImages.test.ts](apps/mobile/src/landingImages.test.ts)) compara el tamaño declarado con el real de cada WebP, la proporción del marco y las dimensiones de las imágenes de Open Graph y del README. **Sin ver la landing renderizada ni el `og-image.png`:** el hero queda un 7 % más bajo que antes (relación 9 / 18,7 en vez de 9 / 20) y los elementos que lo rodean no se revisaron a ojo.
- **Contraste y paleta:** los textos pequeños de la landing se agrandaron y los enlaces de la tarjeta final quedaron en blanco sólido; se sumaron mango, naranja, sol y coral de la app. Sin verificar en un móvil real; solo se revisó con Firefox headless.
- El enlace "Ver código fuente" del pie y de la tarjeta final se conserva aunque la licencia es propietaria; decidir si se renombra a "Ver repositorio".

## Fotos de productos

- **Las fotos no viajan entre dispositivos.** `image_uri` es una ruta local y desde v1.0.3 está marcada como "solo local" en [sync.ts](packages/database/src/sync.ts): no se envía y el pull no la sobrescribe. Un dispositivo nuevo o una restauración desde la nube muestra el producto sin foto.
- **El respaldo JSON no incluye los archivos de foto,** solo las rutas: tras restaurar o reinstalar, las fotos se pierden.
- **Plan para la nube (sin implementar):** Cloudflare R2 con objetos por contenido (`stores/<store_id>/products/<sha256>.webp`), columna nueva `image_key` (migración local y D1), subida y descarga por el Worker con token, cola con reintentos y descarga perezosa. Requiere permiso de R2 en el token, límites por tienda y actualizar la política de privacidad.
- **Quitar el fondo automáticamente:** descartado por ahora (módulo nativo que rompe OTA, rendimiento en gama baja, calidad sin medir, costo por imagen y privacidad). Si se retoma, guardar WebP con transparencia y pintar el fondo al mostrar.

## App móvil

- **Respaldo marcado como hecho aunque se cancele (P2-3), parcialmente resuelto.** `expo-sharing` no informa si el usuario completó o canceló el diálogo, así que "Compartir copia" sigue marcando `last_backup_at` sin poder confirmarlo y el archivo queda en `cacheDirectory`. Se añadió "Guardar copia en el teléfono" ([backup.ts](apps/mobile/src/backup.ts), `saveBackupToDevice`): escribe en una carpeta elegida por el usuario con el Storage Access Framework, relee el archivo y comprueba que el conteo de registros coincide (`verifyBackupText`, con test) antes de marcar el respaldo. **Probado en dispositivo el 2026-11-13** (Android 12): selector, escritura, relectura y verificación funcionan, con la salvedad de que la carpeta Descargas se rechaza (ver hallazgos nuevos).
- **Restauración parcial (P2-4).** [backup.ts](apps/mobile/src/backup.ts) solo reemplaza las tablas presentes en el archivo y no ejecuta `PRAGMA foreign_key_check`. Desde el 2026-11-13 **sí reinicia los cursores de `sync_state`** ([restoreOps.ts](apps/mobile/src/restoreOps.ts)).
- Los archivos de `safety/` (`pre-migracion-*.db` y `surtivox-antes-de-restaurar-*.json`) **no tienen pantalla de restauración**.
- Si una migración falla, el error no se guarda en `last_error` y se muestra crudo y en inglés ([_layout.tsx](apps/mobile/app/_layout.tsx)). Decidir si una copia previa fallida debe bloquear la migración.
- `collectFullBackup` carga toda la base en memoria.
- ~~Modo desarrollador sin salida~~ *Cerrado el 2026-11-13* (`f46ab3b`): tocar la versión en Más lo desactiva.
- Borradores con `track_inventory = 0`: anulación y devolución usan el valor actual del producto, no el movimiento original. Si algún día se activa el inventario, repondrán stock que nunca se descontó.
- `repos.ts` sigue siendo un archivo grande (1.200 líneas el 2026-11-13) con SQL repetido. No se ha leído completo para medir la duplicación.
- Textos técnicos y en inglés en errores del servidor sin traducir fuera de los códigos conocidos ([syncErrors.ts](apps/mobile/src/syncErrors.ts)).
- Accesibilidad: sin revisar con fuente al 200 % ni en pantallas pequeñas.

## Dinero, facturas y fechas (2026-11-08)

Cerrado en esta revisión, con prueba en `apps/mobile/src` (`checkoutSale.test.ts`, `processReturn.test.ts`, `customerPayment.test.ts`, `saleDoubleTap.test.ts`, `returnDiscount.test.ts`, `returnMethods.test.ts`, `reportProfit.test.ts`, `reportPayments.test.ts`, `effectiveLines.test.ts`, `localTime.test.ts`, `numberCollision.test.ts`):

- **Descuento general mal repartido.** *Cerrado.* Las devoluciones y la utilidad usan el valor efectivo de cada renglón (total de la venta repartido por mayor resto, [effectiveLines.ts](apps/mobile/src/effectiveLines.ts)); lo guardado y lo que se sincroniza no cambió. Las devoluciones anteriores al arreglo conservan el valor que se reembolsó entonces.
- **Devolución en efectivo de una venta fiada.** *Cerrado.* Una venta fiada solo se devuelve a la cuenta del cliente; una venta pagada, por el mismo medio o a la cuenta (Nequi y Daviplata como transferencia, porque la base solo admite `cash`, `card`, `bank` y `account`).
- **Abono mayor que la deuda.** *Cerrado.* Se rechaza dentro de una transacción contra el saldo del libro.
- **Doble toque y número de factura.** *Cerrado.* Guarda con `useRef` en Cobrar y Abonar, operaciones idénticas simultáneas rechazadas y distintas puestas en fila ([serialQueue.ts](apps/mobile/src/serialQueue.ts)), y `INV-n` calculado dentro de la transacción con el mayor sufijo. El defecto real no era una factura repetida sino un error de la restricción única (`UNIQUE sales.store_id, sales.invoice_no`) que bloqueaba toda venta nueva cuando un número traído de otro teléfono dejaba el conteo por debajo del mayor.
- **Renombre por número repetido.** *Cerrado.* `resolveNumberCollision` sube `updated_at` y `version` de la fila local renombrada para que el cambio se envíe.
- **Abonos en el reporte.** *Cerrado.* Tarjeta aparte "Abonos de fiados recibidos"; no se suman a ventas ni a utilidad. El libro no guarda el medio de pago del abono.
- **Fechas del CSV y del nombre del respaldo.** *Cerrado.* Hora local del teléfono ([localTime.ts](apps/mobile/src/localTime.ts)).

Abierto, descubierto o confirmado en esta auditoría:

- **Ajuste manual de stock.** No existe: los únicos movimientos son `opening_stock`, `sale`, `sale_return` y `purchase`. Un conteo físico no se puede corregir.
- **Anulación y devolución dobles con dos teléfonos.** `voidSaleOn` y `assertReturnable` solo miran la base local; dos teléfonos que anulan o devuelven lo mismo antes de sincronizar reponen stock y acreditan saldo dos veces. Hacen falta ids determinísticos (por ejemplo `void:<sale_item_id>`) en los movimientos y asientos de anulación.
- **Categorías sin borrado lógico** (`categories` no tiene `deleted_at`).
- **Sincronización automática.** `syncNow` solo se llama desde [cloud-sync.tsx](apps/mobile/app/cloud-sync.tsx) con el botón; la pantalla promete "Respaldo automático".
- **Transacciones no exclusivas.** `anular` no pasa por la fila de [serialQueue.ts](apps/mobile/src/serialQueue.ts), y la descarga de la nube o la restauración corren con `foreign_keys` apagado en la única conexión mientras puede entrar una venta.
- **No existe la fiada parcial:** una venta fiada carga todo el total a la cuenta e ignora el monto recibido.
- **Cantidades enteras:** no hay venta por peso ni por fracción ([pricing.ts](packages/pos-core/src/pricing.ts)).
- **Descuento por renglón:** la venta no lo admite; solo hay descuento general.
- **Devoluciones previas al arreglo** que reembolsaron el valor sin descuento no se corrigen.
- **Fechas en ISO/UTC** que siguen en [diagnostics.ts](apps/mobile/src/diagnostics.ts) (texto de soporte) y en nombres de copias internas de `safety/`.
- **Sin probar en teléfono:** doble toque real, impresión del recibo con los valores nuevos y cambio de zona horaria del teléfono.

## Tests que faltan

- ~~Parte de escritura de `processReturn`~~ (cubierta el 2026-11-08 con SQLite en memoria; ver la sección de dinero).
- `restoreFromCloud` con un fallo a mitad de la carga.
- `restoreFullBackup` con un respaldo parcial y con claves foráneas rotas.
- Handler completo de `POST /pagos/crear` (400, 401, 503, 201).
- Sync entre dos dispositivos contra el Worker (hoy el Worker se prueba con SQLite en memoria, no con D1 real).
- Concurrencia real de `expo-sqlite` en dispositivo (las pruebas de concurrencia corren en un solo hilo).
- Cámara, `quick_check`, copia previa a migrar y backups automáticos: solo hay pruebas puras, ninguna en dispositivo.

## Build, release y CI

- **Firma de release (2026-11-05):** el workflow firma con una llave de producción leída de secretos de GitHub y falla si falta o si el APK sale con el certificado debug. **Verificado el 2026-11-13** en dos builds de `main` (`2cb7c73` y `e995351`): el paso "Verificar la firma del APK" pasó y el APK instalado en el teléfono tiene la huella `e798f4a4…`. Faltan respaldar la llave fuera de este equipo y el AAB (el workflow solo hace `assembleRelease`). Los APK instalados con la llave debug exigen desinstalar al pasar a la nueva: ver [RELEASING.md](RELEASING.md).
- [build-android.yml](.github/workflows/build-android.yml) ahora ejecuta `scripts/verify.sh`, `pnpm -r typecheck` y `pnpm test` antes de compilar, y fija las acciones por SHA. *Verificado en Actions el 2026-11-13* para los builds de `main`. Falta el primer build de **tag** con los cambios nuevos. `ci.yml` y este workflow usan ahora Node 22.
- ~~`pnpm -r typecheck` no cubre `packages/types`~~ *Cerrado el 2026-11-13 20:04 (`46ce257`):* ya tiene el script.
- Los Workers `payments-worker` y `catalog-worker` no declaran `wrangler`, `typescript` ni `@types/node`; se resuelven por hoisting.
- **Hipótesis, sin verificar:** el manifest no incluye el header `expo-channel-name`, así que un `eas update` al canal `production` podría no llegar al APK compilado con Gradle fuera de EAS.
- `buildArchs` limita a arm64 y armeabi: no instala en emuladores x86_64. Desde el 2026-11-13 los APK de `main` son **solo arm64**; los tags compilan arm64 y armeabi-v7a.
- `runtimeVersion` por fingerprint: cualquier cambio nativo deja huérfano el APK anterior. *Medido el 2026-11-14 18:27:* **también cambia al subir `version` o `versionCode`** (de `d38579f1` a `6b3ea8a3` al pasar de 1.1.4 a 1.1.5; solo cambia la fuente `expoConfig`), así que cada versión tiene su propio runtime y una OTA no cruza de una versión a otra; quien tiene 1.1.4 recibe el aviso de actualización de la app, no una OTA.
- Wrangler 3.114 no funciona detrás del proxy de este equipo; los despliegues se hicieron por la API REST. Actualizar Wrangler o desplegar desde otra red.

## Documentación

- ~~Los specs que AGENTS.md referencia no existían~~ *Cerrado el 2026-11-13* (`f6ef2a9`): existen `docs/ui-spec.md`, `docs/core-spec.md` y `docs/sync-spec.md`, escritos solo con lo verificado en el código.
- `docs/architecture.md`, `docs/database.md`, `docs/development.md` se corrigieron el 2026-11-13 (`52775ce`). [docs/roadmap.md](docs/roadmap.md) sigue siendo el plan original, con un aviso arriba; decidir si se reescribe.
- Los `README`/`DEPLOY.md` del sync y del catálogo ya no mandan a reemplazar placeholders de `database_id`. **Siguen sin describir el despliegue por la API REST**, que es el que se usó porque Wrangler 3.114 falla detrás del proxy de este equipo.

## Pruebas manuales en dispositivo real

**Hechas el 2026-11-13** en un Redmi Note 9 con Android 12 (detalle en la sección de esa fecha): respaldo guardado y verificado, restauración con datos posteriores al respaldo, numeración tras restaurar, persistencia tras cierre forzado, cámara (segundo plano, bloqueo de pantalla, permiso denegado, bloqueado, "Abrir ajustes" y reanudación), venta sin stock con confirmación y anulación repetida.

**Pendientes:**

- Dos teléfonos contra el Worker nuevo, uno vendiendo sin conexión; comprobar P1-2.
- Activar la nube, desactivarla y volver a activarla; vincular un segundo dispositivo con el código. Comprobar que los cursores se reinician tras restaurar un respaldo con la nube activa.
- Cortar la red durante una descarga de `restoreFromCloud`.
- Migración pendiente con copia previa; base corrupta a propósito; restauración de un respaldo hecho con una versión anterior de la app.
- Cámara en gama baja; cambio de pestaña con el escáner abierto.
- Venta con producto en borrador; fiado con abono, anulación y devolución a la cuenta; anular dos veces desde dos teléfonos.
- OTA: publicar una actualización al canal y comprobar que llega al APK de CI (hoy no puede llegar a los APK anteriores a `2cb7c73`).
- Tarjeta "Activado, pero aún no se ha sincronizado" con la nube activa (no se probó para no escribir en el Worker).
