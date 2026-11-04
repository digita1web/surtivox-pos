# Notas de investigación — borrador del catálogo comunitario

Este archivo acompaña a `privacidad-catalogo-borrador.md`. No es asesoría legal. El borrador no está publicado ni enlazado.

## Método

Se leyó el flujo real en:

- `apps/catalog-worker/src/index.ts`: recibe código, nombre, presentación e `install_id`; calcula un hash con sal; guarda votos, límite diario y productos publicados.
- `apps/mobile/src/catalog.ts`: crea el `install_id`, envía la cola, cachea resultados y no incluye precios, ventas, clientes ni `store_id`.
- `landing/privacidad.html`: correo oficial `contacto3rillodivino@gmail.com` y alcance actual de la política.
- `apps/mobile/src/pos/UnknownBarcodeSheet.tsx`: nombre solo se aporta si fue editado; “Ahora no” guarda `catalog_opt_in = 0`; “Sí, ayudar” guarda `1`.

La búsqueda web se agotó por límite de consultas después de las primeras búsquedas. Las normas colombianas se contrastaron directamente en las páginas oficiales de Función Pública. Treinta quedó sin verificación.

## Resuelto en esta iteración

- El aviso de consentimiento ya incluye la presentación del producto.
- La etiqueta visible del catálogo ya no usa “anónimo”; ahora dice “Ayudar a mejorar el catálogo” y la línea “Sin tu nombre ni datos de tu tienda”.
- La tabla `contribution_limits` se limpia con una tarea diaria para conservar solo los últimos 7 días. El despliegue del Worker queda pendiente.

## Fuentes consultadas

| Fuente | Enlace | Qué se tomó |
| --- | --- | --- |
| Ley 1581 de 2012, Función Pública | https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=49981 | Artículo 8: derechos a conocer, actualizar, rectificar, solicitar supresión, revocar la autorización y presentar quejas ante la SIC. Artículo 9: autorización previa e informada, obtenida por un medio consultable. Artículo 26: prohibición de transferir datos a países sin nivel adecuado, con excepciones y intervención de la SIC. |
| Decreto 1377 de 2013, Función Pública | https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=53646 | Artículo 7: mecanismos de autorización; el silencio no equivale a autorización. Artículo 13: contenido mínimo de la política de tratamiento. Artículos 14 y 15: aviso de privacidad y su contenido mínimo. Artículo 23: persona o área para atender derechos. Artículos 24 y 25: reglas y contrato para transmisiones internacionales. |
| Decreto 1074 de 2015, Función Pública | https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=76608 | Decreto Único Reglamentario del sector Comercio, Industria y Turismo; se consultó como compilación normativa relacionada. No se usó para una cita textual adicional. |
| Política de privacidad de Open Food Facts | https://world.openfoodfacts.org/privacy | El proyecto trata el nombre de usuario como posible seudónimo, puede hacer visible el identificador de usuario y ofrece un correo para derechos. Se usó como referencia de transparencia; no se copió su modelo. |
| Datos y licencia de Open Food Facts | https://world.openfoodfacts.org/data | La base se ofrece bajo ODbL; los contenidos bajo DbCL; las imágenes bajo CC BY-SA. Se usó para comparar el modelo de licencia abierta; Surtivox no adopta ODbL en este borrador. |
| Licencia ODbL explicada por Open Food Facts | https://en.wiki.openfoodfacts.org/ODBL_License | Resume las obligaciones de atribución y compartir igual de ODbL. |
| Open Products Facts, datos | https://world.openproductsfacts.org/data | La base se ofrece bajo Open Database License; los contenidos bajo Database Contents License; las imágenes bajo CC BY-SA. |
| Open Products Facts, descubrimiento y FAQ | https://world.openproductsfacts.org/discover · https://world.openproductsfacts.org/faq | Proyecto colaborativo, datos abiertos y reutilizables con atribución y compartición de mejoras. No se verificó una política de privacidad separada. |
| Política de privacidad de Cloudflare | https://www.cloudflare.com/privacypolicy/ | Cloudflare se identifica como proveedor de infraestructura. La página se consultó para identificar el tercero; no se usó para afirmar una ubicación física concreta. |
| Treinta | No verificada | Las rutas intentadas de privacidad y términos devolvieron 404 y la búsqueda web se agotó. No se usa ninguna afirmación sobre Treinta en el borrador. |
| SIC, portal | No verificada | La ruta intentada devolvió “Página no encontrada”. Los derechos y la autorización se tomaron de la Ley 1581 y del Decreto 1377, no de una página de la SIC. |

## Lo que no se pudo verificar

- La ubicación exacta de los servidores de Cloudflare que procesarán la D1 y el Worker. El borrador parte del contexto del producto: Cloudflare está fuera de Colombia.
- Si la operación debe clasificarse como transferencia o transmisión internacional y qué contrato o mecanismo exige la normativa. Es una decisión jurídica pendiente.
- La obligación de registrar la base de datos, designar un oficial o área de protección de datos y los datos completos del responsable. No se inventaron.
- El plazo de conservación de votos, hashes y nombres publicados. La limpieza de límites diarios ya quedó definida en 7 días; el resto del esquema no tiene caducidad automática.
- Si se implementará la eliminación de aportes ya publicados o solo la exclusión de nuevas contribuciones.
- El texto y alcance de una licencia definitiva para el aporte. Open Food Facts y Open Products Facts usan ODbL para sus bases, pero Surtivox no adopta esa licencia en este borrador.
- La política de Treinta. No se encontró una página oficial verificable en esta sesión.
- Una cita específica de una guía de la SIC. La ruta consultada no estaba disponible; se usaron las normas oficiales.
- La calificación jurídica colombiana exacta de un hash de instalación como dato seudónimo. El borrador lo describe técnicamente y deja la calificación al abogado.

## Decisiones pendientes para el dueño

1. **Plazo de retención** de votos, hashes y nombres publicados. La limpieza de límites diarios ya está definida en 7 días.
2. **Borrado de aportes ya publicados**: decidir si se ofrece, cómo se atiende y qué efecto tiene sobre el consenso.
3. **Responsable del tratamiento**: nombre o razón social, domicilio, dirección, teléfono y correo; designar persona o área para derechos.
4. **Registro y oficialía**: determinar si hay obligación de registrar la base o designar un oficial/área de protección de datos.
5. **Transferencia internacional**: revisar la ubicación, el contrato con Cloudflare y la base legal aplicable.
6. **Licencia del aporte**: validar el permiso no exclusivo propuesto o decidir una licencia abierta.
7. **Aviso de la app**: resuelto; ya incluye la presentación. Queda verificar su redacción final antes de publicar.
8. **Uso de “anónimo”**: resuelto en la etiqueta visible de la app; la explicación de dato seudónimo sigue pendiente de revisión legal.
9. **Revisión por un abogado colombiano** antes de publicar.
10. **Publicación**: no enlazar este borrador ni sustituir `landing/privacidad.html` hasta completar las decisiones anteriores.
