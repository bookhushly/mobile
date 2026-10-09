import Svg, { Circle, Path } from 'react-native-svg';

import { color } from '@/shared/theme';

export type IllustrationName =
  | 'camera'
  | 'noEvents'
  | 'offline'
  | 'search'
  | 'welcome'
  | 'find'
  | 'pay'
  | 'showUp';

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

// Map pin with its tip at (x, tipY).
function pin(x: number, tipY: number): string {
  const n = String;
  return `M${n(x)} ${n(tipY)}l-7 -11a8 8 0 1 1 14 0z`;
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
      {name === 'welcome' ? (
        <>
          <Path
            d={roundedRect(38, 40, 60, 80, 8)}
            fill={color.surface}
            stroke={ink}
            strokeWidth={3}
          />
          <Path
            d={[
              roundedRect(48, 52, 12, 12, 2),
              roundedRect(66, 52, 12, 12, 2),
              roundedRect(84, 52, 12, 12, 2),
              roundedRect(48, 72, 12, 12, 2),
              roundedRect(66, 72, 12, 12, 2),
              roundedRect(84, 72, 12, 12, 2),
            ].join('')}
            fill={ink}
          />
          <Path
            d={roundedRect(72, 88, 56, 34, 6)}
            fill={color.surface}
            stroke={ink}
            strokeWidth={3}
          />
          <Circle cx={72} cy={105} r={6} fill={violet} />
          <Path d="M88 99h30M88 111h18" stroke={ink} strokeWidth={3} strokeLinecap="round" />
        </>
      ) : null}
      {name === 'find' ? (
        <>
          <Path d={pin(54, 112)} fill={ink} />
          <Path d={pin(80, 122)} fill={violet} />
          <Path d={pin(106, 112)} fill={ink} />
          <Circle cx={74} cy={66} r={24} fill={color.surface} stroke={ink} strokeWidth={5} />
          <Path d="M92 84l20 20" stroke={ink} strokeWidth={8} strokeLinecap="round" />
        </>
      ) : null}
      {name === 'pay' ? (
        <>
          <Path
            d={roundedRect(32, 50, 96, 62, 10)}
            fill={color.surface}
            stroke={ink}
            strokeWidth={3}
          />
          <Path d="M32 62h96v10H32z" fill={ink} />
          <Path
            d="M64 82v22M80 82v22M64 82l16 22M58 90h28M58 97h28"
            stroke={ink}
            strokeWidth={3}
            strokeLinecap="round"
            fill="none"
          />
          <Circle cx={116} cy={108} r={13} fill={violet} />
          <Path
            d="M110 108l4 4l8 -8"
            stroke={color.surface}
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </>
      ) : null}
      {name === 'showUp' ? (
        <>
          <Path
            d={roundedRect(54, 30, 52, 100, 10)}
            fill={color.surface}
            stroke={ink}
            strokeWidth={3}
          />
          <Path d={roundedRect(72, 38, 16, 4, 2)} fill={ink} />
          <Path
            d={[0, 1, 2]
              .flatMap((r) => [0, 1, 2].map((c) => roundedRect(62 + c * 13, 56 + r * 13, 10, 10, 2)))
              .join('')}
            fill={ink}
          />
          <Circle cx={106} cy={118} r={13} fill={violet} />
          <Path
            d="M100 118l4 4l8 -8"
            stroke={color.surface}
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </>
      ) : null}
    </Svg>
  );
}
