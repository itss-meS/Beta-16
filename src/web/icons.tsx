import type { CSSProperties } from 'react';

const symbols: Record<string, string> = {
  'arrow-down-outline': '↓',
  'arrow-forward': '→',
  'arrow-up-outline': '↑',
  'arrow-up-right': '↗',
  'cash-outline': '$',
  'checkmark-circle': '✓',
  'ellipsis-horizontal': '⋯',
  'home-outline': '⌂',
  'information-circle-outline': 'i',
  'receipt-outline': '▤',
  'search': '⌕',
  'sparkles': '✦',
  'trending-up': '↗',
  'alert-circle': '!',
  'bag-outline': '□',
  'calculator-outline': '▦',
  'chatbubble-ellipses-outline': '◌',
  'flash-outline': 'ϟ',
  'medkit-outline': '+',
  'pie-chart-outline': '◔',
  'restaurant-outline': '⌁',
  'shield-checkmark-outline': '✓',
  'swap-horizontal-outline': '↔',
  'car-outline': '▱',
};

export function Ionicons({
  name,
  size = 20,
  color = 'currentColor',
  style,
}: {
  name: string;
  size?: number;
  color?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      aria-hidden="true"
      style={{
        color,
        fontSize: size,
        lineHeight: 1,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...style,
      }}
    >
      {symbols[name] ?? '•'}
    </span>
  );
}
