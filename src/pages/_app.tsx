import type { AppProps } from 'next/app';
import Head from 'next/head';
import { siteConfig } from '../lib/siteConfig';
import { ToastProvider } from '../components/Toast';
import '../styles/animations.css';
import '../styles/globals.css';

export default function MyApp({ Component, pageProps }: AppProps) {
  const canonicalPath = typeof window !== 'undefined' ? window.location.pathname : '/';
  const canonicalUrl = siteConfig.siteUrl + (canonicalPath || '/');

  return (
    <ToastProvider>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <link rel="canonical" href={canonicalUrl} />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:site_name" content={siteConfig.name} />
      </Head>

      <Component {...pageProps} />
    </ToastProvider>
  );
}
