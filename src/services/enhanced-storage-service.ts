// Enhanced Storage Service for Chanitec PWA
// Extends the existing StorageService with offline sync capabilities
import { storageService } from './storage-service';
import { offlineSyncService } from './offline-sync-service';
import { SyncOperationType, SyncEntityType } from '../models/SyncOperation';
import { Client, Quote, Site, SupplyItem } from '../models/Quote';

/**
 * Enhanced Storage Service - Extends existing StorageService with offline sync
 * Implements dual-write strategy: immediate local storage + queue for sync
 */
class EnhancedStorageService {
  private _isOnline: boolean = navigator.onLine;
  private syncEnabled: boolean = true;

  constructor() {
    this.setupNetworkListeners();
    this.setupSyncEventListeners();
  }

  /**
   * Set up network status listeners
   */
  private setupNetworkListeners(): void {
    window.addEventListener('online', () => {
      this._isOnline = true;
      this.processPendingSync();
    });

    window.addEventListener('offline', () => {
      this._isOnline = false;
    });
  }

  /**
   * Set up sync event listeners
   */
  private setupSyncEventListeners(): void {
    offlineSyncService.on('syncCompleted', (result: any) => {
      console.log('Sync completed:', result);
      this.emit('syncCompleted', result);
    });

    offlineSyncService.on('syncFailed', (error: any) => {
      console.error('Sync failed:', error);
      this.emit('syncFailed', error);
    });

    offlineSyncService.on('operationQueued', (operation: any) => {
      console.log('Operation queued:', operation);
      this.emit('operationQueued', operation);
    });
  }

  /**
   * Process pending sync operations when coming back online
   */
  private async processPendingSync(): Promise<void> {
    if (this.syncEnabled && this._isOnline) {
      try {
        console.log('Processing pending sync operations...');

        // Show notification about automatic sync
        this.showNotification('🔄 Auto-Sync Started', {
          body: 'Processing pending operations...',
          tag: 'auto-sync-start'
        });

        await offlineSyncService.processPendingOperations();
        console.log('Pending sync operations completed');

        // Show notification about sync completion
        this.showNotification('✅ Auto-Sync Complete', {
          body: 'All pending operations have been processed',
          tag: 'auto-sync-complete'
        });
      } catch (error) {
        console.error('Failed to process pending sync:', error);
        this.showNotification('❌ Auto-Sync Failed', {
          body: 'Failed to process pending operations',
          tag: 'auto-sync-error'
        });
      }
    }
  }

