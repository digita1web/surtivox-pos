# Política de tratamiento de datos personales de Surtivox POS

> **BORRADOR — requiere revisión de abogado colombiano antes de publicarse.**
> Describe solo lo que la app hace según [00-inventario-de-datos.md](00-inventario-de-datos.md). Lo que el código todavía no cumple **no se promete aquí**: está en [92-brechas-tecnicas-a-cerrar.md](92-brechas-tecnicas-a-cerrar.md). Los textos entre `[[POR COMPLETAR: …]]` los debe llenar el dueño.

**Vigencia:** desde `[[POR COMPLETAR: fecha de entrada en vigencia]]`. Versión del texto: `[[POR COMPLETAR: número de versión; debe coincidir con LEGAL_VERSION de la app]]`.

---

## 1. Quién es el responsable

- **Nombre o razón social:** `[[POR COMPLETAR: nombre completo o razón social]]`
- **Identificación (cédula o NIT):** `[[POR COMPLETAR: documento]]`
- **Domicilio:** `[[POR COMPLETAR: dirección y ciudad]]`
- **Correo para consultas y reclamos:** pragramademateo@gmail.com
- **Teléfono:** `[[POR COMPLETAR: teléfono de contacto]]`
- **Persona o área que atiende los derechos de los titulares:** `[[POR COMPLETAR: nombre del cargo o persona]]`

> **[[ESCENARIO A o B — decisión del abogado]]** Esta política distingue dos tipos de datos. Los **datos propios del usuario** (el tendero que usa la app): Surtivox es responsable. Los **datos de los clientes, proveedores y personal que el tendero registra**: en el escenario A el responsable es el tendero y Surtivox es **encargado** que los aloja por su cuenta; en el escenario B Surtivox también es responsable. Ver [01-marco-normativo.md](01-marco-normativo.md), sección 2.

## 2. A quién se aplica

A las personas que usan Surtivox POS (los usuarios) y a las personas cuyos datos un usuario registra en la app (sus clientes, proveedores y personal). La app está pensada para personas mayores de edad. `[[POR COMPLETAR: edad mínima de uso]]`. Surtivox POS no pide datos de niños, niñas ni adolescentes ni datos sensibles; el campo "notas" de un cliente es de texto libre y el usuario no debe escribir allí datos sensibles.

## 3. Qué datos se tratan y para qué

### 3.1 Siempre, sin conexión (solo en tu teléfono)
Productos, precios, inventario, ventas, pagos, compras, proveedores, personal (nombre, rol y una huella de su PIN), clientes y fiados (nombre, teléfono, correo, dirección y notas), fotos de productos, logotipo y datos de tu tienda. **Surtivox no tiene acceso a estos datos** mientras no actives el respaldo en la nube. Finalidad: que la app funcione.

### 3.2 Consultas a internet aunque no actives nada
| Servicio | Qué se envía | Para qué |
|---|---|---|
| Actualizaciones de Expo | Lo que el servicio de actualizaciones recibe al abrir la app (sistema operativo, identificadores aleatorios de actualización, dirección IP) | Traer mejoras de la app |
| Open Food Facts | El código de barras y tu dirección IP | Buscar el nombre de un producto desconocido |
| Catálogo de Surtivox | El código de barras y tu dirección IP | Buscar el nombre de un producto desconocido |
| Precios de referencia | El código de barras (EAN) y tu dirección IP a Surtivox; Surtivox consulta con el código a los catálogos públicos de Éxito, Jumbo y Olímpica | Mostrar precios aproximados |

### 3.3 Respaldo en la nube (solo si lo activas)
Se copian a servidores de Cloudflare: los datos de tu tienda, productos, categorías, proveedores, personal (nombre, rol y huella del PIN), **clientes y fiados (nombre, teléfono, correo, dirección y notas)**, ventas, pagos, compras y devoluciones. **No se envían las fotos ni el logotipo.** Finalidad: respaldar tu tienda y sincronizar tus dispositivos.

- Los datos viajan por internet con cifrado (HTTPS). En el servidor quedan **sin cifrado de extremo a extremo**: el servicio los recibe tal como los envías.
- Tu **kit de recuperación** (8 palabras) se genera en tu teléfono y **no se envía**. Al servidor solo llega una huella de la llave derivada de ese kit.
- Si alguien intenta entrar con una llave equivocada, el servidor guarda la **dirección IP** y el número de fallos para limitar los intentos. `[[POR COMPLETAR: plazo de conservación de esas IP; hoy no se borran]]`

### 3.4 Catálogo comunitario (solo si lo activas, ver el aviso específico)
Código de barras, nombre y presentación de un producto, con un identificador seudónimo de tu instalación. Ver [12-politica-catalogo-comunitario.md](12-politica-catalogo-comunitario.md).

