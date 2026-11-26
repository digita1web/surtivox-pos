# Relevos de sesión

Esta carpeta guarda **dónde quedó el trabajo al cerrar cada sesión**, para que la siguiente (otro chat, otro modelo, otro día) arranque sin reconstruir nada.

La guía general sigue en [../continuidad.md](../continuidad.md): reglas de oro, ritmo de trabajo, entorno y decisiones del propietario. Aquí solo va lo que cambia de una sesión a otra.

## Cómo se usa

- **Al empezar:** lee la guía general y después el relevo más reciente (el de fecha más alta). Lo que dice [Verificado] se comprobó ese día; lo demás verifícalo antes de apoyarte en ello.
- **Al cerrar:** crea `AAAA-MM-DD.md` copiando [plantilla.md](plantilla.md). Si ya existe uno de ese día, añade una sección al final en vez de crear otro.
- **No se borran.** Si algo quedó cerrado, el relevo siguiente lo dice. Lo que sobreviva a varias sesiones sube a [DEUDA_TECNICA.md](../../DEUDA_TECNICA.md) o a la guía.

## Qué va y qué no

- Va: estado real (con hash o número de PR), lo que falló y todavía no se entiende, decisiones abiertas del propietario, el siguiente paso propuesto y lo que **no** se pudo comprobar.
- No va: PIN, códigos de recuperación, tokens, llaves ni datos personales. El repositorio es público.
- No se repite lo que ya está en la guía; se enlaza.

## Relevos

| Fecha | Resumen |
|---|---|
| [2026-11-26](2026-11-26.md) | 1.1.8 publicada y nube blindada; la OTA de producción con el mensaje del límite falló dos veces y sigue abierta. |
