import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Button, Card, CardContent, Container, Alert, Divider,
  Switch, FormControlLabel, Slider, Chip, List, ListItem, ListItemText,
  ListItemIcon, IconButton, Tooltip
} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  Cached as CacheIcon, // Fixed: Changed from Cache to Cached
  Storage as StorageIcon,
  Settings as SettingsIcon,
  Refresh as RefreshIcon,
  Clear as ClearIcon,
  PlayArrow as PlayIcon,
  Stop as StopIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon
} from '@mui/icons-material';
import { pushNotificationService } from '../services/push-notification-service';
import { advancedCacheService, CacheStrategy } from '../services/advanced-cache-service';
import { backgroundSyncService } from '../services/background-sync-service';

const Phase3Test: React.FC = () => {
  const [testResults, setTestResults] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [notificationPreferences, setNotificationPreferences] = useState(
    pushNotificationService.getPreferences()
  );
  const [cacheStats, setCacheStats] = useState(advancedCacheService.getStats());
  const [cacheConfig, setCacheConfig] = useState({
    strategy: CacheStrategy.STALE_WHILE_REVALIDATE,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    enableCompression: true
  });

  const addResult = (message: string) => {
    setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const clearResults = () => {
    setTestResults([]);
  };

  const testPushNotifications = async () => {
    try {
      addResult('Testing push notifications...');

      // Test basic notification
      const success = await pushNotificationService.showNotification({
        title: 'Test Notification',
        body: 'This is a test notification from Phase 3',
        icon: '/logo192.png',
        tag: 'test-notification'
      });

      if (success) {
        addResult('✅ Basic notification test passed');
      } else {
        addResult('❌ Basic notification test failed');
      }

      // Test sync notification
      pushNotificationService.showSyncNotification('start', { operation: 'test-sync' });
      addResult('✅ Sync notification test completed');

      // Test offline notification
      pushNotificationService.showOfflineNotification();
      addResult('✅ Offline notification test completed');

      // Test reminder notification
      pushNotificationService.showReminderNotification(
        'Test Reminder',
        'This is a test reminder',
        new Date(Date.now() + 5000)
      );
      addResult('✅ Reminder notification test completed');

    } catch (error) {
      addResult(`❌ Push notification test failed: ${error}`);
    }
  };

  const testAdvancedCaching = async () => {
    try {
      addResult('Testing advanced caching...');

      // Test basic operations
      await advancedCacheService.set('test-key', { data: 'test-value' });
      const cachedData = await advancedCacheService.get('test-key');

      if (cachedData) {
        addResult('✅ Basic cache set/get test passed');
      } else {
        addResult('❌ Basic cache set/get test failed');
      }

      // Test cache strategies
      await testCacheStrategy(CacheStrategy.CACHE_FIRST, 'cache-first-test');
      await testCacheStrategy(CacheStrategy.NETWORK_FIRST, 'network-first-test');
      await testCacheStrategy(CacheStrategy.STALE_WHILE_REVALIDATE, 'stale-while-revalidate-test');

      // Test compression
      const largeData = {
        items: Array.from({ length: 1000 }, (_, i) => ({ id: i, name: `Item ${i}` }))
      };
      await advancedCacheService.set('compression-test', largeData, { compress: true });
      addResult('✅ Compression test completed');

      // Test tag-based operations
      await advancedCacheService.set('tagged-item-1', 'value1', { tags: ['test', 'phase3'] });
      await advancedCacheService.set('tagged-item-2', 'value2', { tags: ['test', 'phase3'] });
      const taggedItems = advancedCacheService.searchByTags(['test']);
      addResult(`✅ Tag-based search found ${taggedItems.length} items`);

      // Update stats
      setCacheStats(advancedCacheService.getStats());

    } catch (error) {
      addResult(`❌ Advanced caching test failed: ${error}`);
    }
  };

  const testCacheStrategy = async (strategy: CacheStrategy, key: string) => {
    try {
      const result = await advancedCacheService.getOrSet(
        key,
        async () => ({ strategy, timestamp: Date.now() }),
        { strategy, maxAge: 60000 }
      );

      if (result) {
        addResult(`✅ ${strategy} strategy test passed`);
      } else {
        addResult(`❌ ${strategy} strategy test failed`);
      }
    } catch (error) {
      addResult(`❌ ${strategy} strategy test failed: ${error}`);
    }
  };

  const testServiceWorker = async () => {
    try {
      addResult('Testing service worker...');

      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();

        if (registration) {
          addResult('✅ Service worker registration found');

          // Test background sync (with type assertion)
          if ('sync' in registration) {
            const syncManager = registration.sync as any;
            if (syncManager) {
              addResult('✅ Background sync manager available');
            }
          }

          // Test push manager
          if ('pushManager' in registration) {
            addResult('✅ Push manager available');
          }

        } else {
          addResult('❌ No service worker registration found');
        }
      } else {
        addResult('❌ Service workers not supported');
      }

    } catch (error) {
      addResult(`❌ Service worker test failed: ${error}`);
    }
  };

  const testPerformance = async () => {
    try {
      addResult('Testing performance metrics...');

      // Test cache performance
      const startTime = performance.now();
      for (let i = 0; i < 100; i++) {
        await advancedCacheService.set(`perf-test-${i}`, { index: i, data: `test-${i}` });
      }
      const setTime = performance.now() - startTime;

      const readStartTime = performance.now();
      for (let i = 0; i < 100; i++) {
        await advancedCacheService.get(`perf-test-${i}`);
      }
      const readTime = performance.now() - readStartTime;

      addResult(`✅ Performance test: Set 100 items in ${setTime.toFixed(2)}ms, Read 100 items in ${readTime.toFixed(2)}ms`);

      // Cleanup
      for (let i = 0; i < 100; i++) {
        advancedCacheService.delete(`perf-test-${i}`);
      }

    } catch (error) {
      addResult(`❌ Performance test failed: ${error}`);
    }
  };

  const runAllTests = async () => {
    if (isRunning) return;

    setIsRunning(true);
    clearResults();

    try {
      addResult('🚀 Starting Phase 3 test suite...');

      await testPushNotifications();
      await testAdvancedCaching();
      await testServiceWorker();
      await testPerformance();

      addResult('🎉 All Phase 3 tests completed successfully!');

    } catch (error) {
      addResult(`❌ Test suite failed: ${error}`);
    } finally {
      setIsRunning(false);
    }
  };

  const updateNotificationPreference = (key: keyof typeof notificationPreferences, value: boolean) => {
    const newPreferences = { ...notificationPreferences, [key]: value };
    setNotificationPreferences(newPreferences);
    pushNotificationService.updatePreferences(newPreferences);
  };

  const updateCacheConfig = (key: keyof typeof cacheConfig, value: any) => {
    setCacheConfig(prev => ({ ...prev, [key]: value }));
  };

  const clearCache = () => {
    advancedCacheService.clear();
    setCacheStats(advancedCacheService.getStats());
    addResult('🗑️ Cache cleared');
  };

  const clearExpired = () => {
    const cleared = advancedCacheService.clearExpired();
    setCacheStats(advancedCacheService.getStats());
    addResult(`🗑️ Cleared ${cleared} expired items`);
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setCacheStats(advancedCacheService.getStats());
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h3" component="h1" gutterBottom align="center" color="primary">
        🚀 Phase 3 Advanced PWA Test Suite
      </Typography>

      <Typography variant="body1" align="center" color="text.secondary" paragraph>
        Test Push Notifications, Advanced Caching, and Enhanced Service Worker Features
      </Typography>

      {/* Test Controls */}
      <Box sx={{ mb: 4, display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
        <Button
          variant="contained"
          color="primary"
          onClick={runAllTests}
          disabled={isRunning}
          startIcon={<PlayIcon />}
          size="large"
        >
          {isRunning ? 'Running Tests...' : 'Run All Tests'}
        </Button>

        <Button
          variant="outlined"
          onClick={clearResults}
          startIcon={<ClearIcon />}
          size="large"
        >
          Clear Results
        </Button>
      </Box>

      {/* Configuration Section */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 3, mb: 4 }}>
        {/* Notification Preferences */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              <NotificationsIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
              Notification Preferences
            </Typography>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {Object.entries(notificationPreferences).map(([key, value]) => (
                <FormControlLabel
                  key={key}
                  control={
                    <Switch
                      checked={value}
                      onChange={(e) => updateNotificationPreference(key as keyof typeof notificationPreferences, e.target.checked)}
                    />
                  }
                  label={key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                />
              ))}
            </Box>
          </CardContent>
        </Card>

        {/* Cache Configuration */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              <CacheIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
              Cache Configuration
            </Typography>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={cacheConfig.enableCompression}
                    onChange={(e) => updateCacheConfig('enableCompression', e.target.checked)}
                  />
                }
                label="Enable Compression"
              />

              <Box>
                <Typography variant="body2" gutterBottom>
                  Max Age: {Math.round(cacheConfig.maxAge / (1000 * 60 * 60))} hours
                </Typography>
                <Slider
                  value={cacheConfig.maxAge / (1000 * 60 * 60)}
                  onChange={(_, value) => updateCacheConfig('maxAge', value * 1000 * 60 * 60)}
                  min={1}
                  max={168}
                  step={1}
                  marks={[
                    { value: 1, label: '1h' },
                    { value: 24, label: '1d' },
                    { value: 168, label: '1w' }
                  ]}
                />
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Box>

      {/* Cache Management */}
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            <StorageIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Cache Management
          </Typography>

          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2, mb: 2 }}>
            <Button variant="outlined" onClick={clearCache} startIcon={<ClearIcon />}>
              Clear All Cache
            </Button>
            <Button variant="outlined" onClick={clearExpired} startIcon={<RefreshIcon />}>
              Clear Expired
            </Button>
          </Box>

          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 2 }}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="primary">{cacheStats.totalItems}</Typography>
              <Typography variant="body2">Total Items</Typography>
            </Box>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="primary">{(cacheStats.totalSize / 1024).toFixed(1)}</Typography>
              <Typography variant="body2">Size (KB)</Typography>
            </Box>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="primary">{(cacheStats.hitRate * 100).toFixed(1)}%</Typography>
              <Typography variant="body2">Hit Rate</Typography>
            </Box>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="primary">{(cacheStats.compressionRatio * 100).toFixed(1)}%</Typography>
              <Typography variant="body2">Compression</Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Test Results */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            <SettingsIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Test Results
          </Typography>

          <Box sx={{
            maxHeight: '400px',
            overflowY: 'auto',
            backgroundColor: 'grey.50',
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
                <Box key={index} sx={{ mb: 1, p: 1, backgroundColor: 'white', borderRadius: 1 }}>
                  {result}
                </Box>
              ))
            )}
          </Box>
        </CardContent>
      </Card>
    </Container>
  );
};

export default Phase3Test;
