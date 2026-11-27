"""Boomerang Tracker item icons (own drawings, no game art). Generates 32x32 two-tone SVGs.
Run: python scripts/icons/make_icons.py  -> src/renderer/assets/items/*.svg + index.json + local/icons/sheet.html
"""
import json, os, math

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT_DIR = os.path.join(ROOT, 'src', 'renderer', 'assets', 'items')
SHEET = os.path.join(ROOT, 'local', 'icons', 'sheet.html')
O = '#0b0c10'      # outline
SW = 1.3           # outline width

# palette: (main, shade)
GOLD = ('#f4c64f', '#c38b1f'); SILVER = ('#d5dbe4', '#8c96a6'); WOOD = ('#b98149', '#7d522a')
LEATHER = ('#a06c3d', '#6e4523'); STEEL = ('#9aa3b2', '#5e6675'); BONE = ('#efe6cf', '#b9ad8c')
RED = ('#e8434f', '#a52633'); GREEN = ('#4cbf5c', '#2b8239'); BLUE = ('#3f86ea', '#2256ad')
PURPLE = ('#9a63e0', '#61389e'); ORANGE = ('#f2933b', '#b45d17'); YELLOW = ('#f6e06a', '#c3a52d')
PINK = ('#f28ab8', '#b8548a'); TEAL = ('#38c9c0', '#1f8a85'); WHITE = ('#f4f6fa', '#b8c0cc')


def p(d, fill, stroke=O, sw=SW, extra=''):
    s = f' stroke="{stroke}" stroke-width="{sw}"' if stroke else ''
    return f'<path d="{d}" fill="{fill}"{s} stroke-linejoin="round" stroke-linecap="round"{extra}/>'

def c(cx, cy, r, fill, stroke=O, sw=SW, extra=''):
    s = f' stroke="{stroke}" stroke-width="{sw}"' if stroke else ''
    return f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{fill}"{s}{extra}/>'

def e(cx, cy, rx, ry, fill, stroke=O, sw=SW, extra=''):
    s = f' stroke="{stroke}" stroke-width="{sw}"' if stroke else ''
    return f'<ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" fill="{fill}"{s}{extra}/>'

def ln(d, color=O, w=SW):
    return f'<path d="{d}" fill="none" stroke="{color}" stroke-width="{w}" stroke-linecap="round" stroke-linejoin="round"/>'

def shine(cx, cy, rx=2.2, ry=1.3, rot=-30):
    return f'<ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" fill="#fff" opacity=".55" transform="rotate({rot} {cx} {cy})"/>'

def g(body, t=''):
    return f'<g transform="{t}">{body}</g>' if t else body

def pips(n, col='#fff'):
    """Small 'tier' badge bottom-right: n dots."""
    w = 3 + n * 3.2
    x0 = 30 - w
    s = f'<rect x="{x0}" y="24.4" width="{w}" height="5.2" rx="2.6" fill="{O}"/>'
    for i in range(n):
        s += c(x0 + 3.1 + i * 3.2, 27, 1.05, col, stroke=None)
    return s

# ---------- shapes ----------
def medallion(pal, emblem):
    m, sh = pal
    em = {
        'leaf': ''.join(g(p('M16 9.2c2.6 1.7 2.7 4.4 0 6.4c-2.7-2-2.6-4.7 0-6.4z', '#fff', stroke=None), f'rotate({a} 16 16)') for a in (0, 120, 240)),
        'flame': p('M16 8.6c3.6 3.4 4.9 6.3 3.2 9.2c-1.2 2.2-5.2 2.2-6.4 0c-1.4-2.6-.2-4.6 1.2-6.2c.5 1.5 1.2 2 1.9 2.1c.2-1.7.2-3.2.1-5.1z', '#fff', stroke=None),
        'drop': p('M16 8.4c2.9 3.6 4.8 6.2 4.8 8.6a4.8 4.8 0 0 1-9.6 0c0-2.4 1.9-5 4.8-8.6z', '#fff', stroke=None),
        'moon': p('M18.4 8.4a7.8 7.8 0 1 0 4.2 13.8a6.2 6.2 0 0 1-4.2-13.8z', '#fff', stroke=None),
        'star4': p('M16 8.4l1.9 5.7l5.7 1.9l-5.7 1.9L16 23.6l-1.9-5.7L8.4 16l5.7-1.9z', '#fff', stroke=None),
        'star6': ''.join(g(p('M16 8.2l1.6 4.6h-3.2z', '#fff', stroke=None), f'rotate({a} 16 16)') for a in range(0, 360, 60)) + c(16, 16, 3.2, '#fff', stroke=None),
    }[emblem]
    return (c(16, 16, 12.6, sh) + c(16, 16, 10.6, m, stroke=None) + c(16, 16, 8.4, sh, stroke=None, extra=' opacity=".55"')
            + f'<g opacity=".95">{em}</g>' + shine(11.4, 9.6, 2.6, 1.4))

def stone(kind):
    if kind == 'emerald':
        return (p('M16 3.5C24.5 9.5 24.5 22.5 16 28.5C7.5 22.5 7.5 9.5 16 3.5z', GOLD[0]) +
                p('M16 7.5c5 4.2 5 12.8 0 17c-5-4.2-5-12.8 0-17z', '#36c77a', sw=1) +
                p('M16 7.5v17', 'none', stroke='#1d8a4f', sw=1) + shine(13.8, 11.5, 1.4, 2.4, 10))
    if kind == 'ruby':
        return (c(16, 16, 12, GOLD[0]) + c(16, 16, 12, 'none', stroke=GOLD[1], sw=1, extra=' stroke-dasharray="2 2.2" opacity=".8"') +
                p('M16 8.5l6.5 4v7L16 23.5l-6.5-4v-7z', '#e2384d', sw=1) +
                p('M9.5 12.5L16 16l6.5-3.5M16 16v7.5', 'none', stroke='#9e1f30', sw=.9) + shine(13, 11.3, 1.6, 1))
    # sapphire
    return (p('M16 3.5c6 6 9.5 11 9.5 15.5a9.5 9.5 0 0 1-19 0C6.5 14.5 10 9.5 16 3.5z', GOLD[0]) +
            p('M16 8.5c3.8 3.9 5.8 7.1 5.8 10a5.8 5.8 0 0 1-11.6 0c0-2.9 2-6.1 5.8-10z', '#3a7be0', sw=1) +
            shine(13.4, 15.5, 1.3, 2.2, 15))

def note(col):
    m, sh = col
    return (ln('M18.2 22V6.5c2.6 1.2 5.6 2.3 6.8 5.2c-1.6-1.3-3.6-1.7-5-1.6', O, 4.2) +
            ln('M18.2 22V6.5c2.6 1.2 5.6 2.3 6.8 5.2c-1.6-1.3-3.6-1.7-5-1.6', m, 2) +
            e(13.6, 22.4, 5.2, 3.9, m, extra=' transform="rotate(-22 13.6 22.4)"') +
            shine(11.8, 21, 1.6, .9))

