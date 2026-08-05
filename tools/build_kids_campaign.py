from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageFilter
import qrcode
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "tenants" / "deli-fresas" / "campaigns" / "dia-del-nino"
PHOTO = OUT / "nina-fresas-crema.webp"
LOGO = ROOT / "tenants" / "deli-fresas" / "logo.webp"
URL = "https://delifresas.site/"

PINK = (255, 77, 128)
PINK_DARK = (219, 43, 98)
CREAM = (255, 248, 242)
BROWN = (93, 64, 55)
WHITE = (255, 255, 255)
YELLOW = (255, 213, 79)


def font(size: int, bold: bool = False):
    name = "arialbd.ttf" if bold else "arial.ttf"
    return ImageFont.truetype(str(Path("C:/Windows/Fonts") / name), size)


def contain(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    result = Image.new("RGBA", size, (0, 0, 0, 0))
    copy = image.copy()
    copy.thumbnail(size, Image.Resampling.LANCZOS)
    result.alpha_composite(copy, ((size[0] - copy.width) // 2, (size[1] - copy.height) // 2))
    return result


def cover(image: Image.Image, size: tuple[int, int], focus_y: float = 0.45) -> Image.Image:
    scale = max(size[0] / image.width, size[1] / image.height)
    resized = image.resize((round(image.width * scale), round(image.height * scale)), Image.Resampling.LANCZOS)
    left = max(0, (resized.width - size[0]) // 2)
    available_y = max(0, resized.height - size[1])
    top = round(available_y * focus_y)
    return resized.crop((left, top, left + size[0], top + size[1]))


def rounded_mask(size: tuple[int, int], radius: int) -> Image.Image:
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size[0] - 1, size[1] - 1), radius=radius, fill=255)
    return mask


def paste_rounded(canvas_image: Image.Image, image: Image.Image, box: tuple[int, int, int, int], radius: int, focus_y: float = 0.45):
    x1, y1, x2, y2 = box
    crop = cover(image, (x2 - x1, y2 - y1), focus_y)
    canvas_image.paste(crop, (x1, y1), rounded_mask(crop.size, radius))


def wrap(draw: ImageDraw.ImageDraw, text: str, font_obj, max_width: int):
    words = text.split()
    lines, current = [], ""
    for word in words:
        candidate = f"{current} {word}".strip()
        if draw.textbbox((0, 0), candidate, font=font_obj)[2] <= max_width:
            current = candidate
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def text_block(draw, xy, text, font_obj, fill, max_width, spacing=8):
    x, y = xy
    for line in wrap(draw, text, font_obj, max_width):
        draw.text((x, y), line, font=font_obj, fill=fill)
        y += draw.textbbox((x, y), line, font=font_obj)[3] - y + spacing
    return y


def brand_mark(base: Image.Image, xy: tuple[int, int], width: int):
    logo = Image.open(LOGO).convert("RGBA")
    mark = contain(logo, (width, width))
    base.alpha_composite(mark, xy)


def qr_image(size: int) -> Image.Image:
    code = qrcode.QRCode(version=None, error_correction=qrcode.constants.ERROR_CORRECT_H, box_size=12, border=4)
    code.add_data(URL)
    code.make(fit=True)
    return code.make_image(fill_color="black", back_color="white").convert("RGB").resize((size, size), Image.Resampling.NEAREST)


def draw_nfc(draw: ImageDraw.ImageDraw, center: tuple[int, int], scale: int, color):
    x, y = center
    for offset in (0, 13, 26):
        box = (x - scale - offset, y - scale - offset, x + scale + offset, y + scale + offset)
        draw.arc(box, 300, 60, fill=color, width=max(3, scale // 6))
    draw.ellipse((x - 5, y - 5, x + 5, y + 5), fill=color)


def campaign_4x5(photo: Image.Image):
    size = (1080, 1350)
    base = Image.new("RGBA", size, CREAM + (255,))
    paste_rounded(base, photo, (455, 70, 1040, 1280), 42, 0.32)
    draw = ImageDraw.Draw(base)
    draw.rounded_rectangle((42, 42, 410, 1308), radius=40, fill=(255, 255, 255, 235), outline=(255, 191, 210), width=3)
    brand_mark(base, (98, 78), 250)
    draw.rounded_rectangle((90, 365, 360, 425), radius=30, fill=PINK)
    draw.text((130, 381), "DÍA DEL NIÑO", font=font(26, True), fill=WHITE)
    y = text_block(draw, (88, 472), "Su día sabe mejor con fresas y crema", font(55, True), BROWN, 290, 10)
    y = text_block(draw, (90, y + 24), "Arma su vaso favorito y celebra esa sonrisa.", font(26), (117, 82, 82), 285, 7)
    qr = qr_image(228)
    base.paste(qr, (112, 970))
    draw.text((104, 1214), "ESCANEA Y ELIJAN JUNTOS", font=font(20, True), fill=PINK_DARK)
    base.convert("RGB").save(OUT / "visual-dia-del-nino-4x5.png", quality=95)


def campaign_story(photo: Image.Image):
    size = (1080, 1920)
    base = cover(photo, size, 0.28).convert("RGBA")
    overlay = Image.new("RGBA", size, (0, 0, 0, 0))
    pixels = overlay.load()
    for y in range(size[1]):
        alpha = int(max(0, min(238, (y - 760) / 760 * 245)))
        for x in range(size[0]):
            pixels[x, y] = (255, 241, 245, alpha)
    base = Image.alpha_composite(base, overlay)
    draw = ImageDraw.Draw(base)
    brand_mark(base, (60, 60), 190)
    draw.rounded_rectangle((58, 1190, 430, 1260), radius=35, fill=PINK)
    draw.text((104, 1209), "DÍA DEL NIÑO", font=font(30, True), fill=WHITE)
    y = text_block(draw, (60, 1305), "Una cucharada, una sonrisa", font(66, True), BROWN, 700, 10)
    draw.text((65, y + 16), "Acerca tu celular o escanea para armar su favorito.", font=font(29), fill=(110, 74, 76))
    qr = qr_image(260)
    base.paste(qr, (760, 1580))
    draw_nfc(draw, (660, 1702), 24, PINK_DARK)
    draw.text((512, 1790), "NFC + QR", font=font(28, True), fill=PINK_DARK)
    base.convert("RGB").save(OUT / "historia-dia-del-nino-9x16.png", quality=95)


def poster_a5(photo: Image.Image):
    size = (1240, 1748)
    base = Image.new("RGBA", size, CREAM + (255,))
    paste_rounded(base, photo, (55, 55, 1185, 1040), 54, 0.20)
    draw = ImageDraw.Draw(base)
    draw.rounded_rectangle((82, 86, 450, 158), radius=36, fill=PINK)
    draw.text((130, 105), "DÍA DEL NIÑO", font=font(31, True), fill=WHITE)
    draw.rounded_rectangle((55, 940, 1185, 1693), radius=54, fill=(255, 255, 255, 248))
    y = text_block(draw, (95, 1000), "Una cucharada, una sonrisa", font(72, True), BROWN, 760, 12)
    y = text_block(draw, (98, y + 18), "Fresas frescas, crema suave y sus toppings favoritos.", font(34), (112, 75, 78), 700, 10)
    qr = qr_image(320)
    base.paste(qr, (815, 1130))
    draw_nfc(draw, (720, 1300), 28, PINK_DARK)
    draw.text((100, 1490), "ACERCA O ESCANEA", font=font(34, True), fill=PINK_DARK)
    draw.text((100, 1550), "delifresas.site", font=font(30), fill=BROWN)
    base.convert("RGB").save(OUT / "afiche-a5-dia-del-nino.png", quality=95)


def nfc_cards(photo: Image.Image):
    px = (1004, 638)
    front = Image.new("RGBA", px, PINK + (255,))
    paste_rounded(front, photo, (560, 0, 1004, 638), 26, 0.26)
    shade = Image.new("RGBA", px, (0, 0, 0, 0))
    sd = ImageDraw.Draw(shade)
    sd.rectangle((470, 0, 760, 638), fill=(255, 77, 128, 130))
    shade = shade.filter(ImageFilter.GaussianBlur(35))
    front = Image.alpha_composite(front, shade)
    draw = ImageDraw.Draw(front)
    brand_mark(front, (48, 40), 160)
    draw.rounded_rectangle((54, 245, 410, 302), radius=28, fill=WHITE)
    draw.text((90, 260), "DÍA DEL NIÑO", font=font(25, True), fill=PINK_DARK)
    text_block(draw, (55, 335), "Una cucharada, una sonrisa", font(44, True), WHITE, 470, 7)
    draw_nfc(draw, (490, 545), 22, WHITE)
    draw.text((55, 536), "ACERCA TU CELULAR", font=font(28, True), fill=WHITE)
    front.convert("RGB").save(OUT / "tarjeta-nfc-dia-del-nino-frente.png", quality=95)

    back = Image.new("RGB", px, CREAM)
    draw = ImageDraw.Draw(back)
    qr = qr_image(390)
    back.paste(qr, (48, 122))
    draw.rounded_rectangle((474, 62, 955, 576), radius=42, fill=WHITE, outline=(255, 190, 209), width=4)
    draw.text((520, 120), "ESCANEA Y ARMA", font=font(28, True), fill=PINK_DARK)
    y = text_block(draw, (520, 176), "Su vaso favorito", font(46, True), BROWN, 380, 8)
    y = text_block(draw, (522, y + 18), "Fresas, crema y toppings elegidos juntos.", font(31), (112, 75, 78), 370, 7)
    draw_nfc(draw, (565, 470), 20, PINK_DARK)
    draw.text((620, 442), "También puedes acercar\ntu celular", font=font(27, True), fill=PINK_DARK, spacing=5)
    draw.text((52, 550), URL, font=font(25, True), fill=BROWN)
    back.save(OUT / "tarjeta-nfc-dia-del-nino-reverso.png", quality=95)

    pdf_path = OUT / "tarjetas-nfc-dia-del-nino-a4.pdf"
    doc = canvas.Canvas(str(pdf_path), pagesize=A4)
    positions = [(10 + col * 93, 297 - 10 - 54 - row * 62) for row in range(4) for col in range(2)]
    for image_path in (OUT / "tarjeta-nfc-dia-del-nino-frente.png", OUT / "tarjeta-nfc-dia-del-nino-reverso.png"):
        for x, y in positions:
            doc.drawImage(str(image_path), x * mm, y * mm, width=85 * mm, height=54 * mm, mask="auto")
            doc.setStrokeColorRGB(0.10, 0.10, 0.10)
            doc.setLineWidth(0.30)
            doc.roundRect(x * mm, y * mm, 85 * mm, 54 * mm, 3 * mm, stroke=1, fill=0)
        doc.showPage()
    doc.save()


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    photo = Image.open(PHOTO).convert("RGB")
    campaign_4x5(photo)
    campaign_story(photo)
    poster_a5(photo)
    nfc_cards(photo)
    print("Campana Dia del Nino generada en", OUT)


if __name__ == "__main__":
    main()
