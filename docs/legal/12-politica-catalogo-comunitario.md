# Política del catálogo comunitario de Surtivox POS

> **BORRADOR — requiere revisión de abogado colombiano antes de publicarse.**
> Parte de [docs/privacidad-catalogo-borrador.md](../privacidad-catalogo-borrador.md) (v0.2) y [docs/privacidad-catalogo-notas.md](../privacidad-catalogo-notas.md), conciliados con el código del 2026-11-06. Las diferencias están en la sección 12.

**Vigencia:** `[[POR COMPLETAR: fecha]]`. **Versión:** `[[POR COMPLETAR]]`.

## 1. Qué es
Una función **opcional** con la que varias tiendas ayudan a identificar productos por su código de barras. Si dos instalaciones distintas escriben el mismo nombre para un código, ese nombre se publica en un catálogo compartido y otras tiendas lo ven al escanear.

## 2. Solo si tú lo aceptas
La app te lo pregunta una vez ("¿Quieres ayudar a otros tenderos?") y **nunca viene marcado de antemano**. Si respondes "Ahora no", no se envía nada. Puedes cambiarlo cuando quieras en **Más → Privacidad → Ayudar a mejorar el catálogo**.

## 3. Qué se envía
Cuando aceptas, y **solo al registrar un producto desde el escáner con un código que no tenías y escribir o corregir su nombre**, se envía a Surtivox:
- el **código de barras**;
- el **nombre** que escribiste;
- la **presentación**, si existe (por ejemplo "500 g");
- un **identificador aleatorio de tu instalación** (no tu nombre ni el de tu tienda).

Los nombres sugeridos por otras fuentes no se envían. **No se envían** precios, costos, inventario, ventas, clientes, fiados, personal, fotos, el nombre ni el identificador de tu tienda, ni tu llave de la nube.

Hasta 20 productos por envío, con reintentos si no hay conexión. Los envíos pendientes se guardan en una cola en tu teléfono.

## 4. Cómo se protege tu identificador
Surtivox no guarda el identificador aleatorio de tu instalación tal como llega: calcula una huella (SHA-256) con un valor secreto y guarda solo esa huella. La huella no se muestra en el catálogo. **Es un dato seudónimo, no anónimo**: quien tuviera el identificador original y el valor secreto podría relacionar un aporte con una instalación. Por eso no lo llamamos "anónimo".

## 5. Qué ven los demás
Cuando un nombre alcanza el consenso de **al menos 2 instalaciones distintas** (valor piloto), el catálogo muestra el nombre, la presentación y cuántas instalaciones lo confirmaron. No muestra quién votó.

## 6. Consulta del catálogo (aunque no participes)
Cuando escaneas un código que no tienes registrado, la app **consulta** el catálogo de Surtivox y Open Food Facts con el código de barras, aunque no hayas aceptado aportar. En esa consulta Surtivox recibe el código y la dirección IP de tu conexión. La respuesta se guarda en tu teléfono por 30 días si el producto existe y 3 días si no.

## 7. Quién procesa los datos
El catálogo funciona en servidores de **Cloudflare** (`[[POR COMPLETAR: región de D1 una vez verificada]]`), que pueden estar fuera de Colombia. Ver la política de tratamiento de datos, sección 6.

## 8. Cuánto tiempo se conserva
- **Límites diarios** de aportes: se borran cuando tienen más de 7 días (tarea programada diaria; que esté activa en producción debe verificarse).
- **Votos y producto publicado:** `[[POR COMPLETAR: plazo de retención; hoy el código no los borra]]`.

## 9. Cómo dejar de participar y qué pasa con lo enviado
Al apagar el interruptor, se **dejan de enviar** aportes y se **vacía la cola** de pendientes de tu teléfono. **Lo que ya enviaste o ya se publicó no se borra automáticamente.** Puedes pedir información, corrección o supresión de un aporte escribiendo a pragramademateo@gmail.com. `[[POR COMPLETAR: confirmar cómo se atenderá; hoy el servidor no tiene una función para retirar un aporte, y como solo guarda una huella, el responsable necesitaría el identificador de tu instalación para encontrarlo]]`. El efecto de retirar un aporte sobre un nombre ya publicado por consenso está pendiente de decisión.

## 10. Regla para el tendero
Aporta solo **nombres de productos**. No escribas nombres de personas, teléfonos, direcciones, correos ni datos de clientes o de tu tienda. Si el nombre de un producto contiene un dato personal, no lo envíes.

## 11. Licencia del aporte
Al enviar un nombre y una presentación permites a Surtivox almacenarlos, reproducirlos y mostrarlos en el catálogo compartido. El permiso es no exclusivo y gratuito, y no transfiere la titularidad de tus marcas. `[[POR COMPLETAR: alcance definido por el abogado; conveniencia de una licencia abierta]]`

## 12. Diferencias del borrador anterior frente al código actual

| Tema | Borrador v0.2 | Código del 2026-11-06 |
|---|---|---|
| Cuándo se envía | "cuando escribas o corrijas el nombre de un producto con código de barras" | Solo desde la hoja de producto desconocido al escanear ([UnknownBarcodeSheet.tsx:134-162](../../apps/mobile/src/pos/UnknownBarcodeSheet.tsx#L134-L162)); es el único punto que llama a `enqueueContribution` |
| Consulta | Sugería que la función solo actúa si el tendero acepta | La **consulta** (`/catalog/lookup`) ocurre sin consentimiento ([catalog.ts:46-73](../../apps/mobile/src/catalog.ts#L46-L73)); solo el **envío** exige aceptación |
| Caché | No decía | 30 días si se encontró, 3 si no ([catalogCore.ts:1-2](../../apps/mobile/src/catalogCore.ts#L1-L2)) |
| Cola al apagar | "Se borra la cola local" | Cierto ([more.tsx:246](../../apps/mobile/app/%28tabs%29/more.tsx#L246)) |
| Limpieza | 7 días | Cierto para `contribution_limits`; el cron no se ha verificado en producción; `catalog_votes` no se limpia |
| Correo | Un correo concreto en el texto | Se reemplaza por marcador hasta que el dueño confirme el canal oficial de reclamos |
| Retiro de aportes | "pendiente de definición" | Sigue sin existir; ver [92-brechas-tecnicas-a-cerrar.md](92-brechas-tecnicas-a-cerrar.md) |
