import type { ThemeConfig } from 'antd';
import type { Urgency } from './types';

// One place for the app's visual identity. Deep teal primary (calm,
// health-adjacent — the customers are dental practices), warm-neutral ground.
// Urgency colors stay conventional (red = urgent): triage semantics are not
// the place for a clever palette.
export const colors = {
  primary: '#0e7a6f',
  ink: '#20242a',
  ground: '#f6f7f4',
  headerBg: '#122a27',
};

export const urgencyAccent: Record<Urgency, string> = {
  high: '#d4380e',
  medium: '#d48806',
  low: '#0e7a6f',
  none: '#c8ccc9',
};

export const themeConfig: ThemeConfig = {
  token: {
    colorPrimary: colors.primary,
    colorInfo: colors.primary,
    colorText: colors.ink,
    borderRadius: 7,
    fontSize: 14,
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif',
    colorBorder: '#e1e7df',
    controlHeight: 36,
  },
  components: {
    Layout: {
      headerBg: colors.headerBg,
      bodyBg: colors.ground,
    },
    Card: {
      boxShadowTertiary: '0 1px 2px rgba(32, 36, 42, 0.05)',
    },
  },
};
