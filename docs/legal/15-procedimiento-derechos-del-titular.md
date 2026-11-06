# Procedimiento interno para atender los derechos de los titulares

> **BORRADOR — requiere revisión de abogado colombiano antes de publicarse.**
> Describe cómo debería atender el dueño las solicitudes, **con los plazos de la Ley 1581 de 2012** según la fuente consultada (https://www.alcaldiabogota.gov.co/sisjur/normas/Norma1.jsp?i=49981, arts. 14 y 15, abierta el 2026-11-06) y el Decreto 1377 de 2013 (https://www.alcaldiabogota.gov.co/sisjur/normas/Norma1.jsp?i=53646, arts. 9, 18, 21). El abogado debe cotejarlos. **Hoy el servidor no tiene herramientas de borrado**: la sección 6 dice qué habría que construir.

## 1. Responsable del procedimiento
`[[POR COMPLETAR: persona o área designada (art. 23 Decreto 1377)]]`. Canal: pragramademateo@gmail.com. Registro de solicitudes: `[[POR COMPLETAR: dónde se llevan, por ejemplo una hoja de cálculo privada]]`.

## 2. Tipos de solicitud y plazos

| Tipo | Plazo de respuesta | Prórroga | Fuente |
|---|---|---|---|
| **Consulta** (ver qué datos tenemos y qué uso se les da) | 10 días hábiles desde el recibo | 5 días hábiles más, informando el motivo y la nueva fecha | art. 14 Ley 1581 |
| **Reclamo** (corregir, actualizar, suprimir, revocar autorización, o por incumplimiento) | 15 días hábiles desde el día siguiente al recibo | Hasta 8 días hábiles más, informando al titular | art. 15 Ley 1581 |
| Reclamo incompleto | Pedir lo que falta dentro de 5 días; si pasan 2 meses sin respuesta, se entiende desistido | — | art. 15 |
| Reclamo que no nos corresponde | Trasladarlo en 2 días hábiles e informar al titular | — | art. 15 |
| "Reclamo en trámite" | Marcar en máximo 2 días hábiles desde el reclamo completo y mantener hasta la decisión | — | art. 15 |

La consulta es gratuita al menos una vez al mes (art. 21 Decreto 1377).

## 3. Quién es el titular y a quién se responde
- **Un usuario (tendero)** pidiendo sus propios datos: se responde directamente.
- **Un cliente, proveedor o empleado del tendero** pidiendo sus datos: *[[ESCENARIO A o B — decisión del abogado]]*. En el escenario A (tendero responsable, Surtivox encargado) Surtivox **traslada la solicitud al tendero** y colabora; en el B responde Surtivox. El Decreto 1377 define cómo se reparte la atención (arts. 3, 13, 25).

## 4. Pasos
1. **Recibir** y registrar: fecha, canal, nombre, qué pide, plazo que vence.
2. **Verificar identidad:** pedir un dato que solo el titular tenga. Para un tendero: nombre de la tienda y el dato que identifica su registro. Para el catálogo: ver sección 5, punto C.
3. **Clasificar** (consulta o reclamo) y, si es reclamo completo, marcar "reclamo en trámite".
4. **Ejecutar** (sección 5) y **responder** por escrito dentro del plazo, guardando copia.
5. **Cerrar** el registro con fecha de respuesta y qué se hizo.

## 5. Cómo se ejecuta cada derecho hoy

**A. Consulta o acceso (tendero).** El tendero ya ve todos sus datos en la app. Para lo que está en el servidor: `[[POR COMPLETAR: el dueño exporta las filas de la tienda en D1 y se las entrega; hoy no hay herramienta, ver 6.2]]`.

**B. Rectificación / actualización.** En la app, el tendero corrige sus registros. Si los datos ya sincronizaron, se corrigen en el teléfono y se vuelven a sincronizar ("Sincronizar ahora").

**C. Supresión o revocatoria en el servidor de respaldo.**
- **Desde el teléfono, sin tocar el servidor:** Más → Borrar todos los datos de la app (no borra lo que está en la nube) y "Desactivar respaldo" (no borra lo enviado).
- **En el servidor:** hoy **no hay función**. `[[POR COMPLETAR: confirmar si el dueño puede y se compromete a ejecutar el borrado manual de las filas de la tienda en D1; ver 6.1]]`.

**D. Catálogo comunitario.**
- Dejar de participar: Más → Privacidad.
- Retirar aportes ya enviados: **no hay función**. Como el servidor guarda solo una huella (SHA-256 de `CATALOG_SALT` + identificador de instalación), para ubicar los aportes de una persona hace falta su identificador de instalación (`catalog_install_id`, en `local_settings`, visible solo en el teléfono). `[[POR COMPLETAR: decisión del dueño y del abogado sobre el efecto en nombres ya publicados por consenso]]`.

**E. Cliente o proveedor de un tendero.** Trasladar al tendero (escenario A) y, si el tendero usa la nube, ayudarle a corregir o borrar ese registro (el tendero puede hacerlo desde su app; el borrado en la app es lógico y se sincroniza como `deleted_at`, **no es borrado físico en el servidor**).

## 6. Qué habría que construir en el servidor para cumplirlo (sin implementar aquí)

1. **Borrado de una tienda en D1 (supresión total).** Ruta autenticada con la llave de la tienda que borre las filas de las 15 tablas sincronizadas, `shop_keys` y los intentos asociados, con confirmación y registro del borrado (sin datos personales en el registro).
2. **Exportación.** Ruta o script que devuelva todas las filas de una tienda en un formato legible (para acceso y portabilidad).
3. **Borrado físico de registros marcados `deleted_at`** pasado un plazo.
4. **Retiro de aportes al catálogo.** Ruta que, dado el identificador de instalación, calcule la huella y borre los votos y límites, y recalcule `catalog_products`.
5. **Limpieza de `kit_attempts`** (IP de intentos fallidos) por plazo.
6. **Retención:** tareas programadas con los plazos que decida el dueño.
7. **Registro de solicitudes** para demostrar cumplimiento ante la SIC (responsabilidad demostrada, arts. 26 y 27 Decreto 1377).

Prioridad y alcance en [92-brechas-tecnicas-a-cerrar.md](92-brechas-tecnicas-a-cerrar.md).

## 7. Mientras no exista la herramienta
`[[POR COMPLETAR: el dueño decide si, hasta construirla, la supresión se hace manualmente con consultas directas a D1 desde su cuenta de Cloudflare; si no puede comprometerse, no debe prometer la supresión en la política ni marcar "sí" en la pregunta de eliminación del formulario de Google]]`.
