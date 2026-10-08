import Svg, { Circle, Path } from 'react-native-svg';

import { color } from '@/shared/theme';

export type IllustrationName = 'camera' | 'noEvents' | 'offline' | 'search';

// Rounded rectangle as a path (react-native-svg marks Rect's x/y as deprecated transform aliases).
function roundedRect(x: number, y: number, w: number, h: number, r: number): string {
  const n = String;
  const arc = `a${n(r)} ${n(r)} 0 0 1 `;
  return (
    `M${n(x + r)} ${n(y)}h${n(w - 2 * r)}${arc}${n(r)} ${n(r)}v${n(h - 2 * r)}` +
    `${arc}${n(-r)} ${n(r)}h${n(-(w - 2 * r))}${arc}${n(-r)} ${n(-r)}v${n(-(h - 2 * r))}` +
    `${arc}${n(r)} ${n(-r)}z`
  );
}

// Flat scenes in violet / ink / wash only. Same name + size API a commissioned Lottie file will
// slot into later (MOTION M6). Decorative: hidden from screen readers.
export function Illustration({ name, size = 160 }: { name: IllustrationName; size?: number }) {
  const ink = color.textPrimary;
  const violet = color.actionFill;
  const wash = color.selectedWash;
  return (
    <Svg
      testID={`illustration-${name}`}
      width={size}
      height={size}
      viewBox="0 0 160 160"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Circle cx={80} cy={80} r={72} fill={wash} />
      {name === 'camera' ? (
        <>
          <Path
            d={roundedRect(36, 56, 88, 60, 12)}
            fill={color.surface}
            stroke={ink}
            strokeWidth={3}
          />
          <Path d={roundedRect(60, 46, 40, 14, 4)} fill={ink} />
          <Circle cx={80} cy={86} r={18} fill={wash} stroke={violet} strokeWidth={4} />
          <Circle cx={80} cy={86} r={7} fill={violet} />
        </>
      ) : null}
      {name === 'noEvents' ? (
        <>
          <Path
            d={roundedRect(42, 44, 76, 76, 10)}
            fill={color.surface}
            stroke={ink}
            strokeWidth={3}
          />
          <Path d={roundedRect(42, 44, 76, 18, 9)} fill={violet} />
          <Path d="M62 90h36M62 104h22" stroke={ink} strokeWidth={4} strokeLinecap="round" />
        </>
      ) : null}
      {name === 'offline' ? (
        <>
          <Path
            d="M40 74a56 56 0 0 1 80 0M52 88a38 38 0 0 1 56 0M66 102a18 18 0 0 1 28 0"
            stroke={ink}
            strokeWidth={5}
            strokeLinecap="round"
            fill="none"
          />
          <Circle cx={80} cy={116} r={6} fill={violet} />
          <Path d="M46 46l68 68" stroke={violet} strokeWidth={5} strokeLinecap="round" />
        </>
      ) : null}
      {name === 'search' ? (
        <>
          <Circle cx={72} cy={72} r={26} fill={color.surface} stroke={ink} strokeWidth={5} />
          <Path d="M92 92l22 22" stroke={violet} strokeWidth={8} strokeLinecap="round" />
        </>
      ) : null}
    </Svg>
  );
}
