import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, StyleProp, StyleSheet, View, ImageStyle } from 'react-native';

import { useAppTheme } from '@/lib/app-theme-context';
import { photosApi } from '@/lib/api/completions';

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
  // Tracks whether we've already tried refreshing the URL once. Prevents the
  // component from hammering GET /photos/{id}/url in a loop when the image
  // keeps failing (e.g. CORS, network issue, or missing S3 object).
  const [hasRefreshed, setHasRefreshed] = useState(false);
  const { colors, radii } = useAppTheme();

  // Sync when uri prop changes externally
  useEffect(() => {
    setCurrentUri(initialUri);
    setFailed(false);
    setHasRefreshed(false);
  }, [initialUri]);

  async function handleError() {
    if (refreshing || failed || hasRefreshed) return;
    setHasRefreshed(true);
    setRefreshing(true);
    try {
      const res = await photosApi.getUrl(completionId);
      setCurrentUri(res.data.url);
    } catch {
      setFailed(true);
      onPermanentError?.();
    } finally {
      setRefreshing(false);
    }
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