HEART = 'M16 27.5C6.5 21 3.2 15.8 3.2 11a6.2 6.2 0 0 1 12.8-2.6a6.2 6.2 0 0 1 12.8 2.6C28.8 15.8 25.5 21 16 27.5z'
def heart():
    return p(HEART, RED[0]) + p('M16 27.5C22 23.4 26 19.2 27.6 15c-3.6 4.5-7 7.2-11.6 9.6z', RED[1], stroke=None) + shine(9.5, 10.2, 2.6, 1.6)

def heart_piece():
    clip = '<clipPath id="hp-q"><rect x="0" y="0" width="16" height="16.6"/></clipPath>'
    return (f'<defs>{clip}</defs>' + p(HEART, '#3b2227', stroke='#6b3a42', sw=1.1, extra=' stroke-dasharray="2.2 1.6"') +
            f'<g clip-path="url(#hp-q)">{p(HEART, RED[0])}{shine(9.5, 10.2, 2.6, 1.6)}</g>' +
            ln('M16 8.4V16.6H3.6', O, SW))

def token():
    legs = ''.join(ln(f'M16 16 L{16 + 8.6 * math.cos(math.radians(a)):.1f} {16 + 8.6 * math.sin(math.radians(a)):.1f}', '#6b4a10', 1.6) for a in (-150, -120, -60, -30, 30, 60, 120, 150))
    return (c(16, 16, 12.8, GOLD[1]) + c(16, 16, 11, GOLD[0], stroke=None) + legs +
            e(16, 17.5, 3.6, 4.6, '#6b4a10', stroke=None) + c(16, 12, 2.8, '#6b4a10', stroke=None) +
            c(15, 11.6, .8, '#ffd76a', stroke=None) + c(17, 11.6, .8, '#ffd76a', stroke=None) + shine(10.5, 9, 2.6, 1.3))

def sword(blade_len='mid', guard=('#3a64d1', '#22408f'), grip='#5a3fa0', wide=False, broken=False, guard_style='wing'):
    top = {'short': 7, 'mid': 3.5, 'long': 2}[blade_len]
    w = 3 if wide else 2.2
    if broken:
        blade = f'M{16-w} 19.5V12.2l1.1-1.4l.9 1.2l1-1.6l1.1 1.3V19.5z'
    else:
        blade = f'M{16-w} 19.5V{top+2.2}L16 {top}l{w} 2.2V19.5z'
    gs = (p('M8.6 19.2c2.4.2 5.2.1 7.4-.8c2.2.9 5 1 7.4.8l-.7 2.9H9.3z', guard[0]) if guard_style == 'wing'
          else p('M9.8 19.2h12.4v3h-12.4z', guard[0]))
    body = (p(blade, '#e8edf4') + (ln(f'M16 {top+2.5}V18.6', '#a9b3c2', .9) if not broken else '') + gs +
            p('M14.5 21.9h3v5.2h-3z', grip) + c(16, 28.4, 2, guard[0]))
    return g(body, 'translate(16 16) scale(1.16) rotate(40) translate(-16 -16)')

def shield(kind):
    if kind == 'deku':
        return (c(16, 16, 12.4, WOOD[1]) + c(16, 16, 10.4, WOOD[0], stroke=None) +
                ln('M7 13.5h18M6.6 18.5h18.8', WOOD[1], 1.1) + c(16, 16, 3.6, RED[0], sw=1) + shine(10.5, 9.4, 2.4, 1.2))
    kite = 'M16 3.2L27 7.2v8.2c0 6.8-4.7 11-11 13.8C9.7 26.4 5 22.2 5 15.4V7.2z'
    if kind == 'hylian':
        return (p(kite, SILVER[0]) + p('M16 6.2l8.2 3v6.3c0 5.2-3.6 8.5-8.2 10.6c-4.6-2.1-8.2-5.4-8.2-10.6V9.2z', '#3456c2', stroke=None) +
                p('M16 11l4.8 3.3L16 21.5l-4.8-7.2z', RED[0], sw=1) + shine(11, 9.2, 2, 1))
    return (p(kite, RED[0]) + p('M16 6.4l8 3v6c0 5-3.5 8.3-8 10.4c-4.5-2.1-8-5.4-8-10.4v-6z', SILVER[0], stroke=None) +
            ln('M11 10.5l4 3.5M12.5 15l6 5', '#ffffff', 1.2) + p('M16 9.5l3 3l-3 3l-3-3z', '#e8c24a', sw=.9))

def tunic(pal):
    m, sh = pal
    return (p('M10.5 5l-6.3 4.2l3.1 5.3l2.8-1.8V27h11.8V12.7l2.8 1.8l3.1-5.3L21.5 5c-1.1 2-3 3.1-5.5 3.1S11.6 7 10.5 5z', m) +
            p('M10.1 12.7V27h3V14z', sh, stroke=None) + p('M10.1 17.6h11.8v2.6H10.1z', LEATHER[0], sw=1) +
            p('M15 17.6h2v2.6h-2z', GOLD[0], stroke=None))

def boots(kind):
    pal = STEEL if kind == 'iron' else GOLD
    s = p('M10 4h9v14.6c3.5 1 7.4 2.2 8.4 5.3V27H8.5V18.4z', pal[0]) + p('M8.5 23.6h18.9V27H8.5z', pal[1], sw=1)
    if kind == 'iron':
        s += c(12.5, 8, .9, pal[1], stroke=None) + c(16.5, 8, .9, pal[1], stroke=None) + c(12.5, 13, .9, pal[1], stroke=None) + c(16.5, 13, .9, pal[1], stroke=None)
    else:
        s += p('M18.5 9.5c3-2.6 6.6-3.6 9.5-3c-1.6 1.3-2.6 2.4-3.1 3.8c1.2-.3 2.3-.2 3.2.2c-2.4 1.6-5.6 2.6-9.6 2.6z', '#ffffff', sw=1)
    return s + shine(12.6, 6.6, 1.6, 1)

def glove(pal, studs=None):
    m, sh = pal
    s = (p('M9 15c0-3 1.6-5 4-5.4V6.6a1.9 1.9 0 0 1 3.8 0V9.4h.6V7.2a1.9 1.9 0 0 1 3.8 0v2.6a1.9 1.9 0 0 1 3.6.8V17c0 6-3 9.8-8.2 9.8C11 26.8 9 22.6 9 18z', m) +
         p('M8.6 19.8h16.2v4.2H8.6z', sh, sw=1.1))
    return s + shine(13, 12, 1.4, 1)

def bracelet():
    return (e(16, 17, 11.5, 7.2, LEATHER[1]) + e(16, 17, 8, 4.4, '#1b1d24', stroke=O) +
            ''.join(c(x, y, 1.6, RED[0], sw=.9) for x, y in ((6.2, 15.4), (11, 22.4), (21, 22.4), (25.8, 15.4))) + shine(9, 12.8, 2, 1))

