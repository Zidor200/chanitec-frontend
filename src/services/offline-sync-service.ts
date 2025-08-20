// Offline Sync Service for Chanitec PWA
import {
  SyncOperation,
  SyncOperationType,
  SyncEntityType,
  SyncStatus,
  SyncConfig,
  DEFAULT_SYNC_CONFIG,
  SyncOperationResult,
  BatchSyncResult,
  SyncQueueStats
} from '../models/SyncOperation';
import { generateId } from '../utils/id-generator';

/**
 * Offline Sync Service - Manages offline operations and synchronization
 * This service queues operations when offline and syncs them when online
 */
class OfflineSyncService {
  private config: SyncConfig;
  private operations: Map<string, SyncOperation> = new Map();
  private _isOnline: boolean = navigator.onLine;
  private syncInProgress: boolean = false;
  private syncInterval?: NodeJS.Timeout;
  private eventListeners: Map<string, Function[]> = new Map();

  constructor(config: Partial<SyncConfig> = {}) {
    this.config = { ...DEFAULT_SYNC_CONFIG, ...config };
    this.initializeService();
  }

  /**
   * Initialize the sync service
   */
  private initializeService(): void {
    // Load existing operations from storage
    this.loadOperationsFromStorage();

    // Set up network status listeners
    this.setupNetworkListeners();

    // Start auto-sync if enabled
    if (this.config.enableAutoSync) {
      this.startAutoSync();
    }
  }

  /**
   * Set up network status listeners
   */
  private setupNetworkListeners(): void {
    window.addEventListener('online', () => {
      this._isOnline = true;
      this.emit('networkOnline');
      this.processPendingOperations();
    });

    window.addEventListener('offline', () => {
      this._isOnline = false;
      this.emit('networkOffline');
    });
  }

