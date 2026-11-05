# Guía para probadores: cambio a la versión firmada

Esta versión de Surtivox POS está firmada con una llave nueva. Android no permite instalarla encima de la versión anterior: hay que desinstalar la app vieja e instalar la nueva. **Al desinstalar se borran los datos del teléfono.** Esta guía te permite no perder nada. Es un cambio único; las actualizaciones siguientes se instalan encima sin borrar datos.

Tiempo estimado: 10 minutos. No desinstales hasta terminar la Parte 1.

## Parte 1. Antes de desinstalar

### 1. Anota el código de tienda (solo si usas la nube)
1. Abre **Más** y toca la tarjeta **Respaldo en la nube**.
2. Toca **Sincronizar ahora** y espera a que diga que está sincronizado.
3. Copia el **código de tienda** que aparece en esa pantalla. Envíatelo por mensaje o tómale captura y guárdala **fuera del teléfono**. Sin este código no podrás recuperar la tienda de la nube.

### 2. Guarda una copia en el teléfono
1. Abre **Más**, luego **Respaldo y CSV**.
2. Toca **Guardar copia en el teléfono**.
3. Elige una carpeta (por ejemplo, Descargas o Documentos) y confirma.
4. Debe aparecer el aviso **"Copia guardada y verificada"**. Si aparece un error, no desinstales: avísame.

### 3. Saca el archivo del teléfono
Envía el archivo `surtivox-backup-AAAAMMDD.json` a tu correo, WhatsApp o Google Drive. Comprueba que lo recibiste.

### 4. Anota lo que debes poder comprobar
Después de restaurar vas a comparar contra esto:
- Total de ventas de hoy.
- Fiado pendiente por cliente (los principales).
- Cantidad de productos.

### 5. Importante: lo que NO se recupera
- **Las fotos de los productos.** Hay que volver a tomarlas.
- **El logotipo de la tienda** (se guarda como archivo local, igual que las fotos). Hay que volver a cargarlo.
- **Tu código de recuperación del propietario,** si lo habías generado: sigue valiendo porque viaja en la copia, pero asegúrate de tenerlo anotado fuera del teléfono.

## Parte 2. Desinstalar e instalar
1. Desinstala Surtivox POS.
2. Instala el APK nuevo.
3. Si Android avisa de una fuente desconocida, permite la instalación.
4. Abre la app, acepta los términos y completa la configuración inicial con los datos mínimos de la tienda.

## Parte 3. Recuperar tus datos

Elige **una** de las dos rutas. Recomendada: la copia del teléfono.

### Ruta A. Con la copia guardada (recomendada)
1. Abre **Más**, luego **Respaldo y CSV**.
2. Toca **Restaurar desde respaldo** y confirma.
3. Elige el archivo `surtivox-backup-AAAAMMDD.json`.
4. Debe aparecer **"Restauración completa"** con la cantidad de registros.

Esta ruta restaura productos, ventas, clientes, fiados y personal.

Después de restaurar, la app **no queda vinculada a la nube**. Si la usabas, ve a **Más**, **Respaldo en la nube**, y reactívala con tu código de tienda (Ruta B, paso 2).

### Ruta B. Desde la nube
1. Abre **Más**, luego **Respaldo en la nube**.
2. Escribe el **código de tienda** que anotaste y toca **Reemplazar y vincular**.
3. Espera a que termine y aparezca **"Dispositivo vinculado"**.

## Parte 4. Comprobar
Compara con lo que anotaste en la Parte 1, paso 4:
- Ventas de hoy.
- Fiado de los clientes principales.
- Cantidad de productos.

Si algo no coincide, **no hagas más ventas**. Avísame con una captura de lo que ves y de lo que esperabas.

## Si algo sale mal
- **No pude guardar la copia:** no desinstales. Avísame.
- **Desinstalé sin copia y sin código:** los datos del teléfono no se pueden recuperar. Lo que esté en la nube solo se recupera con el código de tienda.
- **El archivo no restaura:** prueba la Ruta B. Si tampoco funciona, avísame con una captura del mensaje.