def scale(pal):
    m, sh = pal
    return (p('M16 3.6c7.4 4.2 10.4 10.2 10.4 15.2a10.4 10.4 0 0 1-20.8 0C5.6 13.8 8.6 7.8 16 3.6z', m) +
            ln('M8.6 15.6c2.4 2 4.8 2.8 7.4 2.8s5-.8 7.4-2.8M7.4 21c2.8 2.4 5.6 3.4 8.6 3.4s5.8-1 8.6-3.4', sh, 1.2) + shine(12.4, 10, 1.8, 1.2))

def pouch(pal, front='', tier=0):
    m, sh = pal
    s = (p('M9.5 11h13l3 14a3 3 0 0 1-3 3.5H9.5a3 3 0 0 1-3-3.5z', m) + p('M7.4 21.5c3 3.4 14.2 3.4 17.2 0l1 3.5a3 3 0 0 1-3 3.5H9.5a3 3 0 0 1-3-3.5z', sh, stroke=None) +
         p('M10.5 11c-.8-2.6.5-5.2 2.6-6l1.6 2.2h2.6l1.6-2.2c2.1.8 3.4 3.4 2.6 6z', sh) + ln('M9.8 11h12.4', O, 1.6))
    return s + front + (pips(tier) if tier else '')

def rupee(cx, cy, col='#43c463', s=1.0):
    return p(f'M{cx} {cy-4.2*s}l{3*s} {2.2*s}v{4*s}l{-3*s} {2.2*s}l{-3*s} {-2.2*s}v{-4*s}z', col, sw=1)

def bomb(cx=15, cy=18.5, r=8.6):
    return (c(cx, cy, r, '#2f3f73') + p(f'M{cx-2.2} {cy-r-.2}h4.4v-3.2h-4.4z', STEEL[0], sw=1) +
            ln(f'M{cx} {cy-r-3.3}c.4-2.6 2.4-4 4.8-3.6', '#c9b18a', 1.4) +
            p(f'M{cx+5.4} {cy-r-7.6}l.9 1.8l1.9.4l-1.5 1.3l.4 1.9l-1.7-1l-1.7 1l.4-1.9l-1.5-1.3l1.9-.4z', '#ffcf4a', sw=.8) +
            shine(cx - 3.4, cy - 3.6, 2.6, 1.5))

def bombchu():
    return (p('M5 21.5c0-6 4.6-10.5 11-10.5c5.4 0 9 2.6 11 6.4l-2.8 1.3l2.8 1.4c-1.4 3.4-4.6 5.4-9 5.4H7.4A2.4 2.4 0 0 1 5 21.5z', '#c9584a') +
            c(10, 25.4, 2.4, '#2a2d36') + c(21, 25.4, 2.4, '#2a2d36') + c(21.5, 15.6, 1.3, '#fff', sw=.8) +
            ln('M5.4 19.2c-2.2-.4-3.4-2-3-4.2', '#c9b18a', 1.3) + p('M2.2 13l.7 1.5l1.6.2l-1.2 1.1l.3 1.6l-1.4-.8l-1.4.8l.3-1.6L0 14.7l1.6-.2z', '#ffcf4a', sw=.7) +
            shine(12.5, 14.5, 2.4, 1.2))

def boomerang():
    return (p('M5 6.5c7.5-.6 14.2 2.5 19.8 9.8c2.6 3.4 3.4 7 3 10.6c-2.2.3-3.8-.8-4.6-2.8C21 17.4 15.8 12.6 7.6 11.6C5.6 11.3 4.8 9.2 5 6.5z', '#3e7fe0') +
            p('M5 6.5c2.6-.2 4.4 0 5.6.4l-.8 4.8c-.7-.1-1.4-.1-2.2-.1C5.6 11.3 4.8 9.2 5 6.5z', RED[0], sw=1) +
            p('M27.8 26.9c-2.2.3-3.8-.8-4.6-2.8l4.4-1.9c.3 1.5.3 3.1.2 4.7z', RED[0], sw=1) + shine(14, 9.6, 2.6, 1.1, 20))

def slingshot():
    return (ln('M16 28V17.5M16 17.5L9.5 6.5M16 17.5L22.5 6.5', O, 5) + ln('M16 28V17.5M16 17.5L9.5 6.5M16 17.5L22.5 6.5', WOOD[0], 3) +
            ln('M9.5 6.5c2 4.6 11 4.6 13 0', '#d9cdb1', 1.2) + c(16, 10.6, 1.8, LEATHER[1], sw=1))

def bow():
    return (ln('M9 4.5c11 3.5 15 11.5 13.5 23', O, 4.6) + ln('M9 4.5c11 3.5 15 11.5 13.5 23', WOOD[0], 2.6) +
            ln('M9 4.5L22.5 27.5', '#e6e0d2', 1) + p('M16 14.6l2.6-1.2l.6 2.8l-2.6 1.2z', LEATHER[1], sw=.8))

def arrow(head, glow=None):
    s = ln('M7 25L24 8', O, 3.4) + ln('M7 25L24 8', '#c9a46a', 1.8)
    s += p('M20.6 6.6l6.8-2l-2 6.8z', head[0])
    s += p('M5.4 21.4l2.2 3.2l3.2 2.2l-1.6 1.2l-3-1.6l-1.8-3.2z', '#f2f2f2', sw=1)
    if glow:
        s = f'<circle cx="24" cy="8" r="6.4" fill="{glow}" opacity=".35"/>' + s
    return s

def fire_flame(cx, cy, s=1.0):
    return p(f'M{cx} {cy-6*s}c{3*s} {2.8*s} {4.2*s} {5.2*s} {2.8*s} {7.6*s}c{-1*s} {1.8*s} {-4.6*s} {1.8*s} {-5.6*s} 0c{-1.2*s} {-2*s} 0 {-3.8*s} {1*s} {-5*s}c{.4*s} {1.2*s} {1*s} {1.6*s} {1.6*s} {1.6*s}c0 {-1.4*s} 0 {-2.6*s} {.2*s} {-4.2*s}z', '#ff9b38', sw=1)

def hookshot(long=False):
    top = 4 if long else 8
    s = (p(f'M13.8 {top+5}h4.4v12.5h-4.4z', '#9aa3b2') + (ln(f'M16 {top+6}V{top+16}', '#5e6675', .9) if long else '') +
         p(f'M12 {top+5}l4-{2.8}l4 2.8l-1.2 1.2l-2.8-1.6l-2.8 1.6z', '#e8edf4', sw=1) +
         p(f'M16 {top-1.6}l2.6 4.2h-5.2z', '#e8edf4', sw=1) +
         p('M12.5 23.5h7v4.2h-7z', '#d0a542') + p('M12.5 26h-3l-.6 2.8h3.6z', LEATHER[1], sw=1))
    return g(s, 'translate(16 16) scale(1.2) rotate(35) translate(-16 -16)')

