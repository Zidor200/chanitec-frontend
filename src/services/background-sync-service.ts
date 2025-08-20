import { offlineSyncService } from './offline-sync-service';
import { syncQueueStorage } from './sync-queue-storage';
import { SyncStatus, SyncOperation } from '../models/SyncOperation';

export interface BackgroundSyncConfig {
  autoSyncEnabled: boolean;
  syncIntervalMs: number;
  maxRetries: number;
  retryDelayMs: number;
  networkTimeoutMs: number;
  batchSize: number;
}

export interface SyncMetrics {
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  pendingOperations: number;
  lastSyncAt: Date | null;
  averageSyncTime: number;
  networkErrors: number;
  conflictCount: number;
}

export class BackgroundSyncService {
  private config: BackgroundSyncConfig;
  private syncInterval: NodeJS.Timeout | null = null;
  private isRunning = false;
  private metrics: SyncMetrics;
  private networkListeners: Array<(isOnline: boolean) => void> = [];

  constructor(config: Partial<BackgroundSyncConfig> = {}) {
    this.config = {
      autoSyncEnabled: true,
      syncIntervalMs: 30000, // 30 seconds
      maxRetries: 3,
      retryDelayMs: 5000, // 5 seconds
      networkTimeoutMs: 10000, // 10 seconds
      batchSize: 10,
      ...config
    };

    this.metrics = {
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
      pendingOperations: 0,
      lastSyncAt: null,
      averageSyncTime: 0,
      networkErrors: 0,
      conflictCount: 0
    };

    this.initializeNetworkMonitoring();
  }

  /**
   * Start background sync service
   */
  public start(): void {
    if (this.isRunning) {
      console.log('Background sync service is already running');
      return;
    }

    console.log('Starting background sync service...');
    this.isRunning = true;

    // Start periodic sync
    if (this.config.autoSyncEnabled) {
      this.startPeriodicSync();
    }

    // Initial sync if online
    if (navigator.onLine) {
      this.scheduleSync(1000); // Sync after 1 second
    }

    // Listen for network changes
    this.setupNetworkListeners();
  }

  /**
   * Stop background sync service
   */
  public stop(): void {
    if (!this.isRunning) {
      return;
    }

    console.log('Stopping background sync service...');
    this.isRunning = false;

    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }

