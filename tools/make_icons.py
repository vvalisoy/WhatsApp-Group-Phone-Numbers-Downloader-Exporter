"""Generates icons/icon{16,48,128}.png (stdlib only): green rounded square
with a white contact list (three rows of dot + line). The 128px icon has the
16px transparent padding the Chrome Web Store asks for (96px artwork)."""
import struct, zlib, os

GREEN = (31, 168, 85)
WHITE = (255, 255, 255)
SS = 4  # supersampling for anti-aliasing


def inside(x, y):
    """Shape in unit coordinates (0..1). Returns colour or None."""
    r = 0.22
    cx, cy = min(max(x, r), 1 - r), min(max(y, r), 1 - r)
    if (x - cx) ** 2 + (y - cy) ** 2 > r * r:
        return None
    for row in (0.30, 0.50, 0.70):
        if (x - 0.28) ** 2 + (y - row) ** 2 <= 0.065 ** 2:
            return WHITE
        if 0.42 <= x <= 0.76 and abs(y - row) <= 0.035:
            return WHITE
    return GREEN


def png(size, path, pad=0):
    rows = []
    for py in range(size):
        row = bytearray([0])
        for px in range(size):
            acc = [0, 0, 0, 0]
            for sy in range(SS):
                for sx in range(SS):
                    inner = size - 2 * pad
                    c = inside((px - pad + (sx + .5) / SS) / inner, (py - pad + (sy + .5) / SS) / inner)
                    if c:
                        acc[0] += c[0]; acc[1] += c[1]; acc[2] += c[2]; acc[3] += 255
            n = SS * SS
            a = acc[3] / n
            if a:
                cov = acc[3] / 255
                row += bytes([round(acc[0] / cov), round(acc[1] / cov), round(acc[2] / cov), round(a)])
            else:
                row += bytes(4)
        rows.append(bytes(row))
    raw = zlib.compress(b"".join(rows), 9)

    def chunk(t, d):
        return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xffffffff)

    data = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)) \
        + chunk(b"IDAT", raw) + chunk(b"IEND", b"")
    with open(path, "wb") as f:
        f.write(data)


root = os.path.join(os.path.dirname(__file__), "..", "icons")
for s, pad in ((16, 0), (48, 0), (128, 16)):
    png(s, os.path.join(root, f"icon{s}.png"), pad)
print("ok")
