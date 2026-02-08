"""
Build a PUA-remapped subset of NotoEmoji-Regular.ttf.

The key insight: jsPDF only reads cmap format 4 (BMP).
We need ALL our PUA codepoints (E000-E069) in a format 4 subtable.

Strategy:
1. Load original Noto Emoji font
2. For each emoji we want, find its glyph name
3. Build a new font with only those glyphs
4. Map them to PUA codepoints E000-E069 in a format 4 cmap
"""

from fontTools.ttLib import TTFont
from fontTools import subset
from fontTools.ttLib.tables._c_m_a_p import cmap_format_4
import base64
import os

# 200+ common emoji codepoints, in order (maps to E000, E001, ...)
# PUA range E000-E8FF gives us up to 2304 slots — plenty
EMOJI_CODEPOINTS = [
    # === Symbols (BMP range) ===
    0x231A, 0x231B,                       # watch, hourglass
    0x2328,                               # keyboard
    0x23E9, 0x23EA, 0x23EB, 0x23EC,       # fast fwd/rev/up/down
    0x23F0, 0x23F3,                       # alarm clock, hourglass flowing
    0x2600, 0x2601, 0x2602, 0x2603,       # sun, cloud, umbrella, snowman
    0x2604,                               # comet
    0x2611, 0x2614, 0x2615,               # ballot check, umbrella rain, coffee
    0x2618,                               # shamrock
    0x261D,                               # point up
    0x2620, 0x2622, 0x2623,               # skull crossbones, radioactive, biohazard
    0x2626, 0x262A, 0x262E, 0x262F,       # orthodox, star crescent, peace, yin yang
    0x2638, 0x2639, 0x263A,               # wheel dharma, frown, smile
    0x2640, 0x2642,                       # female, male
    0x2648, 0x2649, 0x264A, 0x264B,       # aries..cancer
    0x264C, 0x264D, 0x264E, 0x264F,       # leo..scorpio
    0x2650, 0x2651, 0x2652, 0x2653,       # sagittarius..pisces
    0x265F, 0x2660, 0x2663, 0x2665, 0x2666, # chess pawn, spade, club, heart, diamond
    0x2668,                               # hot springs
    0x267B, 0x267E, 0x267F,               # recycle, infinity, wheelchair
    0x2692, 0x2693, 0x2694, 0x2695, 0x2696, 0x2697, # hammer pick, anchor, swords, medical, scales, alembic
    0x2699, 0x269B, 0x269C,               # gear, atom, fleur de lis
    0x26A0, 0x26A1,                       # warning, zap
    0x26AA, 0x26AB,                       # white circle, black circle
    0x26B0, 0x26B1,                       # coffin, urn
    0x26BD, 0x26BE,                       # soccer, baseball
    0x26C4, 0x26C5,                       # snowman, sun cloud
    0x26CE, 0x26CF,                       # ophiuchus, pick
    0x26D1, 0x26D3, 0x26D4,               # helmet, chains, no entry
    0x26E9, 0x26EA,                       # shinto, church
    0x26F0, 0x26F1, 0x26F2, 0x26F3, 0x26F4, 0x26F5, # mountain, parasol, fountain, golf, boat, sailboat
    0x26F7, 0x26F8, 0x26F9, 0x26FA,       # skier, ice skate, ball player, tent
    0x26FD,                               # fuel pump
    0x2702, 0x2705,                       # scissors, check
    0x2708, 0x2709,                       # airplane, envelope
    0x270A, 0x270B, 0x270C, 0x270D,       # fist, raised hand, peace, writing hand
    0x270F,                               # pencil
    0x2712, 0x2714, 0x2716,               # black nib, checkmark, x mark
    0x271D,                               # latin cross
    0x2721,                               # star of david
    0x2728,                               # sparkles
    0x2733, 0x2734,                       # eight spoked, eight pointed
    0x2744, 0x2747,                       # snowflake, sparkle
    0x274C, 0x274E,                       # cross, cross mark
    0x2753, 0x2754, 0x2755, 0x2757,       # ?, ?, !, !
    0x2763, 0x2764,                       # heart exclamation, heart
    0x2795, 0x2796, 0x2797,               # plus, minus, divide
    0x27A1,                               # right arrow
    0x27B0, 0x27BF,                       # curly loop, double curly loop
    0x2934, 0x2935,                       # arrow up right, arrow down right
    0x2B05, 0x2B06, 0x2B07,               # left, up, down arrow
    0x2B1B, 0x2B1C,                       # black/white square
    0x2B50, 0x2B55,                       # star, circle
    # === Faces & People ===
    0x1F600, 0x1F601, 0x1F602, 0x1F603, 0x1F604, 0x1F605, 0x1F606, 0x1F607,
    0x1F608, 0x1F609, 0x1F60A, 0x1F60B, 0x1F60C, 0x1F60D, 0x1F60E, 0x1F60F,
    0x1F610, 0x1F611, 0x1F612, 0x1F613, 0x1F614, 0x1F615, 0x1F616, 0x1F617,
    0x1F618, 0x1F619, 0x1F61A, 0x1F61B, 0x1F61C, 0x1F61D, 0x1F61E, 0x1F61F,
    0x1F620, 0x1F621, 0x1F622, 0x1F623, 0x1F624, 0x1F625, 0x1F626, 0x1F627,
    0x1F628, 0x1F629, 0x1F62A, 0x1F62B, 0x1F62C, 0x1F62D, 0x1F62E, 0x1F62F,
    0x1F630, 0x1F631, 0x1F632, 0x1F633, 0x1F634, 0x1F635, 0x1F636, 0x1F637,
    0x1F641, 0x1F642, 0x1F643, 0x1F644,
    0x1F910, 0x1F911, 0x1F912, 0x1F913, 0x1F914, 0x1F915,
    0x1F916, 0x1F917,
    0x1F920, 0x1F921, 0x1F922, 0x1F923, 0x1F924, 0x1F925,
    0x1F927, 0x1F928, 0x1F929, 0x1F92A, 0x1F92B, 0x1F92C, 0x1F92D, 0x1F92E, 0x1F92F,
    0x1F970, 0x1F971, 0x1F973, 0x1F974, 0x1F975, 0x1F976,
    0x1F97A,
    # === Hands & Gestures ===
    0x1F44A, 0x1F44B, 0x1F44C, 0x1F44D, 0x1F44E, 0x1F44F,
    0x1F450,
    0x1F4AA,                              # muscle
    0x1F64B, 0x1F64C, 0x1F64D, 0x1F64E, 0x1F64F,  # raised hand, etc, pray
    0x1F91D, 0x1F91E, 0x1F91F,           # handshake, crossed fingers, love you
    0x1F932, 0x1F933,                     # palms up, selfie
    # === Hearts ===
    0x1F494, 0x1F495, 0x1F496, 0x1F497, 0x1F498, 0x1F499,
    0x1F49A, 0x1F49B, 0x1F49C, 0x1F49D, 0x1F49E, 0x1F49F,
    0x1F5A4, 0x1F9E1,
    # === Objects ===
    0x1F4A1, 0x1F4A5, 0x1F4A8, 0x1F4A9, 0x1F4AA, 0x1F4AB, 0x1F4AC, 0x1F4AD,
    0x1F4AF, 0x1F4B0, 0x1F4B2, 0x1F4B5, 0x1F4B8,
    0x1F4BB, 0x1F4BC,                     # laptop, briefcase
    0x1F4C8, 0x1F4C9, 0x1F4CA, 0x1F4CB, 0x1F4CC, 0x1F4CD, 0x1F4CE,
    0x1F4D6, 0x1F4DA, 0x1F4DD,           # book, books, memo
    0x1F4E7,                              # email
    0x1F4F1, 0x1F4F2,                     # phone
    0x1F504, 0x1F50D, 0x1F50E,           # cycle, search
    0x1F511, 0x1F512, 0x1F513, 0x1F517,  # key, lock, unlock, link
    0x1F525, 0x1F527, 0x1F528, 0x1F529,  # fire, wrench, hammer, nut bolt
    0x1F52A,                              # knife
    0x1F52E, 0x1F52F,                     # crystal ball, six pointed star
    # === Nature & Animals ===
    0x1F31F, 0x1F320,                     # glowing star, shooting star
    0x1F332, 0x1F333,                     # evergreen, deciduous tree
    0x1F337, 0x1F338, 0x1F339,           # tulip, cherry blossom, rose
    0x1F33A, 0x1F33B, 0x1F33C,           # hibiscus, sunflower, blossom
    0x1F340, 0x1F341, 0x1F342, 0x1F343,  # four leaf clover, maple, fallen leaf, leaf
    0x1F34E, 0x1F34F,                     # red apple, green apple
    0x1F355, 0x1F354,                     # pizza, hamburger
    0x1F370, 0x1F382,                     # cake, birthday cake
    # === Activities & Travel ===
    0x1F381, 0x1F389, 0x1F38A, 0x1F38B,  # gift, party popper, confetti, tanabata
    0x1F3AE, 0x1F3AF,                     # game, target
    0x1F3C6, 0x1F3C8,                     # trophy, football
    0x1F680, 0x1F681,                     # rocket, helicopter
    0x1F6A8, 0x1F6AB, 0x1F6B2,           # police light, no entry, bicycle
    0x1F6D1,                              # stop sign
    # === Flags / misc ===
    0x1F947, 0x1F948, 0x1F949,           # gold, silver, bronze medal
    0x1F9E0, 0x1F9EE,                     # brain, abacus
    0x1F9F2, 0x1F9F0,                     # magnet, toolbox
]

