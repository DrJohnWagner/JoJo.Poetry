"""Generate Balloons-{filter}.png for every filter except 'none'."""

from pathlib import Path
from PIL import Image

import sys
sys.path.insert(0, str(Path(__file__).parents[3]))

from server.social.filters import FILTER_NAMES, apply_filter

images_dir = Path(__file__).parent
src = Image.open(images_dir / "Balloons-none.png")

for name in FILTER_NAMES:
    if name == "none":
        continue
    out = images_dir / f"Balloons-{name}.png"
    apply_filter(src, name).save(out)
    print(f"  {out.name}")