### 3.5 Lo que no se hace
La app no usa publicidad ni analítica de terceros, no vende datos, no pide ubicación, contactos, micrófono ni notificaciones, y no envía automáticamente errores ni diagnósticos fuera de tu teléfono.

## 4. Autorización
Al aceptar los términos y activar cada servicio opcional, el usuario autoriza el tratamiento descrito para sí mismo. La autorización del catálogo y del respaldo en la nube se pide por separado y nunca viene marcada de antemano.

**Datos de clientes, proveedores y personal:** el usuario declara contar con la autorización de esas personas para registrar sus datos y, si activa la nube, para que se almacenen en servidores de Cloudflare. En [11-terminos-y-condiciones.md](11-terminos-y-condiciones.md) hay un texto sugerido para mostrarles.

## 5. Derechos de los titulares
Conocer, actualizar y rectificar tus datos; pedir prueba de la autorización; ser informado del uso que se les ha dado; presentar quejas ante la Superintendencia de Industria y Comercio; revocar la autorización o pedir la supresión de los datos; y acceder gratuitamente a ellos (Ley 1581 de 2012, art. 8, y Decreto 1377 de 2013).

**Cómo ejercerlos:** escribe a pragramademateo@gmail.com indicando tu nombre, el dato y lo que pides.

**Plazos** (Ley 1581 de 2012, arts. 14 y 15, según la fuente consultada, a verificar por el abogado):
- **Consultas:** respuesta en máximo **10 días hábiles**; si no es posible, se informa el motivo y una nueva fecha que no excede **5 días hábiles** más.
- **Reclamos:** si falta información, se te pedirá completarla dentro de los **5 días** siguientes; con el reclamo completo se marca "reclamo en trámite" en máximo **2 días hábiles**; la respuesta se da en máximo **15 días hábiles**, ampliables hasta **8 días hábiles** más con aviso.

**Lo que hoy puedes hacer tú mismo en la app:**
- Corregir o eliminar tus propios datos, los de tus clientes, proveedores y personal desde sus pantallas.
- Borrar todos los datos de tu teléfono (Más → Borrar todos los datos de la app).
- Detener el catálogo comunitario (Más → Privacidad) y desactivar el respaldo en la nube.

**Lo que hoy no hace la app por sí sola** (por eso se pide por correo y se atiende manualmente): borrar lo que ya está en el servidor de respaldo y retirar contribuciones enviadas al catálogo. `[[POR COMPLETAR: confirmar que el responsable se compromete a ejecutar la supresión manual de la tienda en el servidor y en qué plazo]]`. Ver [15-procedimiento-derechos-del-titular.md](15-procedimiento-derechos-del-titular.md).

## 6. Transferencias internacionales
Para el respaldo, el catálogo y los precios se usan servidores de **Cloudflare**, y para las actualizaciones **Expo**. Los datos pueden tratarse fuera de Colombia, incluido Estados Unidos. Cloudflare actúa como encargado del tratamiento por nuestra cuenta. `[[POR COMPLETAR: país y región del servicio D1 de Cloudflare, una vez verificados]]`. `[[POR COMPLETAR: base legal definida por el abogado para la transferencia/transmisión]]`.

## 7. Seguridad
- Conexión cifrada (HTTPS) con los servidores.
- La llave de la nube nace en tu teléfono; el servidor guarda solo una huella.
- El PIN del personal se guarda como huella; **no es una protección fuerte** frente a quien tenga acceso a la base.
- Los datos del teléfono pueden incluirse en la copia automática de Android a tu cuenta de Google si la tienes activada en el teléfono.
- No se dice que los datos estén cifrados en reposo en el servidor porque no está verificado.

`[[POR COMPLETAR: procedimiento ante incidentes de seguridad y a quién se informa]]`

## 8. Conservación
- **En tu teléfono:** hasta que los borres.
- **En la nube:** `[[POR COMPLETAR: plazo de retención; hoy el código no fija ninguno ni borra automáticamente]]`.
- **Catálogo:** los votos y el producto publicado se conservan `[[POR COMPLETAR: plazo]]`; los límites diarios se borran después de 7 días.

## 9. Cambios
Si esta política cambia de forma importante, la app te pedirá aceptarla de nuevo.

## 10. Lo que este borrador deja fuera (brechas, no se promete)
No se escribe en esta política: borrado automático en el servidor, exportación de tus datos desde el servidor, retiro de contribuciones al catálogo, cifrado en reposo verificado, plazos de retención ni procedimiento de incidentes, porque el código o el proceso aún no los cumplen. Ver [92-brechas-tecnicas-a-cerrar.md](92-brechas-tecnicas-a-cerrar.md).
