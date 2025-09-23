import { Html, Head, Main, NextScript } from 'next/document';
import { siteConfig } from '../lib/siteConfig';

export default function Document() {
  return (
    <Html lang="fi">
      <Head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700;800;900&family=Source+Sans+Pro:wght@300;400;500;600;700;800&family=Montserrat:wght@300;400;500;600;700;800;900&family=Lato:wght@300;400;700;900&display=swap"
          rel="stylesheet"
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

        {/* Viewport for PWA */}
        <meta name="viewport" content="minimum-scale=1, initial-scale=1, width=device-width, shrink-to-fit=no, user-scalable=no, viewport-fit=cover" />

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
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}