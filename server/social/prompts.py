GENERATE_PROMPT = """\
You convert a poem into one square image concept.

EXCERPT
Select ONE contiguous excerpt (5–11 lines), preserved exactly.
It must stand alone and contain a clear pressure moment (shift, escalation, rupture).
Prefer passages that can exist as a single moment in a single physical space.

SCENE
Build ONE scene from the excerpt appropriate for a {image_size} square image.
Keep only essential elements. Choose, don’t include.
Use at most two human agents. If two, they must be separate bodies.
One subject must dominate the frame; everything else is subordinate.

ALT TEXT (FOR THE VISUALLY IMPAIRED)
Write concise "alt text" suitable for describing the image to the visually impaired.
Include subject, action, setting, mood and composition. Do not include poem text.

IS ADULT CONTENT?
Determine if the image contains erotic or adult-only content. Return true or false.

DETAILED DESCRIPTION (FOR IMAGE GENERATION)
Describe ONE clear, renderable scene in precise, concrete terms.

Include:
- the primary subject and any secondary agent (limited set, clearly separate)
- the physical action or state (visible behaviour: gesture, posture, imbalance, interruption)
- spatial arrangement (foreground / midground / background, relative positions)
- what visually dominates the frame and what is subordinate
- key objects only, if essential, with their placement and condition
- lighting (source, direction, quality) and overall colour palette
- surface detail or texture where it contributes to the scene
- background treatment (minimal, blurred or lightly defined)
- negative space reserved for text overlay

Keep it grounded in a single moment in a single physical space.

Prefer concrete, visual language over abstraction. Let emotion read through bodies, materials and light, not explanation.

Exclude non-essential elements. Avoid cliché or stock imagery. Do not split into multiple moments or locations.

IMPORTANT: Provide a fully specified description. Do not optimise for brevity. Include all visually relevant details needed to render the scene faithfully.

## OUTPUT FORMAT (STRICT)

Return ONLY valid JSON. No explanation, no comments, no trailing text.

Use exactly this structure:

{{
    "excerpt": "<string>",
    "description": "<string>",
    "alt_text": "<string>",
    "is_adult": <boolean>
}}

## INPUT

POEM TITLE:
{title}

POEM BODY:
{body}
"""

GENERATE_IMAGE = """\
Create a single {image_size} square image.

DETAILED DESCRIPTION
{description}

---

## OUTPUT FORMAT (STRICT)
- Return only the generated image.
"""
