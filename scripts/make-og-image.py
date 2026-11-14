import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "landing" / "assets"
FONT_DIRS = [Path("/usr/share/fonts/truetype/msttcorefonts"), Path("/usr/share/fonts/truetype/liberation")]
BOLD = ["Trebuchet_MS_Bold.ttf", "trebucbd.ttf", "LiberationSans-Bold.ttf"]
REGULAR = ["Trebuchet_MS.ttf", "trebuc.ttf", "LiberationSans-Regular.ttf"]

SCALE = 2
WIDTH, HEIGHT = 1200, 630
BG = (244, 247, 245)
INK = (16, 42, 36)
ACCENT = (8, 127, 91)
DEEP = (6, 78, 59)
MUTED = (94, 108, 103)
MINT = (219, 250, 233)
PHONE = (5, 7, 8)
TEXT_LEFT = 72
TEXT_MAX_RIGHT = 690
SUBTITLE_WIDTH = 540
PHONE_LEFT = 760


def find_font(names):
    for directory in FONT_DIRS:
        for name in names:
            candidate = directory / name
            if candidate.exists():
                return str(candidate)
    sys.exit("No se encontró una tipografía compatible: " + ", ".join(names))


BOLD_PATH = find_font(BOLD)
REGULAR_PATH = find_font(REGULAR)


def font(path, size):
    return ImageFont.truetype(path, round(size * SCALE))


def px(value):
    return round(value * SCALE)


def fit_font(draw, text, path, size, max_width):
    while size > 20:
        candidate = font(path, size)
        if draw.textlength(text, font=candidate) <= px(max_width):
            return candidate, size
        size -= 2
    sys.exit("El texto no cabe: " + text)


def wrap(draw, text, candidate, max_width):
    lines, current = [], ""
    for word in text.split():
        trial = (current + " " + word).strip()
        if draw.textlength(trial, font=candidate) <= px(max_width):
            current = trial
        else:
            lines.append(current)
            current = word
    lines.append(current)
    return lines


def rounded_mask(size, radius):
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size[0] - 1, size[1] - 1), radius=radius, fill=255)
    return mask


