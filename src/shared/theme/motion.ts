// MOTION.md §4. Durations in ms; easings as cubic-bezier control points.
export const motion = {
  duration: { instant: 0, fast: 100, base: 180, moderate: 300, slow: 500 },
  easing: {
    standard: [0.2, 0, 0, 1],
    decelerate: [0.05, 0.7, 0.1, 1],
    accelerate: [0.3, 0, 0.8, 0.15],
    linear: [0, 0, 1, 1],
  },
  spring: {
    press: { damping: 20, stiffness: 400, mass: 0.6, overshootClamping: true },
    sheet: { damping: 28, stiffness: 260, mass: 1, overshootClamping: true },
    playful: { damping: 14, stiffness: 180, mass: 1, overshootClamping: false },
  },
} as const;
export type MotionTier = 'full' | 'reduced' | 'none';
