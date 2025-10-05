import React, { useState, useEffect, memo } from 'react';
import Image from 'next/image';

interface ImageOptimizedProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  priority?: boolean;
  className?: string;
  fill?: boolean;
  sizes?: string;
  quality?: number;
  placeholder?: 'blur' | 'empty';
  blurDataURL?: string;
  onLoad?: () => void;
  onClick?: () => void;
  lazy?: boolean;
  aspectRatio?: number;
  objectFit?: 'contain' | 'cover' | 'fill' | 'none' | 'scale-down';
}

// Generate a shimmer effect for loading placeholders
const shimmer = (w: number, h: number) => `
<svg width="${w}" height="${h}" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <defs>
    <linearGradient id="g">
      <stop stop-color="#f3f4f6" offset="20%" />
      <stop stop-color="#e5e7eb" offset="50%" />
      <stop stop-color="#f3f4f6" offset="70%" />
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="#f3f4f6" />
  <rect id="r" width="${w}" height="${h}" fill="url(#g)" />
  <animate xlink:href="#r" attributeName="x" from="-${w}" to="${w}" dur="1s" repeatCount="indefinite"  />
</svg>`;

const toBase64 = (str: string) =>
  typeof window === 'undefined'
    ? Buffer.from(str).toString('base64')
    : window.btoa(str);

const ImageOptimized = memo(({
  src,
  alt,
  width,
  height,
  priority = false,
  className = '',
  fill = false,
  sizes,
  quality = 75,
  placeholder = 'blur',
  blurDataURL,
  onLoad,
  onClick,
  lazy = true,
  aspectRatio,
  objectFit = 'cover',
}: ImageOptimizedProps) => {
  const [isLoading, setLoading] = useState(true);
  const [isInView, setIsInView] = useState(!lazy);
  const [hasError, setHasError] = useState(false);

  // Calculate dimensions based on aspect ratio if provided
  const calculatedHeight = aspectRatio && width ? Math.round(width / aspectRatio) : height;
  const calculatedWidth = aspectRatio && height ? Math.round(height * aspectRatio) : width;

  // Generate default blur placeholder if not provided
  const defaultBlurDataURL = placeholder === 'blur' && !blurDataURL
    ? `data:image/svg+xml;base64,${toBase64(shimmer(calculatedWidth || 700, calculatedHeight || 475))}`
    : blurDataURL;

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (!lazy || isInView) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
          }
        });
      },
      {
        rootMargin: '50px',
        threshold: 0.01,
      }
    );

    const element = document.getElementById(`img-${src.replace(/[^a-zA-Z0-9]/g, '-')}`);
    if (element) {
      observer.observe(element);
    }

    return () => {
      if (element) {
        observer.unobserve(element);
      }
    };
  }, [src, lazy, isInView]);

  const handleLoad = () => {
    setLoading(false);
    onLoad?.();
  };

  const handleError = () => {
    setHasError(true);
    setLoading(false);
  };

  // Handle external images
  const isExternal = src.startsWith('http');

  // Fallback for error state
  if (hasError) {
    return (
      <div className={`relative overflow-hidden bg-gray-100 ${className}`}>
        <div className="flex items-center justify-center h-full">
          <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
      </div>
    );
  }

  // For external images without dimensions and not using fill
  if (isExternal && !fill && (!calculatedWidth || !calculatedHeight)) {
    return (
      <div id={`img-${src.replace(/[^a-zA-Z0-9]/g, '-')}`} className={`relative overflow-hidden ${className}`}>
        {isLoading && (
          <div className="absolute inset-0 bg-gray-200 animate-pulse" />
        )}
        {isInView && (
          <img
            src={src}
            alt={alt}
            className={`duration-700 ease-in-out ${isLoading ? 'scale-110 blur-2xl grayscale' : 'scale-100 blur-0 grayscale-0'}`}
            loading={priority ? 'eager' : 'lazy'}
            onClick={onClick}
            onLoad={handleLoad}
            onError={handleError}
            style={{ objectFit, width: '100%', height: 'auto' }}
          />
        )}
      </div>
    );
  }

  return (
    <div
      id={`img-${src.replace(/[^a-zA-Z0-9]/g, '-')}`}
      className={`relative overflow-hidden ${className}`}
      style={fill ? {} : { width: calculatedWidth, height: calculatedHeight }}
    >
      {isInView ? (
        fill ? (
          <Image
            src={src}
            alt={alt}
            fill
            sizes={sizes || '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw'}
            quality={quality}
            priority={priority}
            placeholder={placeholder}
            blurDataURL={defaultBlurDataURL}
            className={`duration-700 ease-in-out object-${objectFit} ${
              isLoading ? 'scale-110 blur-2xl grayscale' : 'scale-100 blur-0 grayscale-0'
            }`}
            onLoadingComplete={handleLoad}
            onError={handleError}
            onClick={onClick}
          />
        ) : (
          <Image
            src={src}
            alt={alt}
            width={calculatedWidth}
            height={calculatedHeight}
            quality={quality}
            priority={priority}
            placeholder={placeholder}
            blurDataURL={defaultBlurDataURL}
            sizes={sizes}
            className={`duration-700 ease-in-out ${
              isLoading ? 'scale-110 blur-2xl grayscale' : 'scale-100 blur-0 grayscale-0'
            }`}
            onLoadingComplete={handleLoad}
            onError={handleError}
            onClick={onClick}
            style={{ objectFit }}
          />
        )
      ) : (
        <div className="w-full h-full bg-gray-200 animate-pulse" />
      )}
    </div>
  );
});

ImageOptimized.displayName = 'ImageOptimized';

export default ImageOptimized;