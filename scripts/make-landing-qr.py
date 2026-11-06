import sys
from xml.sax.saxutils import escape, quoteattr

import qrcode

BORDER = 4
INK = "#102A24"
PAPER = "#FFFFFF"
TITLE = "Código QR para descargar Surtivox"


def build_svg(url: str) -> str:
    qr = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_Q, border=BORDER)
    qr.add_data(url)
    qr.make(fit=True)
    matrix = qr.get_matrix()
    size = len(matrix)
    runs = []
    for y, row in enumerate(matrix):
        x = 0
        while x < size:
            if row[x]:
                start = x
                while x < size and row[x]:
                    x += 1
                runs.append(f"M{start} {y}h{x - start}v1h-{x - start}z")
            else:
                x += 1
    desc = f"Apunta la cámara del celular a este código para abrir {url}"
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}" width="{size * 4}" height="{size * 4}" '
        f'shape-rendering="crispEdges" role="img" aria-labelledby="qr-title qr-desc">'
        f'<title id="qr-title">{escape(TITLE)}</title>'
        f'<desc id="qr-desc">{escape(desc)}</desc>'
        f'<rect width="{size}" height="{size}" fill="{PAPER}"/>'
        f'<path d={quoteattr("".join(runs))} fill="{INK}"/></svg>\n'
    )


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit("Uso: python3 scripts/make-landing-qr.py <URL> <salida.svg>")
    with open(sys.argv[2], "w", encoding="utf-8") as out:
        out.write(build_svg(sys.argv[1]))
