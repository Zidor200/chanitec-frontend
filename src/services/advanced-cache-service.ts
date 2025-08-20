// Advanced Cache Service for Chanitec PWA
import { generateId } from '../utils/id-generator';

export enum CacheStrategy {
  CACHE_FIRST = 'CACHE_FIRST',
  NETWORK_FIRST = 'NETWORK_FIRST',
  STALE_WHILE_REVALIDATE = 'STALE_WHILE_REVALIDATE',
  CACHE_ONLY = 'CACHE_ONLY',
  NETWORK_ONLY = 'NETWORK_ONLY'
}

export interface CacheConfig {
  maxAge: number; // milliseconds
  maxSize: number; // number of items
  strategy: CacheStrategy;
  enableCompression: boolean;
  enableIndexing: boolean;
  cleanupInterval: number; // milliseconds
}

export interface CacheItem<T = any> {
  key: string;
  data: T;
  timestamp: number;
  expiresAt: number;
  size: number;
  accessCount: number;
  lastAccessed: number;
  tags: string[];
  version: string;
}

export interface CacheStats {
  totalItems: number;
  totalSize: number;
  hitRate: number;
  missRate: number;
  evictionCount: number;
  compressionRatio: number;
  lastCleanup: Date;
}

export class AdvancedCacheService {
  private cache: Map<string, CacheItem> = new Map();
  private config: CacheConfig;
  private stats: {
    hits: number;
    misses: number;
    evictions: number;
    totalSize: number;
  };
  private cleanupInterval?: NodeJS.Timeout;
  private compressionWorker?: Worker;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      maxSize: 1000, // 1000 items
      strategy: CacheStrategy.STALE_WHILE_REVALIDATE,
      enableCompression: true,
      enableIndexing: true,
      cleanupInterval: 60 * 60 * 1000 // 1 hour
    };

    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      totalSize: 0
    };

    this.initializeService();
  }

  /**
   * Initialize the cache service
   */
  private initializeService(): void {
    // Load cached data from storage
    this.loadFromStorage();

    // Start cleanup interval
    this.startCleanupInterval();

    // Initialize compression worker if enabled
    if (this.config.enableCompression) {
      this.initializeCompressionWorker();
    }
  }

  /**
   * Set a value in the cache
   */
  public async set<T>(
    key: string,
    data: T,
    options: {
      maxAge?: number;
      tags?: string[];
      version?: string;
      compress?: boolean;
    } = {}
  ): Promise<void> {
    try {
      const maxAge = options.maxAge || this.config.maxAge;
      const timestamp = Date.now();
      const expiresAt = timestamp + maxAge;

      let processedData = data;
      let size = this.calculateSize(data);

      // Compress data if enabled and requested
      if (this.config.enableCompression && options.compress !== false) {
        processedData = await this.compressData(data);
        size = this.calculateSize(processedData);
      }

      const cacheItem: CacheItem<T> = {
        key,
        data: processedData,
        timestamp,
        expiresAt,
        size,
        accessCount: 0,
        lastAccessed: timestamp,
        tags: options.tags || [],
        version: options.version || '1.0'
      };

      // Check if we need to evict items
      await this.ensureCapacity(size);

      // Store the item
      this.cache.set(key, cacheItem);
      this.stats.totalSize += size;

      // Save to persistent storage
      this.saveToStorage();

      console.log(`Cached item: ${key} (${size} bytes)`);

    } catch (error) {
      console.error(`Failed to cache item ${key}:`, error);
    }
  }

  /**
   * Get a value from the cache
   */
  public async get<T>(key: string): Promise<T | null> {
    try {
      const item = this.cache.get(key);

      if (!item) {
        this.stats.misses++;
        return null;
      }

      // Check if item has expired
      if (Date.now() > item.expiresAt) {
        this.cache.delete(key);
        this.stats.totalSize -= item.size;
        this.stats.misses++;
        return null;
      }

      // Update access statistics
      item.accessCount++;
      item.lastAccessed = Date.now();
      this.stats.hits++;

      // Save updated stats
      this.saveToStorage();

      // Decompress if needed
      let data = item.data;
      if (this.config.enableCompression && this.isCompressed(data)) {
        data = await this.decompressData(data);
      }

      return data as T;

    } catch (error) {
      console.error(`Failed to retrieve cached item ${key}:`, error);
      this.stats.misses++;
      return null;
    }
  }

  /**
   * Get or set a value using the configured strategy
   */
  public async getOrSet<T>(
    key: string,
    fetchFunction: () => Promise<T>,
    options: {
      maxAge?: number;
      tags?: string[];
      version?: string;
      strategy?: CacheStrategy;
    } = {}
  ): Promise<T> {
    const strategy = options.strategy || this.config.strategy;

    switch (strategy) {
      case CacheStrategy.CACHE_FIRST:
        return this.cacheFirstStrategy(key, fetchFunction, options);

      case CacheStrategy.NETWORK_FIRST:
        return this.networkFirstStrategy(key, fetchFunction, options);

      case CacheStrategy.STALE_WHILE_REVALIDATE:
        return this.staleWhileRevalidateStrategy(key, fetchFunction, options);

      case CacheStrategy.CACHE_ONLY:
        return this.cacheOnlyStrategy(key);

      case CacheStrategy.NETWORK_ONLY:
        return this.networkOnlyStrategy(fetchFunction);

      default:
        return this.staleWhileRevalidateStrategy(key, fetchFunction, options);
    }
  }

  /**
   * Cache-first strategy: Check cache first, fallback to network
   */
  private async cacheFirstStrategy<T>(
    key: string,
    fetchFunction: () => Promise<T>,
    options: any
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const data = await fetchFunction();
    await this.set(key, data, options);
    return data;
  }

  /**
   * Network-first strategy: Try network first, fallback to cache
   */
  private async networkFirstStrategy<T>(
    key: string,
    fetchFunction: () => Promise<T>,
    options: any
  ): Promise<T> {
    try {
      const data = await fetchFunction();
      await this.set(key, data, options);
      return data;
    } catch (error) {
      console.warn(`Network failed for ${key}, trying cache:`, error);
      const cached = await this.get<T>(key);
      if (cached !== null) {
        return cached;
      }
      throw error;
    }
  }

  /**
   * Stale-while-revalidate strategy: Return cached immediately, update in background
   */
  private async staleWhileRevalidateStrategy<T>(
    key: string,
    fetchFunction: () => Promise<T>,
    options: any
  ): Promise<T> {
    const cached = await this.get<T>(key);

    // Update cache in background
    fetchFunction()
      .then(async (data) => {
        await this.set(key, data, options);
      })
      .catch((error) => {
        console.warn(`Background update failed for ${key}:`, error);
      });

    if (cached !== null) {
      return cached;
    }

    // If no cache, wait for network
    const data = await fetchFunction();
    await this.set(key, data, options);
    return data;
  }

  /**
   * Cache-only strategy: Only return cached data
   */
  private async cacheOnlyStrategy<T>(key: string): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached === null) {
      throw new Error(`Item ${key} not found in cache`);
    }
    return cached;
  }

  /**
   * Network-only strategy: Always fetch from network
   */
  private async networkOnlyStrategy<T>(fetchFunction: () => Promise<T>): Promise<T> {
    return await fetchFunction();
  }

  /**
   * Remove an item from the cache
   */
  public delete(key: string): boolean {
    const item = this.cache.get(key);
    if (item) {
      this.stats.totalSize -= item.size;
      this.cache.delete(key);
      this.saveToStorage();
      return true;
    }
    return false;
  }

  /**
   * Clear all items with specific tags
   */
  public clearByTags(tags: string[]): number {
    let clearedCount = 0;
    const keysToDelete: string[] = [];

    // Convert iterator to array to avoid TypeScript compilation issues
    Array.from(this.cache.entries()).forEach(([key, item]) => {
      if (tags.some(tag => item.tags.includes(tag))) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach(key => {
      if (this.cache.delete(key)) {
        clearedCount++;
      }
    });

    this.stats.evictions += clearedCount;
    this.saveToStorage();
    return clearedCount;
  }

  /**
   * Clear expired items
   */
  public clearExpired(): number {
    const now = Date.now();
    let clearedCount = 0;
    const keysToDelete: string[] = [];

    // Convert iterator to array to avoid TypeScript compilation issues
    Array.from(this.cache.entries()).forEach(([key, item]) => {
      if (item.expiresAt < now) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach(key => {
      if (this.cache.delete(key)) {
        clearedCount++;
      }
    });

    this.stats.evictions += clearedCount;
    this.saveToStorage();
    return clearedCount;
  }

  /**
   * Clear all items
   */
  public clear(): void {
    this.cache.clear();
    this.stats.totalSize = 0;
    this.saveToStorage();
  }

  /**
   * Get cache statistics
   */
  public getStats(): CacheStats {
    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate = totalRequests > 0 ? this.stats.hits / totalRequests : 0;
    const missRate = totalRequests > 0 ? this.stats.misses / totalRequests : 0;

    return {
      totalItems: this.cache.size,
      totalSize: this.stats.totalSize,
      hitRate,
      missRate,
      evictionCount: this.stats.evictions,
      compressionRatio: 0.8, // Placeholder
      lastCleanup: new Date()
    };
  }

  /**
   * Search cache by tags
   */
  public searchByTags(tags: string[]): string[] {
    const matchingKeys: string[] = [];

    // Convert iterator to array to avoid TypeScript compilation issues
    Array.from(this.cache.entries()).forEach(([key, item]) => {
      if (tags.some(tag => item.tags.includes(tag))) {
        matchingKeys.push(key);
      }
    });

    return matchingKeys;
  }

  /**
   * Get items by version
   */
  public getByVersion(version: string): string[] {
    const matchingKeys: string[] = [];

    // Convert iterator to array to avoid TypeScript compilation issues
    Array.from(this.cache.entries()).forEach(([key, item]) => {
      if (item.version === version) {
        matchingKeys.push(key);
      }
    });

    return matchingKeys;
  }

  /**
   * Ensure cache capacity by evicting items if necessary
   */
  private async ensureCapacity(newItemSize: number): Promise<void> {
    if (this.cache.size < this.config.maxSize &&
        this.stats.totalSize + newItemSize <= this.config.maxSize * 1024 * 1024) {
      return; // No eviction needed
    }

    // Sort items by access count and last accessed time
    const items = Array.from(this.cache.entries())
      .map(([key, item]) => ({ key, item }))
      .sort((a, b) => {
        // Prioritize by access count, then by last accessed time
        if (a.item.accessCount !== b.item.accessCount) {
          return a.item.accessCount - b.item.accessCount;
        }
        return a.item.lastAccessed - b.item.lastAccessed;
      });

    // Evict items until we have enough space
    let evictedSize = 0;
    const targetSize = this.config.maxSize * 1024 * 1024 - newItemSize;

    for (const { key, item } of items) {
      if (this.stats.totalSize - evictedSize <= targetSize) {
        break;
      }

      this.cache.delete(key);
      evictedSize += item.size;
      this.stats.evictions++;
    }

    this.stats.totalSize -= evictedSize;
  }

  /**
   * Calculate approximate size of data
   */
  private calculateSize(data: any): number {
    try {
      const jsonString = JSON.stringify(data);
      return new Blob([jsonString]).size;
    } catch (error) {
      return 1024; // Default size if calculation fails
    }
  }

  /**
   * Compress data using compression worker
   */
  private async compressData(data: any): Promise<any> {
    if (!this.compressionWorker) {
      this.initializeCompressionWorker();
    }

    if (!this.compressionWorker) {
      // Fallback if worker initialization fails
      return data;
    }

    return new Promise((resolve, reject) => {
      const messageId = generateId();

      const handleMessage = (event: MessageEvent) => {
        if (event.data.id === messageId) {
          this.compressionWorker?.removeEventListener('message', handleMessage);
          if (event.data.error) {
            reject(new Error(event.data.error));
          } else {
            resolve(event.data.compressedData);
          }
        }
      };

      this.compressionWorker?.addEventListener('message', handleMessage);
      this.compressionWorker?.postMessage({
        id: messageId,
        type: 'COMPRESS',
        data: data
      });

      // Timeout fallback
      setTimeout(() => {
        this.compressionWorker?.removeEventListener('message', handleMessage);
        resolve(data); // Return uncompressed data if compression times out
      }, 5000);
    });
  }

  /**
   * Decompress data
   */
  private async decompressData(data: any): Promise<any> {
    if (!this.compressionWorker) {
      this.initializeCompressionWorker();
    }

    if (!this.compressionWorker) {
      // Fallback if worker initialization fails
      return data;
    }

    return new Promise((resolve, reject) => {
      const messageId = generateId();

      const handleMessage = (event: MessageEvent) => {
        if (event.data.id === messageId) {
          this.compressionWorker?.removeEventListener('message', handleMessage);
          if (event.data.error) {
            reject(new Error(event.data.error));
          } else {
            resolve(event.data.decompressedData);
          }
        }
      };

      this.compressionWorker?.addEventListener('message', handleMessage);
      this.compressionWorker?.postMessage({
        id: messageId,
        type: 'DECOMPRESS',
        data: data
      });

      // Timeout fallback
      setTimeout(() => {
        this.compressionWorker?.removeEventListener('message', handleMessage);
        resolve(data); // Return compressed data if decompression times out
      }, 5000);
    });
  }

  /**
   * Check if data is compressed
   */
  private isCompressed(data: any): boolean {
    // Simple heuristic - in real implementation, you'd have proper compression markers
    return false;
  }

  /**
   * Initialize compression worker
   */
  private initializeCompressionWorker(): void {
    try {
      // In a real implementation, you'd create a Web Worker for compression
      // For now, we'll just set a flag
      console.log('Compression worker would be initialized here');
    } catch (error) {
      console.warn('Failed to initialize compression worker:', error);
      this.config.enableCompression = false;
    }
  }

  /**
   * Start cleanup interval
   */
  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      this.clearExpired();
    }, this.config.cleanupInterval);
  }

  /**
   * Save cache to persistent storage
   */
  private saveToStorage(): void {
    try {
      const cacheData = {
        items: Array.from(this.cache.entries()),
        stats: this.stats,
        config: this.config
      };
      localStorage.setItem('chanitec_advanced_cache', JSON.stringify(cacheData));
    } catch (error) {
      console.error('Failed to save cache to storage:', error);
    }
  }

  /**
   * Load cache from persistent storage
   */
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem('chanitec_advanced_cache');
      if (stored) {
        const cacheData = JSON.parse(stored);

        // Restore cache items
        if (cacheData.items) {
          this.cache = new Map(cacheData.items);
        }

        // Restore stats
        if (cacheData.stats) {
          this.stats = { ...this.stats, ...cacheData.stats };
        }

        // Restore config
        if (cacheData.config) {
          this.config = { ...this.config, ...cacheData.config };
        }
      }
    } catch (error) {
      console.error('Failed to load cache from storage:', error);
    }
  }

  /**
   * Cleanup resources
   */
  public destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    if (this.compressionWorker) {
      this.compressionWorker.terminate();
    }
  }
}

// Export singleton instance
export const advancedCacheService = new AdvancedCacheService();
export default AdvancedCacheService;
