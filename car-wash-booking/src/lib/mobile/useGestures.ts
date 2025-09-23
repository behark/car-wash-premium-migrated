/**
 * Touch Gesture Hook
 * Handles swipe gestures, long press, and haptic feedback for mobile devices
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { TouchEvent } from 'react';

interface GestureOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  onLongPress?: () => void;
  onDoubleTap?: () => void;
  onPinch?: (scale: number) => void;
  swipeThreshold?: number;
  longPressDelay?: number;
  doubleTapDelay?: number;
  enableHapticFeedback?: boolean;
}

interface TouchPoint {
  x: number;
  y: number;
  time: number;
}

export function useGestures(options: GestureOptions = {}) {
  const {
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
    onLongPress,
    onDoubleTap,
    onPinch,
    swipeThreshold = 50,
    longPressDelay = 500,
    doubleTapDelay = 300,
    enableHapticFeedback = true,
  } = options;

  const touchStart = useRef<TouchPoint | null>(null);
  const touchEnd = useRef<TouchPoint | null>(null);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const lastTap = useRef<number>(0);
  const [isLongPressing, setIsLongPressing] = useState(false);

  // Haptic feedback helper
  const hapticFeedback = useCallback((pattern: number[] = [10]) => {
    if (enableHapticFeedback && 'vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  }, [enableHapticFeedback]);

  const handleTouchStart = useCallback((e: TouchEvent<HTMLElement>) => {
    const touch = e.touches[0];
    touchStart.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now(),
    };

    // Start long press timer
    if (onLongPress) {
      longPressTimer.current = setTimeout(() => {
        setIsLongPressing(true);
        onLongPress();
        hapticFeedback([20, 10, 20]); // Long press haptic
      }, longPressDelay);
    }
  }, [onLongPress, longPressDelay, hapticFeedback]);

  const handleTouchMove = useCallback((e: TouchEvent<HTMLElement>) => {
    // Cancel long press if finger moves too much
    if (longPressTimer.current && touchStart.current) {
      const touch = e.touches[0];
      const deltaX = Math.abs(touch.clientX - touchStart.current.x);
      const deltaY = Math.abs(touch.clientY - touchStart.current.y);

      if (deltaX > 10 || deltaY > 10) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
    }

    // Handle pinch gesture
    if (e.touches.length === 2 && onPinch) {
      e.preventDefault();
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];

      const currentDistance = Math.sqrt(
        Math.pow(touch2.clientX - touch1.clientX, 2) +
        Math.pow(touch2.clientY - touch1.clientY, 2)
      );

      // You would need to store initial distance to calculate scale
      // This is a simplified implementation
      onPinch(currentDistance / 100); // Normalize the distance
    }
  }, [onPinch]);

  const handleTouchEnd = useCallback((e: TouchEvent<HTMLElement>) => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }

    if (isLongPressing) {
      setIsLongPressing(false);
      return;
    }

    if (!touchStart.current) return;

    const touch = e.changedTouches[0];
    touchEnd.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now(),
    };

    const deltaX = touchEnd.current.x - touchStart.current.x;
    const deltaY = touchEnd.current.y - touchStart.current.y;
    const deltaTime = touchEnd.current.time - touchStart.current.time;

    // Handle double tap
    if (onDoubleTap) {
      const now = Date.now();
      if (now - lastTap.current < doubleTapDelay) {
        onDoubleTap();
        hapticFeedback([5, 5, 5]); // Double tap haptic
        lastTap.current = 0;
        return;
      }
      lastTap.current = now;
    }

    // Handle swipe gestures
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    if (absX > swipeThreshold || absY > swipeThreshold) {
      if (absX > absY) {
        // Horizontal swipe
        if (deltaX > 0 && onSwipeRight) {
          onSwipeRight();
          hapticFeedback([15]); // Swipe haptic
        } else if (deltaX < 0 && onSwipeLeft) {
          onSwipeLeft();
          hapticFeedback([15]); // Swipe haptic
        }
      } else {
        // Vertical swipe
        if (deltaY > 0 && onSwipeDown) {
          onSwipeDown();
          hapticFeedback([15]); // Swipe haptic
        } else if (deltaY < 0 && onSwipeUp) {
          onSwipeUp();
          hapticFeedback([15]); // Swipe haptic
        }
      }
    }

    touchStart.current = null;
    touchEnd.current = null;
  }, [
    isLongPressing,
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
    onDoubleTap,
    swipeThreshold,
    doubleTapDelay,
    hapticFeedback,
  ]);

  // Return handler functions that can be attached to elements
  const gestureHandlers = {
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
  };

  return {
    gestureHandlers,
    isLongPressing,
    hapticFeedback,
  };
}

// Hook for pull-to-refresh functionality
export function usePullToRefresh(onRefresh: () => void, threshold: number = 80) {
  const [isPulling, setIsPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const startY = useRef<number>(0);
  const currentY = useRef<number>(0);

  const handleTouchStart = useCallback((e: TouchEvent<HTMLElement>) => {
    // Only trigger on the top of the page
    if (window.scrollY === 0) {
      startY.current = e.touches[0].clientY;
    }
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent<HTMLElement>) => {
    if (window.scrollY > 0) return;

    currentY.current = e.touches[0].clientY;
    const deltaY = currentY.current - startY.current;

    if (deltaY > 0) {
      e.preventDefault();
      setIsPulling(true);
      setPullDistance(Math.min(deltaY, threshold * 1.5));
    }
  }, [threshold]);

  const handleTouchEnd = useCallback(() => {
    if (isPulling && pullDistance >= threshold) {
      onRefresh();
      if ('vibrate' in navigator) {
        navigator.vibrate([30]);
      }
    }

    setIsPulling(false);
    setPullDistance(0);
    startY.current = 0;
    currentY.current = 0;
  }, [isPulling, pullDistance, threshold, onRefresh]);

  const pullToRefreshHandlers = {
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
  };

  return {
    pullToRefreshHandlers,
    isPulling,
    pullDistance,
    pullProgress: Math.min(pullDistance / threshold, 1),
  };
}

// Hook for swipe-to-dismiss functionality
export function useSwipeToDismiss(
  onDismiss: () => void,
  direction: 'left' | 'right' | 'up' | 'down' = 'right',
  threshold: number = 100
) {
  const [offset, setOffset] = useState(0);
  const [isDismissing, setIsDismissing] = useState(false);
  const startPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const handleTouchStart = useCallback((e: TouchEvent<HTMLElement>) => {
    const touch = e.touches[0];
    startPos.current = { x: touch.clientX, y: touch.clientY };
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent<HTMLElement>) => {
    const touch = e.touches[0];
    const deltaX = touch.clientX - startPos.current.x;
    const deltaY = touch.clientY - startPos.current.y;

    let currentOffset = 0;
    switch (direction) {
      case 'left':
        currentOffset = Math.min(0, deltaX);
        break;
      case 'right':
        currentOffset = Math.max(0, deltaX);
        break;
      case 'up':
        currentOffset = Math.min(0, deltaY);
        break;
      case 'down':
        currentOffset = Math.max(0, deltaY);
        break;
    }

    setOffset(currentOffset);
  }, [direction]);

  const handleTouchEnd = useCallback(() => {
    const shouldDismiss = Math.abs(offset) >= threshold;

    if (shouldDismiss) {
      setIsDismissing(true);
      setTimeout(() => {
        onDismiss();
        if ('vibrate' in navigator) {
          navigator.vibrate([20]);
        }
      }, 200);
    } else {
      setOffset(0);
    }
  }, [offset, threshold, onDismiss]);

  const swipeToDismissHandlers = {
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
  };

  const progress = Math.abs(offset) / threshold;
  const transform = isDismissing
    ? `translate${direction === 'left' || direction === 'right' ? 'X' : 'Y'}(${direction === 'left' || direction === 'up' ? '-' : ''}100%)`
    : `translate${direction === 'left' || direction === 'right' ? 'X' : 'Y'}(${offset}px)`;

  return {
    swipeToDismissHandlers,
    offset,
    progress,
    isDismissing,
    transform,
    style: {
      transform,
      opacity: 1 - (progress * 0.5),
      transition: isDismissing ? 'transform 0.2s ease-out, opacity 0.2s ease-out' : 'none',
    },
  };
}

export default useGestures;