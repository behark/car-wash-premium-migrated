/**
 * Photo Manager Hook
 * Handles photo storage, compression, and management for bookings
 */

import { useState, useEffect, useCallback } from 'react';

interface PhotoData {
  id: string;
  type: 'before' | 'after';
  dataUrl: string;
  timestamp: number;
  compressed?: string;
  size?: number;
}

interface PhotoManagerState {
  beforePhoto: string | null;
  afterPhoto: string | null;
  photos: PhotoData[];
  isCompressing: boolean;
}

interface UsePhotoManagerOptions {
  bookingId?: number;
  maxFileSize?: number; // in bytes
  quality?: number; // 0-1
  autoSave?: boolean;
}

export function usePhotoManager(options: UsePhotoManagerOptions = {}) {
  const {
    bookingId,
    maxFileSize = 1024 * 1024 * 2, // 2MB default
    quality = 0.8,
    autoSave = false,
  } = options;

  const [state, setState] = useState<PhotoManagerState>({
    beforePhoto: null,
    afterPhoto: null,
    photos: [],
    isCompressing: false,
  });

  const loadPhotos = useCallback(() => {
    try {
      const stored = localStorage.getItem(`booking_photos_${bookingId}`);
      if (stored) {
        const photos: PhotoData[] = JSON.parse(stored);
        const beforePhoto = photos.find(p => p.type === 'before');
        const afterPhoto = photos.find(p => p.type === 'after');

        setState({
          beforePhoto: beforePhoto?.dataUrl || null,
          afterPhoto: afterPhoto?.dataUrl || null,
          photos,
          isCompressing: false,
        });
      }
    } catch (error) {
      console.error('Failed to load photos:', error);
    }
  }, [bookingId]);

  const savePhotos = useCallback(() => {
    try {
      if (bookingId) {
        localStorage.setItem(`booking_photos_${bookingId}`, JSON.stringify(state.photos));
      }
    } catch (error) {
      console.error('Failed to save photos:', error);
    }
  }, [bookingId, state.photos]);

  // Load photos from localStorage on mount
  useEffect(() => {
    if (bookingId) {
      loadPhotos();
    }
  }, [bookingId, loadPhotos]);

  // Auto-save photos when they change
  useEffect(() => {
    if (autoSave && bookingId && state.photos.length > 0) {
      savePhotos();
    }
  }, [autoSave, bookingId, state.photos, savePhotos]);

  const compressImage = useCallback((
    dataUrl: string,
    targetQuality: number = quality
  ): Promise<string> => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      const image = new Image();

      image.onload = () => {
        // Calculate new dimensions while maintaining aspect ratio
        const maxWidth = 1280;
        const maxHeight = 720;
        let { width, height } = image;

        if (width > maxWidth || height > maxHeight) {
          const aspectRatio = width / height;
          if (width > height) {
            width = maxWidth;
            height = width / aspectRatio;
          } else {
            height = maxHeight;
            width = height * aspectRatio;
          }
        }

        canvas.width = width;
        canvas.height = height;

        // Draw and compress
        ctx.drawImage(image, 0, 0, width, height);
        const compressed = canvas.toDataURL('image/jpeg', targetQuality);
        resolve(compressed);
      };

      image.src = dataUrl;
    });
  }, [quality]);

  const addPhoto = useCallback(async (dataUrl: string, type: 'before' | 'after') => {
    setState(prev => ({ ...prev, isCompressing: true }));

    try {
      // Compress the image
      const compressed = await compressImage(dataUrl);

      // Calculate file size
      const size = Math.round((compressed.length * 3) / 4); // Approximate base64 to bytes

      const photoData: PhotoData = {
        id: `${type}_${Date.now()}`,
        type,
        dataUrl: compressed,
        timestamp: Date.now(),
        size,
      };

      setState(prev => {
        const filteredPhotos = prev.photos.filter(p => p.type !== type);
        const newPhotos = [...filteredPhotos, photoData];

        return {
          ...prev,
          photos: newPhotos,
          [type === 'before' ? 'beforePhoto' : 'afterPhoto']: compressed,
          isCompressing: false,
        };
      });

      // Save immediately if auto-save is enabled
      if (autoSave && bookingId) {
        setTimeout(savePhotos, 100);
      }

      return photoData;
    } catch (error) {
      console.error('Failed to compress image:', error);
      setState(prev => ({ ...prev, isCompressing: false }));
      throw error;
    }
  }, [compressImage, autoSave, bookingId, savePhotos]);

  const removePhoto = useCallback((type: 'before' | 'after') => {
    setState(prev => {
      const filteredPhotos = prev.photos.filter(p => p.type !== type);
      return {
        ...prev,
        photos: filteredPhotos,
        [type === 'before' ? 'beforePhoto' : 'afterPhoto']: null,
      };
    });

    if (autoSave && bookingId) {
      setTimeout(savePhotos, 100);
    }
  }, [autoSave, bookingId, savePhotos]);

  const clearAllPhotos = useCallback(() => {
    setState({
      beforePhoto: null,
      afterPhoto: null,
      photos: [],
      isCompressing: false,
    });

    if (bookingId) {
      localStorage.removeItem(`booking_photos_${bookingId}`);
    }
  }, [bookingId]);

  const exportPhotos = useCallback(() => {
    return state.photos.map(photo => ({
      ...photo,
      bookingId,
    }));
  }, [state.photos, bookingId]);

  const getPhotoInfo = useCallback((type: 'before' | 'after') => {
    const photo = state.photos.find(p => p.type === type);
    return photo ? {
      size: photo.size || 0,
      timestamp: photo.timestamp,
      sizeFormatted: formatFileSize(photo.size || 0),
      timestampFormatted: new Date(photo.timestamp).toLocaleString('fi-FI'),
    } : null;
  }, [state.photos]);

  // Calculate total size
  const totalSize = state.photos.reduce((sum, photo) => sum + (photo.size || 0), 0);
  const totalSizeFormatted = formatFileSize(totalSize);

  // Check if storage limit exceeded
  const isOverSizeLimit = totalSize > maxFileSize;

  return {
    // State
    beforePhoto: state.beforePhoto,
    afterPhoto: state.afterPhoto,
    photos: state.photos,
    isCompressing: state.isCompressing,

    // Actions
    addPhoto,
    removePhoto,
    clearAllPhotos,
    savePhotos,
    loadPhotos,

    // Utils
    exportPhotos,
    getPhotoInfo,

    // Stats
    totalSize,
    totalSizeFormatted,
    isOverSizeLimit,
    photoCount: state.photos.length,
    hasBeforePhoto: !!state.beforePhoto,
    hasAfterPhoto: !!state.afterPhoto,
    hasBothPhotos: !!(state.beforePhoto && state.afterPhoto),
  };
}

// Utility function to format file sizes
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default usePhotoManager;