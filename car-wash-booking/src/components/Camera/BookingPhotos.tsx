/**
 * Simple Booking Photos Placeholder (Memory Optimized)
 * Replaces complex camera integration
 */

import React from 'react';

interface BookingPhotosProps {
  bookingId?: number | string;
  className?: string;
  onPhotosChange?: (photos: any[]) => void;
  showInstructions?: boolean;
}

export default function BookingPhotos({
  bookingId,
  className,
  onPhotosChange,
  showInstructions = true
}: BookingPhotosProps) {
  return (
    <div className={`bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl p-8 text-center ${className}`}>
      <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
        <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path>
        </svg>
      </div>

      <h3 className="text-lg font-semibold text-gray-700 mb-2">
        Kuvat (Valinnainen)
      </h3>

      <p className="text-gray-600 text-sm mb-4">
        Kameraominaisuus on tilapäisesti pois käytöstä järjestelmän optimoinnin vuoksi.
      </p>

      {showInstructions && (
        <div className="text-left bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
          <h4 className="font-medium text-blue-800 mb-2">💡 Vaihtoehtoiset tavat:</h4>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• Ota kuvat puhelimellasi</li>
            <li>• Lähetä sähköpostilla: Info@kiiltoloisto.fi</li>
            <li>• Tai tuo kuvat paikan päälle</li>
          </ul>
        </div>
      )}
    </div>
  );
}