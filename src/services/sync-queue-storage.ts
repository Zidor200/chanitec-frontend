// Sync Queue Storage Service for Chanitec PWA
// Uses IndexedDB for persistent storage of sync operations across browser sessions

import { SyncOperation, SyncStatus } from '../models/SyncOperation';

/**
 * Database configuration
 */
const DB_CONFIG = {
  name: 'ChanitecSyncDB',
  version: 1,
  storeName: 'syncOperations',
  keyPath: 'id'
};

/**
 * Sync Queue Storage Service - Manages persistent storage of sync operations
 * Uses IndexedDB for cross-session persistence and better performance than localStorage
 */
class SyncQueueStorageService {
  private db: IDBDatabase | null = null;
  private isInitialized: boolean = false;
  private initPromise: Promise<void> | null = null;

  constructor() {
    this.initializeDatabase();
  }

  /**
   * Initialize the IndexedDB database
   */
  private async initializeDatabase(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        reject(new Error('IndexedDB not supported in this browser'));
        return;
      }

      const request = indexedDB.open(DB_CONFIG.name, DB_CONFIG.version);

      request.onerror = () => {
        console.error('Failed to open IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        this.isInitialized = true;
        console.log('IndexedDB initialized successfully');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object store if it doesn't exist
        if (!db.objectStoreNames.contains(DB_CONFIG.storeName)) {
          const store = db.createObjectStore(DB_CONFIG.storeName, { keyPath: DB_CONFIG.keyPath });

          // Create indexes for efficient querying
          store.createIndex('status', 'status', { unique: false });
          store.createIndex('entityType', 'entityType', { unique: false });
          store.createIndex('entityId', 'entityId', { unique: false });
          store.createIndex('createdAt', 'createdAt', { unique: false });
          store.createIndex('priority', 'priority', { unique: false });
          store.createIndex('status_priority', ['status', 'priority'], { unique: false });

          console.log('Created IndexedDB object store and indexes');
        }
      };
    });

    return this.initPromise;
  }

  /**
   * Wait for database initialization
   */
  private async waitForInit(): Promise<void> {
    if (!this.isInitialized) {
      await this.initializeDatabase();
    }
  }

  /**
   * Get a transaction and object store
   */
  private getTransaction(mode: IDBTransactionMode = 'readonly') {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const transaction = this.db.transaction([DB_CONFIG.storeName], mode);
    const store = transaction.objectStore(DB_CONFIG.storeName);

    return { transaction, store };
  }

  /**
   * Enqueue a sync operation
   */
  async enqueue(operation: SyncOperation): Promise<string> {
    await this.waitForInit();

    return new Promise((resolve, reject) => {
      const { transaction, store } = this.getTransaction('readwrite');

      const request = store.add(operation);

      request.onsuccess = () => {
        resolve(operation.id);
      };

      request.onerror = () => {
        console.error('Failed to enqueue operation:', request.error);
        reject(request.error);
      };

      transaction.oncomplete = () => {
        console.log('Operation enqueued successfully:', operation.id);
      };
    });
  }

  /**
   * Dequeue the next pending operation (FIFO with priority)
   */
  async dequeue(): Promise<SyncOperation | null> {
    await this.waitForInit();

    return new Promise((resolve, reject) => {
      const { transaction, store } = this.getTransaction('readwrite');

      // Get pending operations ordered by priority and creation time
      const index = store.index('status_priority');
      const request = index.openCursor(IDBKeyRange.only(['pending', 5]), 'prev');

      let highestPriorityOp: SyncOperation | null = null;

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          const operation = cursor.value as SyncOperation;

          // Find the highest priority pending operation
          if (!highestPriorityOp || operation.priority > highestPriorityOp.priority) {
            highestPriorityOp = operation;
          }

          cursor.continue();
        } else {
          // No more pending operations
          if (highestPriorityOp) {
            // Mark as in progress and return
            this.updateOperationStatus(highestPriorityOp.id, SyncStatus.IN_PROGRESS)
              .then(() => resolve(highestPriorityOp))
              .catch(reject);
          } else {
            resolve(null);
          }
        }
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Peek at the next operation without removing it
   */
  async peek(): Promise<SyncOperation | null> {
    await this.waitForInit();

    return new Promise((resolve, reject) => {
      const { transaction, store } = this.getTransaction();

      const index = store.index('status_priority');
      const request = index.openCursor(IDBKeyRange.only(['pending', 5]), 'prev');

      let highestPriorityOp: SyncOperation | null = null;

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          const operation = cursor.value as SyncOperation;

          if (!highestPriorityOp || operation.priority > highestPriorityOp.priority) {
            highestPriorityOp = operation;
          }

          cursor.continue();
        } else {
          resolve(highestPriorityOp);
        }
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Get operation by ID
   */
  async getById(id: string): Promise<SyncOperation | null> {
    await this.waitForInit();

    return new Promise((resolve, reject) => {
      const { transaction, store } = this.getTransaction();

      const request = store.get(id);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Update operation status
   */
  async updateOperationStatus(
    id: string,
    status: SyncStatus,
    errorMessage?: string,
    conflictData?: any
  ): Promise<boolean> {
    await this.waitForInit();

    return new Promise((resolve, reject) => {
      const { transaction, store } = this.getTransaction('readwrite');

      const getRequest = store.get(id);

      getRequest.onsuccess = () => {
        const operation = getRequest.result;
        if (!operation) {
          resolve(false);
          return;
        }

        // Update operation
        operation.status = status;
        operation.updatedAt = new Date();
        operation.errorMessage = errorMessage;
        operation.conflictData = conflictData;

        if (status === SyncStatus.IN_PROGRESS) {
          operation.lastAttemptAt = new Date();
        }

        if (status === SyncStatus.FAILED || status === SyncStatus.CONFLICT) {
          operation.retryCount++;
          if (operation.retryCount < operation.maxRetries) {
            operation.status = SyncStatus.RETRY;
          }
        }

        const updateRequest = store.put(operation);

        updateRequest.onsuccess = () => {
          resolve(true);
        };

        updateRequest.onerror = () => {
          reject(updateRequest.error);
        };
      };

      getRequest.onerror = () => {
        reject(getRequest.error);
      };
    });
  }

  /**
   * Get all operations
   */
  async getAll(): Promise<SyncOperation[]> {
    await this.waitForInit();

    return new Promise((resolve, reject) => {
      const { transaction, store } = this.getTransaction();

      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Get operations by status
   */
  async getByStatus(status: SyncStatus): Promise<SyncOperation[]> {
    await this.waitForInit();

    return new Promise((resolve, reject) => {
      const { transaction, store } = this.getTransaction();

      const index = store.index('status');
      const request = index.getAll(status);

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Get operations by entity type
   */
  async getByEntityType(entityType: string): Promise<SyncOperation[]> {
    await this.waitForInit();

    return new Promise((resolve, reject) => {
      const { transaction, store } = this.getTransaction();

      const index = store.index('entityType');
      const request = index.getAll(entityType);

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Get operations by entity ID
   */
  async getByEntityId(entityId: string): Promise<SyncOperation[]> {
    await this.waitForInit();

    return new Promise((resolve, reject) => {
      const { transaction, store } = this.getTransaction();

      const index = store.index('entityId');
      const request = index.getAll(entityId);

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Get pending operations count
   */
  async getPendingCount(): Promise<number> {
    const pending = await this.getByStatus(SyncStatus.PENDING);
    return pending.length;
  }

  /**
   * Remove completed operations
   */
  async removeCompleted(): Promise<number> {
    await this.waitForInit();

    const completed = await this.getByStatus(SyncStatus.COMPLETED);
    let removedCount = 0;

    for (const operation of completed) {
      try {
        await this.removeById(operation.id);
        removedCount++;
      } catch (error) {
        console.error('Failed to remove completed operation:', error);
      }
    }

    return removedCount;
  }

  /**
   * Remove operation by ID
   */
  async removeById(id: string): Promise<boolean> {
    await this.waitForInit();

    return new Promise((resolve, reject) => {
      const { transaction, store } = this.getTransaction('readwrite');

      const request = store.delete(id);

      request.onsuccess = () => {
        resolve(true);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Clear all operations
   */
  async clearAll(): Promise<void> {
    await this.waitForInit();

    return new Promise((resolve, reject) => {
      const { transaction, store } = this.getTransaction('readwrite');

      const request = store.clear();

      request.onsuccess = () => {
        console.log('All sync operations cleared');
        resolve();
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Get queue statistics
   */
  async getStats(): Promise<{
    total: number;
    pending: number;
    inProgress: number;
    completed: number;
    failed: number;
    conflict: number;
    retry: number;
  }> {
    const all = await this.getAll();

    return {
      total: all.length,
      pending: all.filter(op => op.status === SyncStatus.PENDING).length,
      inProgress: all.filter(op => op.status === SyncStatus.IN_PROGRESS).length,
      completed: all.filter(op => op.status === SyncStatus.COMPLETED).length,
      failed: all.filter(op => op.status === SyncStatus.FAILED).length,
      conflict: all.filter(op => op.status === SyncStatus.CONFLICT).length,
      retry: all.filter(op => op.status === SyncStatus.RETRY).length,
    };
  }

  /**
   * Clean up old operations (older than specified days)
   */
  async cleanupOldOperations(daysOld: number = 30): Promise<number> {
    await this.waitForInit();

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const all = await this.getAll();
    const oldOperations = all.filter(op => {
      const createdAt = new Date(op.createdAt);
      return createdAt < cutoffDate && op.status === SyncStatus.COMPLETED;
    });

    let removedCount = 0;
    for (const operation of oldOperations) {
      try {
        await this.removeById(operation.id);
        removedCount++;
      } catch (error) {
        console.error('Failed to remove old operation:', error);
      }
    }

    console.log(`Cleaned up ${removedCount} old operations`);
    return removedCount;
  }

  /**
   * Export operations for debugging/backup
   */
  async exportOperations(): Promise<SyncOperation[]> {
    return await this.getAll();
  }

  /**
   * Import operations (for debugging/restore)
   */
  async importOperations(operations: SyncOperation[]): Promise<void> {
    await this.waitForInit();

    // Clear existing operations
    await this.clearAll();

    // Import new operations
    for (const operation of operations) {
      await this.enqueue(operation);
    }

    console.log(`Imported ${operations.length} operations`);
  }

  /**
   * Close database connection
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.isInitialized = false;
    }
  }

  /**
   * Check if database is available
   */
  isAvailable(): boolean {
    return this.isInitialized && this.db !== null;
  }
}

// Export singleton instance
export const syncQueueStorage = new SyncQueueStorageService();
export default SyncQueueStorageService;
