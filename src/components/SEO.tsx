import Head from 'next/head';
import { useRouter } from 'next/router';
import { siteConfig } from '../lib/siteConfig';

type SEOProps = {
  title?: string;
  description?: string;
  image?: string;
  noIndex?: boolean;
  jsonLd?: Record<string, any> | Record<string, any>[];
};

export function buildTitle(pageTitle?: string) {
  if (!pageTitle) return `${siteConfig.name} – ${siteConfig.tagline}`;
  return `${pageTitle} | ${siteConfig.shortName}`;
}

export default function SEO({ title, description, image, noIndex, jsonLd }: SEOProps) {
  const router = useRouter();
  const url = `${siteConfig.siteUrl.replace(/\/$/, '')}${router.asPath === '/' ? '' : router.asPath}`;
  const metaTitle = buildTitle(title);
  const metaDescription = description || siteConfig.tagline;
  const metaImage = image || siteConfig.heroImage;
  const jsonLdArray = Array.isArray(jsonLd) ? jsonLd : jsonLd ? [jsonLd] : [];

  return (
    <Head>
      <title>{metaTitle}</title>
      <meta name="description" content={metaDescription} />
      {noIndex && <meta name="robots" content="noindex,nofollow" />}
      <meta property="og:type" content="website" />
      <meta property="og:title" content={metaTitle} />
      <meta property="og:description" content={metaDescription} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={metaImage} />
      <meta property="og:site_name" content={siteConfig.name} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={metaTitle} />
      <meta name="twitter:description" content={metaDescription} />
      <meta name="twitter:image" content={metaImage} />
      <meta name="twitter:site" content={siteConfig.shortName} />
      {jsonLdArray.map((block, i) => (
        <script
          // eslint-disable-next-line react/no-danger
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(block) }}
        />
      ))}
    </Head>
  );
}
