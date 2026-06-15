import { StyleSheet, Text, type TextProps } from 'react-native';

import { useAppTheme } from '@/lib/app-theme-context';
import { useThemeColor } from '@/hooks/use-theme-color';

export type ThemedTextProps = TextProps & {
  lightColor?: string;
  darkColor?: string;
  type?: 'default' | 'title' | 'defaultSemiBold' | 'subtitle' | 'link';
};

export function ThemedText({
  style,
  lightColor,
  darkColor,
  type = 'default',
  ...rest
}: ThemedTextProps) {
  const color = useThemeColor({ light: lightColor, dark: darkColor }, 'text');
  const linkColor = useThemeColor({}, 'tint');
  const { theme } = useAppTheme();

  const bodyFontStyle = theme.bodyFont ? { fontFamily: theme.bodyFont } : undefined;

  return (
    <Text
      style={[
        { color },
        type === 'default' ? [styles.default, bodyFontStyle] : undefined,
        type === 'title' ? [styles.title, { fontFamily: theme.titleFont }] : undefined,
        type === 'defaultSemiBold' ? [styles.defaultSemiBold, bodyFontStyle] : undefined,
        type === 'subtitle' ? [styles.subtitle, { fontFamily: theme.titleFont }] : undefined,
        type === 'link' ? [styles.link, { color: linkColor }, bodyFontStyle] : undefined,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  default: {
    fontSize: 16,
    lineHeight: 24,
  },
  defaultSemiBold: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    lineHeight: 34,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  link: {
    lineHeight: 30,
    fontSize: 16,
  },
});
