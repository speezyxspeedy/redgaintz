# TERRASCAN design system: "Aurora Observatory"
Direction chosen with the ui-ux-pro-max skill (design-system, chart and ux searches), adapted to a dark data product.

- Surfaces: `--bg-0 #040714`, cards `rgba(16,24,56,.62)` with blur, hairline `rgba(148,163,255,.16)`.
- Text: `#eef2ff` / `#bcc6e6` / `#8d99c2` (all >= 4.5:1 on cards).
- Brand aurora: cyan `#22d3ee` > violet `#8b5cf6` > pink `#f472b6`.
- Per-variable accent pairs live in `frontend/src/theme.ts` (rain sky/indigo, temperature orange/rose, humidity teal, wind violet, sunshine amber).
- Above/below average bars: amber `#f59e0b` vs indigo `#818cf8` (colour-blind safe, also labelled with arrows and text).
- Type: Space Grotesk (display), Fira Sans (body), Fira Code (data).
- Rules: colour never carries meaning alone; charts have units, axis titles, direct labels, keyboard (arrow keys) and hover; 44px touch targets; mobile bottom tab bar; `prefers-reduced-motion` respected.
