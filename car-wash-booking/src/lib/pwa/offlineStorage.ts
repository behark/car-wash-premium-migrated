/**
 * Offline Storage Management using IndexedDB
 * Stores booking data, user preferences, and cached API responses for offline access
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb';

// Database schema definition
interface CarWashDB extends DBSchema {
  bookings: {
    key: string;
    value: OfflineBooking;
    indexes: { 'by-status': string; 'by-date': string };
  };
  services: {
    key: number;
    value: OfflineService;
  };
  userPreferences: {
    key: string;
    value: any;
  };
  apiCache: {
    key: string;
    value: CachedResponse;
    indexes: { 'by-timestamp': number };
  };
  syncQueue: {
    key: string;
    value: SyncQueueItem;
    indexes: { 'by-timestamp': number; 'by-type': string };
  };
}

export interface OfflineBooking {
  id: string;
  serviceId: number;
  serviceName: string;
  vehicleType: string;
  date: string;
  startTime: string;
  endTime: string;
  duration: number;
  priceCents: number;
  status: 'draft' | 'pending' | 'confirmed' | 'completed' | 'cancelled';
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  licensePlate?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  needsSync: boolean;
}

export interface OfflineService {
  id: number;
  titleFi: string;
  titleEn: string;
  descriptionFi: string;
  descriptionEn: string;
  priceCents: number;
  durationMinutes: number;
  capacity: number;
  image?: string;
  isActive: boolean;
}

export interface CachedResponse {
  url: string;
  method: string;
  data: any;
  timestamp: number;
  expiry: number;
}

export interface SyncQueueItem {
  id: string;
  type: 'booking' | 'payment' | 'notification';
  action: 'create' | 'update' | 'delete';
  data: any;
  timestamp: number;
  attempts: number;
  maxAttempts: number;
}

const DB_NAME = 'CarWashApp';
const DB_VERSION = 1;

let db: IDBPDatabase<CarWashDB> | null = null;

/**
 * Initialize the database
 */
export async function initDB(): Promise<IDBPDatabase<CarWashDB>> {
  if (db) return db;

  db = await openDB<CarWashDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Bookings store
      const bookingsStore = db.createObjectStore('bookings', {
        keyPath: 'id',
      });
      bookingsStore.createIndex('by-status', 'status');
      bookingsStore.createIndex('by-date', 'date');

      // Services store
      db.createObjectStore('services', {
        keyPath: 'id',
      });

      // User preferences store
      db.createObjectStore('userPreferences', {
        keyPath: 'key',
      });

      // API cache store
      const apiCacheStore = db.createObjectStore('apiCache', {
        keyPath: 'url',
      });
      apiCacheStore.createIndex('by-timestamp', 'timestamp');

      // Sync queue store
      const syncQueueStore = db.createObjectStore('syncQueue', {
        keyPath: 'id',
      });
      syncQueueStore.createIndex('by-timestamp', 'timestamp');
      syncQueueStore.createIndex('by-type', 'type');
    },
  });

  return db;
}

/**
 * Booking operations
 */
export const bookingStorage = {
  async save(booking: OfflineBooking): Promise<void> {
    const database = await initDB();
    await database.put('bookings', booking);
  },

  async get(id: string): Promise<OfflineBooking | undefined> {
    const database = await initDB();
    return database.get('bookings', id);
  },

  async getAll(): Promise<OfflineBooking[]> {
    const database = await initDB();
    return database.getAll('bookings');
  },

  async getAllByStatus(status: string): Promise<OfflineBooking[]> {
    const database = await initDB();
    return database.getAllFromIndex('bookings', 'by-status', status);
  },

  async delete(id: string): Promise<void> {
    const database = await initDB();
    await database.delete('bookings', id);
  },

  async getPendingSync(): Promise<OfflineBooking[]> {
    const database = await initDB();
    const bookings = await database.getAll('bookings');
    return bookings.filter(booking => booking.needsSync);
  },

  async markSynced(id: string): Promise<void> {
    const database = await initDB();
    const booking = await database.get('bookings', id);
    if (booking) {
      booking.needsSync = false;
      await database.put('bookings', booking);
    }
  },
};

/**
 * Service operations
 */
export const serviceStorage = {
  async save(service: OfflineService): Promise<void> {
    const database = await initDB();
    await database.put('services', service);
  },

  async saveAll(services: OfflineService[]): Promise<void> {
    const database = await initDB();
    const tx = database.transaction('services', 'readwrite');
    await Promise.all([
      ...services.map(service => tx.store.put(service)),
      tx.done,
    ]);
  },

  async get(id: number): Promise<OfflineService | undefined> {
    const database = await initDB();
    return database.get('services', id);
  },

  async getAll(): Promise<OfflineService[]> {
    const database = await initDB();
    return database.getAll('services');
  },

  async getActive(): Promise<OfflineService[]> {
    const database = await initDB();
    const services = await database.getAll('services');
    return services.filter(service => service.isActive);
  },

  async clear(): Promise<void> {
    const database = await initDB();
    await database.clear('services');
  },
};

