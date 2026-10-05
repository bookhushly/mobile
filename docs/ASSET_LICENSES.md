# Animation asset licences

Shortlist researched 2026-10-04 (decision M6, `docs/MOTION.md`). **No asset may ship until the owner approves it here.** Asset spec: vector only, JSON ≤50 KB, no expressions / merge paths / blur / heavy mattes, ≤3 s one-shot, recolourable. Assets live only in `assets/animations/`.

**Decision (2026-10-04):** v1 does not depend on any third-party animation file. Success tick, onboarding and empty states are code-built (SVG + Reanimated); bespoke Lottie assets are commissioned later and registered in §5 before being installed. Nothing in §2 is approved or in use.

## Blocker: LottieFiles, IconScout and Lordicon are unverified

Every fetch to LottieFiles, IconScout and `lottie.host` returned 403 behind a Cloudflare challenge (WebFetch and curl), so the licence page could not be read first-hand and no listing could be browsed or downloaded. No asset from those sources is recommended until someone with a browser checks it (checklist in §4).

## 1. Licences

| Source | Status | Commercial app use | Attribution | Modify / recolour | Notes |
|---|---|---|---|---|---|
| **LottieFiles Simple License** | **UNVERIFIED first-hand** (secondary summaries only: [help](https://help.lottiefiles.com/animation-licensing-basics-), [Qt](https://doc.qt.io/qt-6.10/qtlottieanimation-attribution-user-interface.html)) | Yes, per summary | Not required, "encouraged" | Yes; derivatives keep the same licence | Forbids using files to build a competing asset library — not an app. Read the licence page in a browser before use. |
| **Storyset (Freepik)** — [Terms §6](https://storyset.com/terms) | **Verified** | Yes | **Required** on the free tier (credit-free needs Flaticon Premium at download time) | Yes | No library/archive redistribution or resale; embedding in an app is the normal use but have counsel confirm; no implied endorsement. |
| **useAnimations** — [LICENSE](https://raw.githubusercontent.com/useAnimations/react-useanimations/master/LICENSE) | **Verified, but ambiguous** | Yes ("web and mobile applications") | **Required**: credit/link useanimations.com | Yes | The file also forbids sharing the file with third parties and "app templates"; the GitHub API says `NOASSERTION` and one snippet claims MIT. Treat the stricter reading as binding; get the author's written confirmation, or avoid. |
| Google Noto animated emoji | UNVERIFIED (secondary source says CC BY 4.0; repo licence is OFL for fonts) | – | – | – | Don't use. |

## 2. Verified candidates (downloaded from the useAnimations repo and inspected)

All: no raster images, no mattes/effects, shapes black (recolour by editing RGB), 32×32 viewBox (vector scales). "Expressions" flagged by a naive scan are false positives (easing handles are also `x`).

| Slot | Asset | Size | fps / length | Verdict |
|---|---|---|---|---|
| Success | `checkmark` ([json](https://raw.githubusercontent.com/useAnimations/react-useanimations/master/src/lib/checkmark/checkmark.json)) | 1.4 KB | 30 fps, 1.5 s | **Best verified option.** Bare tick — wrap it in a Reanimated disc/ring + haptic to feel premium. Needs the licence ambiguity resolved. |
| Pending (optional) | `loading3`, `loading` | 4.9 / 6.1 KB | 24 fps 2 s / 30 fps 5 s | Don't ship — the Reanimated spinner is better and `loading` is at the 5 s cap. |
| Saved toggle | `bookmark`, `heart` | 2.6 / 3.1 KB | 0.33 s | Fine for a save-button tap; not empty-state art. |
| Offline accent | `alertCircle` | 3.7 KB | 1.5 s | Small status accent only. |
| — | `notification`, `notification2`, `error` | — | — | **Rejected:** merge path / string expression. |

## 3. Per slot

| Slot | Result |
|---|---|
| Booking / payment success | Workable now: `checkmark` + Reanimated ring + haptic. If the author won't confirm the licence, draw the tick with `react-native-svg` + Reanimated `strokeDashoffset` (same look, no licence risk). |
| **Onboarding ×3** (discover · book & pay securely · tickets that work offline) | **No verified asset.** Storyset is a legal fit if credited but needs hand-picking, and most of its art is flat multi-colour/cartoonish — at odds with "premium, restrained". |
| **Empty states ×5** (no bookings · no saved · no results · no notifications · offline) | **No verified asset.** Same caveat. |
| Payment pending | Reanimated spinner; no Lottie. |

**Recommendation:** commission 3–5 bespoke brand-violet/ink vector Lottie files (onboarding ×3 + 2–3 empty-state scenes; reuse the style for the rest), built to the spec above. Stopgap while that is in progress: static SVG art with simple Reanimated entrance motion, so onboarding isn't blocked.

## 4. Hand-verification checklist (for anyone with a browser)

For each LottieFiles / Storyset candidate:
1. The page shows the "Lottie Simple License" / "Free" label (screenshot or note it here).
2. Download the JSON, then confirm: `assets` empty or no entries with `p`/`u`; size ≤50 KB; no string-typed `x` expressions; no `tt` mattes; no `ef` effects; no `ty:"mm"` merge paths; `(op−ip)/fr` ≤3 s.
3. Count colour fills — many colours means painful recolouring.
4. Storyset: record the exact credit line required.

## 5. Approved assets register

| Asset | Source | Licence | Attribution line (shown in app → About/Licences) | Approved by / date |
|---|---|---|---|---|
| _none yet_ | | | | |
