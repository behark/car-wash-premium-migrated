/**
 * Push Notifications Client-Side Library
 * Handles subscription management, permission requests, and notification display
 */

import { useState, useEffect } from 'react';

export interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  image?: string;
  data?: any;
  actions?: NotificationAction[];
  tag?: string;
  renotify?: boolean;
  silent?: boolean;
  vibrate?: number[];
  timestamp?: number;
}

export interface NotificationAction {
  action: string;
  title: string;
  icon?: string;
}

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';

/**
 * Check if push notifications are supported
 */
export function isPushNotificationSupported(): boolean {
  if (typeof window === 'undefined') return false;

  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/**
 * Check current notification permission status
 */
export function getNotificationPermission(): NotificationPermission {
  if (!isPushNotificationSupported()) {
    return 'denied';
  }

  return Notification.permission;
}

/**
 * Request notification permission from user
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isPushNotificationSupported()) {
    throw new Error('Push notifications are not supported');
  }

  // Check if already granted
  if (Notification.permission === 'granted') {
    return 'granted';
  }

  // Request permission
  const permission = await Notification.requestPermission();

  // Log permission change
  console.log('Notification permission:', permission);

  return permission;
}

/**
 * Subscribe to push notifications
 */
export async function subscribeToPushNotifications(
  customerEmail?: string
): Promise<PushSubscriptionData | null> {
  if (!isPushNotificationSupported()) {
    throw new Error('Push notifications are not supported');
  }

  if (!VAPID_PUBLIC_KEY) {
    throw new Error('VAPID public key is not configured');
  }

  // Request permission first
  const permission = await requestNotificationPermission();
  if (permission !== 'granted') {
    throw new Error('Notification permission denied');
  }

  try {
    // Get service worker registration
    const registration = await navigator.serviceWorker.ready;

    // Check for existing subscription
    const existingSubscription = await registration.pushManager.getSubscription();
    if (existingSubscription) {
      // Update subscription on server
      const subscriptionData = {
        endpoint: existingSubscription.endpoint,
        keys: {
          p256dh: arrayBufferToBase64(existingSubscription.getKey('p256dh')!),
          auth: arrayBufferToBase64(existingSubscription.getKey('auth')!),
        },
      };

      await updateSubscriptionOnServer(subscriptionData, customerEmail);
      return subscriptionData;
    }

    // Convert VAPID key
    const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);

    // Subscribe to push manager
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKey as any,
    });

    // Convert subscription to our format
    const subscriptionData: PushSubscriptionData = {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: arrayBufferToBase64(subscription.getKey('p256dh')!),
        auth: arrayBufferToBase64(subscription.getKey('auth')!),
      },
    };

    // Send subscription to server
    await saveSubscriptionToServer(subscriptionData, customerEmail);

    console.log('Successfully subscribed to push notifications');
    return subscriptionData;

  } catch (error) {
    console.error('Failed to subscribe to push notifications:', error);
    throw error;
  }
}

/**
 * Unsubscribe from push notifications
 */
export async function unsubscribeFromPushNotifications(): Promise<boolean> {
  if (!isPushNotificationSupported()) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      // Unsubscribe from push manager
      await subscription.unsubscribe();

      // Remove subscription from server
      await removeSubscriptionFromServer(subscription.endpoint);

      console.log('Successfully unsubscribed from push notifications');
      return true;
    }

    return false;
  } catch (error) {
    console.error('Failed to unsubscribe from push notifications:', error);
    return false;
  }
}

/**
 * Get current push subscription
 */
export async function getCurrentPushSubscription(): Promise<PushSubscriptionData | null> {
  if (!isPushNotificationSupported()) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      return {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: arrayBufferToBase64(subscription.getKey('p256dh')!),
          auth: arrayBufferToBase64(subscription.getKey('auth')!),
        },
      };
    }

    return null;
  } catch (error) {
    console.error('Failed to get current push subscription:', error);
    return null;
  }
}

/**
 * Show a local notification (for testing or offline scenarios)
 */
