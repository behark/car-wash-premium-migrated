/**
 * Gesture Hint Component
 * Shows swipe hints and gesture instructions for mobile users
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface GestureHintProps {
  show: boolean;
  onDismiss: () => void;
  type: 'swipe' | 'pull' | 'longpress' | 'doubletap';
  message?: string;
}

export default function GestureHint({ show, onDismiss, type, message }: GestureHintProps) {
  const [autoHide, setAutoHide] = useState(false);

  useEffect(() => {
    if (show) {
      const timer = setTimeout(() => {
        setAutoHide(true);
        setTimeout(onDismiss, 300);
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [show, onDismiss]);

  const getGestureAnimation = () => {
    switch (type) {
      case 'swipe':
        return {
          initial: { x: -20, opacity: 0.5 },
          animate: { x: 20, opacity: 1 },
          transition: { repeat: Infinity, duration: 1.5, repeatType: 'reverse' as const }
        };
      case 'pull':
        return {
          initial: { y: 0, opacity: 0.5 },
          animate: { y: 20, opacity: 1 },
          transition: { repeat: Infinity, duration: 1, repeatType: 'reverse' as const }
        };
      case 'longpress':
        return {
          initial: { scale: 1, opacity: 0.5 },
          animate: { scale: 1.2, opacity: 1 },
          transition: { repeat: Infinity, duration: 1, repeatType: 'reverse' as const }
        };
      case 'doubletap':
        return {
          initial: { scale: 1 },
          animate: { scale: [1, 0.8, 1, 0.8, 1] },
          transition: { repeat: Infinity, duration: 2, times: [0, 0.2, 0.4, 0.6, 1] }
        };
      default:
        return {};
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'swipe':
        return (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        );
      case 'pull':
        return (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        );
      case 'longpress':
        return (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        );
      case 'doubletap':
        return (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11" />
          </svg>
        );
      default:
        return null;
    }
  };

  const getDefaultMessage = () => {
    switch (type) {
      case 'swipe':
        return 'Pyyhkäise vasemmalle siirtyäksesi eteenpäin';
      case 'pull':
        return 'Vedä alaspäin päivittääksesi';
      case 'longpress':
        return 'Paina pitkään nähdäksesi lisäasetuksia';
      case 'doubletap':
        return 'Kaksoisnapauta zoomaukseen';
      default:
        return '';
    }
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: -50, scale: 0.9 }}
          animate={{ opacity: autoHide ? 0 : 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -50, scale: 0.9 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 bg-white rounded-2xl shadow-2xl border border-gray-200 px-6 py-4 max-w-sm mx-4"
        >
          <div className="flex items-center space-x-3">
            <motion.div
              className="text-blue-600 flex-shrink-0"
              {...getGestureAnimation()}
            >
              {getIcon()}
            </motion.div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">
                {message || getDefaultMessage()}
              </p>
            </div>
            <button
              onClick={onDismiss}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Progress bar for auto-hide */}
          <motion.div
            initial={{ width: '100%' }}
            animate={{ width: '0%' }}
            transition={{ duration: 3, ease: 'linear' }}
            className="absolute bottom-0 left-0 h-1 bg-blue-600 rounded-b-2xl"
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Gesture hints manager hook
export function useGestureHints() {
  const [hints, setHints] = useState<{
    [key: string]: boolean;
  }>({});

  const showHint = (type: string, delay: number = 1000) => {
    setTimeout(() => {
      setHints(prev => ({ ...prev, [type]: true }));
    }, delay);
  };

  const hideHint = (type: string) => {
    setHints(prev => ({ ...prev, [type]: false }));
  };

  const isHintVisible = (type: string) => {
    return hints[type] || false;
  };

  // Check if user has seen hints before
  const hasSeenHint = (type: string) => {
    return localStorage.getItem(`gesture_hint_${type}`) === 'true';
  };

  const markHintAsSeen = (type: string) => {
    localStorage.setItem(`gesture_hint_${type}`, 'true');
  };

  const showHintIfNew = (type: string, delay: number = 1000) => {
    if (!hasSeenHint(type)) {
      showHint(type, delay);
    }
  };

  const hideHintAndMarkSeen = (type: string) => {
    hideHint(type);
    markHintAsSeen(type);
  };

  return {
    hints,
    showHint,
    hideHint,
    isHintVisible,
    hasSeenHint,
    markHintAsSeen,
    showHintIfNew,
    hideHintAndMarkSeen,
  };
}