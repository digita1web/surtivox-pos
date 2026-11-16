#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DAY="${1:-$(date +%F)}"
OUT="$ROOT/.cache/off/$DAY"
UA="SurtivoxPOS-Catalog/0.1 (+https://github.com/digita1web/surtivox-pos)"
FIELDS="code,product_name,product_name_es,generic_name_es,brands,quantity,categories_tags,countries_tags,lang,last_modified_t"
BASE="https://world.openfoodfacts.org/api/v2/search?countries_tags_en=colombia&page_size=100&sort_by=code&fields=$FIELDS"
PAUSE=7

mkdir -p "$OUT"

fetch_page() {
  local page="$1" file="$OUT/page-$(printf '%03d' "$1").json" tmp
  if [ -s "$file" ] && python3 -c 'import json,sys; json.load(open(sys.argv[1]))' "$file" 2>/dev/null; then
    return 0
  fi
  tmp="$file.tmp"
  for attempt in 1 2 3 4 5 6; do
    if curl -sS -m 120 -A "$UA" "$BASE&page=$page" -o "$tmp" \
      && python3 -c 'import json,sys; d=json.load(open(sys.argv[1])); assert isinstance(d.get("products"), list)' "$tmp" 2>/dev/null; then
      mv "$tmp" "$file"
      sleep "$PAUSE"
      return 0
    fi
    sleep $((PAUSE * attempt))
  done
  rm -f "$tmp"
  echo "No se pudo descargar la página $page" >&2
  return 1
}

fetch_page 1
COUNT=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["count"])' "$OUT/page-001.json")
PAGES=$(( (COUNT + 99) / 100 ))
echo "Open Food Facts Colombia: $COUNT productos en $PAGES páginas"
for page in $(seq 2 "$PAGES"); do
  fetch_page "$page"
  echo "página $page/$PAGES"
done
printf '{"source":"off","retrieved_at":"%s","count":%s,"pages":%s,"query":"%s"}\n' "$DAY" "$COUNT" "$PAGES" "$BASE" > "$OUT/meta.json"
echo "LISTO $OUT"
