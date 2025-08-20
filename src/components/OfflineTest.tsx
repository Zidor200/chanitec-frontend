import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  TextField,
  Alert,
  List,
  ListItem,
  ListItemText,
  Divider,
  Chip
} from '@mui/material';
import { enhancedClientService, enhancedSiteService } from '../services/enhanced-business-services';
import { backgroundSyncService } from '../services/background-sync-service';
import { enhancedStorageService } from '../services/enhanced-storage-service';

const OfflineTest: React.FC = () => {
  const [clientName, setClientName] = useState('');
  const [siteName, setSiteName] = useState('');
  const [clients, setClients] = useState<any[]>([]);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('info');
  const [syncStatus, setSyncStatus] = useState(enhancedStorageService.getSyncStatus());
  const [notificationPermission, setNotificationPermission] = useState(Notification.permission);

  // Auto-start background sync service and load clients on mount
  useEffect(() => {
    backgroundSyncService.start();
    loadClients();

    // Update sync status periodically
    const interval = setInterval(() => {
      setSyncStatus(enhancedStorageService.getSyncStatus());
      setNotificationPermission(Notification.permission);
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const showMessage = (msg: string, type: 'success' | 'error' | 'info') => {
    setMessage(msg);
    setMessageType(type);
    setTimeout(() => setMessage(''), 5000);
  };

  const loadClients = async () => {
    try {
      const data = await enhancedClientService.getAllClients();
      setClients(data);
      showMessage(`Loaded ${data.length} clients`, 'success');
      setSyncStatus(enhancedStorageService.getSyncStatus());
    } catch (error) {
      showMessage(`Error loading clients: ${error}`, 'error');
    }
  };

  const createClient = async () => {
    if (!clientName.trim()) {
      showMessage('Client name is required', 'error');
      return;
    }

    try {
      const newClient = await enhancedClientService.createClient({
        name: clientName.trim(),
        Taux_marge: 0
      });

      showMessage(`Client "${newClient.name}" created successfully!`, 'success');
      setClientName('');
      await loadClients();
    } catch (error) {
      showMessage(`Error creating client: ${error}`, 'error');
    }
  };

  const createSite = async () => {
    if (!siteName.trim() || clients.length === 0) {
      showMessage('Site name and at least one client are required', 'error');
      return;
    }

    try {
      const newSite = await enhancedSiteService.createSite({
        name: siteName.trim(),
        client_id: clients[0].id
      });

      showMessage(`Site "${newSite.name}" created successfully!`, 'success');
      setSiteName('');
      await loadClients();
    } catch (error) {
      showMessage(`Error creating site: ${error}`, 'error');
    }
  };

  const startSync = async () => {
    try {
      await backgroundSyncService.manualSync();
      showMessage('Manual sync triggered', 'info');
      setSyncStatus(enhancedStorageService.getSyncStatus());
    } catch (error) {
      showMessage(`Error starting sync: ${error}`, 'error');
    }
  };

  const startBackgroundService = () => {
    try {
      backgroundSyncService.start();
      showMessage('Background sync service started', 'info');
    } catch (error) {
      showMessage(`Error starting service: ${error}`, 'error');
    }
  };

  const stopBackgroundService = () => {
    try {
      backgroundSyncService.stop();
      showMessage('Background sync service stopped', 'info');
    } catch (error) {
      showMessage(`Error stopping service: ${error}`, 'error');
    }
  };

  const checkSyncStatus = async () => {
    try {
      const status = backgroundSyncService.getStatus();
      const enhancedStatus = enhancedStorageService.getSyncStatus();
      showMessage(`Sync status: ${JSON.stringify({ ...status, enhanced: enhancedStatus })}`, 'info');
    } catch (error) {
      showMessage(`Error checking sync status: ${error}`, 'error');
    }
  };

  const forceSync = async () => {
    try {
      await enhancedStorageService.triggerSync();
      showMessage('Force sync completed', 'success');
      await loadClients(); // Reload to get updated data
    } catch (error) {
      showMessage(`Error during force sync: ${error}`, 'error');
    }
  };

  const requestNotificationPermission = async () => {
    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      if (permission === 'granted') {
        showMessage('Notification permission granted!', 'success');
      } else {
        showMessage('Notification permission denied', 'error');
      }
    } catch (error) {
      showMessage(`Error requesting notification permission: ${error}`, 'error');
    }
  };

  return (
    <Box sx={{ p: 3, maxWidth: 800, mx: 'auto' }}>
      <Typography variant="h4" gutterBottom>
        🧪 Offline Functionality Test
      </Typography>

      <Typography variant="body1" color="text.secondary" paragraph>
        Test creating clients and sites while offline. Operations will be queued and synced when you're back online.
      </Typography>

      {/* Sync Status Display */}
      <Card sx={{ mb: 3, bgcolor: syncStatus.hasPending ? '#fff3cd' : '#f8f9fa' }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Sync Status
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
            <Chip
              label={syncStatus.isOnline ? '🟢 Online' : '🔴 Offline'}
              color={syncStatus.isOnline ? 'success' : 'error'}
              variant="outlined"
            />
            <Chip
              label={`Pending: ${syncStatus.pendingCount}`}
              color={syncStatus.pendingCount > 0 ? 'warning' : 'default'}
              variant="outlined"
            />
            <Chip
              label={syncStatus.syncEnabled ? 'Sync Enabled' : 'Sync Disabled'}
              color={syncStatus.syncEnabled ? 'success' : 'error'}
              variant="outlined"
            />
            <Chip
              label={notificationPermission === 'granted' ? '🔔 Notifications Enabled' : '🔕 Notifications Disabled'}
              color={notificationPermission === 'granted' ? 'success' : 'error'}
              variant="outlined"
            />
          </Box>
          {syncStatus.hasPending && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              You have {syncStatus.pendingCount} pending sync operations. Go online to sync them.
            </Alert>
          )}
        </CardContent>
      </Card>

      {message && (
        <Alert severity={messageType} sx={{ mb: 2 }}>
          {message}
        </Alert>
      )}

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Create Client
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <TextField
              label="Client Name"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Enter client name"
              fullWidth
            />
            <Button
              variant="contained"
              onClick={createClient}
              disabled={!clientName.trim()}
            >
              Create Client
            </Button>
          </Box>
        </CardContent>
      </Card>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Create Site
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <TextField
              label="Site Name"
              value={siteName}
              onChange={(e) => setSiteName(e.target.value)}
              placeholder="Enter site name"
              fullWidth
            />
            <Button
              variant="contained"
              onClick={createSite}
              disabled={!siteName.trim() || clients.length === 0}
            >
              Create Site
            </Button>
          </Box>
          {clients.length === 0 && (
            <Typography variant="body2" color="text.secondary">
              Create a client first to add sites
            </Typography>
          )}
        </CardContent>
      </Card>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Sync Controls
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
            <Button variant="outlined" onClick={startBackgroundService}>
              Start Background Service
            </Button>
            <Button variant="outlined" onClick={stopBackgroundService}>
              Stop Background Service
            </Button>
            <Button variant="outlined" onClick={startSync}>
              Manual Sync
            </Button>
            <Button variant="outlined" onClick={forceSync} disabled={!syncStatus.isOnline}>
              Force Sync
            </Button>
            <Button variant="outlined" onClick={checkSyncStatus}>
              Check Sync Status
            </Button>
            <Button variant="outlined" onClick={loadClients}>
              Refresh Clients
            </Button>
            <Button variant="outlined" onClick={requestNotificationPermission}>
              Request Notification Permission
            </Button>
          </Box>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Current Clients ({clients.length})
          </Typography>
          {clients.length === 0 ? (
            <Typography color="text.secondary">
              No clients yet. Create your first client above!
            </Typography>
          ) : (
            <List>
              {clients.map((client, index) => (
                <React.Fragment key={client.id}>
                  <ListItem>
                    <ListItemText
                      primary={client.name}
                      secondary={`Sites: ${client.sites?.length || 0} | Margin: ${client.Taux_marge || 0}%`}
                    />
                  </ListItem>
                  {index < clients.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default OfflineTest;
