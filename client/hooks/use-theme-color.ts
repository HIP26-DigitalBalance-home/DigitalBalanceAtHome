import { useAppTheme } from '@/lib/app-theme-context';
import type { ThemeColors } from '@/constants/themes';

export function useThemeColor(
  props: { light?: string; dark?: string },
  colorName: keyof ThemeColors
) {
  const { theme, effectiveScheme } = useAppTheme();

  const colorFromProps = props[effectiveScheme];
  if (colorFromProps) return colorFromProps;

  return theme.colors[effectiveScheme][colorName];
}
