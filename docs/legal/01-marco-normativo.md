# 01 · Marco normativo y brechas

> **BORRADOR — requiere revisión de abogado colombiano antes de publicarse.**
> Consultado el **2026-11-06**. No es asesoría jurídica. No concluye qué régimen aplica al dueño: esas preguntas están en [91-preguntas-para-el-abogado.md](91-preguntas-para-el-abogado.md).

## Cómo leer este documento

- **(a) Norma** = lo que dice la fuente, con su URL. **(b) App** = lo que hace el código, con ruta. **(c) Interpretación** = mi lectura, marcada.
- Las fuentes "abiertas" se leyeron con una herramienta que **devuelve un resumen automático**, no el texto literal. El abogado debe cotejar cada cita con el texto oficial.
- **NO VERIFICADO** = no se abrió la fuente, o solo apareció en un resultado de búsqueda.

## 0. Fuentes consultadas

| # | Fuente | URL | Estado |
|---|---|---|---|
| S1 | Ley Estatutaria 1581 de 2012 (copia SISJUR, Alcaldía de Bogotá) | https://www.alcaldiabogota.gov.co/sisjur/normas/Norma1.jsp?i=49981 | **Abierta** (arts. 8, 9, 14, 15, 17, 18, 25, 26) |
| S1b | Ley 1581 de 2012 (Normograma DIAN) | https://normograma.dian.gov.co/dian/compilacion/docs/ley_1581_2012.htm | **Abierta**, primeros 100.000 de 789.459 caracteres |
| S2 | Decreto 1377 de 2013 (SISJUR) | https://www.alcaldiabogota.gov.co/sisjur/normas/Norma1.jsp?i=53646 | **Abierta.** La página no menciona su compilación en el Decreto 1074 de 2015. |
| S3 | Circular Única de la SIC (copia en normograma Colpensiones, `circular_superindustria_unica_pr004`) | https://normativa.colpensiones.gov.co/colpens/docs/circular_superindustria_unica_pr004.htm | **Abierta**, primeros 100.000 de 530.298 caracteres. **Parece desactualizada** (referencias hasta 2018). |
| S4 | Ley 527 de 1999 (Normograma DIAN) | https://normograma.dian.gov.co/dian/compilacion/docs/ley_0527_1999.htm | **Abierta** (arts. 5 a 15) |
| S5 | Ley 1266 de 2008 (Procuraduría) | https://apps.procuraduria.gov.co/gd_734/docs/l1266008.html | **Abierta** (arts. 1 a 3) |
| S6 | Google Play, requisitos de eliminación de cuenta | https://support.google.com/googleplay/android-developer/answer/13327111 | **Abierta** |
| S7 | Google Play, sección Seguridad de los datos | https://support.google.com/googleplay/android-developer/answer/10787469 | **Abierta** |
| S8 | Google Play, política de Datos de usuario | https://support.google.com/googleplay/android-developer/answer/10144311 | **Abierta** |
| S9 | Cloudflare Customer DPA v6.4 (vigente 3-abr-2026) | https://www.cloudflare.com/cloudflare-customer-dpa/ | **Abierta** |
| S10 | Expo, política de privacidad (actualizada 2-nov-2026) | https://expo.dev/privacy | **Abierta** |
| S11 | Open Food Facts, `/legal` | https://world.openfoodfacts.org/legal | **Abierta.** `/privacy` no abierta. |
| N1 | Ley 1480 de 2011 (arts. 46, 47, 50), Ley 2439 de 2024, Sentencia C-192 de 2026 | https://www.forvismazars.com/co/es/acerca-de-nosotros/noticias-publicaciones-y-media/nuestras-publicaciones/tax-legal/ley-2439-de-2024 · https://jurinfo.jep.gov.co/Normograma/compilacion/docs/C-192_2026.htm | **NO VERIFICADO.** Solo resultados de búsqueda; la sentencia no abrió (error de proxy), el PDF de la ley no fue legible y otro sitio devolvió 403. |
| N2 | Decreto 1074 de 2015 (Capítulo 25, compilación del Decreto 1377) | https://cancilleria.gov.co/normograma/compilacion/docs/decreto_1377_2013.htm (resultado de búsqueda) | **NO VERIFICADO.** Solo un resultado de búsqueda dice que la numeración es 2.2.2.25.x. |
| N3 | Decreto 090 de 2018 y Decreto 886 de 2014 (RNBD) | citados dentro de S1 y S3 | **NO VERIFICADO** como texto propio; solo citados por S1 y S3. |
| N4 | Proyectos de reforma a la Ley 1581 (2025 y 2026) | https://www.cuatrecasas.com/es/latam/tecnologia-medios-digitales/art/nuevo-proyecto-ley-proteccion-datos-personales-colombia · https://www.redjurista.com/Compilaciones2018/gacetasCongreso/2026/gc_1217_2026.pdf | **NO VERIFICADO.** Solo resultados de búsqueda. |
| N5 | Ley 1581, texto del Senado | http://www.secretariasenado.gov.co/senado/basedoc/ley_1581_2012.html | **No se pudo abrir** (error de proxy). Se usaron S1 y S1b. |

