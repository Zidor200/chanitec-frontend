import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Container,
  Alert,
  Divider
} from '@mui/material';
import { backgroundSyncService } from '../services/background-sync-service';
import { conflictResolutionService } from '../services/conflict-resolution-service';
import { offlineSyncService } from '../services/offline-sync-service';
import { syncQueueStorage } from '../services/sync-queue-storage';
import { SyncStatusMonitor } from './SyncStatusMonitor';
import { SyncOperation, SyncOperationType, SyncEntityType, SyncStatus } from '../models/SyncOperation';

const Phase2Test: React.FC = () => {
  const [testResults, setTestResults] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const addResult = (message: string) => {
    setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const clearResults = () => {
    setTestResults([]);
  };

  const testBackgroundSync = async () => {
    addResult('🧪 Testing Background Sync Service...');

    try {
      // Test service start/stop
      backgroundSyncService.start();
      addResult('✅ Background sync service started');

      const status = backgroundSyncService.getStatus();
      addResult(`📊 Service status: ${status.isRunning ? 'Running' : 'Stopped'}`);
      addResult(`🌐 Network status: ${status.isOnline ? 'Online' : 'Offline'}`);

      // Test manual sync
      await backgroundSyncService.manualSync();
      addResult('✅ Manual sync completed');

      // Test metrics
      const metrics = backgroundSyncService.getMetrics();
      addResult(`📈 Metrics: ${metrics.totalOperations} total, ${metrics.pendingOperations} pending`);

      backgroundSyncService.stop();
      addResult('✅ Background sync service stopped');

    } catch (error) {
      addResult(`❌ Background sync test failed: ${error}`);
    }
  };

  const testConflictResolution = async () => {
    addResult('🧪 Testing Conflict Resolution Service...');

    try {
      // Test conflict detection
      const testOperation: SyncOperation = {
        id: 'test-conflict-1',
        type: SyncOperationType.UPDATE,
        entityType: SyncEntityType.QUOTE,
        entityId: 'quote-1',
        data: { title: 'Updated Quote', amount: 1500 },
        status: SyncStatus.PENDING,
        timestamp: new Date(),
        retryCount: 0,
        priority: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const conflict = await conflictResolutionService.detectConflicts(testOperation);
      addResult(`🔍 Conflict detection: ${conflict ? 'Conflict found' : 'No conflict'}`);

      // Test conflict resolution
      if (conflict) {
        const resolution = await conflictResolutionService.resolveConflict(testOperation, conflict);
        addResult(`✅ Conflict resolution: ${resolution.success ? 'Success' : 'Failed'}`);
      }

      // Test stats
      const stats = conflictResolutionService.getStats();
      addResult(`📊 Conflict stats: ${stats.totalConflicts} total, ${stats.autoResolved} auto-resolved`);

    } catch (error) {
      addResult(`❌ Conflict resolution test failed: ${error}`);
    }
  };

  const testOfflineSync = async () => {
    addResult('🧪 Testing Offline Sync Service...');

    try {
      // Test operation queuing
      const testOperation: SyncOperation = {
        id: 'test-sync-1',
        type: SyncOperationType.CREATE,
        entityType: SyncEntityType.CLIENT,
        entityId: 'client-1',
        data: { name: 'Test Client', email: 'test@example.com' },
        status: SyncStatus.PENDING,
        timestamp: new Date(),
        retryCount: 0,
        priority: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await offlineSyncService.queueOperation(
        SyncOperationType.CREATE,
        SyncEntityType.CLIENT,
        'client-1',
        { name: 'Test Client', email: 'test@example.com' },
        1
      );
      addResult('✅ Operation queued successfully');

      // Test queue storage
      const queueStats = await syncQueueStorage.getStats();
      addResult(`📊 Queue stats: ${queueStats.total} total operations`);

      // Test operation processing
      const result = await offlineSyncService.processOperation(testOperation);
      addResult(`✅ Operation processing: ${result.success ? 'Success' : 'Failed'}`);

    } catch (error) {
      addResult(`❌ Offline sync test failed: ${error}`);
    }
  };

  const runAllTests = async () => {
    setIsRunning(true);
    clearResults();

    addResult('🚀 Starting Phase 2 PWA Tests...');
    addResult('=====================================');

    await testBackgroundSync();
    addResult('---');
    await testConflictResolution();
    addResult('---');
    await testOfflineSync();

    addResult('=====================================');
    addResult('✅ All tests completed!');
    setIsRunning(false);
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h3" component="h1" gutterBottom align="center" color="primary">
        🧪 Phase 2 PWA Test Suite
      </Typography>

      <Typography variant="h6" gutterBottom align="center" color="text.secondary" sx={{ mb: 4 }}>
        Testing Background Sync, Conflict Resolution, and Offline Capabilities
      </Typography>

      {/* Sync Status Monitor */}
      <SyncStatusMonitor showAdvanced={true} />

      {/* Test Controls */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            🎯 Test Controls
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Button
              variant="contained"
              onClick={runAllTests}
              disabled={isRunning}
              size="large"
            >
              {isRunning ? 'Running Tests...' : '🚀 Run All Tests'}
            </Button>
            <Button
              variant="outlined"
              onClick={testBackgroundSync}
              disabled={isRunning}
            >
              🧪 Test Background Sync
            </Button>
            <Button
              variant="outlined"
              onClick={testConflictResolution}
              disabled={isRunning}
            >
              🔍 Test Conflict Resolution
            </Button>
            <Button
              variant="outlined"
              onClick={testOfflineSync}
              disabled={isRunning}
            >
              📱 Test Offline Sync
            </Button>
            <Button
              variant="outlined"
              onClick={clearResults}
              color="secondary"
            >
              🗑️ Clear Results
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Test Results */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            📋 Test Results
          </Typography>
          <Box sx={{
            maxHeight: 400,
            overflowY: 'auto',
            bgcolor: 'grey.50',
            p: 2,
            borderRadius: 1,
            fontFamily: 'monospace',
            fontSize: '0.875rem'
          }}>
            {testResults.length === 0 ? (
              <Typography color="text.secondary" align="center">
                No test results yet. Click "Run All Tests" to start testing.
              </Typography>
            ) : (
              testResults.map((result, index) => (
                <Box key={index} sx={{ mb: 1 }}>
                  {result}
                </Box>
              ))
            )}
          </Box>
        </CardContent>
      </Card>

      {/* Information Panel */}
      <Alert severity="info" sx={{ mt: 3 }}>
        <Typography variant="body2">
          <strong>What's being tested:</strong><br/>
          • Background Sync Service: Automatic synchronization, network monitoring, metrics<br/>
          • Conflict Resolution Service: Conflict detection, auto-resolution strategies<br/>
          • Offline Sync Service: Operation queuing, processing, and storage<br/>
          • Sync Status Monitor: Real-time status display and controls
        </Typography>
      </Alert>
    </Container>
  );
};

export default Phase2Test;