export async function showLocalNotification(payload: NotificationPayload): Promise<void> {
  if (!isPushNotificationSupported()) {
    throw new Error('Notifications are not supported');
  }

  const permission = await requestNotificationPermission();
  if (permission !== 'granted') {
    throw new Error('Notification permission denied');
  }

  const registration = await navigator.serviceWorker.ready;

  const options = {
    body: payload.body,
    icon: payload.icon || '/icons/icon-192x192.svg',
    badge: payload.badge || '/icons/icon-72x72.svg',
    image: payload.image,
    data: payload.data,
    actions: payload.actions,
    tag: payload.tag,
    renotify: payload.renotify,
    silent: payload.silent,
    vibrate: payload.vibrate || [200, 100, 200],
    timestamp: payload.timestamp || Date.now(),
  } as any;

  await registration.showNotification(payload.title, options);
}

/**
 * Test push notification functionality
 */
export async function testPushNotification(): Promise<void> {
  await showLocalNotification({
    title: 'KiiltoLoisto Autopesu',
    body: 'Push-ilmoitukset toimivat! 🚗',
    icon: '/icons/icon-192x192.svg',
    data: { test: true },
    actions: [
      { action: 'view', title: 'Näytä', icon: '/icons/icon-72x72.svg' },
      { action: 'dismiss', title: 'Hylkää' },
    ],
  });
}

/**
 * Server API functions
 */

async function saveSubscriptionToServer(
  subscription: PushSubscriptionData,
  customerEmail?: string
): Promise<void> {
  const response = await fetch('/api/notifications/subscribe', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      customerEmail,
      userAgent: navigator.userAgent,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to save subscription to server');
  }
}

async function updateSubscriptionOnServer(
  subscription: PushSubscriptionData,
  customerEmail?: string
): Promise<void> {
  const response = await fetch('/api/notifications/subscribe', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      customerEmail,
      userAgent: navigator.userAgent,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to update subscription on server');
  }
}

async function removeSubscriptionFromServer(endpoint: string): Promise<void> {
  const response = await fetch('/api/notifications/unsubscribe', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ endpoint }),
  });

  if (!response.ok) {
    throw new Error('Failed to remove subscription from server');
  }
}

/**
 * Utility functions
 */

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

/**
 * Notification preferences management
 */
export interface NotificationPreferences {
  bookingReminders: boolean;
  paymentConfirmations: boolean;
  promotionalOffers: boolean;
  statusUpdates: boolean;
  reminderHoursBefore: number;
}

export async function getNotificationPreferences(
  customerEmail: string
): Promise<NotificationPreferences> {
  const response = await fetch(`/api/notifications/preferences?email=${encodeURIComponent(customerEmail)}`);

  if (!response.ok) {
    // Return default preferences if not found
    return {
      bookingReminders: true,
      paymentConfirmations: true,
      promotionalOffers: false,
      statusUpdates: true,
      reminderHoursBefore: 24,
    };
  }

  return response.json();
}

export async function updateNotificationPreferences(
  customerEmail: string,
  preferences: Partial<NotificationPreferences>
): Promise<void> {
  const response = await fetch('/api/notifications/preferences', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      customerEmail,
      ...preferences,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to update notification preferences');
  }
}

/**
 * Hooks for React components
 */
export function useNotificationPermission() {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    setIsSupported(isPushNotificationSupported());
    if (isPushNotificationSupported()) {
      setPermission(getNotificationPermission());
    }
  }, []);

  const requestPermission = async () => {
    const newPermission = await requestNotificationPermission();
    setPermission(newPermission);
    return newPermission;
  };

  return {
    permission,
    isSupported,
    requestPermission,
  };
}

export function usePushSubscription() {
  const [subscription, setSubscription] = useState<PushSubscriptionData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Load current subscription on mount
    getCurrentPushSubscription().then(setSubscription);
  }, []);

  const subscribe = async (customerEmail?: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const newSubscription = await subscribeToPushNotifications(customerEmail);
      setSubscription(newSubscription);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const unsubscribe = async () => {
    setIsLoading(true);
    setError(null);

    try {
      await unsubscribeFromPushNotifications();
      setSubscription(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    subscription,
    isLoading,
    error,
    subscribe,
    unsubscribe,
    isSubscribed: !!subscription,
  };
}

const pushNotificationsClient = {
  isPushNotificationSupported,
  getNotificationPermission,
  requestNotificationPermission,
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications,
  getCurrentPushSubscription,
  showLocalNotification,
  testPushNotification,
  getNotificationPreferences,
  updateNotificationPreferences,
  useNotificationPermission,
  usePushSubscription,
};

export default pushNotificationsClient;