/**
 * User preferences operations
 */
export const preferencesStorage = {
  async set(key: string, value: any): Promise<void> {
    const database = await initDB();
    await database.put('userPreferences', { key, value });
  },

  async get(key: string): Promise<any> {
    const database = await initDB();
    const result = await database.get('userPreferences', key);
    return result?.value;
  },

  async remove(key: string): Promise<void> {
    const database = await initDB();
    await database.delete('userPreferences', key);
  },

  async getAll(): Promise<Record<string, any>> {
    const database = await initDB();
    const preferences = await database.getAll('userPreferences');
    return preferences.reduce((acc, pref) => {
      acc[pref.key] = pref.value;
      return acc;
    }, {} as Record<string, any>);
  },
};

/**
 * API cache operations
 */
export const apiCache = {
  async set(url: string, method: string, data: any, ttl: number = 300000): Promise<void> {
    const database = await initDB();
    const cachedResponse: CachedResponse = {
      url,
      method,
      data,
      timestamp: Date.now(),
      expiry: Date.now() + ttl,
    };
    await database.put('apiCache', cachedResponse);
  },

  async get(url: string): Promise<any | null> {
    const database = await initDB();
    const cached = await database.get('apiCache', url);

    if (!cached) return null;

    if (Date.now() > cached.expiry) {
      await database.delete('apiCache', url);
      return null;
    }

    return cached.data;
  },

  async clear(): Promise<void> {
    const database = await initDB();
    await database.clear('apiCache');
  },

  async clearExpired(): Promise<void> {
    const database = await initDB();
    const cached = await database.getAll('apiCache');
    const now = Date.now();

    const tx = database.transaction('apiCache', 'readwrite');
    await Promise.all([
      ...cached
        .filter(item => now > item.expiry)
        .map(item => tx.store.delete(item.url)),
      tx.done,
    ]);
  },
};

/**
 * Sync queue operations
 */
export const syncQueue = {
  async add(item: Omit<SyncQueueItem, 'id' | 'timestamp' | 'attempts'>): Promise<void> {
    const database = await initDB();
    const queueItem: SyncQueueItem = {
      ...item,
      id: `${item.type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      attempts: 0,
    };
    await database.put('syncQueue', queueItem);
  },

  async getAll(): Promise<SyncQueueItem[]> {
    const database = await initDB();
    return database.getAll('syncQueue');
  },

  async getAllByType(type: string): Promise<SyncQueueItem[]> {
    const database = await initDB();
    return database.getAllFromIndex('syncQueue', 'by-type', type);
  },

  async remove(id: string): Promise<void> {
    const database = await initDB();
    await database.delete('syncQueue', id);
  },

  async incrementAttempts(id: string): Promise<void> {
    const database = await initDB();
    const item = await database.get('syncQueue', id);
    if (item) {
      item.attempts++;
      await database.put('syncQueue', item);
    }
  },

  async clear(): Promise<void> {
    const database = await initDB();
    await database.clear('syncQueue');
  },
};

/**
 * Utility functions
 */
export const offlineUtils = {
  async isOnline(): Promise<boolean> {
    if (typeof navigator === 'undefined') return true;
    return navigator.onLine;
  },

  async clearAllData(): Promise<void> {
    const database = await initDB();
    await Promise.all([
      database.clear('bookings'),
      database.clear('services'),
      database.clear('userPreferences'),
      database.clear('apiCache'),
      database.clear('syncQueue'),
    ]);
  },

  async getStorageStats(): Promise<{
    bookings: number;
    services: number;
    apiCache: number;
    syncQueue: number;
  }> {
    const database = await initDB();
    const [bookings, services, apiCache, syncQueue] = await Promise.all([
      database.count('bookings'),
      database.count('services'),
      database.count('apiCache'),
      database.count('syncQueue'),
    ]);

    return { bookings, services, apiCache, syncQueue };
  },

  async exportData(): Promise<string> {
    const database = await initDB();
    const [bookings, services, preferences] = await Promise.all([
      database.getAll('bookings'),
      database.getAll('services'),
      database.getAll('userPreferences'),
    ]);

    return JSON.stringify({
      bookings,
      services,
      preferences,
      exportDate: new Date().toISOString(),
    });
  },

  async importData(jsonData: string): Promise<void> {
    const data = JSON.parse(jsonData);
    const database = await initDB();

    if (data.services) {
      await serviceStorage.saveAll(data.services);
    }

    if (data.bookings) {
      const tx = database.transaction('bookings', 'readwrite');
      await Promise.all([
        ...data.bookings.map((booking: OfflineBooking) => tx.store.put(booking)),
        tx.done,
      ]);
    }

    if (data.preferences) {
      const tx = database.transaction('userPreferences', 'readwrite');
      await Promise.all([
        ...data.preferences.map((pref: any) => tx.store.put(pref)),
        tx.done,
      ]);
    }
  },
};

export default {
  initDB,
  bookingStorage,
  serviceStorage,
  preferencesStorage,
  apiCache,
  syncQueue,
  offlineUtils,
};