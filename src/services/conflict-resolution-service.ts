import { SyncOperation, SyncEntityType, ConflictResolutionStrategy } from '../models/SyncOperation';
import { storageService } from './storage-service';
import { syncQueueStorage } from './sync-queue-storage';

export interface ConflictData {
  localVersion: any;
  remoteVersion: any;
  conflictType: 'UPDATE_UPDATE' | 'UPDATE_DELETE' | 'DELETE_UPDATE' | 'CREATE_CONFLICT';
  timestamp: Date;
  description: string;
}

export interface ConflictResolution {
  operationId: string;
  strategy: ConflictResolutionStrategy;
  resolvedData: any;
  timestamp: Date;
  resolvedBy: string;
  notes?: string;
}

export interface ConflictResolutionResult {
  success: boolean;
  resolvedData?: any;
  error?: string;
  requiresManualResolution?: boolean;
}

export class ConflictResolutionService {
  private conflictHistory: Map<string, ConflictResolution> = new Map();
  private autoResolutionEnabled = true;
  private defaultStrategy: ConflictResolutionStrategy = ConflictResolutionStrategy.LAST_WRITE_WINS;

  constructor() {
    this.loadConflictHistory();
  }

  /**
   * Detect conflicts between local and remote data
   */
  public async detectConflicts(operation: SyncOperation): Promise<ConflictData | null> {
    try {
      const localData = await this.getLocalData(operation);
      const remoteData = operation.data;

      if (!localData && !remoteData) {
        return null; // No conflict
      }

      if (!localData && remoteData) {
        // Local doesn't exist but remote does - potential CREATE conflict
        return {
          localVersion: null,
          remoteVersion: remoteData,
          conflictType: 'CREATE_CONFLICT',
          timestamp: new Date(),
          description: `Local entity doesn't exist but remote operation tries to create/update it`
        };
      }

      if (localData && !remoteData) {
        // Local exists but remote doesn't - potential DELETE conflict
        return {
          localVersion: localData,
          remoteVersion: null,
          conflictType: 'DELETE_UPDATE',
          timestamp: new Date(),
          description: `Local entity exists but remote operation tries to delete it`
        };
      }

      // Both exist - check for UPDATE conflicts
      if (localData && remoteData) {
        const localTimestamp = this.getTimestamp(localData);
        const remoteTimestamp = operation.timestamp;

        if (localTimestamp && remoteTimestamp) {
          const timeDiff = Math.abs(new Date(localTimestamp).getTime() - new Date(remoteTimestamp).getTime());

          // If timestamps are very close (within 1 second), consider it a conflict
          if (timeDiff < 1000) {
            return {
              localVersion: localData,
              remoteVersion: remoteData,
              conflictType: 'UPDATE_UPDATE',
              timestamp: new Date(),
              description: `Concurrent updates detected with timestamps ${timeDiff}ms apart`
            };
          }
        }

        // Check for data content conflicts
        if (this.hasDataContentConflict(localData, remoteData)) {
          return {
            localVersion: localData,
            remoteVersion: remoteData,
            conflictType: 'UPDATE_UPDATE',
            timestamp: new Date(),
            description: `Data content conflict detected between local and remote versions`
          };
        }
      }

      return null; // No conflict detected
    } catch (error) {
      console.error('Error detecting conflicts:', error);
      return null;
    }
  }

  /**
   * Resolve a conflict automatically or manually
   */
  public async resolveConflict(
    operation: SyncOperation,
    conflictData: ConflictData,
    strategy?: ConflictResolutionStrategy
  ): Promise<ConflictResolutionResult> {
    try {
      const resolutionStrategy = strategy || this.defaultStrategy;

      if (this.autoResolutionEnabled) {
        return await this.autoResolve(operation, conflictData, resolutionStrategy);
      } else {
        return {
          success: false,
          requiresManualResolution: true,
          error: 'Auto-resolution disabled, manual resolution required'
        };
      }
    } catch (error) {
      console.error('Error resolving conflict:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error during conflict resolution'
      };
    }
  }

  /**
   * Auto-resolve conflict using specified strategy
   */
  private async autoResolve(
    operation: SyncOperation,
    conflictData: ConflictData,
    strategy: ConflictResolutionStrategy
  ): Promise<ConflictResolutionResult> {
    let resolvedData: any;

    switch (strategy) {
      case ConflictResolutionStrategy.LAST_WRITE_WINS:
        resolvedData = await this.resolveLastWriteWins(operation, conflictData);
        break;

      case ConflictResolutionStrategy.LOCAL_WINS:
        resolvedData = conflictData.localVersion;
        break;

      case ConflictResolutionStrategy.REMOTE_WINS:
        resolvedData = conflictData.remoteVersion;
        break;

      case ConflictResolutionStrategy.MERGE:
        resolvedData = await this.mergeData(conflictData.localVersion, conflictData.remoteVersion);
        break;

      default:
        return {
          success: false,
          error: `Unknown conflict resolution strategy: ${strategy}`
        };
    }

    if (resolvedData) {
      // Record the resolution
      const resolution: ConflictResolution = {
        operationId: operation.id,
        strategy,
        resolvedData,
        timestamp: new Date(),
        resolvedBy: 'auto-resolution',
        notes: `Auto-resolved using ${strategy} strategy`
      };

      this.conflictHistory.set(operation.id, resolution);
      await this.saveConflictHistory();

      return {
        success: true,
        resolvedData
      };
    }

    return {
      success: false,
      error: 'Failed to resolve conflict with selected strategy'
    };
  }