## 1. Ley 1581 de 2012 y reglamentación

**(a) Norma** (S1, S1b, S2):
- **Autorización** previa e informada, por un medio que permita consulta posterior (art. 9 Ley 1581). El decreto exige pedirla a más tardar al recolectar los datos, admite escrito, oral o **conductas inequívocas** y dice que "en ningún caso el silencio podrá asimilarse a una conducta inequívoca" (arts. 5 y 7 Decreto 1377). El responsable conserva prueba de la autorización (art. 8 Decreto 1377).
- **Derechos del titular** (art. 8): conocer, actualizar y rectificar; pedir prueba de la autorización; ser informado del uso; presentar quejas ante la SIC; revocar la autorización o pedir la supresión; acceso gratuito. La revocatoria y la supresión se piden por reclamo, con mecanismos gratuitos y fáciles (art. 9 Decreto 1377).
- **Consultas:** 10 días hábiles, prorrogables 5 días hábiles más con aviso de motivos (art. 14). **Reclamos:** subsanar en 5 días si está incompleto; leyenda "reclamo en trámite" en 2 días hábiles; respuesta en 15 días hábiles, prorrogables hasta 8 días hábiles más; traslado en 2 días hábiles si no se es competente (art. 15). El acceso es gratuito al menos una vez al mes (art. 21 Decreto 1377).
- **Deberes del responsable** (art. 17): garantizar el hábeas data, conservar copia de la autorización, informar la finalidad, seguridad y actualización, manual interno de políticas, tramitar consultas y reclamos en plazo, informar a la SIC violaciones de seguridad. **Encargado** (art. 18): actualizar lo reportado en 5 días hábiles, registrar las leyendas, informar violaciones de seguridad.
- **Política de tratamiento:** por escrito o electrónico, en lenguaje claro, con identificación del responsable, tratamiento y finalidad, derechos, área o persona que atiende consultas y reclamos, procedimiento, y fecha de vigencia (art. 13 Decreto 1377). **Aviso de privacidad:** contenido mínimo en art. 15 Decreto 1377.
- **Persona o área de protección de datos:** todo responsable y encargado debe designarla (art. 23 Decreto 1377).
- **Datos sensibles:** tratamiento prohibido salvo excepciones; ninguna actividad puede condicionarse a darlos (art. 6). **Niños, niñas y adolescentes:** prohibido salvo datos públicos o respeto del interés superior; autoriza el representante legal (art. 12).
- **Responsabilidad demostrada** (arts. 26 y 27 Decreto 1377): medidas apropiadas y efectivas, proporcionales al tamaño y al riesgo.