# Deduplicate while preserving order
seen = set()
deduped = []
for cp in EMOJI_CODEPOINTS:
    if cp not in seen:
        seen.add(cp)
        deduped.append(cp)
EMOJI_CODEPOINTS = deduped

print(f"Total emoji to include: {len(EMOJI_CODEPOINTS)}")

# Load source font
src = TTFont('/tmp/NotoEmoji-Regular.ttf')
src_cmap = src.getBestCmap()

# Find which glyphs we can actually get
available = []
missing = []
for cp in EMOJI_CODEPOINTS:
    glyph_name = src_cmap.get(cp)
    if glyph_name:
        available.append((cp, glyph_name))
    else:
        missing.append(cp)
        print(f"  MISSING: U+{cp:04X}")

print(f"Available: {len(available)}, Missing: {len(missing)}")

# Subset the font, keeping only the glyphs we need
subsetter = subset.Subsetter()
subsetter.populate(unicodes=[cp for cp, _ in available])
subsetter.subset(src)

# After subsetting, build a map from original codepoint -> glyph name
# by reading the subsetted font's cmap
post_cmap = src.getBestCmap()
print(f"Post-subset cmap entries: {len(post_cmap)}")

# Build PUA mapping: for each emoji in our list order,
# find what glyph the subsetter mapped the original codepoint to,
# then assign that glyph to the PUA codepoint
pua_mapping = {}
for i, (orig_cp, _) in enumerate(available):
    pua_cp = 0xE000 + i
    glyph_name = post_cmap.get(orig_cp)
    if glyph_name:
        pua_mapping[pua_cp] = glyph_name
    else:
        print(f"  WARNING: U+{orig_cp:04X} not in post-subset cmap")

