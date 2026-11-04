# BORRADOR — PENDIENTE DE REVISIÓN. No publicar.

Este documento es un borrador de trabajo para revisión del responsable del proyecto y de un abogado colombiano. No es asesoría legal y no debe presentarse como una política vigente ni como una declaración de cumplimiento normativo.

| Versión | Fecha de preparación | Estado | Fecha de vigencia |
| --- | --- | --- | --- |
| 0.2 | 1 de noviembre de 2026 | Borrador | Pendiente de aprobación |

## 1. Qué es el catálogo comunitario

Surtivox POS es un punto de venta offline para tiendas de barrio en Colombia. El catálogo comunitario es una función opcional que permite que varias tiendas ayuden a identificar productos por su código de barras.

La función es opcional. La app solo la activa cuando el tendero acepta participar y el servicio del catálogo está configurado. En ese caso puede enviar nombres de productos que el tendero escribió o editó. Los nombres sugeridos por otras fuentes no se envían.

## 2. Qué se comparte y qué no

### Sí se comparte

- El código de barras del producto.
- El nombre del producto que el tendero escribió o editó.
- La presentación del producto, cuando exista; por ejemplo, “500 g” o “1 L”.
- Un identificador aleatorio de instalación de la app. La app lo envía para que el servidor pueda calcular un hash y distinguir contribuciones de instalaciones diferentes.

### No se comparte

- Precios de venta ni precios de costo.
- Cantidades, inventario o movimientos de stock.
- Ventas, pagos, recibos, clientes, fiados o datos de contacto de clientes.
- El identificador de la tienda (`store_id`).
- El token de sincronización ni credenciales de la cuenta.
- El nombre del tendero, su teléfono, su dirección o el nombre de su tienda.
- Fotografías del producto en esta versión del catálogo comunitario.

## 3. Para qué se usa y por qué es opcional

Se usa para comparar nombres propuestos por distintas instalaciones y publicar un nombre en el catálogo compartido cuando hay consenso suficiente. En el piloto, el umbral configurado es de al menos 2 instalaciones distintas.

La contribución es opcional. La normativa colombiana exige una autorización previa e informada; el silencio no equivale a autorización (Ley 1581 de 2012, artículo 9; Decreto 1377 de 2013, artículo 7). La app muestra este aviso antes de la primera contribución:

> “¿Quieres ayudar a completar el catálogo? Se compartirá solo el código, el nombre y la presentación del producto, sin precios ni datos de tu tienda.”

Si el tendero elige “Ahora no”, no se envían contribuciones y no se vuelve a preguntar automáticamente. Puede activar la ayuda después desde Ajustes.

## 4. Qué ven los demás

Cuando un nombre alcanza el umbral, el catálogo compartido muestra:

- El nombre publicado del producto.
- La presentación, si fue aportada.
- El número de instalaciones que confirmaron ese nombre.

No muestra el identificador de instalación, el hash, el nombre del tendero ni el nombre de su tienda. Tampoco muestra un historial público de quién votó por cada nombre.

## 5. Una contribución seudónima

La app no promete anonimato total. La contribución se describe así:

- No se publica el nombre de la persona ni el de la tienda.
- El servidor no guarda el identificador aleatorio de instalación tal como lo recibe. Calcula un hash SHA-256 con una sal secreta y guarda únicamente ese hash en su base interna de votos y límites.
- El hash no se muestra en el catálogo público.
- Aun así, un hash de instalación es un dato seudónimo, no una garantía de anonimato absoluto. Si alguien obtuviera el identificador original y la sal, o pudiera cruzar información adicional, podría intentar relacionar una contribución con una instalación. Surtivox no publica esos elementos, pero no debe prometer un anonimato irreversible.

Por eso, en este documento se habla de contribución seudónima y no se presenta como una contribución totalmente anónima.

## 6. Quién procesa los datos

La app envía las contribuciones a un servicio alojado en Cloudflare Workers, con almacenamiento en Cloudflare D1. Cloudflare actúa como proveedor de infraestructura y sus servidores pueden estar fuera de Colombia.

