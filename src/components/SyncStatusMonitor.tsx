import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  LinearProgress,
  IconButton,
  Tooltip,
  Alert,
  Collapse,
  Divider
} from '@mui/material';
import {
  Sync as SyncIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Settings as SettingsIcon,
  Refresh as RefreshIcon,
  Stop as StopIcon,
  PlayArrow as PlayIcon
} from '@mui/icons-material';
import { backgroundSyncService, BackgroundSyncConfig } from '../services/background-sync-service';
import { conflictResolutionService } from '../services/conflict-resolution-service';
import { syncQueueStorage } from '../services/sync-queue-storage';
import { SyncStatus } from '../models/SyncOperation';

interface SyncStatusMonitorProps {
  showAdvanced?: boolean;
  onSyncTriggered?: () => void;
}

export const SyncStatusMonitor: React.FC<SyncStatusMonitorProps> = ({
  showAdvanced = false,
  onSyncTriggered
}) => {
  const [status, setStatus] = useState(backgroundSyncService.getStatus());
  const [queueStats, setQueueStats] = useState<any>(null);
  const [conflictStats, setConflictStats] = useState<any>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [config, setConfig] = useState<BackgroundSyncConfig>(status.config);

  useEffect(() => {
    const updateStatus = () => {
      setStatus(backgroundSyncService.getStatus());
      updateQueueStats();
      updateConflictStats();
    };

    // Update status every 5 seconds
    const interval = setInterval(updateStatus, 5000);

    // Initial update
    updateStatus();

    // Listen for network changes
    const handleNetworkChange = (isOnline: boolean) => {
      updateStatus();
    };

    backgroundSyncService.addNetworkListener(handleNetworkChange);

    return () => {
      clearInterval(interval);
      backgroundSyncService.removeNetworkListener(handleNetworkChange);
    };
  }, []);

  const updateQueueStats = async () => {
    try {
      const stats = await syncQueueStorage.getStats();
      setQueueStats(stats);
    } catch (error) {
      console.error('Error updating queue stats:', error);
    }
  };

  const updateConflictStats = () => {
    try {
      const stats = conflictResolutionService.getStats();
      setConflictStats(stats);
    } catch (error) {
      console.error('Error updating conflict stats:', error);
    }
  };

  const handleManualSync = async () => {
    setIsRefreshing(true);
    try {
      await backgroundSyncService.manualSync();
      onSyncTriggered?.();
      // Update status after sync
      setTimeout(() => {
        setStatus(backgroundSyncService.getStatus());
        updateQueueStats();
        updateConflictStats();
        setIsRefreshing(false);
      }, 1000);
    } catch (error) {
      console.error('Manual sync failed:', error);
      setIsRefreshing(false);
    }
  };

  const handleStartStop = () => {
    if (status.isRunning) {
      backgroundSyncService.stop();
    } else {
      backgroundSyncService.start();
    }
    setStatus(backgroundSyncService.getStatus());
  };

  const handleConfigUpdate = (newConfig: Partial<BackgroundSyncConfig>) => {
    const updatedConfig = { ...config, ...newConfig };
    setConfig(updatedConfig);
    backgroundSyncService.updateConfig(updatedConfig);
  };

  const getStatusColor = () => {
    if (!status.isOnline) return 'error';
    if (status.metrics.failedOperations > 0) return 'warning';
    if (status.metrics.pendingOperations > 0) return 'info';
    return 'success';
  };

  const getStatusIcon = () => {
    if (!status.isOnline) return <ErrorIcon />;
    if (status.metrics.failedOperations > 0) return <WarningIcon />;
    if (status.metrics.pendingOperations > 0) return <InfoIcon />;
    return <CheckCircleIcon />;
  };

  const getStatusText = () => {
    if (!status.isOnline) return 'Offline';
    if (status.metrics.failedOperations > 0) return 'Sync Errors';
    if (status.metrics.pendingOperations > 0) return 'Pending Sync';
    return 'Synced';
  };

  const formatTime = (date: Date | null) => {
    if (!date) return 'Never';
    return new Date(date).toLocaleString();
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${Math.round(ms / 1000)}s`;
    return `${Math.round(ms / 60000)}m`;
  };

  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h6" component="h2">
            🔄 Sync Status Monitor
          </Typography>
          <Box>
            <Tooltip title="Refresh Status">
              <IconButton onClick={() => {
                setStatus(backgroundSyncService.getStatus());
                updateQueueStats();
                updateConflictStats();
              }}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Settings">
              <IconButton onClick={() => setShowSettings(!showSettings)}>
                <SettingsIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Main Status */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <Chip
            icon={getStatusIcon()}
            label={getStatusText()}
            color={getStatusColor()}
            variant="outlined"
          />
          <Chip
            icon={status.isOnline ? <CheckCircleIcon /> : <ErrorIcon />}
            label={status.isOnline ? 'Online' : 'Offline'}
            color={status.isOnline ? 'success' : 'error'}
            size="small"
          />
          <Chip
            icon={status.isRunning ? <PlayIcon /> : <StopIcon />}
            label={status.isRunning ? 'Running' : 'Stopped'}
            color={status.isRunning ? 'success' : 'default'}
            size="small"
          />
        </Box>

        {/* Sync Progress */}
        {status.metrics.pendingOperations > 0 && (
          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Pending Operations: {status.metrics.pendingOperations}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {Math.round((status.metrics.successfulOperations / status.metrics.totalOperations) * 100)}% Complete
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={(status.metrics.successfulOperations / Math.max(status.metrics.totalOperations, 1)) * 100}
              sx={{ height: 8, borderRadius: 4 }}
            />
          </Box>
        )}

        {/* Action Buttons */}
        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
          <Button
            variant="contained"
            startIcon={<SyncIcon />}
            onClick={handleManualSync}
            disabled={isRefreshing || !status.isOnline}
            size="small"
          >
            {isRefreshing ? 'Syncing...' : 'Manual Sync'}
          </Button>
          <Button
            variant="outlined"
            startIcon={status.isRunning ? <StopIcon /> : <PlayIcon />}
            onClick={handleStartStop}
            size="small"
          >
            {status.isRunning ? 'Stop' : 'Start'}
          </Button>
        </Box>

        {/* Basic Stats */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' }, gap: 2, mb: 2 }}>
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h6" color="primary">
              {status.metrics.totalOperations}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Total Operations
            </Typography>
          </Box>
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h6" color="success.main">
              {status.metrics.successfulOperations}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Successful
            </Typography>
          </Box>
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h6" color="error.main">
              {status.metrics.failedOperations}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Failed
            </Typography>
          </Box>
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h6" color="warning.main">
              {status.metrics.conflictCount}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Conflicts
            </Typography>
          </Box>
        </Box>

        {/* Advanced Stats */}
        {showAdvanced && (
          <>
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Advanced Statistics
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' }, gap: 2 }}>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Last Sync: {formatTime(status.metrics.lastSyncAt)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Avg Sync Time: {formatDuration(status.metrics.averageSyncTime)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Network Errors: {status.metrics.networkErrors}
                </Typography>
              </Box>
              <Box>
                {queueStats && (
                  <>
                    <Typography variant="body2" color="text.secondary">
                      Queue Size: {queueStats.totalOperations}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Pending: {queueStats.pendingOperations}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Completed: {queueStats.completedOperations}
                    </Typography>
                  </>
                )}
                {conflictStats && (
                  <>
                    <Typography variant="body2" color="text.secondary">
                      Total Conflicts: {conflictStats.totalConflicts}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Auto-Resolved: {conflictStats.autoResolved}
                    </Typography>
                  </>
                )}
              </Box>
            </Box>
          </>
        )}

        {/* Settings Panel */}
        <Collapse in={showSettings}>
          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle2" sx={{ mb: 2 }}>
            Sync Configuration
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' }, gap: 2 }}>
            <Box>
              <Typography variant="body2" color="text.secondary">
                Auto Sync: {config.autoSyncEnabled ? 'Enabled' : 'Disabled'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Sync Interval: {config.syncIntervalMs / 1000}s
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Max Retries: {config.maxRetries}
              </Typography>
            </Box>
            <Box>
              <Typography variant="body2" color="text.secondary">
                Retry Delay: {config.retryDelayMs / 1000}s
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Network Timeout: {config.networkTimeoutMs / 1000}s
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Batch Size: {config.batchSize}
              </Typography>
            </Box>
          </Box>
        </Collapse>

        {/* Alerts */}
        {!status.isOnline && (
          <Alert severity="error" sx={{ mt: 2 }}>
            Network is offline. Sync operations will resume when connection is restored.
          </Alert>
        )}

        {status.metrics.failedOperations > 0 && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            {status.metrics.failedOperations} operations failed during sync. Check the console for details.
          </Alert>
        )}

        {status.metrics.conflictCount > 0 && (
          <Alert severity="info" sx={{ mt: 2 }}>
            {status.metrics.conflictCount} conflicts were detected and resolved automatically.
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};

export default SyncStatusMonitor;
