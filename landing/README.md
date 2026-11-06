# Landing de Surtivox POS

Se publica con GitHub Pages desde esta carpeta (`.github/workflows/pages.yml`, en cada push a `main`). URL pública: https://digita1web.github.io/surtivox-pos/

## Código QR de la sección "Instala Surtivox"

`assets/qr-descarga.svg` codifica exactamente: `https://digita1web.github.io/surtivox-pos/#instala`

Corrección de errores nivel Q, zona de silencio de 4 módulos, módulos `#102A24` sobre fondo `#FFFFFF`, con `<title>` y `<desc>`.

### Regenerar si cambia la URL

Desde la raíz del repositorio (requiere el módulo `qrcode` de Python, por ejemplo `pip install qrcode`):

```bash
python3 scripts/make-landing-qr.py 'https://digita1web.github.io/surtivox-pos/#instala' landing/assets/qr-descarga.svg
```

Después actualiza la URL esperada en `apps/mobile/src/landingInstall.test.ts` (`EXPECTED_QR_URL`) y esta página.

### Verificar que el QR decodifica a la URL exacta

Con una herramienta temporal fuera del repositorio:

```bash
python3 -m venv /tmp/qrvenv
/tmp/qrvenv/bin/pip install opencv-python-headless cairosvg
/tmp/qrvenv/bin/python - <<'PY'
import cairosvg, cv2
esperada = 'https://digita1web.github.io/surtivox-pos/#instala'
for ancho in (900, 200):
    cairosvg.svg2png(url='landing/assets/qr-descarga.svg', write_to=f'/tmp/qr{ancho}.png', output_width=ancho, output_height=ancho)
    texto, _, _ = cv2.QRCodeDetector().detectAndDecode(cv2.imread(f'/tmp/qr{ancho}.png', cv2.IMREAD_GRAYSCALE))
    print(ancho, repr(texto), texto == esperada)
PY
```

Las dos líneas deben terminar en `True`. Falta siempre la prueba con la cámara de un celular real.
