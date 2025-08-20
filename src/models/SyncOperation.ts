// Sync Operation Models for Offline Data Synchronization

/**
 * Types of sync operations that can be queued
 */
export enum SyncOperationType {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE'
}

/**
 * Status of sync operations
 */
export enum SyncStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CONFLICT = 'CONFLICT',
  RETRY = 'RETRY'
}

/**
 * Entity types that can be synced
 */
export enum SyncEntityType {
  QUOTE = 'QUOTE',
  CLIENT = 'CLIENT',
  SITE = 'SITE',
  SUPPLY_ITEM = 'SUPPLY_ITEM'
}

/**
 * Base interface for sync operations
 */
export interface SyncOperation {
  id: string;
  type: SyncOperationType;
  entityType: SyncEntityType;
  entityId: string;
  data: any;
  status: SyncStatus;
  timestamp: Date;
  retryCount: number;
  priority: number;
  createdAt: Date;
  updatedAt: Date;
  errorMessage?: string;
  conflictData?: any;
  lastAttemptAt?: Date;
}

/**
 * Conflict resolution strategies
 */
export enum ConflictResolutionStrategy {
  LAST_WRITE_WINS = 'LAST_WRITE_WINS',
  LOCAL_WINS = 'LOCAL_WINS',
  REMOTE_WINS = 'REMOTE_WINS',
  MERGE = 'MERGE',
  MANUAL = 'MANUAL'
}

/**
 * Conflict resolution interface
 */
export interface ConflictResolution {
  operationId: string;
  strategy: ConflictResolutionStrategy;
  resolvedData: any;
  resolvedAt: Date;
  resolvedBy?: string; // User ID if manual resolution
  notes?: string;
}

/**
 * Sync metadata for entities
 */
export interface SyncMetadata {
  id: string;
  lastSyncedAt: Date;
  syncStatus: SyncStatus;
  version: number;
  lastModifiedAt: Date;
  isDirty: boolean; // Has local changes that need syncing
  conflictId?: string; // If there's a conflict
}

/**
 * Sync queue statistics
 */
export interface SyncQueueStats {
  totalOperations: number;
  pendingOperations: number;
  completedOperations: number;
  failedOperations: number;
  conflictOperations: number;
  lastSyncAt?: Date;
  nextSyncAt?: Date;
  estimatedTimeRemaining: number; // in seconds
}

/**
 * Sync operation result
 */
export interface SyncOperationResult {
  success: boolean;
  operationId: string;
  entityId: string;
  entityType: SyncEntityType;
  status: SyncStatus;
  message: string;
  data?: any;
  error?: Error;
  conflictData?: any;
  timestamp: Date;
}

/**
 * Batch sync result
 */
export interface BatchSyncResult {
  batchId: string;
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  conflictOperations: number;
  results: SyncOperationResult[];
  startTime: Date;
  endTime: Date;
  duration: number; // in milliseconds
}

/**
 * Sync configuration options
 */
export interface SyncConfig {
  maxRetries: number;
  retryDelay: number; // in milliseconds
  batchSize: number;
  syncInterval: number; // in milliseconds
  conflictResolutionStrategy: ConflictResolutionStrategy;
  enableAutoSync: boolean;
  enableBackgroundSync: boolean;
  maxQueueSize: number;
  enableConflictDetection: boolean;
}

/**
 * Default sync configuration
 */
export const DEFAULT_SYNC_CONFIG: SyncConfig = {
  maxRetries: 3,
  retryDelay: 5000, // 5 seconds
  batchSize: 50,
  syncInterval: 30000, // 30 seconds
  conflictResolutionStrategy: ConflictResolutionStrategy.LOCAL_WINS,
  enableAutoSync: true,
  enableBackgroundSync: true,
  maxQueueSize: 1000,
  enableConflictDetection: true
};