  /**
   * Resolve conflict using last-write-wins strategy
   */
  private async resolveLastWriteWins(
    operation: SyncOperation,
    conflictData: ConflictData
  ): Promise<any> {
    const localTimestamp = this.getTimestamp(conflictData.localVersion);
    const remoteTimestamp = operation.timestamp;

    if (localTimestamp && remoteTimestamp) {
      const localTime = new Date(localTimestamp).getTime();
      const remoteTime = new Date(remoteTimestamp).getTime();

      return localTime > remoteTime ? conflictData.localVersion : conflictData.remoteVersion;
    }

    // Fallback to remote version if timestamp comparison fails
    return conflictData.remoteVersion;
  }

  /**
   * Merge local and remote data
   */
  private async mergeData(localData: any, remoteData: any): Promise<any> {
    if (!localData || !remoteData) {
      return localData || remoteData;
    }

    // Simple merge strategy - combine all fields, remote takes precedence for conflicts
    const merged = { ...localData };

    for (const [key, value] of Object.entries(remoteData)) {
      if (value !== undefined && value !== null) {
        merged[key] = value;
      }
    }

    // Update timestamp to current time
    merged.updatedAt = new Date().toISOString();
    merged.lastSyncedAt = new Date().toISOString();

    return merged;
  }

  /**
   * Check if there's a data content conflict
   */
  private hasDataContentConflict(localData: any, remoteData: any): boolean {
    // Simple conflict detection - check if critical fields differ
    const criticalFields = ['name', 'title', 'amount', 'quantity', 'status'];

    for (const field of criticalFields) {
      if (localData[field] !== remoteData[field]) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get local data for the entity
   */
  private async getLocalData(operation: SyncOperation): Promise<any> {
    try {
      switch (operation.entityType) {
        case SyncEntityType.QUOTE:
          return storageService.getQuoteById(operation.entityId);
        case SyncEntityType.CLIENT:
          return storageService.getClientById(operation.entityId);
        case SyncEntityType.SITE:
          const sites = storageService.getSites();
          return sites.find(site => site.id === operation.entityId);
        case SyncEntityType.SUPPLY_ITEM:
          const supplies = storageService.getSupplies();
          return supplies.find(supply => supply.id === operation.entityId);
        default:
          return null;
      }
    } catch (error) {
      console.error('Error getting local data:', error);
      return null;
    }
  }

  /**
   * Get timestamp from data object
   */
  private getTimestamp(data: any): string | null {
    return data?.updatedAt || data?.lastModified || data?.timestamp || null;
  }

  /**
   * Get conflict resolution history
   */
  public getConflictHistory(): ConflictResolution[] {
    return Array.from(this.conflictHistory.values());
  }

  /**
   * Get conflict resolution for specific operation
   */
  public getConflictResolution(operationId: string): ConflictResolution | undefined {
    return this.conflictHistory.get(operationId);
  }

  /**
   * Enable/disable auto-resolution
   */
  public setAutoResolutionEnabled(enabled: boolean): void {
    this.autoResolutionEnabled = enabled;
  }

  /**
   * Set default conflict resolution strategy
   */
  public setDefaultStrategy(strategy: ConflictResolutionStrategy): void {
    this.defaultStrategy = strategy;
  }

  /**
   * Clear conflict history
   */
  public clearConflictHistory(): void {
    this.conflictHistory.clear();
    this.saveConflictHistory();
  }

  /**
   * Load conflict history from storage
   */
  private async loadConflictHistory(): Promise<void> {
    try {
      const stored = localStorage.getItem('conflictResolutionHistory');
      if (stored) {
        const parsed = JSON.parse(stored);
        const entries = Array.from(Object.entries(parsed));
        for (const [key, value] of entries) {
          this.conflictHistory.set(key, value as ConflictResolution);
        }
      }
    } catch (error) {
      console.error('Error loading conflict history:', error);
    }
  }

  /**
   * Save conflict history to storage
   */
  private async saveConflictHistory(): Promise<void> {
    try {
      const serialized: Record<string, ConflictResolution> = {};
      const entries = Array.from(this.conflictHistory.entries());
      for (const [key, value] of entries) {
        serialized[key] = value;
      }
      localStorage.setItem('conflictResolutionHistory', JSON.stringify(serialized));
    } catch (error) {
      console.error('Error saving conflict history:', error);
    }
  }

  /**
   * Get service statistics
   */
  public getStats(): {
    totalConflicts: number;
    autoResolved: number;
    manualResolved: number;
    pendingConflicts: number;
    lastConflictAt: Date | null;
  } {
    const resolutions = Array.from(this.conflictHistory.values());
    const autoResolved = resolutions.filter(r => r.resolvedBy === 'auto-resolution').length;

    return {
      totalConflicts: resolutions.length,
      autoResolved,
      manualResolved: resolutions.length - autoResolved,
      pendingConflicts: 0, // This would need to be tracked separately
      lastConflictAt: resolutions.length > 0 ?
        new Date(Math.max(...resolutions.map(r => r.timestamp.getTime()))) : null
    };
  }
}

// Export singleton instance
export const conflictResolutionService = new ConflictResolutionService();