El proyecto Surtivox POS se identifica en este borrador como responsable del tratamiento, pendiente de confirmar la razón social o nombre, el domicilio, la dirección y el teléfono antes de publicar esta política.

El tratamiento fuera de Colombia debe revisarse con un abogado para determinar la figura aplicable y el mecanismo contractual o legal correspondiente.

## 7. Cuánto tiempo se conservan

**Pendiente de decisión del dueño** para los votos, los hashes de instalación y los nombres publicados. La tabla de límites diarios se limpia automáticamente con una tarea diaria y conserva solo los últimos 7 días.

Antes de publicar esta política debe definirse:

- Cuánto tiempo se conservan los votos y los hashes.
- Cuánto tiempo se conservan los nombres publicados.
- La limpieza de límites diarios ya está definida en 7 días.
- Si se conserva algún registro mínimo para atender solicitudes legales o reclamos.

No debe inventarse un plazo en este borrador.

## 8. Cómo dejar de participar y qué pasa con lo publicado

El tendero puede desactivar la ayuda en:

**Más → Privacidad → “Ayudar a mejorar el catálogo”**

Al desactivarla:

- Se dejan de encolar nuevas contribuciones desde esa instalación.
- Se borra la cola local de contribuciones pendientes.
- No se envían nuevas contribuciones desde esa instalación.

Los aportes ya enviados o ya publicados no se borran automáticamente al desactivar el interruptor. Para solicitar información, corrección o supresión de un aporte ya enviado, el tendero puede escribir al correo de contacto indicado abajo. La forma de atender esas solicitudes y el efecto sobre el consenso del catálogo están pendientes de definición.

## 9. Derechos y contacto

La Ley 1581 de 2012 reconoce, entre otros, los derechos a conocer, actualizar, rectificar y solicitar la supresión de los datos personales, así como a revocar la autorización y presentar quejas ante la Superintendencia de Industria y Comercio.

Para ejercer estos derechos o hacer una consulta sobre este catálogo, escribe al correo oficial que ya aparece en la política de privacidad de Surtivox POS:

**contacto3rillodivino@gmail.com**

No se inventa aquí una dirección física ni un procedimiento con plazos que todavía no hayan sido aprobados. El responsable deberá definir el área o persona que atienda estas solicitudes y el procedimiento aplicable antes de publicar la política.

## 10. Regla de uso para el tendero

Contribuye únicamente con nombres de productos.

No incluyas nombres de personas, teléfonos, direcciones, correos, documentos, datos de clientes, contraseñas ni información privada de la tienda. Si el nombre de un producto incluye un dato personal, no lo envíes.

## 11. Licencia del aporte

Al enviar un nombre y una presentación, el tendero permite que Surtivox los almacene, reproduzca y muestre en el catálogo compartido para que otras tiendas puedan identificarlos. Este permiso es no exclusivo y gratuito, y no transfiere la titularidad de los datos personales, del nombre comercial ni de las marcas del tendero.

El alcance definitivo de esta autorización y la conveniencia de usar una licencia abierta están pendientes de revisión legal. Este borrador no adopta automáticamente la licencia ODbL de Open Food Facts ni la de Open Products Facts.

## 12. Vigencia y control de versiones

- Versión: 0.2.
- Fecha de preparación: 1 de noviembre de 2026.
- Fecha de vigencia: pendiente de aprobación; este documento no está publicado.
- Cambios: se añadió la presentación al aviso, se retiró la etiqueta “anónimo” de la app y se documentó la limpieza de límites diarios a 7 días. Cualquier cambio sustancial debe quedar registrado en una nueva versión y revisarse antes de publicarse.

## 13. Revisión pendiente

Este texto debe revisarlo un abogado colombiano antes de publicarse. En particular, deben resolverse el plazo de conservación, la eliminación de aportes publicados, la identificación del responsable, la clasificación de la transferencia internacional, el procedimiento de derechos y la licencia definitiva del aporte.
