---
paths:
  - "src/theme/**"
  - "src/ui/**"
  - "src/components/**"
  - "src/features/**/screens/**"
  - "src/features/**/components/**"
---
# Design system (docs/DESIGN_SYSTEM.md)

- Screens consume **semantic theme roles** and `src/ui` primitives only: never the raw palette, hex, numeric spacing/radius/font size, or `fontWeight`. Spacing from the `s1…s11` scale; radius `r1…r4`; type from the named variants.
- 70/20/10: ~70 % neutral surface, ~20 % ink/structure, ~10 % violet. Violet only for the single primary action, links, active/selected state, progress, focus ring — never decoration, large fills or status. Red = error/destructive only.
- Small violet text uses `#6D28D9`-level contrast (7.1:1); never violet-500 or muted `#9E98BB` for text. Inputs get 3:1 borders (`lineStrong`).
- Density: `customer` / `work` (receptionist) / `gate` — gate controls ≥56 pt, ≥16 apart, lower third.
- Money via `Money` (₦, tabular, integer amounts). Numbers that change (timers, counts) use tabular figures.
- Source Serif 4 only for display ≥32 px; Radio-Canada everywhere else; weights by family name.
- States: skeletons mirror layout and appear after 150 ms; empty = icon + reason + one action; errors say what happened, whether money/data is safe, and the next step.
- Gate outcomes: full-screen solid dark-stop fill + large icon + word (+ haptic/audio); "Couldn't check" is neutral, never red. Copy: sentence case, verb-first, no exclamation marks/blame/jokes.
- Check the open decisions table (§11) before assuming a value is final; keep values behind tokens.
