/**
 * Optimized Camera Capture Component
 * Lightweight camera interface for capturing booking photos with lazy-loaded dependencies
 */

import React, { useState, useRef, useCallback, useEffect, memo } from 'react';
import dynamic from 'next/dynamic';

// Lazy load react-webcam only when needed
const Webcam = dynamic<any>(
  () => import('react-webcam') as any,
  {
    loading: () => <div className="w-full h-full bg-gray-900 animate-pulse" />,
    ssr: false
  }
);

interface CameraCaptureOptimizedProps {
  type: 'before' | 'after';
  onCapture: (_imageData: string, _type: 'before' | 'after') => void;
  onClose: () => void;
  existingPhoto?: string;
}

const CameraCaptureOptimized = memo(({
  type,
  onCapture,
  onClose,
  existingPhoto
}: CameraCaptureOptimizedProps) => {
  const webcamRef = useRef<any>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [capturedImage, setCapturedImage] = useState<string | null>(existingPhoto || null);
  const [isRetaking, setIsRetaking] = useState(false);
  const [cameraError, setCameraError] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const videoConstraints = {
    width: { ideal: 1920 },
    height: { ideal: 1080 },
    facingMode,
    aspectRatio: 16 / 9,
  };

  const capture = useCallback(async () => {
    if (!webcamRef.current) return;

    setIsProcessing(true);

    try {
      // Capture image
      const imageSrc = webcamRef.current.getScreenshot({
        width: 1920,
        height: 1080,
      });

      if (imageSrc) {
        setCapturedImage(imageSrc);

        // Add vibration feedback
        if ('vibrate' in navigator) {
          navigator.vibrate(50);
        }
      }
    } catch (error) {
      console.error('Error capturing image:', error);
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const retake = useCallback(() => {
    setCapturedImage(null);
    setIsRetaking(true);
  }, []);

  const confirm = useCallback(() => {
    if (capturedImage) {
      onCapture(capturedImage, type);
    }
  }, [capturedImage, onCapture, type]);

  const toggleCamera = useCallback(() => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  }, []);

  const handleUserMediaError = useCallback(() => {
    setCameraError(true);
  }, []);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-black">
      <div className="relative h-full flex flex-col">
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/70 to-transparent p-4">
          <div className="flex items-center justify-between">
            <button
              onClick={onClose}
              className="p-2 text-white bg-black/30 backdrop-blur-sm rounded-full"
              aria-label="Sulje kamera"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="bg-black/30 backdrop-blur-sm px-4 py-2 rounded-full">
              <span className="text-white font-medium">
                {type === 'before' ? 'Kuva ennen' : 'Kuva jälkeen'}
              </span>
            </div>

            {!capturedImage && (
              <button
                onClick={toggleCamera}
                className="p-2 text-white bg-black/30 backdrop-blur-sm rounded-full"
                aria-label="Vaihda kamera"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Camera/Preview Area */}
        <div className="flex-1 relative bg-black flex items-center justify-center">
          {cameraError ? (
            <div className="text-center p-8">
              <svg className="w-16 h-16 text-red-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-white text-lg mb-2">Kameraan ei saada yhteyttä</p>
              <p className="text-gray-400 text-sm">Tarkista, että olet antanut sovellukselle luvan käyttää kameraa.</p>
            </div>
          ) : capturedImage && !isRetaking ? (
            <img
              src={capturedImage}
              alt="Captured"
              className="max-w-full max-h-full object-contain"
            />
          ) : (
            <Webcam
              ref={webcamRef}
              audio={false}
              screenshotFormat="image/jpeg"
              videoConstraints={videoConstraints}
              onUserMediaError={handleUserMediaError}
              className="w-full h-full object-cover"
              screenshotQuality={0.9}
            />
          )}

          {/* Processing overlay */}
          {isProcessing && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <div className="bg-white rounded-lg p-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            </div>
          )}

          {/* Focus indicator */}
          {!capturedImage && !cameraError && (
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                <div className="w-64 h-64 border-2 border-white/30 rounded-lg">
                  <div className="absolute -top-1 -left-1 w-8 h-8 border-t-2 border-l-2 border-white rounded-tl-lg"></div>
                  <div className="absolute -top-1 -right-1 w-8 h-8 border-t-2 border-r-2 border-white rounded-tr-lg"></div>
                  <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-2 border-l-2 border-white rounded-bl-lg"></div>
                  <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-2 border-r-2 border-white rounded-br-lg"></div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-6">
          {!cameraError && (
            <div className="flex items-center justify-center space-x-8">
              {capturedImage && !isRetaking ? (
                <>
                  <button
                    onClick={retake}
                    className="px-6 py-3 bg-white/20 backdrop-blur-sm text-white rounded-full font-medium transform active:scale-95 transition-transform"
                  >
                    Ota uudelleen
                  </button>
                  <button
                    onClick={confirm}
                    className="px-8 py-3 bg-blue-600 text-white rounded-full font-medium transform active:scale-95 transition-transform shadow-lg"
                  >
                    Käytä tätä
                  </button>
                </>
              ) : (
                <button
                  onClick={capture}
                  disabled={isProcessing}
                  className="w-20 h-20 bg-white rounded-full border-4 border-white/50 transform active:scale-95 transition-transform disabled:opacity-50"
                  aria-label="Ota kuva"
                >
                  <div className="w-full h-full rounded-full bg-white"></div>
                </button>
              )}
            </div>
          )}

          {/* Tips */}
          {!capturedImage && !cameraError && (
            <div className="mt-4 text-center">
              <p className="text-white/80 text-sm">
                {type === 'before'
                  ? 'Ota kuva ajoneuvostasi ennen pesua'
                  : 'Ota kuva ajoneuvostasi pesun jälkeen'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

CameraCaptureOptimized.displayName = 'CameraCaptureOptimized';

export default CameraCaptureOptimized;