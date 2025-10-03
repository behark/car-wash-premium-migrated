import { Html, Head, Main, NextScript } from 'next/document';
import { siteConfig } from '../lib/siteConfig';

export default function Document() {
  return (
    <Html lang="fi">
      <Head>
        {/* Critical resource hints */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />

        {/* Optimize font loading with font-display: swap */}
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />

        {/* Preload critical fonts */}
        <link
          rel="preload"
          href="https://fonts.gstatic.com/s/inter/v12/UcC73FwrK3iLTeHuS_fvQtMwCp50KnMa1ZL7.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link rel="icon" href="/favicon.ico" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.svg" />
        <link rel="manifest" href="/manifest.json" />

        <meta name="description" content={siteConfig.tagline} />
        <meta name="keywords" content="autopesu, autohuolto, varaa aika, Helsinki, autopuhdistus, premium autopesu, ammattitaitoinen autohuolto" />

        {/* PWA Meta Tags */}
        <meta name="application-name" content="KiiltoLoisto Autopesu" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="KiiltoLoisto" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-config" content="/browserconfig.xml" />
        <meta name="msapplication-TileColor" content="#1976d2" />
        <meta name="msapplication-tap-highlight" content="no" />
        <meta name="theme-color" content="#1976d2" />

        {/* Optimized viewport for performance and PWA */}
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />

        {/* Open Graph */}
        <meta property="og:title" content={`${siteConfig.name} - ${siteConfig.tagline}`} />
        <meta property="og:description" content={siteConfig.tagline} />
        <meta property="og:type" content="website" />
        <meta property="og:image" content={`${siteConfig.siteUrl}/images/og-default.png`} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />

        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={`${siteConfig.name} - ${siteConfig.tagline}`} />
        <meta name="twitter:description" content={siteConfig.tagline} />
        <meta name="twitter:image" content={`${siteConfig.siteUrl}/images/og-default.png`} />

        {/* iOS Safari specific */}
        <meta name="apple-touch-fullscreen" content="yes" />
        <link rel="apple-touch-startup-image" href="/icons/icon-512x512.svg" />

        {/* Preload critical resources */}
        <link rel="preload" href="/icons/icon-192x192.svg" as="image" type="image/svg+xml" />
        <link rel="dns-prefetch" href="https://api.stripe.com" />
        <link rel="dns-prefetch" href="https://www.google.com" />

        {/* Inline critical CSS for above-the-fold content */}
        <style
          dangerouslySetInnerHTML={{
            __html: `
              /* Critical CSS for initial paint */
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body {
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                -webkit-font-smoothing: antialiased;
                -moz-osx-font-smoothing: grayscale;
              }
              .loading-skeleton {
                animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
              }
              @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: .5; }
              }
            `,
          }}
        />
      </Head>
      <body className="antialiased">
        <Main />
        <NextScript />

        {/* Performance monitoring script */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Report Web Vitals to console (or analytics)
              if (typeof window !== 'undefined' && 'web-vital' in window) {
                window.addEventListener('load', () => {
                  console.log('Page fully loaded');
                });
              }
            `,
          }}
        />
      </body>
    </Html>
  );
}