# Avisos cortos dentro de la app

> **BORRADOR — requiere revisión de abogado colombiano antes de publicarse.**
> Máximo 3 frases por texto. Están pensados para sustituir los de [apps/mobile/src/legalText.ts](../../apps/mobile/src/legalText.ts). Si se cambian, hay que subir `LEGAL_VERSION` ([legal.ts:3](../../apps/mobile/src/legal.ts#L3)), actualizar [landing/privacidad.html](../../landing/privacidad.html) y [landing/terminos.html](../../landing/terminos.html) y ajustar la prueba `landingLegal.test.ts`.

## 1. Aceptación al primer arranque
> "Al continuar aceptas los **Términos** y la **Política de datos** de Surtivox POS. Tus datos se guardan en tu teléfono; solo salen si activas el respaldo en la nube o el catálogo, y la app consulta internet para actualizaciones, códigos de barras y precios. Eres responsable de contar con la autorización de tus clientes para registrar sus datos."
>
> Botones: **Aceptar y continuar** · **Leer términos y política**

## 2. Consentimiento del catálogo comunitario
> "¿Quieres ayudar a otros tenderos? Si aceptas, al escribir o corregir el nombre de un producto que escaneas, enviaremos el código, el nombre y la presentación con un identificador aleatorio de tu app, sin precios ni datos de tu tienda. Lo que ya enviaste no se puede borrar automáticamente, y puedes dejar de participar en Más → Privacidad."
>
> Botones: **Sí, quiero ayudar** · **Ahora no**

## 3. Aviso del kit de recuperación
> "Este kit de 8 palabras es la llave de tu tienda en la nube: quien lo tenga puede abrirla. Guárdalo en un lugar seguro y no lo compartas. Si lo pierdes junto con tu teléfono, no podremos recuperar tu tienda."
>
> Botón: **Ya lo guardé, confirmar**

## 4. Aviso de la nube
> "Se guardará una copia de tu tienda en servidores de Cloudflare, que pueden estar fuera de Colombia: productos, ventas, personal y **tus clientes y fiados, con nombres y teléfonos**. Las fotos no se envían y los datos no quedan cifrados de extremo a extremo. Eres responsable de la autorización de tus clientes, y desactivar la nube no borra lo ya enviado."
>
> Botones: **Activar** · **Cancelar**

*(La última frase solo se escribe si el responsable confirma que es cierta hoy: el código no borra el servidor al desactivar. `[[POR COMPLETAR: confirmar con el dueño]]`)*

## Qué textos actuales quedan desactualizados

| Texto actual | Dónde | Problema |
|---|---|---|
| "El código de tu tienda da acceso a esos datos: no lo compartas" | [legalText.ts:70](../../apps/mobile/src/legalText.ts#L70) (Privacidad §4) y [legalText.ts:109](../../apps/mobile/src/legalText.ts#L109) (`CLOUD_NOTICE`) | Hoy la llave es un **kit de 8 palabras**; el código largo de 16 caracteres solo existe en tiendas antiguas |
| "Surtivox almacena sus datos por encargo tuyo" | [legalText.ts:70](../../apps/mobile/src/legalText.ts#L70) | Presupone el escenario A (encargado) sin que el abogado lo haya decidido |
| "Mateo Castro, titular de Surtivox POS. Contacto: …" | [legalText.ts:57](../../apps/mobile/src/legalText.ts#L57) | Faltan domicilio, teléfono y documento; el correo debe confirmarse |
| "Los datos de la nube y del catálogo se conservan mientras el servicio esté activo o hasta que solicites su supresión" | [legalText.ts:86](../../apps/mobile/src/legalText.ts#L86) | La supresión por solicitud no tiene procedimiento ni herramienta |
| "Los datos de tu teléfono los controlas tú: Más → Borrar todos los datos… no borra lo que ya esté en la nube" | [legalText.ts:82](../../apps/mobile/src/legalText.ts#L82) | Cierto, pero conviene sumar que no borra las fotos ni las copias en la carpeta del teléfono |
| "(a) buscar actualizaciones… (b)… solo se envía el código" | [legalText.ts:66](../../apps/mobile/src/legalText.ts#L66) | Cierto en lo esencial; no menciona que también se envía el código a Open Food Facts con la IP del usuario ni la caché local |
| Aviso de catálogo: "cuando escribas o corrijas el nombre de un producto con código de barras" | [legalText.ts:74](../../apps/mobile/src/legalText.ts#L74), `CATALOG_NOTICE` | El envío ocurre solo desde la hoja de producto desconocido del escáner |
| Sin edad mínima ni evidencia de aceptación | `TERMS_SECTIONS` | Pendientes de la decisión del abogado |