**(b) App:** ver 00-inventario. La aceptación de términos existe solo para el usuario de la app ([legal.ts](../../apps/mobile/src/legal.ts)); los clientes del tendero no ven ningún aviso. La política vigente es [legalText.ts:55-90](../../apps/mobile/src/legalText.ts#L55-L90).

**(c) Interpretación:** la política vigente no cumple el contenido mínimo del art. 13 del Decreto 1377 (falta domicilio, teléfono, área responsable, procedimiento con plazos y vigencia). Eso no se resuelve en esta carpeta: se deja en [10-politica-tratamiento-datos.md](10-politica-tratamiento-datos.md) como borrador.

## 2. Responsable y encargado (dos escenarios, sin escoger)

**(a) Norma:** el responsable decide sobre la base de datos y el tratamiento; el encargado trata los datos por cuenta del responsable (definiciones de la Ley 1581 y art. 3 Decreto 1377, S2). Entre ambos debe haber un contrato con alcances, y el encargado salvaguarda la seguridad y la confidencialidad (art. 25 Decreto 1377). Las transmisiones internacionales entre responsable y encargado para que este trate datos por cuenta del primero no requieren informar al titular ni su consentimiento **cuando existe ese contrato** (art. 24 num. 2).

**(c) Escenarios (no se escoge):**

| | Escenario A: el tendero es responsable y Surtivox encargado | Escenario B: Surtivox también es responsable |
|---|---|---|
| Clientes y fiados del tendero | El tendero decide qué registra; Surtivox los aloja por su cuenta | Surtivox decide fines propios sobre ellos (hoy el código no lo hace) |
| Qué exige | Contrato de encargo con cada tendero; instrucciones; seguridad; borrado al terminar | Política y autorización de Surtivox frente a los titulares |
| Datos del propio tendero (nombre, correo, tienda) y del catálogo | Surtivox es responsable de esos datos | Igual |
| Lo que ya dice la app | [legalText.ts:70](../../apps/mobile/src/legalText.ts#L70): "Surtivox almacena sus datos por encargo tuyo" (apunta al escenario A para fiados) | — |

La decisión **depende de la figura del dueño y de cómo se contrate**: va al abogado (preguntas 2, 3 y 4).

## 3. Registro Nacional de Bases de Datos (RNBD)

**(a) Norma** (S3, S1): el RNBD es un directorio público administrado por la SIC (art. 25 Ley 1581). Según la Circular Única en la copia consultada, deben inscribirse los responsables que sean **sociedades y entidades sin ánimo de lucro con activos totales superiores a 100.000 UVT** y las personas jurídicas de naturaleza pública; plazos de 2018 y 2019 ya vencidos; actualización anual entre el 2 de enero y el 31 de marzo y por cambios sustanciales. El umbral se cita junto al Decreto 090 de 2018 (N3, **NO VERIFICADO** como texto propio). Valor de la UVT en 2026 y umbral en pesos: **NO VERIFICADO**.

**(c) No concluyo si aplica.** Depende de la figura jurídica del dueño, de sus activos y de si es responsable (pregunta 5).

## 4. Transferencia y transmisión internacional

**(a) Norma:** el art. 26 Ley 1581 prohíbe transferir datos a países sin nivel adecuado, con excepciones, entre ellas la **autorización expresa e inequívoca del titular** y la ejecución de un contrato con autorización (S1). La Circular Única, copia consultada, lista en su numeral 3.2 países con nivel adecuado, entre ellos **Estados Unidos**, Alemania, España, Japón, México y Perú, y puede modificarse en cualquier momento; si hay un contrato que garantice la protección, "se presumirá" viable la operación con una comunicación previa a la SIC (S3). **La copia parece desactualizada**: verificar la versión vigente en el sitio de la SIC (**NO VERIFICADO**).

**(a) Términos de los proveedores:**
- **Cloudflare** (S9): actúa como encargado; el cliente es el responsable. Las transferencias a EE. UU. bajo el Marco de Privacidad de Datos UE-EE. UU. no se consideran restringidas; si el DPF dejara de ser válido se aplican las cláusulas contractuales tipo. Subencargados con autorización general, aviso con 30 días y oposición en 10. Al terminar el contrato borra o devuelve los datos a elección del cliente. Brechas: "without undue delay", sin plazo numérico. **No lista países de tratamiento.** Cómo se acepta ese DPA para una cuenta concreta: **NO VERIFICADO**. Dónde reside D1: **NO VERIFICADO**.
- **Expo** (S10): puede procesar en EE. UU.; usa DPF, cláusulas tipo, y para no residentes en EE. UU. el consentimiento a la transferencia. Países concretos: **NO VERIFICADO**.
- **Google**: **NO VERIFICADO** (no se abrió ningún DPA de Google).

**(c) Interpretación:** el envío a Cloudflare por la nube del tendero es una transmisión a un encargado fuera de Colombia. La política debe informarla. Si el contrato con el encargado de la sección 2 es suficiente para los datos de los clientes del tendero, lo decide el abogado (pregunta 6).

## 5. Estatuto del Consumidor (Ley 1480 de 2011)

**NO VERIFICADO** en texto. Lo que dicen resultados de búsqueda (N1): el retracto en ventas por medios electrónicos está en el art. 47; la Ley 2439 de 2024 modificó el inciso final y agregó un parágrafo; el plazo de **15 días calendario** para devolver el dinero tras el retracto quedó uniforme para todas las modalidades según la Sentencia C-192 de 2026; el plazo para ejercer el retracto se ubica en **5 días hábiles** según una nota de prensa y un concepto de la SIC de 2017; el art. 50 impone obligaciones de información a quien vende por medios electrónicos.

**(b) App:** hoy **no se cobra** nada ([DEUDA_TECNICA.md](../../DEUDA_TECNICA.md)). La suscripción se plantea por Google Play (`cloud_sync_monthly`).

**(c) Dudas para el abogado:** si el software por suscripción tiene excepciones al retracto, si Google Play como intermediario cambia quién responde, y precios (hay cuatro distintos en el código). Pregunta 8.

## 6. Ley 527 de 1999 y aceptación electrónica

**(a) Norma** (S4): la información no pierde validez por estar en un mensaje de datos (art. 5); cumple la exigencia de escrito si puede consultarse después (art. 6); admisibilidad y fuerza probatoria (art. 10); valoración por sana crítica atendiendo a la confiabilidad de generación, archivo, comunicación y conservación y a la identificación del iniciador (art. 11); un contrato no pierde validez por haberse formado con mensajes de datos (art. 14).

**(b) App:** guarda solo `legal_accepted_version` y `legal_accepted_at` en el teléfono ([legal.ts:45-49](../../apps/mobile/src/legal.ts#L45-L49)).

**(c) Interpretación:** una aceptación guardada solo en el dispositivo del aceptante es evidencia débil para el responsable. Qué evidencia conviene guardar (versión del texto, fecha y hora, identificador de instalación, copia del texto) es la pregunta 7. Ver brecha B9.

## 7. Ley 1266 de 2008 (hábeas data financiero)

**(a) Norma** (S5): regula la información financiera, crediticia, comercial, de servicios y de terceros países. Dato "financiero, crediticio, comercial, de servicios" es el que se refiere al nacimiento, ejecución y extinción de **obligaciones dinerarias** (art. 3 lit. j). Distingue fuente, operador y usuario. Excluye los datos de uso "exclusivamente personal o doméstico" y los que circulan internamente sin suministrarse a terceros (art. 2). La Ley 2157 de 2021 la modificó (N: resultado de búsqueda, **NO VERIFICADO**).

**(b) App:** el fiado registra deudas de clientes del tendero (nombre, teléfono, monto) y las sincroniza a un servidor ajeno al tendero. No hay consulta ni reporte a centrales de riesgo.

**(c) No concluyo** si registrar fiados activa la Ley 1266. Los criterios que importan: si el tendero es "fuente"; si el dato circula solo internamente o llega a Surtivox y a Cloudflare; si Surtivox se comporta como "operador". Pregunta 4.

## 8. Tiendas de aplicaciones (Google Play)

**(a) Norma de la tienda** (S6, S7, S8):
- **Política de privacidad obligatoria** aunque la app no recopile datos: enlazada en Play Console y dentro de la app, URL activa, pública, no PDF, con datos de contacto, tipos de datos, con quién se comparten, seguridad, y **retención y eliminación** (S8, S7).
- **Seguridad de los datos:** "recopilar" es transmitir datos fuera del dispositivo; "compartir" no incluye al proveedor de servicios que procesa por encargo; hay que declarar cifrado en tránsito y si se ofrece **eliminación** (S7). Datos seudónimos deben declararse (S7).
- **Eliminación de cuenta:** aplica si la app permite crear una cuenta; cuentas creadas y usadas **sin conexión** no cuentan; si se aplica, hace falta una vía en la app y un **enlace web** sin tener que volver a la app (S6).
- **Divulgación destacada y consentimiento** dentro de la app para usos no esperados, con acción afirmativa; salir de la pantalla no es consentimiento (S8).

**(b) App:** la política pública existe en [landing/privacidad.html](../../landing/privacidad.html) y se muestra en la app. Eliminación de datos del servidor: no hay mecanismo.

**(c) Duda:** si la "tienda" que se crea en la nube con el kit es una "cuenta" a efectos de la política de Google. Pregunta 12.

## 9. Cambios 2024 a 2026

- **Ley 2439 de 2024** (consumo electrónico): ver sección 5. **NO VERIFICADO.**
- **Sentencia C-192 de 2026** (retracto): ver sección 5. **NO VERIFICADO.**
- **Reforma de la Ley 1581:** resultados de búsqueda reportan proyectos radicados en la Cámara en 2025 (214 y 274 de 2025) y uno de 2026 (282 de 2026 Cámara, Gaceta 1217 de 2026), con temas como perfilamiento, tratamiento automatizado y flujos transfronterizos. **No confirmé ninguno como aprobado**; la Ley 1581 de 2012 sigue siendo el marco que encontré. **NO VERIFICADO.**
- Inteligencia artificial: sin norma específica confirmada.

## 10. Tabla: obligación → qué hace la app hoy → brecha → quién decide

| # | Obligación (fuente) | Qué hace la app hoy | Brecha | Quién decide |
|---|---|---|---|---|
| 1 | Autorización previa e informada del titular (art. 9 L1581) | Aceptación de términos del tendero al primer arranque | **BRECHA:** los clientes y proveedores del tendero no reciben aviso ni dan autorización dentro de la app | Abogado + dueño |
| 2 | Conservar prueba de la autorización (art. 8 D1377) | Solo en el teléfono del aceptante | **BRECHA** | Abogado + dueño |
| 3 | Informar la finalidad (art. 17) | Texto genérico en [legalText.ts:77](../../apps/mobile/src/legalText.ts#L77) | Parcial: finalidades poco específicas | Abogado |
| 4 | Política con contenido mínimo (art. 13 D1377) | [legalText.ts:55-90](../../apps/mobile/src/legalText.ts#L55-L90) | **BRECHA:** faltan domicilio, teléfono, área responsable, procedimiento, plazos y vigencia | Abogado + dueño |
| 5 | Conocer, actualizar, rectificar (art. 8) | El tendero edita sus datos en la app; un titular externo no tiene canal | **BRECHA** para titulares distintos del tendero | Abogado |
| 6 | **Supresión y revocatoria** (art. 8; art. 9 D1377) | Borrado local total y lógico; **ninguna ruta del servidor borra** | **BRECHA:** no existe borrado en servidor ni retiro de contribuciones al catálogo | Dueño (construir) |
| 7 | Consultas 10 días hábiles y reclamos 15 (arts. 14 y 15) | Correo manual de contacto; sin procedimiento ni registro | **BRECHA** (ver [15-procedimiento-derechos-del-titular.md](15-procedimiento-derechos-del-titular.md)) | Dueño |
| 8 | Persona o área de protección de datos (art. 23 D1377) | No definida | **BRECHA** | Dueño |
| 9 | Contrato de encargo (art. 25 D1377) | Una frase en [legalText.ts:70](../../apps/mobile/src/legalText.ts#L70) | **BRECHA** si el escenario A aplica | Abogado |
| 10 | Seguridad (art. 17) | HTTPS; solo huella de la llave en servidor; PIN débil (4 dígitos, `cyrb53`); `allowBackup=true`; sin cifrado de extremo a extremo | Parcial | Dueño |
| 11 | Informar violaciones de seguridad a la SIC (art. 17, art. 18) | Sin procedimiento de incidentes | **BRECHA** | Dueño |
| 12 | Transferencia internacional (art. 26) | Cloudflare, Expo y Google fuera de Colombia, informado en texto | Pendiente de revisar contrato y región de D1 | Abogado |
| 13 | RNBD | Sin análisis | **Pendiente de decidir** | Abogado |
| 14 | Datos sensibles y de menores (arts. 6 y 12) | La app no los pide, pero el campo "notas" de clientes es libre; no hay edad mínima | Parcial | Abogado |
| 15 | Evidencia de aceptación (Ley 527) | Solo local | **BRECHA** | Abogado |
| 16 | Google Play: política pública con retención y eliminación | Política existe; retención dice "mientras el servicio esté activo" | **BRECHA** en retención y eliminación | Dueño |
| 17 | Google Play: Seguridad de los datos coherente | Sin formulario | Ver [14-formulario-google-play.md](14-formulario-google-play.md) | Dueño |
| 18 | Retracto en suscripciones (Ley 1480) | No se cobra | Sin brecha hoy; **pendiente** al activar cobro | Abogado |

## 11. Mecanismos reales de borrado (hallazgo de código)

- **Teléfono:** sí. `resetAllData()` borra las tablas locales, `local_settings` y la llave de la nube ([repos.ts:1332-1338](../../apps/mobile/src/repos.ts#L1332-L1338)). **No** borra las fotos de `products/` ni `branding/` ni las copias de `safety/` (*Interpretación*: solo ejecuta `DELETE` en SQLite; comprobar en dispositivo).
- **Servidor de sincronización:** no. Rutas existentes: `register`, `push`, `pull`, `rotate` ([index.ts](../../apps/sync-worker/src/index.ts)). "Desactivar respaldo" no avisa al servidor ([syncState.ts:7-11](../../apps/mobile/src/syncState.ts#L7-L11)).
- **Catálogo:** no. Rutas existentes: `health`, `lookup`, `contribute` ([index.ts:186-192](../../apps/catalog-worker/src/index.ts#L186-L192)). Solo se borra `contribution_limits` con más de 7 días. `catalog_outbox` local se vacía, pero lo ya enviado no se puede retirar.
