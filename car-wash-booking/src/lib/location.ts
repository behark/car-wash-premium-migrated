/**
 * Location Services Library
 * Handles geolocation, directions, and location-based features
 */

export interface LocationCoordinates {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp?: number;
}

export interface LocationError {
  code: number;
  message: string;
}

export interface DirectionsOptions {
  origin: LocationCoordinates | string;
  destination: LocationCoordinates | string;
  mode?: 'driving' | 'walking' | 'transit' | 'bicycling';
  avoidTolls?: boolean;
  avoidHighways?: boolean;
}

// Car wash location (Kiilto Loisto - example coordinates for Helsinki)
export const CAR_WASH_LOCATION: LocationCoordinates = {
  latitude: 60.1699,
  longitude: 24.9384,
};

export const CAR_WASH_ADDRESS = 'Mannerheimintie 100, 00250 Helsinki, Finland';

/**
 * Check if geolocation is supported
 */
export function isGeolocationSupported(): boolean {
  return typeof navigator !== 'undefined' && 'geolocation' in navigator;
}

/**
 * Get current user location
 */
export function getCurrentLocation(
  options: {
    enableHighAccuracy?: boolean;
    timeout?: number;
    maximumAge?: number;
  } = {}
): Promise<LocationCoordinates> {
  return new Promise((resolve, reject) => {
    if (!isGeolocationSupported()) {
      reject({
        code: 0,
        message: 'Geolocation is not supported by this browser',
      });
      return;
    }

    const defaultOptions = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 300000, // 5 minutes
    };

    const finalOptions = { ...defaultOptions, ...options };

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
        });
      },
      (error) => {
        let message = 'Unknown location error';

        switch (error.code) {
          case error.PERMISSION_DENIED:
            message = 'Location access denied by user';
            break;
          case error.POSITION_UNAVAILABLE:
            message = 'Location information is unavailable';
            break;
          case error.TIMEOUT:
            message = 'Location request timed out';
            break;
        }

        reject({
          code: error.code,
          message,
        });
      },
      finalOptions
    );
  });
}

/**
 * Watch user location changes
 */
export function watchLocation(
  callback: (location: LocationCoordinates) => void,
  errorCallback?: (error: LocationError) => void,
  options: {
    enableHighAccuracy?: boolean;
    timeout?: number;
    maximumAge?: number;
  } = {}
): number | null {
  if (!isGeolocationSupported()) {
    errorCallback?.({
      code: 0,
      message: 'Geolocation is not supported by this browser',
    });
    return null;
  }

  const defaultOptions = {
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 60000, // 1 minute
  };

  const finalOptions = { ...defaultOptions, ...options };

  return navigator.geolocation.watchPosition(
    (position) => {
      callback({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: position.timestamp,
      });
    },
    (error) => {
      let message = 'Unknown location error';

      switch (error.code) {
        case error.PERMISSION_DENIED:
          message = 'Location access denied by user';
          break;
        case error.POSITION_UNAVAILABLE:
          message = 'Location information is unavailable';
          break;
        case error.TIMEOUT:
          message = 'Location request timed out';
          break;
      }

      errorCallback?.({
        code: error.code,
        message,
      });
    },
    finalOptions
  );
}

/**
 * Clear location watching
 */
export function clearLocationWatch(watchId: number): void {
  if (isGeolocationSupported()) {
    navigator.geolocation.clearWatch(watchId);
  }
}

/**
 * Calculate distance between two points using Haversine formula
 */
export function calculateDistance(
  point1: LocationCoordinates,
  point2: LocationCoordinates
): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRad(point2.latitude - point1.latitude);
  const dLon = toRad(point2.longitude - point1.longitude);

  const lat1 = toRad(point1.latitude);
  const lat2 = toRad(point2.latitude);

  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Format distance for display
 */
export function formatDistance(distance: number): string {
  if (distance < 1) {
    return `${Math.round(distance * 1000)} m`;
  } else {
    return `${distance.toFixed(1)} km`;
  }
}

/**
 * Get estimated travel time (rough approximation)
 */
export function getEstimatedTravelTime(
  distance: number,
  mode: 'driving' | 'walking' | 'transit' | 'bicycling' = 'driving'
): number {
  // Average speeds in km/h
  const speeds = {
    driving: 30,   // City driving
    walking: 5,    // Walking speed
    transit: 20,   // Public transport
    bicycling: 15, // Cycling speed
  };

  const hours = distance / speeds[mode];
  return Math.round(hours * 60); // Return minutes
}

/**
 * Format travel time for display
 */
export function formatTravelTime(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  } else {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (remainingMinutes === 0) {
      return `${hours} h`;
    } else {
      return `${hours} h ${remainingMinutes} min`;
    }
  }
}

/**
 * Open directions in external map app
 */