  /**
   * Start automatic sync interval
   */
  private startAutoSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    this.syncInterval = setInterval(() => {
      if (this._isOnline && !this.syncInProgress) {
        this.processPendingOperations();
      }
    }, this.config.syncInterval);
  }

  /**
   * Stop automatic sync
   */
  private stopAutoSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = undefined;
    }
  }

  /**
   * Queue a sync operation
   */
  queueOperation(
    type: SyncOperationType,
    entityType: SyncEntityType,
    entityId: string,
    data: any,
    priority: number = 1
  ): string {
    const operationId = generateId();
    const operation: SyncOperation = {
      id: operationId,
      type,
      entityType,
      entityId,
      data,
      status: SyncStatus.PENDING,
      timestamp: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      retryCount: 0,
      priority
    };

    this.operations.set(operationId, operation);
    this.saveOperationsToStorage();
    this.emit('operationQueued', operation);

    // Try to process immediately if online
    if (this._isOnline && !this.syncInProgress) {
      this.processPendingOperations();
    }

    return operationId;
  }

  /**
   * Get operation by ID
   */
  getOperation(operationId: string): SyncOperation | undefined {
    return this.operations.get(operationId);
  }

  /**
   * Get all operations
   */
  getAllOperations(): SyncOperation[] {
    return Array.from(this.operations.values());
  }

  /**
   * Get pending operations
   */
  getPendingOperations(): SyncOperation[] {
    return Array.from(this.operations.values())
      .filter(op => op.status === SyncStatus.PENDING)
      .sort((a, b) => b.priority - a.priority); // Higher priority first
  }

  /**
   * Get operations by entity type
   */
  getOperationsByEntityType(entityType: SyncEntityType): SyncOperation[] {
    return Array.from(this.operations.values())
      .filter(op => op.entityType === entityType);
  }

  /**
   * Get operations by entity ID
   */
  getOperationsByEntityId(entityId: string): SyncOperation[] {
    return Array.from(this.operations.values())
      .filter(op => op.entityId === entityId);
  }

  /**
   * Update operation status
   */
  updateOperationStatus(
    operationId: string,
    status: SyncStatus,
    errorMessage?: string,
    conflictData?: any
  ): boolean {
    const operation = this.operations.get(operationId);
    if (!operation) return false;

    operation.status = status;
    operation.updatedAt = new Date();
    operation.errorMessage = errorMessage;
    operation.conflictData = conflictData;

    if (status === SyncStatus.FAILED || status === SyncStatus.CONFLICT) {
      operation.retryCount++;
      if (operation.retryCount < this.config.maxRetries) {
        operation.status = SyncStatus.RETRY;
      }
    }

    if (status === SyncStatus.IN_PROGRESS) {
      operation.lastAttemptAt = new Date();
    }

    this.saveOperationsToStorage();
    this.emit('operationUpdated', operation);
    return true;
  }

  /**
   * Remove completed operations
   */
  removeCompletedOperations(): number {
    let removedCount = 0;
    const operationsToRemove: string[] = [];

    for (const [id, operation] of Array.from(this.operations.entries())) {
      if (operation.status === SyncStatus.COMPLETED) {
        operationsToRemove.push(id);
      }
    }

    operationsToRemove.forEach(id => {
      this.operations.delete(id);
      removedCount++;
    });

    if (removedCount > 0) {
      this.saveOperationsToStorage();
    }

    return removedCount;
  }

  /**
   * Process pending operations
   */
  async processPendingOperations(): Promise<BatchSyncResult> {
    if (this.syncInProgress || !this._isOnline) {
      throw new Error('Sync already in progress or offline');
    }

    const pendingOperations = this.getPendingOperations();
    if (pendingOperations.length === 0) {
      return this.createEmptyBatchResult();
    }

    this.syncInProgress = true;
    const batchId = generateId();
    const startTime = new Date();
    const results: SyncOperationResult[] = [];

    try {
      this.emit('syncStarted', { batchId, totalOperations: pendingOperations.length });

      // Process operations in batches
      const batches = this.chunkArray(pendingOperations, this.config.batchSize);

      for (const batch of batches) {
        const batchResults = await this.processBatch(batch);
        results.push(...batchResults);
      }

      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      const batchResult: BatchSyncResult = {
        batchId,
        totalOperations: pendingOperations.length,
        successfulOperations: results.filter(r => r.success).length,
        failedOperations: results.filter(r => !r.success).length,
        conflictOperations: results.filter(r => r.status === SyncStatus.CONFLICT).length,
        results,
        startTime,
        endTime,
        duration
      };

      this.emit('syncCompleted', batchResult);
      return batchResult;

    } catch (error) {
      this.emit('syncFailed', { batchId, error });
      throw error;
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Process a batch of operations
   */
  private async processBatch(operations: SyncOperation[]): Promise<SyncOperationResult[]> {
    const results: SyncOperationResult[] = [];

    for (const operation of operations) {
      try {
        // Mark as in progress
        this.updateOperationStatus(operation.id, SyncStatus.IN_PROGRESS);

        // Simulate API call (replace with actual API calls)
        const result = await this.executeOperation(operation);
        results.push(result);

        // Update status based on result
        if (result.success) {
          this.updateOperationStatus(operation.id, SyncStatus.COMPLETED);
        } else if (result.status === SyncStatus.CONFLICT) {
          this.updateOperationStatus(operation.id, SyncStatus.CONFLICT, result.message, result.conflictData);
        } else {
          this.updateOperationStatus(operation.id, SyncStatus.FAILED, result.message);
        }

      } catch (error) {
        const result: SyncOperationResult = {
          success: false,
          operationId: operation.id,
          entityId: operation.entityId,
          entityType: operation.entityType,
          status: SyncStatus.FAILED,
          message: error instanceof Error ? error.message : 'Unknown error',
          error: error instanceof Error ? error : new Error('Unknown error'),
          timestamp: new Date()
        };

        results.push(result);
        this.updateOperationStatus(operation.id, SyncStatus.FAILED, result.message);
      }
    }

    return results;
  }

  /**
   * Execute a single operation
   */
  private async executeOperation(operation: SyncOperation): Promise<SyncOperationResult> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 100));

    // Simulate different operation types
    switch (operation.type) {
      case SyncOperationType.CREATE:
        return this.simulateCreateOperation(operation);
      case SyncOperationType.UPDATE:
        return this.simulateUpdateOperation(operation);
      case SyncOperationType.DELETE:
        return this.simulateDeleteOperation(operation);
      default:
        throw new Error(`Unknown operation type: ${operation.type}`);
    }
  }

  /**
   * Simulate CREATE operation
   */
  private simulateCreateOperation(operation: SyncOperation): SyncOperationResult {
    // Simulate 95% success rate
    if (Math.random() < 0.95) {
      return {
        success: true,
        operationId: operation.id,
        entityId: operation.entityId,
        entityType: operation.entityType,
        status: SyncStatus.COMPLETED,
        message: 'Created successfully',
        data: operation.data,
        timestamp: new Date()
      };
    } else {
      return {
        success: false,
        operationId: operation.id,
        entityId: operation.entityId,
        entityType: operation.entityType,
        status: SyncStatus.FAILED,
        message: 'Simulated creation failure',
        timestamp: new Date()
      };
    }
  }

  /**
   * Simulate UPDATE operation
   */
  private simulateUpdateOperation(operation: SyncOperation): SyncOperationResult {
    // Simulate 90% success rate with 5% conflict rate
    const random = Math.random();

    if (random < 0.85) {
      return {
        success: true,
        operationId: operation.id,
        entityId: operation.entityId,
        entityType: operation.entityType,
        status: SyncStatus.COMPLETED,
        message: 'Updated successfully',
        data: operation.data,
        timestamp: new Date()
      };
    } else if (random < 0.90) {
      return {
        success: false,
        operationId: operation.id,
        entityId: operation.entityId,
        entityType: operation.entityType,
        status: SyncStatus.CONFLICT,
        message: 'Simulated conflict - remote version newer',
        conflictData: { remoteVersion: operation.data.version + 1 },
        timestamp: new Date()
      };
    } else {
      return {
        success: false,
        operationId: operation.id,
        entityId: operation.entityId,
        entityType: operation.entityType,
        status: SyncStatus.FAILED,
        message: 'Simulated update failure',
        timestamp: new Date()
      };
    }
  }

  /**
   * Simulate DELETE operation
   */
  private simulateDeleteOperation(operation: SyncOperation): SyncOperationResult {
    // Simulate 98% success rate
    if (Math.random() < 0.98) {
      return {
        success: true,
        operationId: operation.id,
        entityId: operation.entityId,
        entityType: operation.entityType,
        status: SyncStatus.COMPLETED,
        message: 'Deleted successfully',
        timestamp: new Date()
      };
    } else {
      return {
        success: false,
        operationId: operation.id,
        entityId: operation.entityId,
        entityType: operation.entityType,
        status: SyncStatus.FAILED,
        message: 'Simulated deletion failure',
        timestamp: new Date()
      };
    }
  }

  /**
   * Process a sync operation (simulate API call)
   */
  public async processOperation(operation: SyncOperation): Promise<{
    success: boolean;
    conflict?: boolean;
    error?: string;
  }> {
    try {
      console.log(`Processing operation: ${operation.type} ${operation.entityType} ${operation.entityId}`);

      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));

      // Simulate occasional conflicts (10% chance)
      if (Math.random() < 0.1) {
        console.log(`Conflict detected for operation ${operation.id}`);
        return {
          success: false,
          conflict: true,
          error: 'Data conflict detected'
        };
      }

      // Simulate occasional failures (5% chance)
      if (Math.random() < 0.05) {
        console.log(`Operation ${operation.id} failed`);
        return {
          success: false,
          error: 'Network error'
        };
      }

      console.log(`Operation ${operation.id} processed successfully`);
      return { success: true };

    } catch (error) {
      console.error(`Error processing operation ${operation.id}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get sync queue statistics
   */
  getQueueStats(): SyncQueueStats {
    const totalOperations = this.operations.size;
    const pendingOperations = this.getPendingOperations().length;
    const completedOperations = Array.from(this.operations.values())
      .filter(op => op.status === SyncStatus.COMPLETED).length;
    const failedOperations = Array.from(this.operations.values())
      .filter(op => op.status === SyncStatus.FAILED).length;
    const conflictOperations = Array.from(this.operations.values())
      .filter(op => op.status === SyncStatus.CONFLICT).length;

    return {
      totalOperations,
      pendingOperations,
      completedOperations,
      failedOperations,
      conflictOperations,
      lastSyncAt: this.syncInProgress ? undefined : new Date(),
      nextSyncAt: this.config.enableAutoSync ? new Date(Date.now() + this.config.syncInterval) : undefined,
      estimatedTimeRemaining: this.estimateTimeRemaining()
    };
  }

  /**
   * Estimate time remaining for sync
   */
  private estimateTimeRemaining(): number {
    const pendingOperations = this.getPendingOperations().length;
    const estimatedTimePerOperation = 200; // milliseconds
    return Math.ceil((pendingOperations * estimatedTimePerOperation) / 1000);
  }

  /**
   * Clear all operations (use with caution)
   */
  clearAllOperations(): void {
    this.operations.clear();
    this.saveOperationsToStorage();
    this.emit('operationsCleared');
  }

  /**
   * Update sync configuration
   */
  updateConfig(newConfig: Partial<SyncConfig>): void {
    this.config = { ...this.config, ...newConfig };

    if (this.config.enableAutoSync) {
      this.startAutoSync();
    } else {
      this.stopAutoSync();
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): SyncConfig {
    return { ...this.config };
  }

  /**
   * Event system for sync events
   */
  on(event: string, callback: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  /**
   * Remove event listener
   */
  off(event: string, callback: Function): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Emit event to listeners
   */
  private emit(event: string, data?: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Utility method to chunk array into batches
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Create empty batch result
   */
  private createEmptyBatchResult(): BatchSyncResult {
    return {
      batchId: generateId(),
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
      conflictOperations: 0,
      results: [],
      startTime: new Date(),
      endTime: new Date(),
      duration: 0
    };
  }

  /**
   * Save operations to storage
   */
  private saveOperationsToStorage(): void {
    try {
      const operationsArray = Array.from(this.operations.values());
      localStorage.setItem('chanitec_sync_operations', JSON.stringify(operationsArray));
    } catch (error) {
      console.error('Failed to save sync operations to storage:', error);
    }
  }

  /**
   * Load operations from storage
   */
  private loadOperationsFromStorage(): void {
    try {
      const stored = localStorage.getItem('chanitec_sync_operations');
      if (stored) {
        const operationsArray = JSON.parse(stored);
        operationsArray.forEach((op: any) => {
          // Convert date strings back to Date objects
          op.createdAt = new Date(op.createdAt);
          op.updatedAt = new Date(op.updatedAt);
          if (op.lastAttemptAt) {
            op.lastAttemptAt = new Date(op.lastAttemptAt);
          }
          this.operations.set(op.id, op);
        });
      }
    } catch (error) {
      console.error('Failed to load sync operations from storage:', error);
    }
  }

  /**
   * Check if sync is in progress
   */
  isSyncInProgress(): boolean {
    return this.syncInProgress;
  }

  /**
   * Check if online
   */
  isOnline(): boolean {
    return this._isOnline;
  }

  /**
   * Get pending operations count
   */
  getPendingCount(): number {
    return this.getPendingOperations().length;
  }
}

// Export singleton instance
export const offlineSyncService = new OfflineSyncService();
export default OfflineSyncService;
