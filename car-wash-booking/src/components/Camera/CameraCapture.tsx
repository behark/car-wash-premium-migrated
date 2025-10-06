/**
 * Simple Camera Placeholder Component (Memory Optimized)
 * Replaces heavy react-webcam dependency
 */

import React from 'react';

interface CameraCaptureProps {
  onPhotoTaken?: (photo: any) => void;
  className?: string;
}

export default function CameraCapture({ onPhotoTaken, className }: CameraCaptureProps) {
  return (
    <div className={`bg-gray-100 rounded-xl p-8 text-center ${className}`}>
      <div className="w-16 h-16 bg-gray-300 rounded-full flex items-center justify-center mx-auto mb-4">
        <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path>
        </svg>
      </div>
      <h3 className="text-lg font-medium text-gray-700 mb-2">Kameraominaisuus</h3>
      <p className="text-gray-500 text-sm">
        Kameraominaisuus on tilapäisesti pois käytöstä optimointien vuoksi.
        Ota kuvat puhelimellasi ja lähetä ne sähköpostilla tarvittaessa.
      </p>
    </div>
  );
}