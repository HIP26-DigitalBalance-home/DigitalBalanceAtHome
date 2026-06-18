import { BlurView } from 'expo-blur';
import { StyleSheet, View } from 'react-native';

import { useAppTheme } from '@/lib/app-theme-context';

export function TabBarBackground() {
  const { effectiveScheme, colors } = useAppTheme();
  return (
    <View style={StyleSheet.absoluteFillObject}>
      <BlurView
        tint={effectiveScheme === 'dark' ? 'dark' : 'light'}
        intensity={80}
        style={StyleSheet.absoluteFillObject}
      />
      {/* Semi-transparent theme wash so brand colour bleeds through the blur */}
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: colors.background + '55' }]} />
    </View>
  );
}