def hammer():
    return g(p('M15 12h2.6v16h-2.6z', WOOD[0]) + p('M7 5.5h18v8H7z', '#8c95a5') + p('M7 5.5h4v8H7zM21 5.5h4v8h-4z', GOLD[0], sw=1) +
             ln('M9 8.5v2.6M23 8.5v2.6', GOLD[1], 1) + shine(13, 7.6, 2.4, .9, 0), 'rotate(-35 16 16)')

def lens():
    return (ln('M21.5 21.5l6 6', O, 4.4) + ln('M21.5 21.5l6 6', PURPLE[1], 2.4) + c(14.5, 14.5, 9.6, PURPLE[0]) +
            c(14.5, 14.5, 7, '#bfe3ff', sw=1) + e(14.5, 14.8, 3.6, 2.2, '#fff', stroke=PURPLE[1], sw=1) + c(14.5, 14.8, 1.3, PURPLE[1], stroke=None) +
            shine(11.6, 11, 1.8, 1))

def ocarina(pal, accent):
    m, sh = pal
    return (p('M5 15.6c0-4.6 4.4-8 10.4-8c6 0 11.6 3.6 11.6 8.4c0 4.4-4.8 7.8-11.2 7.8C9.6 23.8 5 20.4 5 15.6z', m) +
            p('M25.6 12.4l3.4-2.6l1.4 2.2l-3.4 2.4z', sh, sw=1) + p('M6 18.6c3 3.6 13 4.4 19.6.4c-2.4 3.4-6.4 4.8-10.4 4.8C10.6 23.8 7.4 21.8 6 18.6z', sh, stroke=None) +
            ''.join(c(x, y, 1.05, O, stroke=None) for x, y in ((11, 14.4), (15, 13.6), (19, 14.4), (13, 18.2), (17, 18.4))) +
            (accent or '') + shine(10.2, 11, 2.2, 1.1))

def spell(pal, inner):
    m, sh = pal
    return (p('M16 2.8L25.4 16L16 29.2L6.6 16z', m) + p('M16 2.8L25.4 16H6.6z', sh, stroke=None, extra=' opacity=".0"') +
            p('M16 29.2L25.4 16H16z', sh, stroke=None) + p('M16 2.8L25.4 16L16 29.2L6.6 16z', 'none') + inner +
            shine(12.6, 11.6, 1.6, 1, -55))

def magic_jar(tier):
    return (p('M11 8.5h10v3l3.2 3.6v10a3 3 0 0 1-3 3H10.8a3 3 0 0 1-3-3v-10L11 11.5z', '#3fbf6a') + p('M11.6 4.5h8.8v4h-8.8z', LEATHER[0], sw=1) +
            p('M7.8 20.5h16.4v4.6a3 3 0 0 1-3 3H10.8a3 3 0 0 1-3-3z', '#2a8a4b', stroke=None) + shine(11.6, 15, 1.4, 2.4, 0) + pips(tier))

def bean():
    return (p('M8.6 21.4C4.8 17 7.6 9 14 7.6c6.2-1.4 11.2 2.8 10.2 8c-.8 4-4.6 4.4-7.2 6.6c-2.4 2-4.4 4.2-8.4-.8z', '#b9553d') +
            p('M9.8 21.8c2.6 2.6 4.4 1 6.6-.8c2.6-2.2 6.4-2.6 7.6-6.4c-.6 4.2-4.2 4.8-6.8 7c-2.4 2-4.4 4.2-7.4.2z', '#7f3224', stroke=None) +
            shine(12.2, 11.6, 2.4, 1.3))

def sticks():
    return (g(p('M14 3.2h4v25.6h-4z', WOOD[0]) + ln('M16 5.6v21', WOOD[1], 1) + ln('M14.4 12h3.2M14.4 20h3.2', WOOD[1], .9) +
              p('M18 8.4c4-1.8 7-.6 8.2 1.8c-3.4.7-6 .4-8.2-1.8z', GREEN[0], sw=1), 'rotate(35 16 16)'))

def nut():
    return (c(16, 17, 10.2, '#a86f3e') + p('M7.2 21.6c3.6 4.6 13.4 5 17.6-.4c-1.4 4.4-5 7-8.8 7c-4.2 0-7.6-2.6-8.8-6.6z', '#74481f', stroke=None) +
            ln('M12 9.6c1.6 3 1.2 6 3.6 7.8M20.2 9.6c-1.4 2.6-.6 5.6-2.6 7.8', '#6b4220', 1.1) + p('M14.6 5.4c.8-1.6 2.2-1.6 2.8 0l-.4 2h-2z', GREEN[0], sw=1) +
            shine(11.6, 12.6, 2.2, 1.3))

def gem(pal):
    m, sh = pal
    return (p('M10.4 6h11.2l5.4 7.4L16 27.4L5 13.4z', m) + p('M5 13.4h22L16 27.4z', sh, stroke=None) + p('M10.4 6h11.2l5.4 7.4L16 27.4L5 13.4z', 'none') +
            ln('M5 13.4h22M12.6 13.4L16 6l3.4 7.4L16 27.4l-3.4-14z', '#ffffff', .8) + shine(10.6, 10.4, 1.6, .9))

def bottle(fill=None):
    s = p('M12.6 4.6h6.8v3.6h-6.8z', '#b07a4a', sw=1) + p('M13.2 8.2h5.6v4.2c3.6 1.8 5.6 4.8 5.6 8.4c0 4.6-3.6 7.6-8.4 7.6s-8.4-3-8.4-7.6c0-3.6 2-6.6 5.6-8.4z', '#bfe3ff', extra=' fill-opacity=".55"')
    if fill:
        s += p('M8.4 20.4c0 4.4 3.4 7.2 7.6 7.2s7.6-2.8 7.6-7.2z', fill, stroke=None, extra=' opacity=".9"')
    return s + p('M13.2 8.2h5.6v4.2c3.6 1.8 5.6 4.8 5.6 8.4c0 4.6-3.6 7.6-8.4 7.6s-8.4-3-8.4-7.6c0-3.6 2-6.6 5.6-8.4z', 'none') + shine(11.8, 16.6, 1.2, 2.6, 15)

def face_mask(base, eyes, extra=''):
    return p('M16 4.2c6.6 0 10.6 4.6 10.6 10.8c0 7.2-4.8 12.8-10.6 12.8S5.4 22.2 5.4 15c0-6.2 4-10.8 10.6-10.8z', base[0]) + extra + eyes

