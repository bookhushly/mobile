---
paths:
  - "src/shared/theme/**"
  - "src/shared/ui/**"
  - "src/shared/ui/**"
  - "src/features/**/screens/**"
  - "src/features/**/components/**"
---
# Design system (docs/DESIGN_SYSTEM.md)

- Screens consume **semantic theme roles** and `src/shared/ui` primitives only: never the raw palette, hex, numeric spacing/radius/font size, or `fontWeight`. Spacing from the `s1…s11` scale; radius `r1…r4`; type from the named variants.
- 70/20/10: ~70 % neutral surface, ~20 % ink/structure, ~10 % violet. Neutrals are plain greys, never brand-tinted; links are ink and underlined. Violet only for the single primary action, active/selected state, progress, focus ring — never decoration, large fills or status. Red = error/destructive only.
- Small violet text uses `#6D28D9`-level contrast (7.1:1); never violet-500 or muted `#9E98BB` for text. Inputs get 3:1 borders (`lineStrong`).
- Density: `customer` / `work` (receptionist) / `gate` — gate controls ≥56 pt, ≥16 apart, lower third.
- Money via `Money` (₦, tabular, integer amounts). Numbers that change (timers, counts) use tabular figures.
- Hanken Grotesk everywhere, no serif; onboarding headlines 500 at about −2.5% (larger display 600); buttons pill-shaped with 600 labels (compare stroke thickness across fonts, not weight numbers); weights by family name.
- States: skeletons mirror layout and appear after 150 ms; empty = icon + reason + one action; errors say what happened, whether money/data is safe, and the next step.
- Gate outcomes: full-screen solid dark-stop fill + large icon + word (+ haptic/audio); "Couldn't check" is neutral, never red. Copy: sentence case, verb-first, no exclamation marks/blame/jokes.
- Design references (Mobbin): follow DESIGN_SYSTEM §9 "How references are chosen". Use Tier 1 apps (Airbnb, Nike, Apple, Mindtrip, Luma, Hyatt) first and Tier 2 category leaders for domain patterns; anything else needs a stated reason. Open every screenshot before citing it; current designs only; no dark patterns. Report Tier 1 examples before counts and flag where they disagree. If Mobbin has nothing good, say so.
- Check the open decisions table (§11) before assuming a value is final; keep values behind tokens.
- Icons (DESIGN_SYSTEM §6 rules): lucide outline only; ink, never violet (except the selected tick/primary action); no disc or tile behind an informational icon (a circle means a button); size follows the text beside it (24 body rows, 20 small text/buttons, 16 captions); always beside words or an accessibility label.
