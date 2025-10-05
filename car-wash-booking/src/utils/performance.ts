// Performance monitoring and optimization utilities

export interface PerformanceMetrics {
  FCP: number | null;  // First Contentful Paint
  LCP: number | null;  // Largest Contentful Paint
  FID: number | null;  // First Input Delay
  CLS: number | null;  // Cumulative Layout Shift
  TTFB: number | null; // Time to First Byte
  TTI: number | null;  // Time to Interactive
  INP: number | null;  // Interaction to Next Paint
}

interface WebVitalMetric {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta: number;
  id: string;
  entries: any[];
}

// Store for performance metrics
const performanceStore: { [key: string]: number } = {};

// Web Vitals monitoring with enhanced tracking
export function initWebVitals(callback?: (metric: WebVitalMetric) => void) {
  if (typeof window === 'undefined') return;

  // Dynamically import web-vitals to avoid SSR issues
  import('web-vitals').then(({ onCLS, onINP, onFCP, onLCP, onTTFB }) => {
    const sendToAnalytics = (metric: WebVitalMetric) => {
      // Store metrics
      performanceStore[metric.name] = metric.value;

      // Log in development
      if (process.env.NODE_ENV === 'development') {
        console.log(`[Web Vitals] ${metric.name}:`, metric.value.toFixed(2), metric.rating);
      }

      // Send to analytics if configured
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('event', metric.name, {
          value: Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value),
          metric_rating: metric.rating,
          metric_delta: metric.delta,
          non_interaction: true,
        });
      }

      // Store in localStorage for dashboard
      storeMetricInLocalStorage(metric);

      // Call custom callback if provided
      if (callback) callback(metric);
    };

    onCLS(sendToAnalytics);
    onINP(sendToAnalytics);
    onFCP(sendToAnalytics);
    onLCP(sendToAnalytics);
    onTTFB(sendToAnalytics);
  });
}

// Store metrics in localStorage for dashboard
function storeMetricInLocalStorage(metric: WebVitalMetric) {
  try {
    const vitals = JSON.parse(localStorage.getItem('webVitals') || '[]');
    vitals.push({
      name: metric.name,
      value: metric.value,
      rating: metric.rating,
      timestamp: Date.now(),
      page: window.location.pathname,
    });

    // Keep only last 100 entries
    if (vitals.length > 100) {
      vitals.splice(0, vitals.length - 100);
    }

    localStorage.setItem('webVitals', JSON.stringify(vitals));
  } catch (e) {
    // Handle localStorage errors silently
  }
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
    'https://js.stripe.com',
  ];

  preconnectDomains.forEach((domain) => {
    if (!document.querySelector(`link[rel="preconnect"][href="${domain}"]`)) {
      const link = document.createElement('link');
      link.rel = 'preconnect';
      link.href = domain;
      link.crossOrigin = 'anonymous';
      head.appendChild(link);
    }
  });

  // DNS prefetch for additional domains
  const dnsPrefetchDomains = [
    'https://checkout.stripe.com',
    'https://api.stripe.com',
  ];

  dnsPrefetchDomains.forEach((domain) => {
    if (!document.querySelector(`link[rel="dns-prefetch"][href="${domain}"]`)) {
      const link = document.createElement('link');
      link.rel = 'dns-prefetch';
      link.href = domain;
      head.appendChild(link);
    }
  });

  // Preload critical fonts
  const criticalFonts = [
    { href: 'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiA.woff2', crossOrigin: 'anonymous' },
  ];

  criticalFonts.forEach((font) => {
    if (!document.querySelector(`link[rel="preload"][href="${font.href}"]`)) {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.href = font.href;
      link.as = 'font';
      link.type = 'font/woff2';
      if (font.crossOrigin) link.crossOrigin = font.crossOrigin;
      head.appendChild(link);
    }
  });
}

// Lazy load images with native loading attribute and IntersectionObserver
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
    // Use IntersectionObserver as fallback
    if ('IntersectionObserver' in window) {
      const imageObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const img = entry.target as HTMLImageElement;
            if (img.dataset.src) {
              img.src = img.dataset.src;
              img.removeAttribute('data-src');
              imageObserver.unobserve(img);
            }
          }
        });
      });

      document.querySelectorAll('img[data-src]').forEach((img) => {
        imageObserver.observe(img);
      });
    }
  }
}

// Prefetch critical pages and resources
export function prefetchCriticalPages() {
  if (typeof window === 'undefined') return;

  const criticalPages = ['/booking', '/services', '/mobile-booking'];

  if ('prefetch' in HTMLLinkElement.prototype) {
    criticalPages.forEach((page) => {
      if (!document.querySelector(`link[rel="prefetch"][href="${page}"]`)) {
        const link = document.createElement('link');
        link.rel = 'prefetch';
        link.href = page;
        link.as = 'document';
        document.head.appendChild(link);
      }
    });
  }

  // Prefetch on link hover for better UX
  setupLinkPrefetching();
}

