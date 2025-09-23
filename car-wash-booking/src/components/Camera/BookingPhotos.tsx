/**
 * Booking Photos Component
 * Integration component for photo management in booking flow
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import CameraCapture from './CameraCapture';
import PhotoGallery from './PhotoGallery';
import usePhotoManager from '../../lib/camera/usePhotoManager';

interface BookingPhotosProps {
  bookingId?: number;
  className?: string;
  onPhotosChange?: (photos: any[]) => void;
  showInstructions?: boolean;
}

export default function BookingPhotos({
  bookingId,
  className = '',
  onPhotosChange,
  showInstructions = true,
}: BookingPhotosProps) {
  const [showCamera, setShowCamera] = useState(false);
  const [cameraType, setCameraType] = useState<'before' | 'after'>('before');

  const {
    beforePhoto,
    afterPhoto,
    addPhoto,
    removePhoto,
    isCompressing,
    totalSizeFormatted,
    photoCount,
    hasBothPhotos,
    exportPhotos,
  } = usePhotoManager({
    bookingId,
    autoSave: true,
    quality: 0.8,
  });

  const handleAddPhoto = (type: 'before' | 'after') => {
    setCameraType(type);
    setShowCamera(true);
  };

  const handleCameraCapture = async (imageData: string, type: 'before' | 'after') => {
    try {
      await addPhoto(imageData, type);

      // Notify parent component
      if (onPhotosChange) {
        onPhotosChange(exportPhotos());
      }

      setShowCamera(false);
    } catch (error) {
      console.error('Failed to add photo:', error);
    }
  };

  const handleRemovePhoto = (type: 'before' | 'after') => {
    removePhoto(type);

    // Notify parent component
    if (onPhotosChange) {
      onPhotosChange(exportPhotos());
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Instructions */}
      {showInstructions && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-blue-50 border border-blue-200 rounded-xl p-4"
        >
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h4 className="text-blue-900 font-medium mb-1">Dokumentoi pesuprosessi</h4>
              <p className="text-blue-700 text-sm">
                Ota kuvia ajoneuvostasi ennen ja jälkeen pesun. Tämä auttaa dokumentoimaan pesun laadun
                ja tarjoaa sinulle ennen-jälkeen vertailun.
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Loading State */}
      {isCompressing && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center justify-center py-8"
        >
          <div className="flex items-center space-x-3 text-blue-600">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span className="font-medium">Käsitellään kuvaa...</span>
          </div>
        </motion.div>
      )}

      {/* Photo Gallery */}
      <PhotoGallery
        beforePhoto={beforePhoto || undefined}
        afterPhoto={afterPhoto || undefined}
        onAddPhoto={handleAddPhoto}
        onRemovePhoto={handleRemovePhoto}
      />

      {/* Photo Statistics */}
      {photoCount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gray-50 rounded-lg p-4"
        >
          <div className="flex items-center justify-between text-sm">
            <div className="text-gray-600">
              <span className="font-medium">{photoCount}</span> kuva{photoCount !== 1 ? 'a' : ''} tallennettu
            </div>
            <div className="text-gray-600">
              Yhteensä: <span className="font-medium">{totalSizeFormatted}</span>
            </div>
          </div>

          {hasBothPhotos && (
            <div className="mt-2 flex items-center text-green-600">
              <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="text-sm font-medium">Ennen ja jälkeen kuvat valmiit!</span>
            </div>
          )}
        </motion.div>
      )}

      {/* Quick Action Buttons */}
      {photoCount === 0 && (
        <div className="flex flex-col sm:flex-row gap-3">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => handleAddPhoto('before')}
            className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 text-white py-4 px-6 rounded-xl font-medium shadow-lg hover:shadow-xl transition-shadow"
          >
            <div className="flex items-center justify-center space-x-3">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>Ota kuva ennen</span>
            </div>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => handleAddPhoto('after')}
            className="flex-1 bg-gradient-to-r from-green-600 to-green-700 text-white py-4 px-6 rounded-xl font-medium shadow-lg hover:shadow-xl transition-shadow"
          >
            <div className="flex items-center justify-center space-x-3">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>Ota kuva jälkeen</span>
            </div>
          </motion.button>
        </div>
      )}

      {/* Camera Modal */}
      {showCamera && (
        <CameraCapture
          type={cameraType}
          onCapture={handleCameraCapture}
          onClose={() => setShowCamera(false)}
          existingPhoto={cameraType === 'before' ? beforePhoto || undefined : afterPhoto || undefined}
        />
      )}
    </div>
  );
}