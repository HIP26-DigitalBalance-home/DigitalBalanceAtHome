import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, StyleProp, StyleSheet, View, ImageStyle } from 'react-native';

import { photosApi } from '@/lib/api/completions';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';

interface ImageWithFallbackProps {
  uri: string;
  completionId: string;
  style?: StyleProp<ImageStyle>;
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'center';
  accessibilityLabel?: string;
  onPermanentError?: () => void;
}

export function ImageWithFallback({
  uri: initialUri,
  completionId,
  style,
  resizeMode = 'cover',
  accessibilityLabel,
  onPermanentError,
}: ImageWithFallbackProps) {
  const [currentUri, setCurrentUri] = useState(initialUri);
  const [refreshing, setRefreshing] = useState(false);
  const [failed, setFailed] = useState(false);
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  // Sync when uri prop changes externally
  useEffect(() => {
    setCurrentUri(initialUri);
    setFailed(false);
  }, [initialUri]);

  async function handleError() {
    if (refreshing || failed) return;
    let cancelled = false;
    setRefreshing(true);
    try {
      const res = await photosApi.getUrl(completionId);
      if (!cancelled) {
        setCurrentUri(res.data.url);
        setFailed(false);
      }
    } catch {
      if (!cancelled) {
        setFailed(true);
        onPermanentError?.();
      }
    } finally {
      if (!cancelled) setRefreshing(false);
    }
    return () => { cancelled = true; };
  }

  if (refreshing) {
    return (
      <View style={[styles.placeholder, style, { backgroundColor: colors.border }]}>
        <ActivityIndicator color={colors.muted} />
      </View>
    );
  }

  return (
    <Image
      source={{ uri: currentUri }}
      style={style}
      resizeMode={resizeMode}
      accessibilityLabel={accessibilityLabel}
      onError={handleError}
    />
  );
}

const styles = StyleSheet.create({
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
