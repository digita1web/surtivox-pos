# Datos maestros

Un archivo JSONL por lote, dentro de una carpeta por fuente:

```
data/<id-de-fuente>/<lote>.jsonl
```

Cada línea es un producto que cumple `schema/product.schema.json`. El prefijo del `id` de cada producto es el id de su fuente.

Esta carpeta está vacía a propósito: ningún dato entra hasta que el propietario apruebe la fuente en `sources/sources.json` (`"status": "approved"`). El validador rechaza productos de fuentes pendientes, rechazadas o no registradas.
