"""Model pricing table and token-usage → CostEstimate conversion for text and image API calls."""
from __future__ import annotations

from typing import Any

from server.social.types import CostEstimate, Pricing

PRICING: dict[str, Pricing] = {
    # OpenAI text models
    "gpt-4o-mini": Pricing(
        input_per_million_tokens=0.15,
        output_per_million_tokens=0.60,
        cached_input_per_million_tokens=0.075,
    ),
    "gpt-5": Pricing(
        input_per_million_tokens=0.625,
        output_per_million_tokens=5.00,
        cached_input_per_million_tokens=0.125,
    ),
    # OpenAI image models
    "gpt-image-1": Pricing(
        text_input_per_million_tokens=5.00,
        image_input_per_million_tokens=10.00,
        image_output_per_million_tokens=40.00,
    ),
    "gpt-image-1.5": Pricing(
        text_input_per_million_tokens=5.00,
        image_input_per_million_tokens=10.00,
        image_output_per_million_tokens=40.00,
    ),
}


def usage_from_response(response: Any) -> dict[str, int]:
    """Extract token counts from an OpenAI Responses API response."""
    u = getattr(response, "usage", None)
    if u is None:
        return {"input_tokens": 0, "output_tokens": 0, "total_tokens": 0}
    return {
        "input_tokens":  getattr(u, "input_tokens", 0) or 0,
        "output_tokens": getattr(u, "output_tokens", 0) or 0,
        "total_tokens":  getattr(u, "total_tokens", 0) or 0,
    }


def usage_from_image(response: Any) -> dict[str, int]:
    """Extract token counts from an OpenAI Images API response.

    The Images API breaks input into text_tokens and image_tokens via
    input_tokens_details. output_tokens are the generated image tokens.
    """
    u = getattr(response, "usage", None)
    if u is None:
        return {"input_tokens": 0, "image_input_tokens": 0, "output_tokens": 0, "total_tokens": 0}
    details = getattr(u, "input_tokens_details", None)
    text_input = getattr(details, "text_tokens", 0) or 0
    image_input = getattr(details, "image_tokens", 0) or 0
    output = getattr(u, "output_tokens", 0) or 0
    total = getattr(u, "total_tokens", 0) or 0
    return {
        "input_tokens":       text_input,
        "image_input_tokens": image_input,
        "output_tokens":      output,
        "total_tokens":       total,
    }


def cost_estimate(model: str, usage: dict[str, int]) -> CostEstimate:
    """Compute a CostEstimate from a usage dict and a model name."""
    pricing = PRICING.get(model)
    if pricing is None:
        return CostEstimate()

    input_tokens        = usage.get("input_tokens", 0)
    image_input_tokens  = usage.get("image_input_tokens", 0)
    output_tokens       = usage.get("output_tokens", 0)
    cached_input_tokens = usage.get("cached_input_tokens", 0)

    is_image_model = pricing.image_output_per_million_tokens is not None

    if is_image_model:
        input_cost        = input_tokens       * (pricing.text_input_per_million_tokens  or 0) / 1_000_000
        image_input_cost  = image_input_tokens * (pricing.image_input_per_million_tokens or 0) / 1_000_000
        image_output_cost = output_tokens      * (pricing.image_output_per_million_tokens or 0) / 1_000_000
        output_cost       = 0.0
        cached_cost       = 0.0
        image_output_tokens = output_tokens
    else:
        input_cost          = input_tokens       * pricing.input_per_million_tokens  / 1_000_000
        output_cost         = output_tokens      * pricing.output_per_million_tokens / 1_000_000
        cached_cost         = cached_input_tokens * (pricing.cached_input_per_million_tokens or 0) / 1_000_000
        image_input_cost    = 0.0
        image_output_cost   = 0.0
        image_output_tokens = 0

    return CostEstimate(
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        cached_input_tokens=cached_input_tokens,
        image_input_tokens=image_input_tokens,
        image_output_tokens=image_output_tokens,
        input_cost_usd=input_cost,
        output_cost_usd=output_cost,
        cached_input_cost_usd=cached_cost,
        image_input_cost_usd=image_input_cost,
        image_output_cost_usd=image_output_cost,
        total_cost_usd=input_cost + output_cost + cached_cost + image_input_cost + image_output_cost,
    )


def add_estimates(*estimates: CostEstimate) -> CostEstimate:
    """Sum any number of CostEstimates field-by-field into a single aggregate."""
    return CostEstimate(
        input_tokens=                  sum(e.input_tokens                  for e in estimates),
        output_tokens=                 sum(e.output_tokens                 for e in estimates),
        cached_input_tokens=           sum(e.cached_input_tokens           for e in estimates),
        cache_creation_input_tokens=   sum(e.cache_creation_input_tokens   for e in estimates),
        image_input_tokens=            sum(e.image_input_tokens            for e in estimates),
        image_output_tokens=           sum(e.image_output_tokens           for e in estimates),
        input_cost_usd=                sum(e.input_cost_usd                for e in estimates),
        output_cost_usd=               sum(e.output_cost_usd               for e in estimates),
        cached_input_cost_usd=         sum(e.cached_input_cost_usd         for e in estimates),
        cache_creation_input_cost_usd= sum(e.cache_creation_input_cost_usd for e in estimates),
        image_input_cost_usd=          sum(e.image_input_cost_usd          for e in estimates),
        image_output_cost_usd=         sum(e.image_output_cost_usd         for e in estimates),
        total_cost_usd=                sum(e.total_cost_usd                for e in estimates),
    )