def keaton():
    return (p('M6 4.8l4.6 6.2M26 4.8l-4.6 6.2', 'none') + p('M5.6 4l6.6 5.4l-5.8 3.4zM26.4 4l-6.6 5.4l5.8 3.4z', '#f2c94c') +
            p('M16 8c6.4 0 10.4 4.2 10.4 9.2c0 3-1.8 4.8-4.4 6.2L16 28l-6-4.6c-2.6-1.4-4.4-3.2-4.4-6.2C5.6 12.2 9.6 8 16 8z', '#f2c94c') +
            p('M16 20.4l6 3l-6 4.6l-6-4.6z', '#fff7e0', sw=1) + p('M9.6 15.6l4.2 1.8l-4.4.8zM22.4 15.6l-4.2 1.8l4.4.8z', O, sw=.8) + c(16, 22, 1.4, O, stroke=None))

def skull_mask():
    return (p('M7.6 8.4c-2.6-1.4-4.6-1-5.6.2c2 .4 3.4 1.8 4.2 3.6zM24.4 8.4c2.6-1.4 4.6-1 5.6.2c-2 .4-3.4 1.8-4.2 3.6z', BONE[1]) +
            p('M16 5c6.4 0 10 4.4 10 9.6c0 3.6-1.6 5.8-3.6 7v4.6H9.6v-4.6c-2-1.2-3.6-3.4-3.6-7C6 9.4 9.6 5 16 5z', BONE[0]) +
            e(12, 15.4, 2.6, 2.8, O, stroke=None) + e(20, 15.4, 2.6, 2.8, O, stroke=None) + p('M16 18.6l1.4 2.6h-2.8z', O, stroke=None) +
            ln('M12.6 23.4v3.2M16 23.4v3.2M19.4 23.4v3.2', BONE[1], 1))

def spooky():
    return (ln('M16 26.6V30', O, 3.6) + ln('M16 26.6V30', WOOD[1], 2) +
            p('M16 3.4c6.4 0 10.4 4.8 10.4 11.4S22.4 27 16 27S5.6 21.4 5.6 14.8S9.6 3.4 16 3.4z', '#c99a5e') +
            p('M9.4 12.6l4.4 1.6l-4.2 2.2zM22.6 12.6l-4.4 1.6l4.2 2.2z', O, sw=.8) + p('M10.6 20c3 2.6 7.8 2.6 10.8 0c-1.6 3.4-9.2 3.4-10.8 0z', O, sw=.8) +
            shine(11.2, 8.4, 2.4, 1.2))

def bunny():
    return (p('M10.4 18c-3.4-5.8-4-11.8-1.6-14.2c2.6 1.2 4.4 6.6 4.8 13z', PINK[0]) + p('M21.6 18c3.4-5.8 4-11.8 1.6-14.2c-2.6 1.2-4.4 6.6-4.8 13z', PINK[0]) +
            p('M10.6 15.4c-1.8-4-2.2-7.6-1.4-9.4c1.2 1.2 2.2 4.6 2.6 8.8zM21.4 15.4c1.8-4 2.2-7.6 1.4-9.4c-1.2 1.2-2.2 4.6-2.6 8.8z', '#ffd1e4', stroke=None) +
            p('M6 23.4c0-4.6 4.4-7.2 10-7.2s10 2.6 10 7.2v3.4H6z', PINK[0]) + p('M6 24h20v2.8H6z', PINK[1], sw=1))

def truth():
    return (p('M16 4.2c6.6 0 10.6 4.6 10.6 10.8c0 7.2-4.8 12.8-10.6 12.8S5.4 22.2 5.4 15c0-6.2 4-10.8 10.6-10.8z', '#aab3c2') +
            e(16, 14.6, 7.4, 4.4, '#fff') + c(16, 14.6, 3, '#d1453b', sw=1) + c(16, 14.6, 1.3, O, stroke=None) +
            ln('M8 9.6l-2.6-2.4M24 9.6l2.6-2.4M16 8.2V5', '#6c7584', 1.2) + p('M12.6 22.4h6.8', 'none'))

def generic_mask():
    return (face_mask(WHITE, e(11.6, 14.2, 2.4, 1.6, O, stroke=None) + e(20.4, 14.2, 2.4, 1.6, O, stroke=None),
                      p('M8 19.8c4.6 2 11.4 2 16 0c-1 4-4.4 7-8 7s-7-3-8-7z', '#cfd6e0', stroke=None)) + shine(11, 8.8, 2.4, 1.2))

def egg(pal, spots='#c98f56'):
    return (e(16, 17, 9, 11.4, pal) + c(12.4, 12.4, 1.6, spots, stroke=None) + c(19, 15, 1.2, spots, stroke=None) + c(14.6, 21.4, 1.4, spots, stroke=None) +
            c(20.4, 22, 1, spots, stroke=None) + shine(12.4, 10.4, 1.6, 2.6, 20))

def cucco(body, comb=RED[0]):
    return (p('M7.4 18.4c0-5.2 3.6-8.6 8.2-8.6c1-3.4 3.4-5.2 6-5c2.6.2 4 2.4 4 5c0 1.6-.6 2.8-1.6 3.8c1.2 1.6 1.8 3.4 1.8 5.4c0 5-4.2 8.4-9.4 8.4S7.4 23.4 7.4 18.4z', body) +
            p('M20.2 5.2c.4-1.8 1.8-2.6 3-2c.2-1.2 1.8-1.6 2.6-.6c-1.2 1-1.6 2.2-1.6 3.4z', comb, sw=.9) + p('M25.6 9.4l3.6 1l-3.4 1.4z', '#f6b73c', sw=.9) +
            c(22.4, 8.6, 1, O, stroke=None) + p('M7.6 15.4c-2.4-.8-4.2.2-4.8 2.2c1.6-.4 3 0 4.4 1z', body) +
            ln('M13.4 26.6v3M18.6 26.6v3', '#f6b73c', 1.4) + ln('M11.6 18.6c2.4 2 6 2 8.4-.6', '#00000055', 1.1))

def mushroom():
    return (p('M12.6 17h6.8l1.2 10.4h-9.2z', '#efe6cf') + p('M3.8 17.4c0-6.8 5.4-12 12.2-12s12.2 5.2 12.2 12z', '#3e6fd8') +
            c(10.4, 12, 1.8, '#dbe9ff', stroke=None) + c(17.4, 9.4, 1.5, '#dbe9ff', stroke=None) + c(22, 13.6, 1.8, '#dbe9ff', stroke=None) + shine(9, 9.6, 2.2, 1.1))

def potion():
    return (p('M12.8 4.6h6.4v3.4h-6.4z', '#b07a4a', sw=1) + p('M13.4 8h5.2v5c3.8 1.4 6.4 4.4 6.4 8.4c0 4.4-3.8 7.4-9 7.4s-9-3-9-7.4c0-4 2.6-7 6.4-8.4z', '#5cc27a') +
            c(13, 20, 1.4, '#c9f2d4', stroke=None) + c(18.4, 22.4, 1.1, '#c9f2d4', stroke=None) + c(16.4, 17.2, .9, '#c9f2d4', stroke=None) + shine(11.4, 17, 1.2, 2.4, 15))

