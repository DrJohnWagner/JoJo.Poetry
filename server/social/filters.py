"""Instagram-style image filters implemented with PIL and NumPy; supports strength blending and alpha preservation."""
from __future__ import annotations

import numpy as np
from PIL import Image, ImageEnhance

FILTER_NAMES = [
    "aden",
    "clarendon",
    "crema",
    "gingham",
    "juno",
    "lark",
    "ludwig",
    "moon",
    "none",
    "perpetua",
    "reyes",
    "slumber",
]

def apply_filter(image: Image.Image, filter_name: str, strength: float = 1.0) -> Image.Image:
    """Apply a named filter at the given strength [0, 1]; alpha channel is preserved."""
    name = _normalise_filter_name(filter_name)
    strength = _clamp_strength(strength)
    fn = _FILTERS.get(name)
    if fn is None:
        raise ValueError(f"Unknown filter: {filter_name!r}. Valid: {FILTER_NAMES}")
    if strength == 0.0:
        return image.copy()
    original_rgb, alpha = _split_alpha(image)
    filtered_rgb = fn(original_rgb)
    blended = _blend(original_rgb, filtered_rgb, strength)
    return _restore_alpha(blended, alpha)


# ── helpers ──────────────────────────────────────────────────────────────────

def _clamp_strength(s: float) -> float:
    return max(0.0, min(1.0, float(s)))


def _normalise_filter_name(name: str) -> str:
    return name.strip().lower()


def _split_alpha(image: Image.Image) -> tuple[Image.Image, Image.Image | None]:
    if image.mode == "RGBA":
        r, g, b, a = image.split()
        return Image.merge("RGB", (r, g, b)), a
    return image.convert("RGB"), None


def _restore_alpha(rgb: Image.Image, alpha: Image.Image | None) -> Image.Image:
    if alpha is None:
        return rgb
    r, g, b = rgb.split()
    return Image.merge("RGBA", (r, g, b, alpha))


def _blend(original: Image.Image, filtered: Image.Image, strength: float) -> Image.Image:
    if strength >= 1.0:
        return filtered
    return Image.blend(original, filtered, strength)


def _adjust(
    image: Image.Image,
    *,
    contrast: float = 1.0,
    brightness: float = 1.0,
    colour: float = 1.0,
    sharpness: float = 1.0,
) -> Image.Image:
    if contrast != 1.0:
        image = ImageEnhance.Contrast(image).enhance(contrast)
    if brightness != 1.0:
        image = ImageEnhance.Brightness(image).enhance(brightness)
    if colour != 1.0:
        image = ImageEnhance.Color(image).enhance(colour)
    if sharpness != 1.0:
        image = ImageEnhance.Sharpness(image).enhance(sharpness)
    return image


def _split_tone(
    image: Image.Image,
    shadow_rgb: tuple[int, int, int],
    highlight_rgb: tuple[int, int, int],
    shadow_strength: float = 0.3,
    highlight_strength: float = 0.3,
) -> Image.Image:
    arr = np.array(image, dtype=np.float32) / 255.0
    lum = 0.2126 * arr[:, :, 0] + 0.7152 * arr[:, :, 1] + 0.0722 * arr[:, :, 2]

    shadow_mask = np.clip(1.0 - lum * 2.0, 0.0, 1.0) * shadow_strength
    highlight_mask = np.clip(lum * 2.0 - 1.0, 0.0, 1.0) * highlight_strength

    sr, sg, sb = (c / 255.0 for c in shadow_rgb)
    hr, hg, hb = (c / 255.0 for c in highlight_rgb)

    m = shadow_mask[:, :, np.newaxis]
    arr = arr + m * np.array([sr - arr[:, :, 0], sg - arr[:, :, 1], sb - arr[:, :, 2]]).transpose(1, 2, 0)

    m = highlight_mask[:, :, np.newaxis]
    arr = arr + m * np.array([hr - arr[:, :, 0], hg - arr[:, :, 1], hb - arr[:, :, 2]]).transpose(1, 2, 0)

    arr = np.clip(arr * 255.0, 0, 255).astype(np.uint8)
    return Image.fromarray(arr, "RGB")


def _vignette(image: Image.Image, strength: float = 0.4) -> Image.Image:
    w, h = image.size
    arr = np.array(image, dtype=np.float32)

    xs = np.linspace(-1.0, 1.0, w)
    ys = np.linspace(-1.0, 1.0, h)
    xg, yg = np.meshgrid(xs, ys)
    dist = np.sqrt(xg ** 2 + yg ** 2) / np.sqrt(2.0)
    mask = 1.0 - dist * strength
    mask = np.clip(mask, 0.0, 1.0)[:, :, np.newaxis]

    arr = np.clip(arr * mask, 0, 255).astype(np.uint8)
    return Image.fromarray(arr, "RGB")


def _lift_shadows(image: Image.Image, lift: float = 0.05) -> Image.Image:
    arr = np.array(image, dtype=np.float32)
    arr = arr + lift * (255.0 - arr)
    arr = np.clip(arr, 0, 255).astype(np.uint8)
    return Image.fromarray(arr, "RGB")


def _warm(image: Image.Image, red_boost: float = 0.08, blue_cut: float = 0.06) -> Image.Image:
    arr = np.array(image, dtype=np.float32)
    arr[:, :, 0] = np.clip(arr[:, :, 0] * (1.0 + red_boost), 0, 255)
    arr[:, :, 2] = np.clip(arr[:, :, 2] * (1.0 - blue_cut), 0, 255)
    return Image.fromarray(arr.astype(np.uint8), "RGB")


