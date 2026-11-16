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

## Compilar los paquetes

```bash
node catalog-data/src/cli/build.ts --version=2026.11.16 --out=catalog-dist
```

No compila si la validación tiene errores. Genera, por cada tipo de negocio con productos, `<tipo>.sqlite`, su versión comprimida `<tipo>.sqlite.gz` y un `manifest.json` con `catalog_version`, cantidad de productos, bytes y sha256 de cada archivo. La compilación es reproducible: los mismos datos producen los mismos bytes, así la app no descarga de nuevo un paquete que no cambió.

Cada paquete es una base SQLite lista para abrir, sin pasos de importación:

- `products` (en orden de nombre más corto primero), `barcodes`, `categories`, `units`, `sources` (con licencia y atribución) y `meta`.
- `products_fts`: FTS5 sin contenido duplicado (`content=''`, `detail=none`), con `unicode61 remove_diacritics 2` y prefijos de 2 y 3 letras.
- `src/search.ts` tiene las consultas que usará la app: `matchQuery` convierte lo escrito en prefijos seguros (sin operadores de FTS5) y la búsqueda ordena por relevancia solo los primeros 300 candidatos, para que el costo quede acotado aunque coincidan miles.

## Medición

```bash
node catalog-data/src/cli/bench.ts --items=200000 [--compare]
```

Genera productos sintéticos deterministas (nunca se guardan en `data/`), los valida, compila los paquetes y mide tamaños y consultas.

Resultado del 2026-11-16 con 200.000 productos sintéticos, **medido en un computador de escritorio, no en un teléfono**:

| Paquete | Productos | SQLite | gzip -9 |
|---|---:|---:|---:|
| tienda | 95.733 | 14,3 MB | 4,9 MB |
| minimercado | 95.480 | 14,3 MB | 4,9 MB |
| ferretería | 42.778 | 6,3 MB | 2,1 MB |
| papelería | 29.328 | 4,4 MB | 1,4 MB |
| droguería | 27.206 | 4,2 MB | 1,3 MB |
| licorera | 23.315 | 3,4 MB | 1,1 MB |

- `detail=none` pesa 14,3 MB frente a 17,3 MB (`column`) y 18,4 MB (`full`).
- Brotli 11 deja el paquete de tienda en 3,3 MB frente a 4,9 MB con gzip, pero tarda 90 s en comprimir y el teléfono necesitaría una librería para descomprimirlo.
- Búsqueda mientras se escribe (5.500 consultas de 2 o más letras): p50 1,4 ms, p95 14 ms, máximo 57 ms. Por código de barras: p50 0,04 ms. Abrir el paquete: menos de 1 ms.
- Ordenar todas las coincidencias por relevancia daba p95 45 ms y máximo 150 ms; acotar a 300 candidatos lo bajó a los valores de arriba.

Pendiente de medir en un Android de gama baja: descarga, verificación del sha256, apertura y búsqueda. Los datos sintéticos repiten vocabulario; un catálogo real puede pesar distinto.

## Fuentes en uso

| Fuente | Estado | Productos | Cómo se obtiene |
|---|---|---:|---|
| `surtivox` (propio) | aprobada | 814 | Redactado por el proyecto; los JSONL de `data/surtivox/` se editan a mano o se regeneran. |
| `off` (Open Food Facts) | aprobada | 447 | `src/importers/fetch-off.sh` descarga a `.cache/off/<día>/` y `src/cli/import-off.ts --day=<día>` escribe `data/off/colombia.jsonl`. |
| `invima-cum` | pendiente | 0 | Pospuesta; CC BY-SA 4.0, incompatible con ODbL. |

**Open Food Facts solo entrega 10 páginas (1.000 productos) a usuarios no identificados.** Desde la página 11 responde "Due to heavy abuse from robots, we are unable to serve this page to unidentified users". No se rodea ese bloqueo partiendo consultas: para el resto hay que usar una cuenta de Open Food Facts o su exportación oficial de datos, con aprobación del propietario.

Reglas del importador (`src/importers/off.ts`, probadas en `test/off.test.ts`): nombre en español; marca obligatoria y con mayúscula inicial si viene en mayúsculas; si el nombre ya trae una medida no se agrega otra y una presentación que la contradiga se descarta; categoría por nombre (`NAME_RULES`: la malta va a bebidas) o por la tabla `off-categories.json`; los suplementos y las proteínas no tienen equivalencia a propósito. Lo demás queda en cuarentena en la caché con su motivo.

## Publicar una actualización

```bash
node catalog-data/src/cli/validate.ts
node catalog-data/src/cli/build.ts --version=AAAA.MM.DD --out=landing/catalogo --gzip=false
```

`landing/` se publica en GitHub Pages al fusionar en `main`; la app descarga `https://digita1web.github.io/surtivox-pos/catalogo/manifest.json` y el `.sqlite` de su tipo de negocio, y compara tamaño y sha256 antes de instalarlo. `test/published.test.ts` falla si `data/` cambió y no se recompiló lo publicado.
