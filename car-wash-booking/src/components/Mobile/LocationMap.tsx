/**
 * Location Map Component
 * Shows directions to car wash and location-based features
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  useGeolocation,
  useDistanceToCarWash,
  openCarWashDirections,
  CAR_WASH_ADDRESS,
} from '../../lib/location';

interface LocationMapProps {
  showDirections?: boolean;
  showDistance?: boolean;
  className?: string;
}

export default function LocationMap({
  showDirections = true,
  showDistance = true,
  className = '',
}: LocationMapProps) {
  const {
    location,
    error,
    loading,
    permission,
    getCurrentLocation,
    requestPermission,
    isSupported,
  } = useGeolocation();

  const {
    formattedDistance,
    formattedTravelTime,
    isNearby,
  } = useDistanceToCarWash(location);

  const [selectedMode, setSelectedMode] = useState<'driving' | 'walking' | 'transit' | 'bicycling'>('driving');

  const handleGetDirections = () => {
    openCarWashDirections(location || undefined, selectedMode);
  };

  const handleRequestLocation = () => {
    if (permission === 'prompt' || permission === 'denied') {
      requestPermission();
    } else {
      getCurrentLocation();
    }
  };

  const transportModes = [
    {
      id: 'driving' as const,
      name: 'Auto',
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.22.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>
        </svg>
      ),
    },
    {
      id: 'walking' as const,
      name: 'Kävely',
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M13.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM9.8 8.9L7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3C14.8 12 16.8 13 19 13v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1L9 8.3V13h2V9.6l-.2-.7z"/>
        </svg>
      ),
    },
    {
      id: 'transit' as const,
      name: 'Julkinen',
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2c-4.42 0-8 .5-8 4v10c0 .88.39 1.67 1 2.22V20c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h8v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4zM7.5 17c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm1.5-6H6V6h12v5z"/>
        </svg>
      ),
    },
    {
      id: 'bicycling' as const,
      name: 'Pyörä',
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M15.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM5 12c-2.8 0-5 2.2-5 5s2.2 5 5 5 5-2.2 5-5-2.2-5-5-5zm0 8.5c-1.9 0-3.5-1.6-3.5-3.5s1.6-3.5 3.5-3.5 3.5 1.6 3.5 3.5-1.6 3.5-3.5 3.5zm14.8-9.6c-.4-.2-.8-.3-1.3-.3-.4 0-.8.1-1.1.3l-1.5.9L9.8 8.5C9.4 8.2 9 8 8.5 8c-.6 0-1.1.2-1.5.6L5.5 10l1.4 1.4 1.5-1.5 6.1 2.2-1.4 1.4c-.4.4-.6.9-.6 1.5 0 .6.2 1.1.6 1.5L18 22l1.4-1.4-5.9-5.9c-.2-.2-.2-.5 0-.7l1.5-1.5L19 12c2.8 0 5 2.2 5 5s-2.2 5-5 5-5-2.2-5-5c0-.9.2-1.7.6-2.4L12.4 13l.5-2.1c1.2-.4 2.1-1.5 2.1-2.8 0-.2 0-.4-.1-.6L16.5 8h2.4l.1 2.1h2V8c0-1.1-.9-2-2-2h-3.8l-1.9-1.9z"/>
        </svg>
      ),
    },
  ];

  if (!isSupported) {
    return (
      <div className={`bg-white rounded-2xl p-6 shadow-sm border ${className}`}>
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Sijainti ei saatavilla</h3>
            <p className="text-gray-600 text-sm">Selaimesi ei tue sijaintitietoja</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-2xl shadow-sm border overflow-hidden ${className}`}>
      {/* Header */}
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
            <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
              <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Reittiohjeet</h3>
            <p className="text-gray-600 text-sm">KiiltoLoisto Autopesu</p>
          </div>
        </div>
      </div>

      {/* Location Status */}
      <div className="p-6 space-y-4">
        {/* Permission Request */}
        {permission === 'prompt' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-blue-50 rounded-xl p-4"
          >
            <div className="flex items-start space-x-3">
              <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="currentColor" viewBox="0 0 24 24">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <div className="flex-1">
                <p className="text-blue-800 font-medium text-sm">
                  Salli sijaintien käyttö saadaksesi reittiohjeet
                </p>
                <p className="text-blue-600 text-xs mt-1">
                  Tarvitsemme sijaintisi näyttääksemme matka-ajan ja suunnan
                </p>
                <button
                  onClick={handleRequestLocation}
                  className="mt-2 bg-blue-600 hover:bg-blue-700 text-white text-sm px-3 py-1.5 rounded-lg transition-colors"
                >
                  Salli sijainti
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Permission Denied */}
        {permission === 'denied' && (
          <div className="bg-red-50 rounded-xl p-4">
            <div className="flex items-start space-x-3">
              <svg className="w-5 h-5 text-red-600 mt-0.5" fill="currentColor" viewBox="0 0 24 24">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <div className="flex-1">
                <p className="text-red-800 font-medium text-sm">Sijainti estetty</p>
                <p className="text-red-600 text-xs mt-1">
                  Salli sijainti selaimen asetuksista käyttääksesi reittejä
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center space-x-2 text-blue-600">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
            <span className="text-sm">Haetaan sijaintia...</span>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-orange-50 rounded-xl p-4">
            <div className="flex items-start space-x-3">
              <svg className="w-5 h-5 text-orange-600 mt-0.5" fill="currentColor" viewBox="0 0 24 24">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <div className="flex-1">
                <p className="text-orange-800 font-medium text-sm">Sijaintia ei voitu hakea</p>
                <p className="text-orange-600 text-xs mt-1">{error.message}</p>
                <button
                  onClick={getCurrentLocation}
                  className="mt-2 bg-orange-600 hover:bg-orange-700 text-white text-sm px-3 py-1.5 rounded-lg transition-colors"
                >
                  Yritä uudelleen
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Distance and Travel Time */}
        {showDistance && location && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-r from-green-50 to-blue-50 rounded-xl p-4"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-2xl font-bold text-gray-900">{formattedDistance}</span>
                  {isNearby && (
                    <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full font-medium">
                      Lähistöllä
                    </span>
                  )}
                </div>
                <p className="text-gray-600 text-sm">Etäisyys autopesulaan</p>
              </div>
              <div className="text-right">
                <div className="text-lg font-semibold text-gray-900">{formattedTravelTime}</div>
                <p className="text-gray-600 text-sm">Matka-aika autolla</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Address */}
        <div className="bg-gray-50 rounded-xl p-4">
          <div className="flex items-start space-x-3">
            <svg className="w-5 h-5 text-gray-500 mt-0.5" fill="currentColor" viewBox="0 0 24 24">
              <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
            </svg>
            <div>
              <p className="font-medium text-gray-900">KiiltoLoisto Autopesu</p>
              <p className="text-gray-600 text-sm">{CAR_WASH_ADDRESS}</p>
            </div>
          </div>
        </div>

        {/* Transport Mode Selection */}
        {showDirections && (
          <div className="space-y-3">
            <p className="font-medium text-gray-900 text-sm">Valitse kulkutapa:</p>
            <div className="grid grid-cols-4 gap-2">
              {transportModes.map((mode) => (
                <button
                  key={mode.id}
                  onClick={() => setSelectedMode(mode.id)}
                  className={`flex flex-col items-center space-y-1 p-3 rounded-xl border-2 transition-all ${
                    selectedMode === mode.id
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 hover:border-gray-300 text-gray-600 hover:text-gray-700'
                  }`}
                >
                  {mode.icon}
                  <span className="text-xs font-medium">{mode.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-3">
          {showDirections && (
            <button
              onClick={handleGetDirections}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-xl transition-colors flex items-center justify-center space-x-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-1.447-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
              <span>Avaa reittiohjeet</span>
            </button>
          )}

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => window.open(`tel:+358401234567`, '_self')}
              className="flex items-center justify-center space-x-2 bg-green-600 hover:bg-green-700 text-white font-medium py-2.5 px-4 rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
              </svg>
              <span>Soita</span>
            </button>

            <button
              onClick={() => window.open(`https://wa.me/358401234567`, '_blank')}
              className="flex items-center justify-center space-x-2 bg-green-500 hover:bg-green-600 text-white font-medium py-2.5 px-4 rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.465 3.788" />
              </svg>
              <span>WhatsApp</span>
            </button>
          </div>
        </div>
      </div>

      {/* Arrival Detection */}
      {isNearby && location && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mx-6 mb-6 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl p-4"
        >
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <p className="font-semibold">Olet perillä!</p>
              <p className="text-green-100 text-sm">Tervetuloa KiiltoLoisto Autopesulaan</p>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}

// Compact location widget for headers/navigation
export function LocationWidget() {
  const { location, permission } = useGeolocation();
  const { formattedDistance, formattedTravelTime } = useDistanceToCarWash(location);

  if (permission !== 'granted' || !location) {
    return null;
  }

  return (
    <div className="flex items-center space-x-2 text-sm text-gray-600">
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
        <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
      </svg>
      <span>{formattedDistance}</span>
      <span className="text-gray-400">•</span>
      <span>{formattedTravelTime}</span>
    </div>
  );
}