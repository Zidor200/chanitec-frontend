// Enhanced Models for Chanitec PWA with Sync Metadata
// Extends existing models with sync-related fields for offline synchronization

import { Quote, Client, Site, SupplyItem } from './Quote';

/**
 * Sync status for entities
 */
export enum EntitySyncStatus {
  SYNCED = 'synced',           // Successfully synced with backend
  PENDING = 'pending',          // Waiting to be synced
  CONFLICT = 'conflict',        // Has conflicts that need resolution
  FAILED = 'failed',            // Sync failed, needs retry
  OFFLINE = 'offline'           // Created/updated while offline
}

/**
 * Enhanced Quote with sync metadata
 */
export interface EnhancedQuote extends Quote {
  // Sync metadata
  syncStatus: EntitySyncStatus;
  lastSyncedAt?: string;        // ISO string of last successful sync
  syncVersion: number;          // Version for conflict resolution
  syncConflictData?: any;       // Data about any sync conflicts
  syncErrorMessage?: string;    // Error message if sync failed
  syncRetryCount: number;       // Number of sync retry attempts
  syncLastAttemptAt?: string;   // ISO string of last sync attempt

  // Additional metadata for better sync handling
  isDirty: boolean;             // True if local changes haven't been synced
  parentSyncId?: string;        // Reference to parent entity in sync system
  syncPriority: number;         // Priority for sync operations (1-5, 5 being highest)
}

/**
 * Enhanced Client with sync metadata
 */
export interface EnhancedClient extends Client {
  // Sync metadata
  syncStatus: EntitySyncStatus;
  lastSyncedAt?: string;
  syncVersion: number;
  syncConflictData?: any;
  syncErrorMessage?: string;
  syncRetryCount: number;
  syncLastAttemptAt?: string;

  // Additional metadata
  isDirty: boolean;
  parentSyncId?: string;
  syncPriority: number;

  // Enhanced sites relationship
  sites: EnhancedSite[];
}

/**
 * Enhanced Site with sync metadata
 */
export interface EnhancedSite extends Site {
  // Sync metadata
  syncStatus: EntitySyncStatus;
  lastSyncedAt?: string;
  syncVersion: number;
  syncConflictData?: any;
  syncErrorMessage?: string;
  syncRetryCount: number;
  syncLastAttemptAt?: string;

  // Additional metadata
  isDirty: boolean;
  parentSyncId?: string;
  syncPriority: number;

  // Enhanced client relationship
  client?: EnhancedClient;
}

/**
 * Enhanced SupplyItem with sync metadata
 */
export interface EnhancedSupplyItem extends SupplyItem {
  // Sync metadata
  syncStatus: EntitySyncStatus;
  lastSyncedAt?: string;
  syncVersion: number;
  syncConflictData?: any;
  syncErrorMessage?: string;
  syncRetryCount: number;
  syncLastAttemptAt?: string;

  // Additional metadata
  isDirty: boolean;
  parentSyncId?: string;
  syncPriority: number;

  // Enhanced quote relationship
  quote?: EnhancedQuote;
}

/**
 * Sync metadata interface that can be applied to any entity
 */
export interface SyncMetadata {
  syncStatus: EntitySyncStatus;
  lastSyncedAt?: string;
  syncVersion: number;
  syncConflictData?: any;
  syncErrorMessage?: string;
  syncRetryCount: number;
  syncLastAttemptAt?: string;
  isDirty: boolean;
  parentSyncId?: string;
  syncPriority: number;
}

/**
 * Factory functions to create enhanced entities with default sync metadata
 */
export const createEnhancedQuote = (quote: Quote): EnhancedQuote => ({
  ...quote,
  syncStatus: EntitySyncStatus.OFFLINE,
  syncVersion: 1,
  syncRetryCount: 0,
  isDirty: true,
  syncPriority: 2 // High priority for quotes
});

