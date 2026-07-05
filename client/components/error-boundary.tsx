import React, { Component, ErrorInfo, ReactNode } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EmptyState } from '@/components/ui/empty-state';
import { useAppTheme } from '@/lib/app-theme-context';
import i18n from '@/lib/i18n';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('ErrorBoundary');

// Standalone function component so the fallback can read theme colours via
// hooks — the class boundary itself can mount above every provider,
// including AppThemeProvider, so useAppTheme()'s context default carries it.
function ErrorFallback({ error, onRetry }: { error: Error | null; onRetry: () => void }) {
  const { colors } = useAppTheme();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <EmptyState
        illustration="error-mascot"
        title={i18n.t('errorBoundary.title')}
        body={error?.message || i18n.t('errorBoundary.message')}
        actionLabel={i18n.t('common.retry')}
        onAction={onRetry}
      />
    </SafeAreaView>
  );
}

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error Boundary component for catching and handling React errors gracefully.
 * Prevents the entire app from crashing when a component throws an error.
 *
 * @example
 * ```tsx
 * <ErrorBoundary>
 *   <YourComponent />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    logger.error('Uncaught error in component tree', { error, errorInfo });
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return <ErrorFallback error={this.state.error} onRetry={this.handleRetry} />;
    }

    return this.props.children;
  }
}