def saw():
    teeth = ''.join(f'l1.5 2.2l1.5-2.2' for _ in range(6))
    return (p(f'M5.4 13.2h18.4v5.2H8.4l-3-2.6z', '#c7ced8') + p(f'M8.4 18.4{teeth}', 'none', sw=1.1) +
            p('M23.8 10.6h4.6c1 0 1.6.8 1.6 1.6v8.2c0 .8-.6 1.6-1.6 1.6h-4.6z', WOOD[0]) + c(26.6, 16.4, 1.4, '#1b1d24', stroke=None) + shine(11, 14.6, 3, .8, 0))

def paper(mark=''):
    return (p('M8 4h11.6l5 5v19H8z', '#f3ecda') + p('M19.6 4v5h5', '#d8ceb4') +
            ln('M11 13h10M11 16.6h10M11 20.2h6.4', '#a99f86', 1.1) + mark)

def frog():
    return (p('M5 22c0-5.8 4.8-9.6 11-9.6S27 16.2 27 22c0 3.2-2.4 5-5.4 5H10.4C7.4 27 5 25.2 5 22z', '#5cb85c') +
            c(10.8, 11.6, 4, '#5cb85c') + c(21.2, 11.6, 4, '#5cb85c') + c(10.8, 11.6, 2.6, '#fff', sw=.9) + c(21.2, 11.6, 2.6, '#fff', sw=.9) +
            c(11.2, 11.8, 1.3, O, stroke=None) + c(21.6, 11.8, 1.3, O, stroke=None) + ln('M11.6 21.2c2.8 1.8 6 1.8 8.8 0', '#2f7a33', 1.2))

def eye_drops():
    return (p('M13 3.6h6v6h-6z', RED[0], sw=1) + p('M12.4 9.6h7.2v3.6c3 1.4 4.6 3.8 4.6 7c0 4.4-3.6 7.6-8.2 7.6s-8.2-3.2-8.2-7.6c0-3.2 1.6-5.6 4.6-7z', '#5aa7f0') +
            p('M16 16.4c1.6 2 2.6 3.4 2.6 4.6a2.6 2.6 0 0 1-5.2 0c0-1.2 1-2.6 2.6-4.6z', '#e5f2ff', sw=.9) + shine(11.8, 16.4, 1.1, 2.2, 15))

def ticket():
    return (p('M4 9h24v4.4a2.6 2.6 0 0 0 0 5.2V23H4v-4.4a2.6 2.6 0 0 0 0-5.2z', '#f0a640') + ln('M20.6 9.6v12.8', '#a86412', 1.1) +
            ln('M7.6 13.4h9.6M7.6 17h7', '#7a4a10', 1.2) + c(24.4, 16, 1.6, '#a86412', stroke=None))

def letter():
    return (p('M3.6 9h24.8v15.4H3.6z', '#f5f1e6') + ln('M3.6 9L16 18.4L28.4 9', '#b9b2a0', 1.2) + c(16, 18.2, 3.4, '#c9343f') +
            p('M16 15.8l.8 1.6l1.7.2l-1.2 1.2l.3 1.7l-1.6-.8l-1.6.8l.3-1.7l-1.2-1.2l1.7-.2z', '#f7b4b9', stroke=None))

def card():
    return (p('M4 7.6h24a2 2 0 0 1 2 2v12.8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9.6a2 2 0 0 1 2-2z', '#8e4fc4') + p('M2 11.6h28v3H2z', '#5f2f8f', stroke=None) +
            p('M10.6 20.4a4.4 4.4 0 1 1 3.4-7.2a3.4 3.4 0 1 0 0 4.4a4.4 4.4 0 0 1-3.4 2.8z', '#f4c64f', sw=.9) + ln('M17.6 18h8M17.6 21h5.6', '#e5d6f5', 1.2))

def boss_key():
    return (g(c(16, 9, 6.4, RED[0]) + c(16, 9, 2.6, '#1b1d24') + p('M14.4 14.8h3.2v12.8h-3.2z', GOLD[0]) +
              p('M17.6 21.4h4v2.4h-4zM17.6 25.2h3v2.4h-3z', GOLD[0], sw=1) + ''.join(c(16 + 6.4 * math.cos(math.radians(a)), 9 + 6.4 * math.sin(math.radians(a)), 1.4, GOLD[0], sw=.9) for a in (-90, 30, 150)) +
              shine(13.4, 6.6, 1.6, .9), 'rotate(25 16 16)'))

def small_key():
    return g(c(16, 9.2, 5.2, SILVER[0]) + c(16, 9.2, 2.2, '#1b1d24') + p('M14.6 14h2.8v13.6h-2.8z', SILVER[0]) + p('M17.4 21.6h3.4v2.2h-3.4zM17.4 25.2h2.6v2.2h-2.6z', SILVER[0], sw=1),
             'rotate(25 16 16)')

def dmap():
    return (p('M4 7.4l7-2.6l10 2.6l7-2.6v19.8l-7 2.6l-10-2.6l-7 2.6z', '#e9dcb4') + p('M11 4.8v19.8M21 7.4v19.8', 'none', sw=1) +
            p('M11 4.8l10 2.6v19.8l-10-2.6z', '#d7c690', stroke=None) + p('M4 7.4l7-2.6l10 2.6l7-2.6v19.8l-7 2.6l-10-2.6l-7 2.6z', 'none') +
            ln('M7 18.4c3-1 5 1.6 8 .4s4-4.4 9-3.6', '#c0392b', 1.2) + p('M22.4 12.6l1.4 1.4m0-1.4l-1.4 1.4', 'none', stroke='#c0392b', sw=1.3))

def compass():
    return (c(16, 16, 12.2, GOLD[1]) + c(16, 16, 9.8, '#f5efe0', sw=1) + p('M16 7.6l2.4 8.4h-4.8z', RED[0], sw=.9) + p('M16 24.4l2.4-8.4h-4.8z', '#5b6475', sw=.9) +
            c(16, 16, 1.4, GOLD[1], sw=.8) + c(16, 3.4, 1.8, GOLD[0]))

def dungeon():
    return (p('M4 28V13.4C4 7.6 9.4 3.6 16 3.6S28 7.6 28 13.4V28z', '#8d95a3') + ln('M4 18h4M24 18h4M4 23h3M25 23h3M8.6 8.4l2 2.4M23.4 8.4l-2 2.4', '#5e6675', 1.1) +
            p('M9.4 28V15c0-3.8 3-6.6 6.6-6.6s6.6 2.8 6.6 6.6v13z', WOOD[0]) + ln('M13.4 10v18M18.6 10v18', WOOD[1], 1.1) + c(19.8, 20.4, 1, GOLD[0], stroke=None))

