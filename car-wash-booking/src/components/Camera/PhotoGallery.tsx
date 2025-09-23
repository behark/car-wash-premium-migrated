/**
 * Photo Gallery Component
 * Displays before/after photos with comparison view
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';

interface PhotoGalleryProps {
  beforePhoto?: string;
  afterPhoto?: string;
  onAddPhoto: (type: 'before' | 'after') => void;
  onRemovePhoto: (type: 'before' | 'after') => void;
  className?: string;
}

export default function PhotoGallery({
  beforePhoto,
  afterPhoto,
  onAddPhoto,
  onRemovePhoto,
  className = '',
}: PhotoGalleryProps) {
  const [viewMode, setViewMode] = useState<'grid' | 'comparison'>('grid');
  const [fullscreenPhoto, setFullscreenPhoto] = useState<string | null>(null);

  const hasPhotos = beforePhoto || afterPhoto;
  const hasBothPhotos = beforePhoto && afterPhoto;

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header with View Toggle */}
      {hasPhotos && (
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Kuvat</h3>
          {hasBothPhotos && (
            <div className="bg-gray-100 rounded-lg p-1 flex">
              <button
                onClick={() => setViewMode('grid')}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Ruudukko
              </button>
              <button
                onClick={() => setViewMode('comparison')}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  viewMode === 'comparison'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Vertailu
              </button>
            </div>
          )}
        </div>
      )}

      {/* Photo Display */}
      <AnimatePresence mode="wait">
        {!hasPhotos ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="text-center py-12 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-300"
          >
            <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h4 className="text-gray-900 font-medium mb-2">Ei kuvia vielä</h4>
            <p className="text-gray-500 text-sm mb-6">
              Ota kuvia ajoneuvostasi ennen ja jälkeen pesun
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => onAddPhoto('before')}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                📷 Ennen pesua
              </button>
              <button
                onClick={() => onAddPhoto('after')}
                className="bg-green-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-green-700 transition-colors"
              >
                📷 Pesun jälkeen
              </button>
            </div>
          </motion.div>
        ) : viewMode === 'grid' ? (
          <motion.div
            key="grid"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
          >
            {/* Before Photo */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-gray-900">Ennen pesua</h4>
                {beforePhoto && (
                  <button
                    onClick={() => onRemovePhoto('before')}
                    className="text-red-500 hover:text-red-700 transition-colors p-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
              {beforePhoto ? (
                <motion.div
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setFullscreenPhoto(beforePhoto)}
                  className="relative aspect-[4/3] bg-gray-100 rounded-xl overflow-hidden cursor-pointer group"
                >
                  <Image
                    src={beforePhoto}
                    alt="Ennen pesua"
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                    <svg className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                    </svg>
                  </div>
                </motion.div>
              ) : (
                <button
                  onClick={() => onAddPhoto('before')}
                  className="w-full aspect-[4/3] bg-gray-100 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center text-gray-500 hover:text-blue-600 hover:border-blue-300 transition-colors"
                >
                  <svg className="w-12 h-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span className="font-medium">Lisää kuva</span>
                </button>
              )}
            </div>

            {/* After Photo */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-gray-900">Pesun jälkeen</h4>
                {afterPhoto && (
                  <button
                    onClick={() => onRemovePhoto('after')}
                    className="text-red-500 hover:text-red-700 transition-colors p-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
              {afterPhoto ? (
                <motion.div
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setFullscreenPhoto(afterPhoto)}
                  className="relative aspect-[4/3] bg-gray-100 rounded-xl overflow-hidden cursor-pointer group"
                >
                  <Image
                    src={afterPhoto}
                    alt="Pesun jälkeen"
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                    <svg className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                    </svg>
                  </div>
                </motion.div>
              ) : (
                <button
                  onClick={() => onAddPhoto('after')}
                  className="w-full aspect-[4/3] bg-gray-100 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center text-gray-500 hover:text-green-600 hover:border-green-300 transition-colors"
                >
                  <svg className="w-12 h-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span className="font-medium">Lisää kuva</span>
                </button>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="comparison"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="bg-gray-50 rounded-xl p-6"
          >
            <h4 className="text-center font-medium text-gray-900 mb-4">Ennen ja jälkeen vertailu</h4>
            <div className="relative">
              <div className="flex rounded-xl overflow-hidden">
                <div className="flex-1 relative aspect-[4/3]">
                  {beforePhoto ? (
                    <Image
                      src={beforePhoto}
                      alt="Ennen pesua"
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                      <span className="text-gray-500">Ei kuvaa</span>
                    </div>
                  )}
                  <div className="absolute bottom-2 left-2 bg-black/70 text-white px-2 py-1 rounded text-xs">
                    Ennen
                  </div>
                </div>
                <div className="w-px bg-white"></div>
                <div className="flex-1 relative aspect-[4/3]">
                  {afterPhoto ? (
                    <Image
                      src={afterPhoto}
                      alt="Pesun jälkeen"
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                      <span className="text-gray-500">Ei kuvaa</span>
                    </div>
                  )}
                  <div className="absolute bottom-2 right-2 bg-black/70 text-white px-2 py-1 rounded text-xs">
                    Jälkeen
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Fullscreen Modal */}
      <AnimatePresence>
        {fullscreenPhoto && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4"
            onClick={() => setFullscreenPhoto(null)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="relative max-w-4xl max-h-full"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setFullscreenPhoto(null)}
                className="absolute -top-12 right-0 text-white hover:text-gray-300 transition-colors"
              >
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <Image
                src={fullscreenPhoto}
                alt="Kuva"
                width={1280}
                height={720}
                className="rounded-lg max-h-[80vh] w-auto object-contain"
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}