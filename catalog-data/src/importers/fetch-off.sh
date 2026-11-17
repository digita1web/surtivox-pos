#!/usr/bin/env bash
set -euo pipefail
umask 077

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DAY="${1:-$(date +%F)}"
OUT="$ROOT/.cache/off/$DAY"
JAR="$ROOT/.cache/off/session.cookies"
CREDENTIALS="${OFF_ENV:-$HOME/.config/surtivox/off.env}"
UA="SurtivoxPOS-Catalog/0.1 (+https://github.com/digita1web/surtivox-pos)"
FIELDS="code,product_name,product_name_es,generic_name_es,brands,quantity,categories_tags,countries_tags,lang,last_modified_t"
BASE="https://world.openfoodfacts.org/api/v2/search?countries_tags_en=colombia&page_size=100&sort_by=code&fields=$FIELDS"
PAUSE=7

mkdir -p "$OUT"
AUTH=()

login() {
  [ -f "$CREDENTIALS" ] || return 0
  local code
  code=$(
    set -a
    . "$CREDENTIALS"
    set +a
    printf '%s' "${OFF_PASS:?falta OFF_PASS}" | curl -sS -m 60 -A "$UA" -c "$JAR" -o /dev/null -w '%{http_code}' \
      --data-urlencode "user_id=${OFF_USER:?falta OFF_USER}" --data-urlencode "password@-" \
      "https://world.openfoodfacts.org/cgi/session.pl"
  )
  if [ "$code" != "200" ] || ! grep -q $'\tsession\t' "$JAR"; then
    echo "No se pudo iniciar sesión en Open Food Facts (HTTP $code). Revisa $CREDENTIALS." >&2
    exit 1
  fi
  AUTH=(-b "$JAR")
  echo "Sesión de Open Food Facts iniciada"
}

valid_page() {
  python3 -c 'import json,sys; d=json.load(open(sys.argv[1])); assert isinstance(d.get("products"), list)' "$1" 2>/dev/null
}

fetch_page() {
  local page="$1" file="$OUT/page-$(printf '%03d' "$1").json" tmp code relogged=0
  if [ -s "$file" ] && valid_page "$file"; then
    return 0
  fi
  tmp="$file.tmp"
  for attempt in 1 2 3 4 5 6; do
    code=$(curl -sS -m 120 -A "$UA" "${AUTH[@]}" -o "$tmp" -w '%{http_code}' "$BASE&page=$page" || echo 000)
    if [ "$code" = "200" ] && valid_page "$tmp"; then
      mv "$tmp" "$file"
      sleep "$PAUSE"
      return 0
    fi
    if [ "$code" = "401" ] || [ "$code" = "403" ]; then
      if [ "$relogged" = "0" ] && [ -f "$CREDENTIALS" ]; then
        relogged=1
        login
        sleep "$PAUSE"
        continue
      fi
      rm -f "$tmp"
      echo "Open Food Facts negó la página $page (HTTP $code). Se detiene la descarga sin reintentar." >&2
      exit 3
    fi
    sleep $((PAUSE * attempt))
  done
  rm -f "$tmp"
  echo "No se pudo descargar la página $page" >&2
  return 1
}

login
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