def boss():
    return (p('M6.4 10.4C3.6 8 3.2 4.4 4.4 2.6c1 2.6 3 4 5.4 4.6zM25.6 10.4c2.8-2.4 3.2-6 2-7.8c-1 2.6-3 4-5.4 4.6z', BONE[1]) +
            p('M16 6c6.6 0 10.6 4.6 10.6 10c0 3.8-1.8 6-4 7.4V28H9.4v-4.6c-2.2-1.4-4-3.6-4-7.4C5.4 10.6 9.4 6 16 6z', '#d9c9a8') +
            p('M9.6 14.6l5 2l-4.8 2.4zM22.4 14.6l-5 2l4.8 2.4z', RED[1], sw=.9) + p('M16 20l1.4 2.4h-2.8z', O, stroke=None) +
            ln('M12.8 24.6v3M16 24.6v3M19.2 24.6v3', '#a99777', 1))

def crossed_swords():
    one = p('M15.2 4l1.6-1.6l1.6 1.6v15h-3.2z', '#e8edf4') + p('M11.4 19h9.2v2.4h-9.2z', GOLD[0]) + p('M14.8 21.4h2.4v5h-2.4z', LEATHER[1]) + c(16, 27.6, 1.5, GOLD[0])
    return g(one, 'rotate(-38 16 16)') + g(one, 'rotate(38 16 16)')

def quest():
    return (p('M7 6h15.4c1.6 0 2.6 1.2 2.6 2.6V26H9.6C8.2 26 7 24.8 7 23.4z', '#f0e3bf') + p('M7 23.4C7 22 8.2 21 9.6 21H25v5H9.6C8.2 26 7 24.8 7 23.4z', '#d9c690') +
            p('M15 9.4h3l-.6 7.4h-1.8z', '#c0392b', sw=.9) + c(16.5, 19.2, 1.4, '#c0392b', sw=.9))

def fairy():
    wing = '#e9f3ff'
    w = ''.join(e(16 + dx, cy, rx, ry, wing, stroke='#8fb4d9', sw=.9, extra=f' transform="rotate({rot} {16 + dx} {cy})" fill-opacity=".9"')
                for dx, cy, rx, ry, rot in ((-6.4, 10.4, 6, 3.6, -35), (6.4, 10.4, 6, 3.6, 35), (-5.4, 20.6, 4.6, 2.8, 30), (5.4, 20.6, 4.6, 2.8, -30)))
    return (w + f'<circle cx="16" cy="15.6" r="8.4" fill="{PINK[0]}" opacity=".28"/>' + f'<circle cx="16" cy="15.6" r="6" fill="#ffc2de" opacity=".55"/>' +
            c(16, 15.6, 3.8, '#fff0f7', stroke='#e46aa6', sw=1.1) + ''.join(c(x, y, .9, '#fff', stroke=None) for x, y in ((6, 26), (26.4, 26.6), (27.4, 4.6))))

def poe():
    return (p('M6.6 13.6C6.6 7.8 10.6 4 16 4s9.4 3.8 9.4 9.6V27l-3.1-2.4L19.2 27l-3.2-2.4L12.8 27l-3.1-2.4L6.6 27z', '#9b7ad6') +
            e(12.6, 13, 1.8, 2.4, O, stroke=None) + e(19.4, 13, 1.8, 2.4, O, stroke=None) + p('M23.6 17.4h5v7.2h-5z', '#f2b43a', sw=1) +
            f'<rect x="24.6" y="18.6" width="3" height="4.6" fill="#fff4b8"/>' + ln('M26.1 15.4v2', O, 1.2) + shine(11.2, 7.8, 2.4, 1.1))

def planted_bean():
    return (p('M3 26.6c2.4-5 7-7.8 13-7.8s10.6 2.8 13 7.8z', '#7a5230') + ln('M16 19.4V11', '#2d8a3c', 2.6) + ln('M16 19.4V11', GREEN[0], 1.2) +
            p('M16 13.4c0-4-3.2-6.6-8-6.6c0 4 3.2 6.6 8 6.6z', GREEN[0], sw=1.1) + p('M16 11.4c0-3.4 2.8-5.8 6.8-5.8c0 3.4-2.8 5.8-6.8 5.8z', '#6fd47c', sw=1.1) +
            c(10.6, 24, .9, '#a5764a', stroke=None) + c(21, 23.4, .8, '#a5764a', stroke=None))

def wallet(pal):
    return pouch(pal, rupee(16, 19.6, '#43c463', 1.15))

def bomb_bag(tier):
    return pouch(('#7c4fa0', '#55337a'), c(16, 19.4, 3.8, '#2f3f73', sw=1) + shine(14.8, 18.2, 1.1, .7), tier)

def seed_bag(tier):
    seeds = ''.join(c(x, y, 1.3, '#f2d15a', sw=.7) for x, y in ((13, 18), (16, 20.6), (19, 18), (15.4, 16.4), (17.6, 16.8)))
    return pouch(GREEN, seeds, tier)

def quiver(tier):
    s = ''.join(ln(f'M{x} 10L{x+3} 3.6', O, 3) + ln(f'M{x} 10L{x+3} 3.6', '#f2f2f2', 1.4) for x in (11, 15, 19))
    s += g(p('M9.4 9.4h13.2l-1.4 18H10.8z', LEATHER[0]) + p('M9.4 9.4h13.2v3H9.4z', LEATHER[1], sw=1), 'rotate(8 16 18)')
    return s + (pips(tier) if tier else '')

def nut_tier(t): return nut() + pips(t)
def stick_tier(t): return sticks() + pips(t)

def song_icon(pal): return note(pal)