    this.removeNetworkListeners();
  }

  /**
   * Manually trigger a sync operation
   */
  public async manualSync(): Promise<void> {
    console.log('Manual sync triggered');
    await this.performSync();
  }

  /**
   * Get current sync metrics
   */
  public getMetrics(): SyncMetrics {
    return { ...this.metrics };
  }

  /**
   * Update configuration
   */
  public updateConfig(newConfig: Partial<BackgroundSyncConfig>): void {
    this.config = { ...this.config, ...newConfig };

    if (this.isRunning) {
      this.stop();
      this.start();
    }
  }

  /**
   * Add network status listener
   */
  public addNetworkListener(listener: (isOnline: boolean) => void): void {
    this.networkListeners.push(listener);
  }

  /**
   * Remove network status listener
   */
  public removeNetworkListener(listener: (isOnline: boolean) => void): void {
    const index = this.networkListeners.indexOf(listener);
    if (index > -1) {
      this.networkListeners.splice(index, 1);
    }
  }

  /**
   * Start periodic sync interval
   */
  private startPeriodicSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    this.syncInterval = setInterval(() => {
      if (navigator.onLine && this.isRunning) {
        this.scheduleSync(0);
      }
    }, this.config.syncIntervalMs);

    console.log(`Periodic sync started with ${this.config.syncIntervalMs}ms interval`);
  }

  /**
   * Schedule a sync operation
   */
  private scheduleSync(delayMs: number): void {
    setTimeout(async () => {
      if (this.isRunning && navigator.onLine) {
        await this.performSync();
      }
    }, delayMs);
  }

  /**
   * Perform the actual sync operation
   */
  private async performSync(): Promise<void> {
    if (!navigator.onLine) {
      console.log('Network offline, skipping sync');
      return;
    }

    const startTime = Date.now();
    console.log('Starting background sync...');

    try {
      // Get pending operations
      const pendingOperations = await syncQueueStorage.getByStatus(SyncStatus.PENDING);
      this.metrics.pendingOperations = pendingOperations.length;

      if (pendingOperations.length === 0) {
        console.log('No pending operations to sync');
        return;
      }

      console.log(`Syncing ${pendingOperations.length} pending operations`);

      // Process operations in batches
      const batches = this.createBatches(pendingOperations, this.config.batchSize);
      let processedCount = 0;

      for (const batch of batches) {
        const batchResult = await this.processBatch(batch);
        processedCount += batchResult.processed;

        // Update metrics
        this.metrics.successfulOperations += batchResult.successful;
        this.metrics.failedOperations += batchResult.failed;
        this.metrics.conflictCount += batchResult.conflicts;

        // Small delay between batches to avoid overwhelming the server
        if (batches.length > 1) {
          await this.delay(1000);
        }
      }

      // Update final metrics
      this.metrics.totalOperations += processedCount;
      this.metrics.lastSyncAt = new Date();
      this.metrics.averageSyncTime = this.calculateAverageSyncTime(startTime);

      console.log(`Background sync completed: ${processedCount} operations processed`);
      this.notifyNetworkListeners(true);

    } catch (error) {
      console.error('Background sync failed:', error);
      this.metrics.networkErrors++;
      this.metrics.failedOperations++;
      this.notifyNetworkListeners(false);

      // Schedule retry if we haven't exceeded max retries
      if (this.metrics.failedOperations < this.config.maxRetries) {
        this.scheduleSync(this.config.retryDelayMs);
      }
    }
  }

  /**
   * Process a batch of operations
   */
  private async processBatch(operations: SyncOperation[]): Promise<{
    processed: number;
    successful: number;
    failed: number;
    conflicts: number;
  }> {
    let successful = 0;
    let failed = 0;
    let conflicts = 0;

    for (const operation of operations) {
      try {
        const result = await offlineSyncService.processOperation(operation);

        if (result.success) {
          successful++;
          // Mark operation as completed
          await syncQueueStorage.updateOperationStatus(operation.id, SyncStatus.COMPLETED);
        } else {
          failed++;
          if (result.conflict) {
            conflicts++;
            // Mark operation as conflicted
            await syncQueueStorage.updateOperationStatus(operation.id, SyncStatus.CONFLICT);
          } else {
            // Mark operation as failed
            await syncQueueStorage.updateOperationStatus(operation.id, SyncStatus.FAILED);
          }
        }
      } catch (error) {
        console.error(`Failed to process operation ${operation.id}:`, error);
        failed++;
        await syncQueueStorage.updateOperationStatus(operation.id, SyncStatus.FAILED);
      }
    }

    return {
      processed: operations.length,
      successful,
      failed,
      conflicts
    };
  }

  /**
   * Create batches from operations array
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Calculate average sync time
   */
  private calculateAverageSyncTime(startTime: number): number {
    const currentTime = Date.now();
    const syncDuration = currentTime - startTime;

    if (this.metrics.averageSyncTime === 0) {
      return syncDuration;
    }

    // Exponential moving average
    return (this.metrics.averageSyncTime * 0.7) + (syncDuration * 0.3);
  }

  /**
   * Initialize network monitoring
   */
  private initializeNetworkMonitoring(): void {
    // Listen for online/offline events
    window.addEventListener('online', () => {
      console.log('Network came online, triggering sync');
      this.notifyNetworkListeners(true);
      if (this.isRunning) {
        this.scheduleSync(2000); // Sync after 2 seconds
      }
    });

    window.addEventListener('offline', () => {
      console.log('Network went offline');
      this.notifyNetworkListeners(false);
    });
  }

  /**
   * Setup network listeners
   */
  private setupNetworkListeners(): void {
    // This will be called when network status changes
    this.addNetworkListener((isOnline: boolean) => {
      if (isOnline && this.isRunning) {
        // Network came back online, trigger sync
        this.scheduleSync(1000);
      }
    });
  }

  /**
   * Remove network listeners
   */
  private removeNetworkListeners(): void {
    this.networkListeners = [];
  }

  /**
   * Notify all network listeners
   */
  private notifyNetworkListeners(isOnline: boolean): void {
    this.networkListeners.forEach(listener => {
      try {
        listener(isOnline);
      } catch (error) {
        console.error('Error in network listener:', error);
      }
    });
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get service status
   */
  public getStatus(): {
    isRunning: boolean;
    isOnline: boolean;
    config: BackgroundSyncConfig;
    metrics: SyncMetrics;
  } {
    return {
      isRunning: this.isRunning,
      isOnline: navigator.onLine,
      config: { ...this.config },
      metrics: this.getMetrics()
    };
  }
}

// Export singleton instance
export const backgroundSyncService = new BackgroundSyncService();
