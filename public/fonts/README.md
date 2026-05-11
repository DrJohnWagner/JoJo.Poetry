# Glyph Font Drop-In

Place your custom glyph webfont file here as:

- `JoJoGlyph-Regular.woff2`
- `JoJoGlyph-Alt.woff2` (optional, preferred first)

The app loads these families via `@font-face` in `app/globals.css`:

- `JoJo Glyph` (regular)
- `JoJo Glyph Alt` (optional alternate)

The glyph stack prefers `JoJo Glyph Alt` first, then falls back to `JoJo Glyph`, then CJK/system families. Analytics glyph traces and the HTML legend use the same stack.

If the file is missing, the charts fall back to CJK/system families in the glyph font stack.