ICONS = {
    # stones & medallions
    'forest_medallion': medallion(GREEN, 'leaf'), 'fire_medallion': medallion(RED, 'flame'), 'water_medallion': medallion(BLUE, 'drop'),
    'shadow_medallion': medallion(PURPLE, 'moon'), 'spirit_medallion': medallion(ORANGE, 'star4'), 'light_medallion': medallion(YELLOW, 'star6'),
    'kokiris_emerald': stone('emerald'), 'gorons_ruby': stone('ruby'), 'zoras_sapphire': stone('sapphire'),
    # songs (colour per song)
    'zeldas_lullaby': note(('#a98ff0', '#6b52b8')), 'eponas_song': note(ORANGE), 'sarias_song': note(GREEN), 'suns_song': note(YELLOW),
    'song_of_time': note(('#5aa0ff', '#2d63c2')), 'song_of_storms': note(('#9fb0c8', '#64748e')), 'scarecrows_song': note(WOOD),
    'minuet_of_forest': note(('#5fd06c', '#2b8239')), 'bolero_of_fire': note(RED), 'serenade_of_water': note(BLUE),
    'requiem_of_spirit': note(ORANGE), 'nocturne_of_shadow': note(PURPLE), 'prelude_of_light': note(YELLOW),
    # hearts & tokens
    'heart_container': heart(), 'heart_piece': heart_piece(), 'gold_skulltula': token(),
    # equipment
    'kokiri_sword': sword('short', guard=('#6aa84f', '#3f7a2c'), grip='#7d522a', guard_style='bar'),
    'master_sword': sword('mid'), 'biggorons_sword': sword('long', guard=GOLD, grip='#5a3fa0', wide=True, guard_style='bar'),
    'giants_knife': sword('long', guard=('#a88a5a', '#6e5a36'), grip='#4a3a2a', wide=True, guard_style='bar'),
    'broken_gorons_sword': sword('long', guard=GOLD, grip='#5a3fa0', wide=True, broken=True, guard_style='bar'),
    'deku_shield': shield('deku'), 'hylian_shield': shield('hylian'), 'mirror_shield': shield('mirror'),
    'kokiri_tunic_heros_clothes': tunic(GREEN), 'goron_tunic': tunic(RED), 'zora_tunic': tunic(BLUE),
    'iron_boots': boots('iron'), 'hover_boots': boots('hover'),
    # items
    'gorons_bracelet': bracelet(), 'silver_gauntlets': glove(SILVER), 'golden_gauntlets': glove(GOLD),
    'silver_scale': scale(SILVER), 'golden_scale': scale(GOLD),
    'fairy_slingshot': slingshot(), 'fairy_bow': bow(), 'boomerang': boomerang(),
    'fire_arrow': arrow(('#ff6a3d', '#b5341a'), '#ff7a3d'), 'ice_arrow': arrow(('#8fe3ff', '#3fa7d6'), '#7fdcff'), 'light_arrow': arrow(('#fff27a', '#d6c13a'), '#fff07a'),
    'hookshot': hookshot(False), 'longshot': hookshot(True), 'megaton_hammer': hammer(), 'lenses_of_truth': lens(),
    'fairy_ocarina': ocarina(WOOD, ''), 'ocarina_of_time': ocarina(('#4a7fe6', '#2a55ad'), p('M13 9.4l3-1.6l3 1.6l-3 1.4z', '#e8edf4', sw=.8)),
    'dins_fire': spell(RED, fire_flame(16, 17.4, .9)),
    'farores_wind': spell(GREEN, ln('M11.6 16c0-2.6 2-4.4 4.4-4.4s4 1.8 4 3.8s-1.6 3.2-3.2 3.2s-2.4-1-2.4-2.2s.8-1.8 1.6-1.8', '#e6ffe9', 1.6)),
    'nayrus_love': spell(BLUE, p('M16 11l3.4 5L16 21l-3.4-5z', '#e1f0ff', sw=.9)),
    'double_magic': magic_jar(2), 'magic_bean': bean(), 'deku_sticks': sticks(), 'deku_nuts': nut(),
    'bombchus': bombchu(), 'bomb_bag': bomb_bag(1), 'echo_gem': gem(TEAL),
    # capacity
    'kokiri_wallet': wallet(('#c49a62', '#8a6638')), 'adults_wallet': wallet(('#d1574e', '#93332c')), 'giants_wallet': wallet(('#8e5ad6', '#5b3497')),
    'bigger_bomb_bag': bomb_bag(2), 'biggest_bomb_bag': bomb_bag(3),
    'bigger_deku_seed_bag': seed_bag(2), 'biggest_deku_seed_bag': seed_bag(3),
    'bigger_quiver': quiver(2), 'biggest_quiver': quiver(3),
    'deku_nut_capacity_30': nut_tier(2), 'deku_nut_capacity_40': nut_tier(3),
    'deku_stick_capacity_20': stick_tier(2), 'deku_stick_capacity_30': stick_tier(3),
    # bottles, masks
    'bottle': bottle(), 'keaton_mask': keaton(), 'skull_mask': skull_mask(), 'spooky_mask': spooky(), 'bunny_hood': bunny(),
    'mask_of_truth': truth(), 'mask': generic_mask(),
    # trade
    'weird_egg': egg('#f6f1e4'), 'pocket_egg': egg('#f8dcd2', '#c97a5a'), 'wake_up_cucco': cucco('#f8f6f0'), 'pocket_cucco': cucco('#f8f6f0'),
    'cojiro': cucco('#5f8fe6', '#e8434f'), 'odd_mushroom': mushroom(), 'odd_potion': potion(), 'poachers_saw': saw(),
    'prescription': paper(p('M18.4 21.6h5v5h-5z', '#c0392b', sw=.9) + ln('M20.9 22.6v3M19.4 24.1h3', '#fff', 1)),
    'eyeball_frog': frog(), 'worlds_finest_eye_drops': eye_drops(), 'claim_check': ticket(), 'zeldas_letter': letter(),
    'gerudo_membership_card': card(),
    # dungeon / progress
    'boss_key': boss_key(), 'small_key': small_key(), 'dungeon_map': dmap(), 'compass': compass(),
    'dungeon': dungeon(), 'boss': boss(), 'mini_boss': crossed_swords(), 'side_quest': quest(),
    'great_fairy': fairy(), 'big_poe': poe(), 'bean': planted_bean(),
}


def svg(iid, body):
    body = body.replace('id="hp-q"', f'id="{iid}-q"').replace('url(#hp-q)', f'url(#{iid}-q)')
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">{body}</svg>\n'


def main(need):
    os.makedirs(OUT_DIR, exist_ok=True)
    missing = sorted(set(need) - set(ICONS))
    for iid, body in ICONS.items():
        open(os.path.join(OUT_DIR, f'{iid}.svg'), 'w', encoding='utf8', newline='\n').write(svg(iid, body))
    json.dump({'note': 'Own drawings for Boomerang Tracker (no game art). One file per checklist iconId. Generated by scripts/icons/make_icons.py.',
               'size': 32, 'icons': sorted(ICONS)}, open(os.path.join(OUT_DIR, 'index.json'), 'w', encoding='utf8', newline='\n'), indent=1)
    cells = ''.join(
        f'<div class="c"><div class="row"><span class="t on">{svg(k, b)}</span><span class="t off">{svg(k, b)}</span>'
        f'<span class="s">{svg(k, b)}</span></div><div class="n">{k}</div></div>' for k, b in sorted(ICONS.items()))
    os.makedirs(os.path.dirname(SHEET), exist_ok=True)
    open(SHEET, 'w', encoding='utf8').write(
        '<html><body style="margin:0;background:#0f1117;font:11px Segoe UI,sans-serif;color:#8b90a0">'
        '<style>.g{display:grid;grid-template-columns:repeat(8,1fr);gap:8px;padding:12px}.c{background:#161922;border:1px solid #262b38;border-radius:8px;padding:8px}'
        '.row{display:flex;gap:8px;align-items:center}.t svg{width:48px;height:48px}.on svg{filter:drop-shadow(0 0 4px rgba(255,255,255,.18))}'
        '.off svg{filter:grayscale(1);opacity:.4}.s svg{width:24px;height:24px}.n{margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}</style>'
        f'<div class="g">{cells}</div></body></html>')
    return missing


if __name__ == '__main__':
    import sys
    need = json.loads(sys.argv[1]) if len(sys.argv) > 1 else []
    print('missing:', main(need))
    print('drawn:', len(ICONS))