def _cool_shadows(image: Image.Image, strength: float = 0.15) -> Image.Image:
    arr = np.array(image, dtype=np.float32) / 255.0
    lum = 0.2126 * arr[:, :, 0] + 0.7152 * arr[:, :, 1] + 0.0722 * arr[:, :, 2]
    shadow_mask = np.clip(1.0 - lum * 2.0, 0.0, 1.0) * strength
    arr[:, :, 2] = np.clip(arr[:, :, 2] + shadow_mask, 0.0, 1.0)
    arr[:, :, 0] = np.clip(arr[:, :, 0] - shadow_mask * 0.5, 0.0, 1.0)
    arr = np.clip(arr * 255.0, 0, 255).astype(np.uint8)
    return Image.fromarray(arr, "RGB")


# ── filter implementations ────────────────────────────────────────────────────

def _filter_none(image: Image.Image) -> Image.Image:
    return image.copy()


def _filter_clarendon(image: Image.Image) -> Image.Image:
    image = _adjust(image, contrast=1.2, brightness=1.05, colour=1.15)
    image = _cool_shadows(image, strength=0.12)
    image = _vignette(image, strength=0.25)
    return image


def _filter_gingham(image: Image.Image) -> Image.Image:
    image = _adjust(image, contrast=0.9, brightness=1.05, colour=0.85)
    image = _lift_shadows(image, lift=0.04)
    image = _split_tone(
        image,
        shadow_rgb=(220, 215, 200),
        highlight_rgb=(255, 252, 240),
        shadow_strength=0.2,
        highlight_strength=0.15,
    )
    return image


def _filter_lark(image: Image.Image) -> Image.Image:
    image = _adjust(image, contrast=0.95, brightness=1.1, colour=1.1)
    image = _split_tone(
        image,
        shadow_rgb=(190, 205, 220),
        highlight_rgb=(255, 252, 235),
        shadow_strength=0.2,
        highlight_strength=0.2,
    )
    return image


def _filter_juno(image: Image.Image) -> Image.Image:
    image = _adjust(image, contrast=1.1, colour=1.2)
    image = _warm(image, red_boost=0.1, blue_cut=0.08)
    image = _split_tone(
        image,
        shadow_rgb=(40, 20, 10),
        highlight_rgb=(255, 240, 200),
        shadow_strength=0.15,
        highlight_strength=0.15,
    )
    image = _vignette(image, strength=0.2)
    return image


def _filter_reyes(image: Image.Image) -> Image.Image:
    image = _adjust(image, contrast=0.85, brightness=1.1, colour=0.75)
    image = _lift_shadows(image, lift=0.06)
    image = _split_tone(
        image,
        shadow_rgb=(210, 200, 180),
        highlight_rgb=(255, 248, 230),
        shadow_strength=0.25,
        highlight_strength=0.2,
    )
    return image


def _filter_aden(image: Image.Image) -> Image.Image:
    image = _adjust(image, contrast=0.9, brightness=1.05, colour=0.85)
    image = _lift_shadows(image, lift=0.08)
    image = _warm(image, red_boost=0.05, blue_cut=0.03)
    image = _vignette(image, strength=0.15)
    return image


def _filter_crema(image: Image.Image) -> Image.Image:
    image = _adjust(image, contrast=0.9, brightness=1.05, colour=0.9)
    image = _warm(image, red_boost=0.06, blue_cut=0.04)
    image = _split_tone(
        image,
        shadow_rgb=(200, 190, 170),
        highlight_rgb=(255, 244, 220),
        shadow_strength=0.15,
        highlight_strength=0.25,
    )
    return image


def _filter_ludwig(image: Image.Image) -> Image.Image:
    image = _adjust(image, contrast=1.25, brightness=1.05, colour=1.1)
    image = _warm(image, red_boost=0.05, blue_cut=0.03)
    return image


def _filter_moon(image: Image.Image) -> Image.Image:
    image = image.convert("L").convert("RGB")
    image = _adjust(image, contrast=1.2, brightness=1.05)
    return image


def _filter_perpetua(image: Image.Image) -> Image.Image:
    image = _adjust(image, contrast=0.95, brightness=1.1, colour=1.1)
    image = _split_tone(
        image,
        shadow_rgb=(180, 200, 220),
        highlight_rgb=(245, 250, 255),
        shadow_strength=0.2,
        highlight_strength=0.2,
    )
    return image


def _filter_slumber(image: Image.Image) -> Image.Image:
    image = _adjust(image, contrast=0.9, brightness=1.05, colour=0.8)
    image = _lift_shadows(image, lift=0.07)
    image = _split_tone(
        image,
        shadow_rgb=(200, 190, 180),
        highlight_rgb=(255, 240, 230),
        shadow_strength=0.2,
        highlight_strength=0.2,
    )
    image = _vignette(image, strength=0.2)
    return image


# ── registry ──────────────────────────────────────────────────────────────────

_FILTERS: dict[str, object] = {
    "aden": _filter_aden,
    "clarendon": _filter_clarendon,
    "crema": _filter_crema,
    "gingham": _filter_gingham,
    "juno": _filter_juno,
    "lark": _filter_lark,
    "ludwig": _filter_ludwig,
    "moon": _filter_moon,
    "none": _filter_none,
    "perpetua": _filter_perpetua,
    "reyes": _filter_reyes,
    "slumber": _filter_slumber,
}