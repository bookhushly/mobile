---
paths:
  - "src/shared/ui/**"
  - "src/features/**/components/**"
  - "src/features/**/screens/**"
---
# Components and UI

- Light UI only. Colours/spacing/radii/type come from theme tokens through shared primitives (`Text`, `Button`, `Screen`) — no raw hex or magic numbers. Fonts: Radio-Canada (UI), Source Serif 4 (display); min 12 px, sentence case, semibold headings.
- React Compiler is on: write plain React. No `useMemo`/`useCallback`/`memo` by default; add only for effect-dependency stability or a profiler-proven skip, with a comment. Don't mutate props/state/refs in render. No `useEffect` for derived state or data fetching.
- Lists: virtualised (FlashList v2 / FlatList), never `ScrollView` + `.map()` for long data. Stable `keyExtractor`, no `key` on FlashList item roots, `getItemType` for mixed rows, `recyclingKey` on images.
- Images: `expo-image` with explicit size, `contentFit`, placeholder; request resized variants.
- Animate `transform`/`opacity` with Reanimated worklets only; never width/height/top/left/margin/padding; no JS-thread animation.
- Accessibility: every pressable has role + label + state; touch targets ≥ 44pt; outcomes use colour + icon + text + haptic; respect Dynamic Type and reduced motion.
- One component per file, named exports, ≲200 lines; container hook + presentational view. Accept `style` and `testID`.
- All user-visible strings go through i18n; money via the central NGN formatter.