// Setup link prefetching on hover
function setupLinkPrefetching() {
  if ('IntersectionObserver' in window && 'prefetch' in HTMLLinkElement.prototype) {
    const links = document.querySelectorAll('a[href^="/"]');
    const prefetchedUrls = new Set();

    links.forEach((link) => {
      link.addEventListener('mouseenter', () => {
        const href = link.getAttribute('href');
        if (href && !prefetchedUrls.has(href) && !href.includes('#')) {
          const prefetchLink = document.createElement('link');
          prefetchLink.rel = 'prefetch';
          prefetchLink.href = href;
          prefetchLink.as = 'document';
          document.head.appendChild(prefetchLink);
          prefetchedUrls.add(href);
        }
      }, { passive: true });
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
          console.warn(`[Performance] Long task detected: ${entry.duration.toFixed(2)}ms`, {
            name: entry.name,
            startTime: entry.startTime,
            duration: entry.duration,
          });

          // Store long tasks for analysis
          const longTasks = JSON.parse(localStorage.getItem('longTasks') || '[]');
          longTasks.push({
            duration: entry.duration,
            startTime: entry.startTime,
            timestamp: Date.now(),
            page: window.location.pathname,
          });

          // Keep only last 50 long tasks
          if (longTasks.length > 50) {
            longTasks.splice(0, longTasks.length - 50);
          }

          localStorage.setItem('longTasks', JSON.stringify(longTasks));
        }
      }
    });

    observer.observe({ entryTypes: ['longtask'] });
  } catch (e) {
    // Long task monitoring not supported
  }
}

// Monitor resource loading
export function monitorResourceLoading() {
  if (typeof window === 'undefined' || !('PerformanceObserver' in window)) return;

  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const resourceEntry = entry as PerformanceResourceTiming;

        // Check for slow resources
        if (resourceEntry.duration > 1000) {
          console.warn(`[Performance] Slow resource:`, {
            name: resourceEntry.name,
            duration: resourceEntry.duration.toFixed(2),
            transferSize: (resourceEntry as any).transferSize || 0,
            type: resourceEntry.initiatorType,
          });
        }

        // Check for large resources
        if ((resourceEntry as any).transferSize > 500000) {
          console.warn(`[Performance] Large resource:`, {
            name: resourceEntry.name,
            transferSize: ((resourceEntry as any).transferSize / 1024).toFixed(2) + ' KB',
            duration: resourceEntry.duration.toFixed(2),
          });
        }
      }
    });

    observer.observe({ entryTypes: ['resource'] });
  } catch (e) {
    // Resource timing not supported
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
      INP: null,
    };
  }

  const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
  const paintEntries = performance.getEntriesByType('paint');

  // Get FCP from paint timing
  const fcpEntry = paintEntries.find(entry => entry.name === 'first-contentful-paint');

  return {
    FCP: fcpEntry ? fcpEntry.startTime : performanceStore['FCP'] || null,
    LCP: performanceStore['LCP'] || null,
    FID: performanceStore['FID'] || null,
    CLS: performanceStore['CLS'] || null,
    INP: performanceStore['INP'] || null,
    TTFB: navigation ? navigation.responseStart - navigation.requestStart : performanceStore['TTFB'] || null,
    TTI: navigation ? navigation.loadEventEnd - navigation.fetchStart : null,
  };
}

// Performance budget checking
export function checkPerformanceBudget() {
  const budgets = {
    FCP: 1800,  // 1.8s
    LCP: 2500,  // 2.5s
    FID: 100,   // 100ms
    CLS: 0.1,   // 0.1
    TTFB: 800,  // 800ms
    INP: 200,   // 200ms
  };

  const metrics = getCurrentMetrics();
  const violations: string[] = [];

  Object.entries(budgets).forEach(([metric, budget]) => {
    const value = metrics[metric as keyof PerformanceMetrics];
    if (value && value > budget) {
      violations.push(`${metric}: ${value.toFixed(2)} (budget: ${budget})`);
    }
  });

  if (violations.length > 0 && process.env.NODE_ENV === 'development') {
    console.warn('[Performance Budget] Violations detected:', violations);
  }

  return violations;
}

// Utility to measure component render time
export function measureComponentPerformance(componentName: string) {
  const startMark = `${componentName}-start`;
  const endMark = `${componentName}-end`;
  const measureName = `${componentName}-render`;

  return {
    start: () => {
      if ('performance' in window) {
        performance.mark(startMark);
      }
    },
    end: () => {
      if ('performance' in window) {
        performance.mark(endMark);
        performance.measure(measureName, startMark, endMark);

        const measure = performance.getEntriesByName(measureName)[0];
        if (measure && process.env.NODE_ENV === 'development') {
          console.log(`[Performance] ${componentName} render time:`, measure.duration.toFixed(2), 'ms');
        }

        // Clean up marks
        performance.clearMarks(startMark);
        performance.clearMarks(endMark);
        performance.clearMeasures(measureName);

        return measure?.duration;
      }
      return 0;
    },
  };
}

// Debounce utility for performance
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// Throttle utility for performance
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean = false;

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}

// Check if user prefers reduced motion
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;

  const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  return mediaQuery.matches;
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
    monitorResourceLoading();
    checkPerformanceBudget();
  } else {
    window.addEventListener('load', () => {
      prefetchCriticalPages();
      monitorLongTasks();
      monitorResourceLoading();

      // Check performance budget after a delay
      setTimeout(() => {
        checkPerformanceBudget();
      }, 1000);
    });
  }

  // Initialize web vitals monitoring
  initWebVitals();

  // Setup idle callback for non-critical tasks
  if ('requestIdleCallback' in window) {
    (window as any).requestIdleCallback(() => {
      // Additional optimizations when idle
      console.log('[Performance] Running idle optimizations');
    });
  }
}