---
paths:
  - "src/shared/ui/motion/**"
  - "src/**/*animation*"
  - "src/**/*motion*"
  - "src/features/**/animations/**"
  - "assets/animations/**"
---
# Motion (docs/MOTION.md)

- Animate **only `transform` and `opacity`** with Reanimated worklets. Never width/height/top/left/margin/padding, never per-frame `setState`, never read shared values on the JS thread in hot paths.
- Durations/easings/springs come from the motion tokens (`instant 0 · fast 100 · base 150–200 · moderate 300 · slow 500`), not literals.
- **Every animation reads `useMotionTier()`** (`full | reduced | none`): `none` under OS Reduce Motion, `reduced` under Low Power Mode / low-end device. Receptionist defaults to `reduced`; gate is minimal.
- Budget: ≤100 simultaneous animated components, ≤1 Lottie view (2 max in customer mode), Lottie JSON ≤50 KB / `.lottie` ≤30 KB, 512 px comp, 30 fps, ≤3 s one-shot; loops capped ≤5 s and paused when unfocused/backgrounded.
- Lottie: no masks/mattes/merge paths/blur/expressions/rasters; benchmark `renderMode` SOFTWARE vs HARDWARE on a low-end Android; assets live only in `assets/animations/`; drive `progress` from a shared value; install pin via `npx expo install lottie-react-native` (7.3.8). `.lottie` support is unverified — test on device first.
- **Never animate or use Lottie for the gate scan outcome** (appears <100 ms: static colour + icon). No looping animation while the scanner is idle. Haptics are unreliable on iOS while the camera is active — audio + colour + icon carry the result.
- Must not animate: scan counters, error/validation text, list rows during scroll. Stagger ≤6 items, first mount only.
- An animation PR states which device profile it was measured on; release builds only.
