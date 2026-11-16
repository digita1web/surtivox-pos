# Catálogo estandarizado de productos

Base de datos de productos, solo texto, para que el tendero encuentre un producto por nombre o código de barras sin escribirlo desde cero. Funciona sin internet: la app descarga un paquete por tipo de negocio y lo consulta en el teléfono.

Licencia de los datos: ODbL 1.0 (ver [LICENSE](LICENSE)). El código se rige por el `LICENSE` de la raíz.

## Estructura

| Ruta | Contenido |
|---|---|
| `taxonomy/business-types.json` | Tipos de negocio (tienda, minimercado, droguería, ferretería, papelería, licorera). |
| `taxonomy/categories.json` | Categorías con su emoji y los tipos de negocio donde aplican. Las 16 categorías con imagen en la app conservan su nombre exacto. |
| `taxonomy/units.json` | Unidades con los mismos ids que la app (`unit`, `bottle`, `L`, …). `sale`: se puede vender en esa unidad; `presentation`: sirve para describir el empaque. La libra es la colombiana, 500 g. |
| `sources/licenses.json` | Licencias conocidas y si son compatibles con ODbL. CC BY-SA no lo es. |
| `sources/sources.json` | Registro de fuentes con licencia, atribución y estado (`approved`, `pending`, `rejected`). Hoy está vacío. |
| `schema/product.schema.json` | Contrato de un producto (JSON Schema 2020-12). |
| `data/` | Datos maestros en JSONL, una carpeta por fuente. |
| `src/` | Normalización, validación de GTIN, taxonomías, validador y comandos. |
| `test/` | Pruebas; corren en `scripts/verify.sh`. |

## Producto

| Campo | Obligatorio | Regla |
|---|---|---|
| `id` | Sí | `fuente:clave`, estable entre versiones. |
| `name` | Sí | Normalizado (`normalizeName`): espacios, NFC y unidades (`500gr` → `500 g`, `1lt` → `1 L`, `400 cc` → `400 ml`). 2 a 120 caracteres. |
| `brand` | No | Normalizado, hasta 60 caracteres. |
| `category` | Sí | id de `categories.json`, y la categoría debe aplicar a todos los `business_types` del producto. |
| `unit` | Sí | Unidad de venta. |
| `presentation` | No | `{ quantity, unit, count? }`; por ejemplo `{ "quantity": 330, "unit": "ml", "count": 6 }`. |
| `synonyms` | No | Hasta 20, únicos y distintos del nombre al comparar sin tildes ni mayúsculas. |
| `barcodes` | No | GTIN-8, UPC-A, EAN-13 o GTIN-14 con dígito de control válido. Un código no puede pertenecer a dos productos. |
| `business_types` | Sí | Al menos uno. |
| `source` | Sí | `{ id, ref?, retrieved_at? }`; la fuente debe estar aprobada. |
| `license` | Sí | Debe ser la licencia de la fuente. |

## Validar

```bash
node catalog-data/src/cli/validate.ts
```

Termina con código 1 si hay errores y muestra archivo, línea, código y motivo. Los avisos (texto en mayúsculas, posibles duplicados) no detienen la validación.

## Reglas

- No se hace scraping de tiendas ni se usan datos sin licencia clara.
- Una fuente nueva se registra primero como `pending`, con su licencia verificada en la página oficial; pasa a `approved` solo con la decisión del propietario.
- No se guardan fotos de productos: cada categoría tiene un emoji, y en la app, su imagen por defecto.
