# Surtivox POS — Kit de identidad visual v1

Kit inicial basado en la captura compartida por el usuario. Los HEX son aproximaciones visuales extraídas de la referencia; validar contra los colores reales del código fuente antes de publicar.

## Dirección de marca
- Personalidad: ágil, confiable, moderna y cercana al comercio de barrio colombiano.
- Idea de símbolo: S geométrica que integra ritmo de código de barras.
- UI: tema oscuro, superficies grafito y verde turquesa como acción primaria.
- Prioridad: legibilidad, reconocimiento en tamaños pequeños y consistencia.

## Paleta
- Fondo principal: #0B0E12
- Superficie: #151C24
- Borde: #27313B
- Verde principal: #19B88E
- Verde oscuro: #10332C
- Texto principal: #F1F3F6
- Texto secundario: #929BA9
- Alerta: #E66B75
- Fondo de alerta: #FCEBED

## Contenido
- `brand/palette.css`: variables CSS.
- `brand/palette.json`: paleta estructurada.
- `brand/surtivox-mark.svg`: símbolo vectorial editable.
- `brand/app-icon.svg`: icono cuadrado vectorial.
- `brand/app-icon-1024.png`: export PNG 1024x1024.
- `icons/`: cinco iconos principales y fiado, en SVG.
- `prompts/`: prompts en inglés para generar variaciones de icono e ilustración.
- `docs/`: especificación de uso y accesibilidad.
- `reference/captura_original.jpg`: imagen de referencia proporcionada.

## Recomendaciones
1. El SVG es el recurso maestro editable; los PNG pueden regenerarse desde él.
2. Para Android, exportar/adaptar el icono a los tamaños y formato que exija el proyecto (incluido adaptive icon si corresponde).
3. No usar solo el color para indicar un estado: acompañar alertas con texto/icono.
4. Verificar contraste en dispositivos reales y probar tamaños pequeños.
5. La ilustración splash propuesta es un prompt listo para generar, no una imagen generada en este kit.