def build():
    canvas = Image.new("RGB", (px(WIDTH), px(HEIGHT)), BG)
    draw = ImageDraw.Draw(canvas)
    boxes = {}

    circle = (px(930 - 280), px(330 - 280), px(930 + 280), px(330 + 280))
    draw.ellipse(circle, fill=MINT)

    shot = Image.open(ASSETS / "screen-home.webp").convert("RGB")
    screen_w = 316
    screen_h = round(shot.height * screen_w / shot.width)
    shot = shot.resize((px(screen_w), px(screen_h)), Image.LANCZOS)
    pad = 12
    outer_w, outer_h = screen_w + pad * 2, screen_h + pad * 2
    phone_top = 58

    shadow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle(
        (px(PHONE_LEFT), px(phone_top + 26), px(PHONE_LEFT + outer_w), px(phone_top + 26 + outer_h)),
        radius=px(46), fill=(6, 78, 59, 90),
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(px(22)))
    canvas.paste(Image.alpha_composite(canvas.convert("RGBA"), shadow).convert("RGB"))
    draw = ImageDraw.Draw(canvas)

    draw.rounded_rectangle(
        (px(PHONE_LEFT), px(phone_top), px(PHONE_LEFT + outer_w), px(phone_top + outer_h)),
        radius=px(46), fill=PHONE,
    )
    canvas.paste(shot, (px(PHONE_LEFT + pad), px(phone_top + pad)), rounded_mask(shot.size, px(34)))
    boxes["telefono"] = (PHONE_LEFT, phone_top, PHONE_LEFT + outer_w, min(phone_top + outer_h, HEIGHT))
    draw = ImageDraw.Draw(canvas)

    icon = Image.open(ASSETS / "icon-180.png").convert("RGBA").resize((px(76), px(76)), Image.LANCZOS)
    canvas.paste(icon, (px(TEXT_LEFT), px(64)), icon)
    boxes["icono"] = (TEXT_LEFT, 64, TEXT_LEFT + 76, 64 + 76)

    brand_font, _ = fit_font(draw, "Surtivox POS", BOLD_PATH, 40, TEXT_MAX_RIGHT - (TEXT_LEFT + 94))
    brand_x = TEXT_LEFT + 94
    brand_box = draw.textbbox((px(brand_x), px(64 + 38)), "Surtivox POS", font=brand_font, anchor="lm")
    draw.text((px(brand_x), px(64 + 38)), "Surtivox POS", font=brand_font, fill=DEEP, anchor="lm")
    boxes["marca"] = tuple(round(v / SCALE) for v in brand_box)

    title_font, title_size = fit_font(draw, "sin enredos.", BOLD_PATH, 96, TEXT_MAX_RIGHT - TEXT_LEFT)
    line_gap = round(title_size * 1.08)
    top = 190
    for index, (line, color) in enumerate((("Tu tienda,", INK), ("sin enredos.", ACCENT))):
        y = top + index * line_gap
        box = draw.textbbox((px(TEXT_LEFT), px(y)), line, font=title_font, anchor="la")
        draw.text((px(TEXT_LEFT), px(y)), line, font=title_font, fill=color, anchor="la")
        boxes[f"titular{index + 1}"] = tuple(round(v / SCALE) for v in box)

    sub_font, _ = fit_font(draw, "aunque se caiga el internet.", REGULAR_PATH, 31, SUBTITLE_WIDTH)
    sub_top = top + 2 * line_gap + 22
    for index, line in enumerate(wrap(draw, "Vende, fía y cuadra la caja aunque se caiga el internet.", sub_font, SUBTITLE_WIDTH)):
        y = sub_top + index * 42
        box = draw.textbbox((px(TEXT_LEFT), px(y)), line, font=sub_font, anchor="la")
        draw.text((px(TEXT_LEFT), px(y)), line, font=sub_font, fill=MUTED, anchor="la")
        boxes[f"subtitulo{index + 1}"] = tuple(round(v / SCALE) for v in box)

    pill_text = "POS offline para tiendas de barrio"
    pill_font, _ = fit_font(draw, pill_text, BOLD_PATH, 24, TEXT_MAX_RIGHT - TEXT_LEFT - 56)
    text_w = draw.textlength(pill_text, font=pill_font) / SCALE
    pill = (TEXT_LEFT, 524, round(TEXT_LEFT + text_w + 56), 524 + 54)
    draw.rounded_rectangle(tuple(px(v) for v in pill), radius=px(27), fill=DEEP)
    draw.text((px(pill[0] + 28), px(pill[1] + 27)), pill_text, font=pill_font, fill=(255, 255, 255), anchor="lm")
    boxes["etiqueta"] = pill

    final = canvas.resize((WIDTH, HEIGHT), Image.LANCZOS)
    return final, boxes


def overlaps(a, b):
    return not (a[2] <= b[0] or b[2] <= a[0] or a[3] <= b[1] or b[3] <= a[1])


def verify(boxes):
    errors = []
    for name, box in boxes.items():
        if box[0] < 0 or box[1] < 0 or box[2] > WIDTH or box[3] > HEIGHT:
            errors.append(f"{name} se sale del lienzo: {box}")
        if name != "telefono" and box[2] > TEXT_MAX_RIGHT:
            errors.append(f"{name} invade la zona del teléfono: {box}")
    names = [n for n in boxes if n != "telefono"]
    for i, first in enumerate(names):
        for second in names[i + 1:]:
            if overlaps(boxes[first], boxes[second]):
                errors.append(f"{first} y {second} se solapan")
    return errors


if __name__ == "__main__":
    image, boxes = build()
    problems = verify(boxes)
    for name, box in boxes.items():
        print(f"{name.ljust(11)} {box}")
    if problems:
        sys.exit("\n".join(problems))
    target = ASSETS / "og-image.png"
    image.save(target, optimize=True)
    print(f"og-image.png guardado: {image.size}, {target.stat().st_size / 1024:.0f} KB")
