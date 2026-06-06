#!/usr/bin/env python3
"""Generate the beanie product-image set from the single real photo in images/.

The only real beanie photo we have is the 800x800 "Convex" trio (brown/pink/grey
beanies). To give every listing a distinct real-photo beanie we:
  - crop the three individual beanies out of the trio, and
  - colorize the neutral grey beanie into more colours.
Run:  python3 frontend/scripts/gen-beanie-images.py
"""
from PIL import Image, ImageOps
import os

ROOT = "/Users/soongshaozhi/GitHub/axiomap"
SRC = f"{ROOT}/images/sg-11134201-822x3-moazms2fmkgc27@resize_w900_nl.webp"
OUT = f"{ROOT}/frontend/public/assets/beanies"
os.makedirs(OUT, exist_ok=True)

img = Image.open(SRC).convert("RGB")  # 800 x 800


def save(im, name, size=600):
    im.resize((size, size), Image.LANCZOS).save(os.path.join(OUT, name), "JPEG", quality=88)


# full trio + the three single beanies (approx regions in the 800x800 photo)
save(img, "trio.jpg")
brown = img.crop((18, 40, 446, 468))
pink = img.crop((386, 22, 792, 430))
grey = img.crop((232, 362, 660, 792))
save(brown, "brown.jpg")
save(pink, "pink.jpg")
save(grey, "grey.jpg")

# colorized knit beanies derived from the neutral grey one
g = grey.convert("L")


def colorize(name, dark, light):
    save(ImageOps.colorize(g, black=dark, white=light), name)


colorize("black.jpg", (12, 12, 14), (96, 96, 102))
colorize("navy.jpg", (8, 12, 30), (48, 64, 120))
colorize("burgundy.jpg", (28, 8, 16), (132, 46, 62))
colorize("forest.jpg", (8, 22, 14), (46, 92, 64))
colorize("camel.jpg", (60, 42, 20), (198, 152, 98))
colorize("cream.jpg", (120, 110, 88), (244, 238, 218))

print("generated:", sorted(os.listdir(OUT)))
