import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        {/*
          viewport-fit=cover extends the layout under the notch/home indicator.
          SafeAreaView already handles the insets, so this is safe to enable.
        */}
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        {/*
          When the user adds to Home Screen, these tags make Safari launch the
          app in standalone mode (no address bar, no bottom toolbar).
        */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Bond" />
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
