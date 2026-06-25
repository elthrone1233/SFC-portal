/**
 * SAINT FRANCIS CLINIC - Client-Side Real-Time Data Connection
 * 
 * Modified per "System-Wide Cache Removal and Direct MySQL Connection Optimization" directives.
 * Under this new architecture, all storage-based cache systems (IndexedDB, LocalStorage, etc.)
 * are completely disabled or uninstalled. Data is always fetched in real-time from MySQL.
 */

// Custom event name for state updates
export const SFC_CACHE_SYNC_EVENT = 'sfc-cache-synced';

export interface SyncData {
  timestamp: number;
  isIncremental: boolean;
  households: any[];
  masterlist: any[];
  barangays: any[];
  puroks: any[];
  stats: any;
  notifications: any[];
}

/**
 * Empty stub for IndexedDB wrapper. Real storage-based client caching is removed completely.
 * All existing cached tables are cleared out instantly.
 */
class SFCIndexedDB {
  private static dbName = 'SaintFrancisClinicDB';

  static {
    try {
      // Proactively clear and delete existing IndexedDB database caches
      if (typeof indexedDB !== 'undefined') {
        indexedDB.deleteDatabase(SFCIndexedDB.dbName);
      }
    } catch (e) {
      console.warn('[Cache Removal] Could not delete old cache DB:', e);
    }
  }

  public static async get<T>(key: string, defaultValue: T): Promise<T> {
    return defaultValue;
  }

  public static async set(key: string, value: any): Promise<void> {
    // No-op to satisfy complete browser cache removal
  }

  public static async delete(key: string): Promise<void> {
    // No-op
  }

  public static async clear(): Promise<void> {
    // No-op
  }
}

export class CacheSyncService {
  private static isSyncing = false;
  private static isInitialized = false;

  // Real-time synchronous memory state reference
  private static inMemoryCache: SyncData = {
    timestamp: 0,
    isIncremental: false,
    households: [],
    masterlist: [],
    barangays: [],
    puroks: [],
    stats: {
      totalApproved: 0,
      totalPending: 0,
      totalDisapproved: 0,
      totalTrash: 0,
      totalMembers: 0,
      totalDependents: 0,
      timestamp: new Date().toISOString()
    },
    notifications: []
  };

  /**
   * Initializes the in-memory cache reference
   */
  public static async initializeCache(): Promise<void> {
    if (this.isInitialized) return;
    this.isInitialized = true;
    window.dispatchEvent(new CustomEvent(SFC_CACHE_SYNC_EVENT, { detail: this.inMemoryCache }));
  }

  /**
   * Safe synchronous fallback that pulls from live in-memory state
   */
  public static getCachedState(): SyncData {
    return this.inMemoryCache;
  }

  /**
   * Updates notifications instantly in main memory (IndexedDB is bypassed)
   */
  public static async updateNotifications(updatedNotifs: any[]): Promise<void> {
    this.inMemoryCache.notifications = updatedNotifs || [];
    window.dispatchEvent(new CustomEvent(SFC_CACHE_SYNC_EVENT, { detail: this.inMemoryCache }));
  }

  /**
   * Performs high-speed direct sync fetch against backend MySQL
   * Timestamp since values are forced to 0 to bypass caching and return full live databases.
   */
  public static async performSync(userEmail: string, forceFull: boolean = true): Promise<SyncData | null> {
    if (this.isSyncing) return this.inMemoryCache;
    this.isSyncing = true;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 15000);

    try {
      // Force 'since' parameter to 0 to bypass incremental caches and query MySQL database directly
      const url = `/api/sync?since=0&userEmail=${encodeURIComponent(userEmail)}`;

      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'x-user-email': userEmail,
          'Content-Type': 'application/json'
        }
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error(`Sync request failed with status: ${res.status}`);
      }

      const syncPayload: SyncData = await res.json();

      // Clean, un-cached overwrite of the local memory state Reference
      this.inMemoryCache = {
        timestamp: syncPayload.timestamp || 0,
        isIncremental: false,
        households: syncPayload.households || [],
        masterlist: syncPayload.masterlist || [],
        barangays: syncPayload.barangays || [],
        puroks: syncPayload.puroks || [],
        stats: syncPayload.stats || this.inMemoryCache.stats,
        notifications: syncPayload.notifications || []
      };

      // Dispatch real-time update event to alert active React components immediately
      window.dispatchEvent(new CustomEvent(SFC_CACHE_SYNC_EVENT, { detail: this.inMemoryCache }));

      return this.inMemoryCache;
    } catch (err) {
      console.error('[SYNC SERVICE ERROR] Failed to fetch real-time state from MySQL:', err);
      return this.inMemoryCache;
    } finally {
      clearTimeout(timeoutId);
      this.isSyncing = false;
    }
  }

  /**
   * Retrieves active latency metrics. Polling is disabled.
   */
  public static getSpeedMetrics() {
    return {
      latency: 0,
      interval: 0,
      isSyncing: this.isSyncing
    };
  }

  /**
   * Performs a single optimized sync on launch. Polling intervals are removed
   * in order to prevent excess server load, repeated loop queries, and polling traffic.
   */
  public static startBackgroundSync(userEmail: string): void {
    if (!userEmail) return;
    this.performSync(userEmail).catch(err => {
      console.warn('Initial real-time data fetch skipped:', err.message);
    });
  }

  /**
   * Stops background sync poller (No-op since polling is completely deleted)
   */
  public static stopBackgroundSync(): void {
    // No-op
  }

  /**
   * Clears the live client cache state completely (e.g. on user Logout)
   */
  public static async clearCache(): Promise<void> {
    this.inMemoryCache = {
      timestamp: 0,
      isIncremental: false,
      households: [],
      masterlist: [],
      barangays: [],
      puroks: [],
      stats: {
        totalApproved: 0,
        totalPending: 0,
        totalDisapproved: 0,
        totalTrash: 0,
        totalMembers: 0,
        totalDependents: 0,
        timestamp: new Date().toISOString()
      },
      notifications: []
    };
    window.dispatchEvent(new CustomEvent(SFC_CACHE_SYNC_EVENT, { detail: this.inMemoryCache }));
  }
}
