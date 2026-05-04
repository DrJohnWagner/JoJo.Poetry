import base64
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from server.instagram.instagram import generate

poem_title = "Second Nature"
poem_body = (
    "The car coils along the mountain road\n"
    "    past bright birch, a barking shepherd, a gravel drive—camera over the garage.\n"
    "Heads dart quickly side to side, counting windows,\n"
    "    searching for eyes, tight curtains, a flickering light.\n"
    "A blue house, white shutters, a yellow door, a dented mailbox;\n"
    "    skirt loose at the waist, heels that slip off without a buckle.\n"
    "\n"
    "The car coils along the mountain road\n"
    "    past thinning pines, a chained hound silent, cracked asphalt.\n"
    "Heads turn once, then twice—\n"
    "    distant headlights, a porch light left on too long.\n"
    "A beige house—peeling trim, a green door;\n"
    "    zippered denim, buttoned cotton, lace loosened without hurry.\n"
    "\n"
    "The car coils along the mountain road\n"
    "    past brick. Past stone. Past warm-lit windows.\n"
    "A glance left, a glance right—\n"
    "    then back to the quiet between them.\n"
    "The brick house. White trim.\n"
    "    Knotted tie, pressed jacket, cuffed sleeves. Silk stockings, polished shoes.\n"
    "\n"
    "The car takes the mountain road."
)

print("Calling generate()...")
result = generate(poem_title, poem_body)

print(f"\nexcerpt:\n{result['excerpt']}")
print(f"\nprompt:\n{result['prompt']}")

image_field = result["image"]
assert image_field.startswith("data:image/png;base64,"), f"Unexpected image prefix: {image_field[:50]}"

b64 = image_field[len("data:image/png;base64,"):]
png_bytes = base64.b64decode(b64)

assert png_bytes[:8] == b"\x89PNG\r\n\x1a\n", "Not a valid PNG"
print(f"\nImage: valid PNG, {len(png_bytes):,} bytes")

out = Path(__file__).parent / "test.png"
out.write_bytes(png_bytes)
print(f"Saved to {out}")
