// Performance monitoring utilities

export interface PerformanceMetrics {
  FCP: number | null;  // First Contentful Paint
  LCP: number | null;  // Largest Contentful Paint
  FID: number | null;  // First Input Delay
  CLS: number | null;  // Cumulative Layout Shift
  TTFB: number | null; // Time to First Byte
  TTI: number | null;  // Time to Interactive
}

// Web Vitals monitoring
export function initWebVitals(callback?: (_metric: any) => void) {
  if (typeof window === 'undefined') return;

  // Dynamically import web-vitals to avoid SSR issues
  import('web-vitals').then(({ onCLS, onINP, onFCP, onLCP, onTTFB }) => {
    onCLS((metric) => {
      console.log('CLS:', metric.value);
      if (callback) callback(metric);
    });

    onINP((metric) => {
      console.log('INP:', metric.value);
      if (callback) callback(metric);
    });

    onFCP((metric) => {
      console.log('FCP:', metric.value);
      if (callback) callback(metric);
    });

    onLCP((metric) => {
      console.log('LCP:', metric.value);
      if (callback) callback(metric);
    });

    onTTFB((metric) => {
      console.log('TTFB:', metric.value);
      if (callback) callback(metric);
    });
  });
}

// Resource hints for critical resources
export function addResourceHints() {
  if (typeof window === 'undefined') return;

  const head = document.head;

  // Preconnect to external domains
  const preconnectDomains = [
    'https://fonts.googleapis.com',
    'https://fonts.gstatic.com',
    'https://images.unsplash.com',
  ];

  preconnectDomains.forEach((domain) => {
    const link = document.createElement('link');
    link.rel = 'preconnect';
    link.href = domain;
    head.appendChild(link);
  });

  // DNS prefetch for additional domains
  const dnsPrefetchDomains = [
    'https://www.googletagmanager.com',
    'https://www.google-analytics.com',
  ];

  dnsPrefetchDomains.forEach((domain) => {
    const link = document.createElement('link');
    link.rel = 'dns-prefetch';
    link.href = domain;
    head.appendChild(link);
  });
}

// Lazy load images with native loading attribute
export function setupLazyImages() {
  if ('loading' in HTMLImageElement.prototype) {
    const images = document.querySelectorAll('img[data-src]');
    images.forEach((img) => {
      const imgElement = img as HTMLImageElement;
      if (imgElement.dataset.src) {
        imgElement.src = imgElement.dataset.src;
        imgElement.removeAttribute('data-src');
      }
    });
  } else {
    // Fallback for browsers that don't support native lazy loading
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/lazysizes/5.3.2/lazysizes.min.js';
    document.body.appendChild(script);
  }
}

// Prefetch critical pages
export function prefetchCriticalPages() {
  if (typeof window === 'undefined') return;

  const criticalPages = ['/booking', '/services', '/contact'];

  if ('prefetch' in HTMLLinkElement.prototype) {
    criticalPages.forEach((page) => {
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.href = page;
      document.head.appendChild(link);
    });
  }
}

// Monitor and report long tasks
export function monitorLongTasks(threshold = 50) {
  if (typeof window === 'undefined' || !('PerformanceObserver' in window)) return;

  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.duration > threshold) {
          console.warn(`Long task detected: ${entry.duration}ms`, entry);
          // You can send this to your analytics service
        }
      }
    });

    observer.observe({ entryTypes: ['longtask'] });
  } catch (e) {
    console.error('Long task monitoring not supported');
  }
}

// Get current performance metrics
export function getCurrentMetrics(): PerformanceMetrics {
  if (typeof window === 'undefined' || !window.performance) {
    return {
      FCP: null,
      LCP: null,
      FID: null,
      CLS: null,
      TTFB: null,
      TTI: null,
    };
  }

  const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;

  return {
    FCP: null, // Will be set by web-vitals
    LCP: null, // Will be set by web-vitals
    FID: null, // Will be set by web-vitals
    CLS: null, // Will be set by web-vitals
    TTFB: navigation ? navigation.responseStart - navigation.requestStart : null,
    TTI: navigation ? navigation.loadEventEnd - navigation.fetchStart : null,
  };
}

// Initialize all performance optimizations
export function initPerformanceOptimizations() {
  if (typeof window === 'undefined') return;

  // Run immediately
  addResourceHints();
  setupLazyImages();

  // Run after page load
  if (document.readyState === 'complete') {
    prefetchCriticalPages();
    monitorLongTasks();
  } else {
    window.addEventListener('load', () => {
      prefetchCriticalPages();
      monitorLongTasks();
    });
  }

  // Initialize web vitals monitoring
  initWebVitals();
}