export const createEnhancedClient = (client: Client): EnhancedClient => ({
  ...client,
  syncStatus: EntitySyncStatus.OFFLINE,
  syncVersion: 1,
  syncRetryCount: 0,
  isDirty: true,
  syncPriority: 1,
  sites: client.sites.map(site => createEnhancedSite(site))
});

export const createEnhancedSite = (site: Site): EnhancedSite => ({
  ...site,
  syncStatus: EntitySyncStatus.OFFLINE,
  syncVersion: 1,
  syncRetryCount: 0,
  isDirty: true,
  syncPriority: 1
});

export const createEnhancedSupplyItem = (supply: SupplyItem): EnhancedSupplyItem => ({
  ...supply,
  syncStatus: EntitySyncStatus.OFFLINE,
  syncVersion: 1,
  syncRetryCount: 0,
  isDirty: true,
  syncPriority: 1
});

/**
 * Utility functions for sync metadata management
 */
export const markEntityAsSynced = <T extends SyncMetadata>(entity: T): T => ({
  ...entity,
  syncStatus: EntitySyncStatus.SYNCED,
  lastSyncedAt: new Date().toISOString(),
  isDirty: false,
  syncRetryCount: 0,
  syncErrorMessage: undefined,
  syncConflictData: undefined
});

export const markEntityAsPending = <T extends SyncMetadata>(entity: T): T => ({
  ...entity,
  syncStatus: EntitySyncStatus.PENDING,
  isDirty: true,
  syncLastAttemptAt: new Date().toISOString()
});

export const markEntityAsConflict = <T extends SyncMetadata>(
  entity: T,
  conflictData: any,
  errorMessage?: string
): T => ({
  ...entity,
  syncStatus: EntitySyncStatus.CONFLICT,
  syncConflictData: conflictData,
  syncErrorMessage: errorMessage,
  syncRetryCount: entity.syncRetryCount + 1,
  syncLastAttemptAt: new Date().toISOString(),
  isDirty: true
});

export const markEntityAsFailed = <T extends SyncMetadata>(
  entity: T,
  errorMessage: string
): T => ({
  ...entity,
  syncStatus: EntitySyncStatus.FAILED,
  syncErrorMessage: errorMessage,
  syncRetryCount: entity.syncRetryCount + 1,
  syncLastAttemptAt: new Date().toISOString(),
  isDirty: true
});

export const incrementSyncVersion = <T extends SyncMetadata>(entity: T): T => ({
  ...entity,
  syncVersion: entity.syncVersion + 1,
  isDirty: true
});

/**
 * Type guards for enhanced entities
 */
export const isEnhancedQuote = (entity: any): entity is EnhancedQuote => {
  return entity && 'syncStatus' in entity && 'syncVersion' in entity;
};

export const isEnhancedClient = (entity: any): entity is EnhancedClient => {
  return entity && 'syncStatus' in entity && 'syncVersion' in entity;
};

export const isEnhancedSite = (entity: any): entity is EnhancedSite => {
  return entity && 'syncStatus' in entity && 'syncVersion' in entity;
};

export const isEnhancedSupplyItem = (entity: any): entity is EnhancedSupplyItem => {
  return entity && 'syncStatus' in entity && 'syncVersion' in entity;
};

/**
 * Check if an entity needs syncing
 */
export const needsSync = (entity: SyncMetadata): boolean => {
  return entity.isDirty || entity.syncStatus === EntitySyncStatus.PENDING;
};

/**
 * Check if an entity has sync conflicts
 */
export const hasSyncConflict = (entity: SyncMetadata): boolean => {
  return entity.syncStatus === EntitySyncStatus.CONFLICT;
};

/**
 * Check if an entity sync failed
 */
export const hasSyncFailed = (entity: SyncMetadata): boolean => {
  return entity.syncStatus === EntitySyncStatus.FAILED;
};

/**
 * Check if an entity is ready for sync
 */
export const isReadyForSync = (entity: SyncMetadata): boolean => {
  return entity.isDirty &&
         entity.syncStatus !== EntitySyncStatus.PENDING &&
         entity.syncStatus !== EntitySyncStatus.CONFLICT;
};