cmap_table = src['cmap']

print(f"PUA mapping entries: {len(pua_mapping)}")

# Replace all cmap subtables
new_subtables = []

# Format 4 subtable (platform 3, encoding 1) - this is what jsPDF reads
fmt4 = cmap_format_4(4)
fmt4.platEncID = 1
fmt4.platformID = 3
fmt4.format = 4
fmt4.reserved = 0
fmt4.length = 0  # Will be calculated
fmt4.language = 0
fmt4.cmap = dict(pua_mapping)
new_subtables.append(fmt4)

# Also add platform 0 encoding 3 (Unicode BMP) with same data
fmt4_unicode = cmap_format_4(4)
fmt4_unicode.platEncID = 3
fmt4_unicode.platformID = 0
fmt4_unicode.format = 4
fmt4_unicode.reserved = 0
fmt4_unicode.length = 0
fmt4_unicode.language = 0
fmt4_unicode.cmap = dict(pua_mapping)
new_subtables.append(fmt4_unicode)

cmap_table.tables = new_subtables

# Remove variation tables that might confuse things
for table_tag in ['GSUB', 'GPOS', 'GDEF', 'fvar', 'gvar', 'HVAR', 'VVAR', 'STAT']:
    if table_tag in src:
        del src[table_tag]

# Save the font
out_path = '/tmp/NotoEmoji-PUA.ttf'
src.save(out_path)

# Verify the output
verify = TTFont(out_path)
verify_cmap = verify.getBestCmap()
print(f"\nVerification:")
print(f"  Glyph count: {len(verify.getGlyphOrder())}")
print(f"  Cmap entries: {len(verify_cmap)}")

# Check specific PUA codes
test_codes = [0xE000, 0xE009, 0xE014, 0xE015, 0xE01F, 0xE03B, 0xE05F, 0xE069]
for code in test_codes:
    gname = verify_cmap.get(code, 'NOT FOUND')
    print(f"  U+{code:04X}: {gname}")

# Check cmap subtable formats
for st in verify['cmap'].tables:
    print(f"  Subtable: platform={st.platformID}, encoding={st.platEncID}, format={st.format}")
    if hasattr(st, 'cmap'):
        codes = sorted(st.cmap.keys())
        if codes:
            print(f"    Range: U+{codes[0]:04X} - U+{codes[-1]:04X} ({len(codes)} entries)")

# Convert to base64
with open(out_path, 'rb') as f:
    font_bytes = f.read()

print(f"\nFont file size: {len(font_bytes)} bytes")
b64 = base64.b64encode(font_bytes).decode('ascii')

# Write as JS
js_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'lib', 'emoji-font.js')
with open(js_path, 'w') as f:
    f.write(f"const EMOJI_FONT_BASE64 = '{b64}';\n")

print(f"Written to: {js_path}")
print(f"JS file size: {len(b64) + 30} bytes")
