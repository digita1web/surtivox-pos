# Programa piloto: 20 a 50 tiendas

Objetivo: saber, antes de cobrar, si las tiendas usan Surtivox POS todos los días y si pagarían por el plan Pro. Duración sugerida: 8 semanas.

## 1. A quién buscar

- Tiendas de barrio, minimercados y algunas ferreterías o papelerías, con un celular Android 7.0 o más reciente.
- Dueños que hoy anotan en cuaderno o en Excel y que acepten **una llamada corta cada semana**.
- Mejor varias en la misma zona: así puedes visitarlas y comparar.
- Evita al principio negocios con varias cajas o facturación electrónica obligatoria: la app aún no la hace.

## 2. Cómo conseguirlas

- Recorrido por el barrio con el celular en la mano: la demostración en vivo convence más que un enlace.
- Distribuidores y tenderos conocidos que presenten a otros.
- Mensaje corto para WhatsApp:

> Hola, soy Mateo. Estoy probando Surtivox, una app gratis para que la tienda venda, lleve el fiado y el inventario desde el celular, sin internet. Busco 20 tiendas que la usen 2 meses y me cuenten qué les sirve y qué no. Te la instalo en 20 minutos. ¿Te interesa?

## 3. Instalación acompañada (20 a 30 minutos)

- [ ] Instalar desde la landing ([guía](https://digita1web.github.io/surtivox-pos/ayuda.html#instalar-la-app)).
- [ ] Crear la tienda con el nombre real; moneda COP.
- [ ] Cargar productos: catálogo de ejemplo o, desde la 1.1.8, el catálogo de su tipo de negocio; registrar 10 a 20 productos reales con precio.
- [ ] Si hay empleados: personal con PIN y **código de recuperación guardado** fuera del celular.
- [ ] Activar el respaldo en la nube (versión de pruebas) y confirmar el kit de recuperación.
- [ ] Hacer una venta real, un fiado y compartir un recibo.
- [ ] Explicar dónde está la ayuda y cómo escribirte.

## 4. Lo que les dices (y lo que no)

- Es gratis y funciona sin internet. Los datos se guardan en su celular; si activan la nube, una copia queda en servidores de Cloudflare ([privacidad](https://digita1web.github.io/surtivox-pos/privacidad.html)).
- **No prometas** factura electrónica, sincronización automática (hoy se sincroniza con el botón), ni que la app reemplaza al contador.
- Pídeles guardar una copia o activar la nube: si el celular se daña sin copia, no hay cómo recuperar los datos.

## 5. Cómo medir sin rastrear

La app no envía estadísticas de uso, y así debe seguir. Las fuentes son tres:

1. **La llamada semanal** (5 minutos). Preguntas:
   - ¿Cuántos días de esta semana registraste ventas en la app?
   - ¿Qué hiciste por fuera de la app que te gustaría hacer en ella?
   - ¿Qué fue lo más difícil o lo que más molestó?
   - ¿Le recomendarías la app a otro tendero? (0 a 10)
   - Pídele que mire **Ventas de hoy** o **Reportes → 7 días** y te diga los pedidos de la semana.
2. **La nube, solo de quienes la activaron.** Con el Worker que tiene el tope diario desplegado, la tabla `store_usage` guarda cuántas filas sincronizó cada tienda por día, sin nombres ni contenido. Consulta de solo lectura que ejecutas tú en D1:

   ```sql
   SELECT store_id, COUNT(*) AS dias, SUM(rows) AS filas
   FROM store_usage
   WHERE day >= date('now', '-7 days')
   GROUP BY store_id
   ORDER BY dias DESC;
   ```

   Un día con filas indica que la tienda sincronizó ese día, no cuánto vendió.
3. **Tu planilla** (una fila por tienda): nombre, zona, tipo, fecha de instalación, días con ventas por semana, recomendación (0–10), problemas, pedidos de funciones, ¿pagaría? y cuánto.

## 6. La pregunta de precio (semana 6 a 8)

Hazla con el valor concreto, no en abstracto:

> Si el respaldo en la nube, varios celulares y los informes por WhatsApp costaran **$X al mes**, pagados por Nequi o Daviplata, ¿lo pagarías?

Prueba dos precios distintos en grupos de tiendas distintos (por ejemplo $9.900 y $14.900) y anota la respuesta exacta. Ofrecer el plan Pro gratis 3 meses a cambio de las llamadas es un buen incentivo.

## 7. Cuándo dar el piloto por bueno

| Señal | Meta |
|---|---|
| Tiendas que registran ventas 5 o más días por semana en la semana 4 | 60 % o más |
| Recomendación promedio (0–10) | 8 o más |
| Tiendas que dicen que pagarían el precio propuesto | 30 % o más |
| Tiendas que siguen usándola en la semana 8 | 50 % o más |

Si no se alcanzan, el problema es de producto antes que de precio: prioriza lo que más se repite en las llamadas.

## 8. Calendario sugerido

| Semana | Qué |
|---|---|
| 1–2 | Reclutar e instalar las primeras 10 tiendas; arreglar lo que falle |
| 3–4 | Llegar a 20–30 tiendas; llamadas semanales |
| 5–6 | Seguir midiendo; empezar la pregunta de precio |
| 7–8 | Cerrar: decidir precio y plan Pro con datos; elegir si pasar a cobro manual (pago por Nequi y activación a mano) |

## 9. Antes de cobrar

- Licencia revisada por un abogado y publicada (borrador del 2026-11-16 en `LICENSE` y en los Términos).
- Worker de pagos desplegado con la autenticación corregida (P0-1) y, para empezar, cobro manual.
- Tope de la nube desplegado (`migrations/0003_store_usage.sql` y Worker) con el número decidido.