export function openDirections(
  destination: LocationCoordinates | string = CAR_WASH_LOCATION,
  origin?: LocationCoordinates | string,
  mode: 'driving' | 'walking' | 'transit' | 'bicycling' = 'driving'
): void {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isAndroid = /Android/.test(navigator.userAgent);

  let url = '';

  // Format coordinates for URL
  const formatCoords = (coords: LocationCoordinates | string): string => {
    if (typeof coords === 'string') {
      return encodeURIComponent(coords);
    }
    return `${coords.latitude},${coords.longitude}`;
  };

  const destinationStr = formatCoords(destination);
  const originStr = origin ? formatCoords(origin) : '';

  if (isIOS) {
    // iOS - Apple Maps
    const modeMap = {
      driving: 'd',
      walking: 'w',
      transit: 'r',
      bicycling: 'w', // Apple Maps doesn't have bicycling, use walking
    };

    url = `maps://maps.apple.com/?daddr=${destinationStr}`;
    if (originStr) {
      url += `&saddr=${originStr}`;
    }
    url += `&dirflg=${modeMap[mode]}`;
  } else if (isAndroid) {
    // Android - Google Maps
    const modeMap = {
      driving: 'driving',
      walking: 'walking',
      transit: 'transit',
      bicycling: 'bicycling',
    };

    url = `google.navigation:q=${destinationStr}`;
    if (mode !== 'driving') {
      url = `https://maps.google.com/maps?dir=${originStr ? originStr + '/' : ''}${destinationStr}&mode=${modeMap[mode]}`;
    }
  } else {
    // Desktop/Web - Google Maps
    const modeMap = {
      driving: 'driving',
      walking: 'walking',
      transit: 'transit',
      bicycling: 'bicycling',
    };

    url = `https://maps.google.com/maps?dir=${originStr ? originStr + '/' : ''}${destinationStr}&mode=${modeMap[mode]}`;
  }

  // Open in new tab/app
  window.open(url, '_blank');
}

/**
 * Open car wash location in maps
 */
export function openCarWashDirections(
  userLocation?: LocationCoordinates,
  mode: 'driving' | 'walking' | 'transit' | 'bicycling' = 'driving'
): void {
  openDirections(CAR_WASH_LOCATION, userLocation, mode);
}

/**
 * Check if user is near the car wash location
 */
export function isNearCarWash(
  userLocation: LocationCoordinates,
  radiusKm: number = 0.1 // 100 meters
): boolean {
  const distance = calculateDistance(userLocation, CAR_WASH_LOCATION);
  return distance <= radiusKm;
}

/**
 * Request location permission
 */
export async function requestLocationPermission(): Promise<PermissionState> {
  if (!('permissions' in navigator)) {
    // Fallback: try to get location to trigger permission prompt
    try {
      await getCurrentLocation({ timeout: 1000 });
      return 'granted';
    } catch {
      return 'denied';
    }
  }

  try {
    const permission = await navigator.permissions.query({ name: 'geolocation' });
    return permission.state;
  } catch {
    // Fallback for older browsers
    try {
      await getCurrentLocation({ timeout: 1000 });
      return 'granted';
    } catch {
      return 'denied';
    }
  }
}

/**
 * Get location permission status
 */
export async function getLocationPermissionStatus(): Promise<PermissionState> {
  if (!('permissions' in navigator)) {
    return 'prompt';
  }

  try {
    const permission = await navigator.permissions.query({ name: 'geolocation' });
    return permission.state;
  } catch {
    return 'prompt';
  }
}

/**
 * React hooks for location functionality
 */
export function useGeolocation(
  options: {
    enableHighAccuracy?: boolean;
    timeout?: number;
    maximumAge?: number;
    watch?: boolean;
  } = {}
) {
  const [location, setLocation] = useState<LocationCoordinates | null>(null);
  const [error, setError] = useState<LocationError | null>(null);
  const [loading, setLoading] = useState(false);
  const [permission, setPermission] = useState<PermissionState>('prompt');

  useEffect(() => {
    // Check initial permission status
    getLocationPermissionStatus().then(setPermission);
  }, []);

  const getCurrentPos = async () => {
    if (!isGeolocationSupported()) {
      setError({ code: 0, message: 'Geolocation not supported' });
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const position = await getCurrentLocation(options);
      setLocation(position);
      setPermission('granted');
    } catch (err: any) {
      setError(err);
      if (err.code === 1) {
        setPermission('denied');
      }
    } finally {
      setLoading(false);
    }
  };

  const requestPermission = async () => {
    const newPermission = await requestLocationPermission();
    setPermission(newPermission);

    if (newPermission === 'granted') {
      getCurrentPos();
    }
  };

  useEffect(() => {
    if (options.watch && location && permission === 'granted') {
      const watchId = watchLocation(
        setLocation,
        setError,
        options
      );

      return () => {
        if (watchId !== null) {
          clearLocationWatch(watchId);
        }
      };
    }
  }, [options.watch, permission, location, options]);

  return {
    location,
    error,
    loading,
    permission,
    getCurrentLocation: getCurrentPos,
    requestPermission,
    isSupported: isGeolocationSupported(),
  };
}

export function useDistanceToCarWash(userLocation: LocationCoordinates | null) {
  const [distance, setDistance] = useState<number | null>(null);
  const [travelTime, setTravelTime] = useState<number | null>(null);

  useEffect(() => {
    if (userLocation) {
      const dist = calculateDistance(userLocation, CAR_WASH_LOCATION);
      const time = getEstimatedTravelTime(dist, 'driving');

      setDistance(dist);
      setTravelTime(time);
    } else {
      setDistance(null);
      setTravelTime(null);
    }
  }, [userLocation]);

  return {
    distance,
    travelTime,
    formattedDistance: distance ? formatDistance(distance) : null,
    formattedTravelTime: travelTime ? formatTravelTime(travelTime) : null,
    isNearby: distance ? distance <= 0.1 : false, // Within 100m
  };
}

import { useState, useEffect } from 'react';

const locationUtils = {
  isGeolocationSupported,
  getCurrentLocation,
  watchLocation,
  clearLocationWatch,
  calculateDistance,
  formatDistance,
  getEstimatedTravelTime,
  formatTravelTime,
  openDirections,
  openCarWashDirections,
  isNearCarWash,
  requestLocationPermission,
  getLocationPermissionStatus,
  useGeolocation,
  useDistanceToCarWash,
  CAR_WASH_LOCATION,
  CAR_WASH_ADDRESS,
};

export default locationUtils;