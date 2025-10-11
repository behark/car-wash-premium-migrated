import { useEffect, useRef, useState, ReactNode } from 'react';

interface LazyLoadProps {
  children: ReactNode;
  threshold?: number;
  rootMargin?: string;
  placeholder?: ReactNode;
  onVisible?: () => void;
}

export default function LazyLoad({
  children,
  threshold = 0.1,
  rootMargin = '50px',
  placeholder = <div className="animate-pulse bg-gray-200 h-full w-full" />,
  onVisible,
}: LazyLoadProps) {
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            if (onVisible) onVisible();
            observer.disconnect();
          }
        });
      },
      {
        threshold,
        rootMargin,
      }
    );

    const currentRef = containerRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [threshold, rootMargin, onVisible]);

  return (
    <div ref={containerRef}>
      {isVisible ? children : placeholder}
    </div>
  );
}