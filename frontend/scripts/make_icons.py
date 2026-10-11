"""Generates the PWA app icons (192, 512 and maskable 512) as real PNG files.

Run:  python make_icons.py
"""
import os
import struct
import zlib

OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "icons")

BG = (40, 116, 240)      # Flipkart blue
FG = (255, 255, 255)


def make_png(size: int, maskable: bool = False) -> bytes:
    cx = cy = size / 2
    # bag body + handle + a basket line, drawn with simple rasterised shapes
    bag_w, bag_h = size * 0.52, size * 0.46
    bag_x, bag_y = cx - bag_w / 2, cy - bag_h / 2 + size * 0.06
    handle_r = bag_w * 0.30
    handle_cy = bag_y
    handle_w = max(2, size // 42)

    rows = []
    for y in range(size):
        row = bytearray([0])  # filter type 0
        for x in range(size):
            px, py = x + 0.5, y + 0.5
            inside = False

            if not maskable:
                # handle: half ring above the bag
                if ((px - cx) ** 2 + (py - handle_cy) ** 2) ** 0.5 < handle_r:
                    inside = abs((px - cx) ** 2 + (py - handle_cy) ** 2 - handle_r ** 2) ** 0.5 < handle_w

            # bag body with rounded corners
            if not inside and bag_x <= px <= bag_x + bag_w and bag_y <= py <= bag_y + bag_h:
                r = size * 0.06
                cxr = min(max(px, bag_x + r), bag_x + bag_w - r)
                cyr = min(max(py, bag_y + r), bag_y + bag_h - r)
                inside = (px - cxr) ** 2 + (py - cyr) ** 2 <= r * r

            # handle inner hole
            if inside and ((px - cx) ** 2 + (py - handle_cy) ** 2) ** 0.5 < handle_r - handle_w:
                inside = False

            row += bytes(FG if inside else BG)
        rows.append(bytes(row))

    raw = b"".join(rows)

    def chunk(tag: bytes, data: bytes) -> bytes:
        return (struct.pack(">I", len(data)) + tag + data
                + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF))

    ihdr = struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0)  # 8-bit RGB
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr)
            + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b""))


def main() -> None:
    os.makedirs(OUT_DIR, exist_ok=True)
    for name, size, maskable in [
        ("icon-192.png", 192, False),
        ("icon-512.png", 512, False),
        ("icon-maskable-512.png", 512, True),
        ("apple-touch-icon.png", 180, False),
        ("favicon-32.png", 32, False),
    ]:
        path = os.path.join(OUT_DIR, name)
        with open(path, "wb") as fh:
            fh.write(make_png(size, maskable))
        print(f"  wrote {name} ({size}x{size})")


if __name__ == "__main__":
    main()