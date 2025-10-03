/**
 * Camera Capture Component
 * Enables users to take before/after photos of their vehicle
 */

import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Webcam from 'react-webcam';

interface CameraCaptureProps {
  onCapture: (_imageData: string, _type: 'before' | 'after') => void;
  onClose: () => void;
  type: 'before' | 'after';
  existingPhoto?: string;
}

export default function CameraCapture({
  onCapture,
  onClose,
  type,
  existingPhoto,
}: CameraCaptureProps) {
  const webcamRef = useRef<Webcam>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(existingPhoto || null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  const videoConstraints = {
    width: 1280,
    height: 720,
    facingMode: facingMode,
  };

  const handleUserMediaError = useCallback((error: string | DOMException) => {
    console.error('Camera error:', error);
    setHasPermission(false);
  }, []);

  const handleUserMedia = useCallback(() => {
    setHasPermission(true);
  }, []);

  const capture = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc) {
      setIsCapturing(true);
      setCapturedImage(imageSrc);
      setIsCapturing(false);
    }
  }, [webcamRef]);

  const retake = () => {
    setCapturedImage(null);
  };

  const save = () => {
    if (capturedImage) {
      onCapture(capturedImage, type);
      onClose();
    }
  };

  const switchCamera = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  const titleText = type === 'before' ? 'Ennen pesua' : 'Pesun jälkeen';
  const instructionText = type === 'before'
    ? 'Ota kuva ajoneuvostasi ennen pesua dokumentointia varten'
    : 'Ota kuva puhtaasta ajoneuvostasi pesun jälkeen';

  if (hasPermission === false) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4"
      >
        <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Kameraoikeudet tarvitaan</h3>
          <p className="text-gray-600 mb-6 text-sm">
            Anna lupa käyttää kameraa ottaaksesi kuvia ajoneuvostasi
          </p>
          <div className="space-y-3">
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Yritä uudelleen
            </button>
            <button
              onClick={onClose}
              className="w-full bg-gray-100 text-gray-700 py-2 px-4 rounded-lg font-medium hover:bg-gray-200 transition-colors"
            >
              Peruuta
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black z-50"
    >
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/70 to-transparent p-4">
        <div className="flex items-center justify-between">
          <button
            onClick={onClose}
            className="p-2 text-white hover:bg-white/10 rounded-full transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div className="text-center">
            <h2 className="text-white font-semibold">{titleText}</h2>
            <p className="text-white/80 text-sm">{instructionText}</p>
          </div>
          <div className="w-10" />
        </div>
      </div>

      {/* Camera View */}
      <div className="relative w-full h-full">
        <AnimatePresence mode="wait">
          {!capturedImage ? (
            <motion.div
              key="camera"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.1 }}
              className="w-full h-full"
            >
              <Webcam
                ref={webcamRef}
                audio={false}
                screenshotFormat="image/jpeg"
                screenshotQuality={0.8}
                videoConstraints={videoConstraints}
                onUserMedia={handleUserMedia}
                onUserMediaError={handleUserMediaError}
                className="w-full h-full object-cover"
              />

              {/* Camera overlay guides */}
              <div className="absolute inset-4 border-2 border-white/30 border-dashed rounded-2xl pointer-events-none">
                <div className="absolute top-4 left-4 text-white/80 text-sm">
                  {type === 'before' ? 'Keskitä ajoneuvo näkymään' : 'Näytä lopputulos'}
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="preview"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full h-full"
            >
              <img
                src={capturedImage}
                alt="Captured"
                className="w-full h-full object-cover"
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Camera Controls */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-6">
          {!capturedImage ? (
            <div className="flex items-center justify-between">
              {/* Switch Camera */}
              <button
                onClick={switchCamera}
                className="p-3 text-white hover:bg-white/10 rounded-full transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>

              {/* Capture Button */}
              <motion.button
                onClick={capture}
                disabled={isCapturing || hasPermission === null}
                whileTap={{ scale: 0.9 }}
                className="w-20 h-20 bg-white rounded-full border-4 border-gray-300 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="w-16 h-16 bg-white rounded-full border-2 border-gray-400"></div>
              </motion.button>

              <div className="w-12" />
            </div>
          ) : (
            <div className="flex items-center justify-center space-x-4">
              <button
                onClick={retake}
                className="flex items-center space-x-2 bg-white/10 text-white px-6 py-3 rounded-full backdrop-blur-sm hover:bg-white/20 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>Ota uudelleen</span>
              </button>

              <button
                onClick={save}
                className="flex items-center space-x-2 bg-blue-600 text-white px-6 py-3 rounded-full hover:bg-blue-700 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Tallenna</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}