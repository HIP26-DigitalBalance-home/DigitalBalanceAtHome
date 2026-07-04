import { Tabs } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Easing } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { HapticTab } from '@/components/haptic-tab';
import { AnimatedTabBar } from '@/components/ui/animated-tab-bar';
import { Glyph } from '@/components/ui/illustration';
import { TabBarBackground } from '@/components/ui/tab-bar-background';
import { Durations } from '@/constants/motion';
import { useAppTheme } from '@/lib/app-theme-context';

export default function TabLayout() {
  const { colors } = useAppTheme();
  const { t } = useTranslation();
  // Tab transitions run through RN Animated (not reanimated), so the
  // ReduceMotion.System config from constants/motion doesn't apply — gate on
  // the OS setting explicitly instead.
  const reducedMotion = useReducedMotion();

  return (
    <Tabs
      // AnimatedTabBar owns the pill's absolute position and the hide/show
      // slide (it reads `hidden` from TabBarContext); tabBarStyle below keeps
      // only the visual styling.
      tabBar={(props) => <AnimatedTabBar {...props} />}
      screenOptions={{
        // Crossfade with a slight directional shift between tabs, timed to
        // match the stack/content fades so tab switches stop being hard cuts.
        animation: reducedMotion ? 'none' : 'shift',
        transitionSpec: {
          animation: 'timing',
          // RN Animated equivalent of Easings.standard (reanimated type
          // doesn't fit here).
          config: { duration: Durations.base, easing: Easing.bezier(0.2, 0, 0, 1) },
        },
        tabBarActiveTintColor: colors.tabIconSelected,
        tabBarInactiveTintColor: colors.tabIconDefault,
        tabBarBackground: () => <TabBarBackground />,
        tabBarItemStyle: {
          borderRadius: 999,
          marginVertical: 4,
          marginHorizontal: 4,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          marginTop: 2,
        },
        tabBarStyle: {
          height: 72,
          paddingTop: 6,
          paddingBottom: 6,
          paddingHorizontal: 8,
          borderRadius: 999,
          borderTopWidth: 0,
          backgroundColor: 'transparent',
          borderWidth: 0.5,
          borderColor: colors.border,
          overflow: 'hidden',
          shadowColor: '#1C1208',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.09,
          shadowRadius: 20,
          elevation: 8,
        },
        headerShown: false,
        tabBarButton: HapticTab,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.home'),
          tabBarIcon: ({ color }) => <Glyph size={26} name="tab-home" color={color} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: t('tabs.explore'),
          tabBarIcon: ({ color }) => <Glyph size={26} name="tab-explore" color={color} />,
        }}
      />
      <Tabs.Screen
        name="groups"
        options={{
          title: t('tabs.groups'),
          tabBarIcon: ({ color }) => <Glyph size={26} name="tab-groups" color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabs.profile'),
          tabBarIcon: ({ color }) => <Glyph size={26} name="tab-profile" color={color} />,
        }}
      />
    </Tabs>
  );
}
