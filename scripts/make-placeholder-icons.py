"""Draws the template's placeholder icons (build/icon.ico and build/icon-dev.ico).

Only used once to create the template. Replace the .ico files with your own icon
(see README, "Using this template"); you don't need to run this script.
"""
from PIL import Image, ImageDraw

SIZES = [16, 20, 24, 32, 40, 48, 64, 96, 128, 256]


def draw(color: str, size: int = 1024) -> Image.Image:
    image = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(image)
    m = size // 16
    d.rounded_rectangle([m, m, size - m, size - m], radius=size // 5, fill=color)
    # A simple white "window" shape.
    w0, w1 = size * 0.25, size * 0.75
    d.rounded_rectangle([w0, w0, w1, w1], radius=size // 20, outline="white", width=size // 20)
    d.line([w0, size * 0.38, w1, size * 0.38], fill="white", width=size // 20)
    return image


for name, color in [("icon", "#0F6CBD"), ("icon-dev", "#C4510F")]:
    draw(color).save(f"build/{name}.ico", sizes=[(s, s) for s in SIZES])
    print(f"wrote build/{name}.ico")