  /**
   * Show notification helper method
   */
  private showNotification(title: string, options?: NotificationOptions): void {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, {
        icon: '/logo192.png',
        badge: '/logo192.png',
        ...options
      });
    }
  }

  /**
   * Queue an operation for sync
   */
  private queueSyncOperation(
    type: SyncOperationType,
    entityType: SyncEntityType,
    entityId: string,
    data: any,
    priority: number = 1
  ): string {
    if (!this.syncEnabled) return '';

    try {
      return offlineSyncService.queueOperation(type, entityType, entityId, data, priority);
    } catch (error) {
      console.error('Failed to queue sync operation:', error);
      return '';
    }
  }

  /**
   * Enhanced Quote Methods with Offline Sync
   */
  saveQuote(quote: Quote): Quote {
    // First, save to local storage (immediate response)
    const savedQuote = storageService.saveQuote(quote);

    // Then queue for sync
    if (quote.id) {
      // Update operation
      this.queueSyncOperation(
        SyncOperationType.UPDATE,
        SyncEntityType.QUOTE,
        quote.id,
        savedQuote,
        2 // High priority for quotes
      );
    } else {
      // Create operation
      this.queueSyncOperation(
        SyncOperationType.CREATE,
        SyncEntityType.QUOTE,
        savedQuote.id,
        savedQuote,
        2
      );
    }

    return savedQuote;
  }

  deleteQuote(id: string): boolean {
    // Get quote data before deletion for sync
    const quote = storageService.getQuoteById(id);
    const deleted = storageService.deleteQuote(id);

    if (deleted && quote) {
      // Queue delete operation
      this.queueSyncOperation(
        SyncOperationType.DELETE,
        SyncEntityType.QUOTE,
        id,
        quote,
        1
      );
    }

    return deleted;
  }

  /**
   * Enhanced Client Methods with Offline Sync
   */
  saveClient(client: Omit<Client, 'id'> & { id?: string }): Client {
    // First, save to local storage
    const savedClient = storageService.saveClient(client);

    // Then queue for sync
    if (client.id) {
      // Update operation
      this.queueSyncOperation(
        SyncOperationType.UPDATE,
        SyncEntityType.CLIENT,
        client.id,
        savedClient,
        1
      );
    } else {
      // Create operation
      this.queueSyncOperation(
        SyncOperationType.CREATE,
        SyncEntityType.CLIENT,
        savedClient.id,
        savedClient,
        1
      );
    }

    return savedClient;
  }

  deleteClient(id: string): void {
    // Get client data before deletion for sync
    const client = storageService.getClientById(id);
    const sites = storageService.getSitesByClientId(id);

    // Delete from local storage
    storageService.deleteClient(id);

    // Queue delete operations
    if (client) {
      this.queueSyncOperation(
        SyncOperationType.DELETE,
        SyncEntityType.CLIENT,
        id,
        client,
        1
      );
    }

    // Queue site deletions
    sites.forEach(site => {
      this.queueSyncOperation(
        SyncOperationType.DELETE,
        SyncEntityType.SITE,
        site.id,
        site,
        1
      );
    });
  }

  /**
   * Enhanced Site Methods with Offline Sync
   */
  saveSite(site: Omit<Site, 'id'> & { id?: string }): Site {
    // First, save to local storage
    const savedSite = storageService.saveSite(site);

    // Then queue for sync
    if (site.id) {
      // Update operation
      this.queueSyncOperation(
        SyncOperationType.UPDATE,
        SyncEntityType.SITE,
        site.id,
        savedSite,
        1
      );
    } else {
      // Create operation
      this.queueSyncOperation(
        SyncOperationType.CREATE,
        SyncEntityType.SITE,
        savedSite.id,
        savedSite,
        1
      );
    }

    return savedSite;
  }

  deleteSite(id: string): boolean {
    // Get site data before deletion for sync
    const site = storageService.getSites().find((s: Site) => s.id === id);
    const deleted = storageService.deleteSite(id);

    if (deleted && site) {
      // Queue delete operation
      this.queueSyncOperation(
        SyncOperationType.DELETE,
        SyncEntityType.SITE,
        id,
        site,
        1
      );
    }

    return deleted;
  }

  /**
   * Enhanced Supply Methods with Offline Sync
   */
  saveSupply(supply: Omit<SupplyItem, 'id'> & { id?: string }): SupplyItem {
    // First, save to local storage
    const savedSupply = storageService.saveSupply(supply);

    // Then queue for sync
    if (supply.id) {
      // Update operation
      this.queueSyncOperation(
        SyncOperationType.UPDATE,
        SyncEntityType.SUPPLY_ITEM,
        supply.id,
        savedSupply,
        1
      );
    } else {
      // Create operation
      this.queueSyncOperation(
        SyncOperationType.CREATE,
        SyncEntityType.SUPPLY_ITEM,
        savedSupply.id,
        savedSupply,
        1
      );
    }

    return savedSupply;
  }

  deleteSupply(id: string): boolean {
    // Get supply data before deletion for sync
    const supply = storageService.getSupplies().find((s: SupplyItem) => s.id === id);
    const deleted = storageService.deleteSupply(id);

    if (deleted && supply) {
      // Queue delete operation
      this.queueSyncOperation(
        SyncOperationType.DELETE,
        SyncEntityType.SUPPLY_ITEM,
        id,
        supply,
        1
      );
    }

    return deleted;
  }

  /**
   * Sync Status and Control Methods
   */
  isOnline(): boolean {
    return this._isOnline;
  }

  isSyncEnabled(): boolean {
    return this.syncEnabled;
  }

  enableSync(): void {
    this.syncEnabled = true;
  }

  disableSync(): void {
    this.syncEnabled = false;
  }

  /**
   * Get sync queue statistics
   */
  getSyncStats() {
    return offlineSyncService.getQueueStats();
  }

  /**
   * Manually trigger sync operations
   */
  public async triggerSync(): Promise<void> {
    if (!this._isOnline) {
      throw new Error('Cannot sync while offline');
    }

    try {
      console.log('Manually triggering sync...');

      // Show notification about manual sync
      this.showNotification('🔄 Manual Sync Started', {
        body: 'Processing pending operations...',
        tag: 'manual-sync-start'
      });

      await offlineSyncService.processPendingOperations();
      console.log('Manual sync completed');

      // Show notification about sync completion
      this.showNotification('✅ Manual Sync Complete', {
        body: 'All pending operations have been processed',
        tag: 'manual-sync-complete'
      });
    } catch (error) {
      console.error('Manual sync failed:', error);
      this.showNotification('❌ Manual Sync Failed', {
        body: 'Failed to process pending operations',
        tag: 'manual-sync-error'
      });
      throw error;
    }
  }

  /**
   * Get pending sync operations count
   */
  getPendingSyncCount(): number {
    return offlineSyncService.getPendingCount();
  }

  /**
   * Check if there are pending sync operations
   */
  hasPendingSync(): boolean {
    return this.getPendingSyncCount() > 0;
  }

  /**
   * Get sync status information
   */
  getSyncStatus(): {
    isOnline: boolean;
    syncEnabled: boolean;
    pendingCount: number;
    hasPending: boolean;
  } {
    return {
      isOnline: this._isOnline,
      syncEnabled: this.syncEnabled,
      pendingCount: this.getPendingSyncCount(),
      hasPending: this.hasPendingSync()
    };
  }

  // Delegate methods to storage service
  getQuotes(): Quote[] {
    return storageService.getQuotes();
  }

  getQuoteById(id: string): Quote | undefined {
    return storageService.getQuoteById(id);
  }

  getClients(): Client[] {
    return storageService.getClients();
  }

  getClientById(id: string): Client | undefined {
    return storageService.getClientById(id);
  }

  getSites(): Site[] {
    return storageService.getSites();
  }

  getSitesByClientId(clientId: string): Site[] {
    return storageService.getSitesByClientId(clientId);
  }

  getSupplies(): SupplyItem[] {
    return storageService.getSupplies();
  }

  /**
   * Clear completed sync operations
   */
  clearCompletedSyncOperations(): number {
    return offlineSyncService.removeCompletedOperations();
  }

  /**
   * Event system for enhanced storage events
   */
  private eventListeners: Map<string, Function[]> = new Map();

  on(event: string, callback: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  off(event: string, callback: Function): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

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
}

// Export singleton instance
export const enhancedStorageService = new EnhancedStorageService();
export default EnhancedStorageService;
