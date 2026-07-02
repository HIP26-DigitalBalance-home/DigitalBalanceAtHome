import { Tabs } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HapticTab } from '@/components/haptic-tab';
import { Glyph } from '@/components/ui/illustration';
import { TabBarBackground } from '@/components/ui/tab-bar-background';
import { useAppTheme } from '@/lib/app-theme-context';
import { useTabBar } from '@/lib/tab-bar-context';

export default function TabLayout() {
  const { colors } = useAppTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { hidden } = useTabBar();

  return (
    <Tabs
      screenOptions={{
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
        tabBarStyle: hidden ? { display: 'none' } : {
          position: 'absolute',
          left: 16,
          right: 16,
          bottom: insets.bottom > 0 ? insets.bottom : 16,
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
