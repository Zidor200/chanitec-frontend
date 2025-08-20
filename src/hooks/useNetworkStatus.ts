import { useState, useEffect, useCallback } from 'react';

export interface NetworkStatus {
  isOnline: boolean;
  isReconnecting: boolean;
  connectionType?: string;
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  lastSeen: Date;
  connectionQuality: 'excellent' | 'good' | 'poor' | 'unknown';
}

export const useNetworkStatus = (): NetworkStatus => {
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>({
    isOnline: navigator.onLine,
    isReconnecting: false,
    lastSeen: new Date(),
    connectionQuality: 'unknown'
  });

  // Get connection information if available
  const getConnectionInfo = useCallback(() => {
    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;

    if (connection) {
      return {
        connectionType: connection.effectiveType || connection.type || 'unknown',
        effectiveType: connection.effectiveType || 'unknown',
        downlink: connection.downlink || 0,
        rtt: connection.rtt || 0
      };
    }

    return {
      connectionType: 'unknown',
      effectiveType: 'unknown',
      downlink: 0,
      rtt: 0
    };
  }, []);

  // Determine connection quality based on metrics
  const getConnectionQuality = useCallback((downlink: number, rtt: number): NetworkStatus['connectionQuality'] => {
    if (downlink === 0 || rtt === 0) return 'unknown';

    // Simple quality assessment based on downlink speed and latency
    if (downlink >= 10 && rtt <= 50) return 'excellent';
    if (downlink >= 5 && rtt <= 100) return 'good';
    return 'poor';
  }, []);

  // Update network status
  const updateNetworkStatus = useCallback((isOnline: boolean) => {
    const connectionInfo = getConnectionInfo();
    const connectionQuality = getConnectionQuality(connectionInfo.downlink, connectionInfo.rtt);

    setNetworkStatus(prev => ({
      ...prev,
      isOnline,
      isReconnecting: !isOnline && prev.isOnline,
      lastSeen: new Date(),
      connectionQuality,
      ...connectionInfo
    }));
  }, [getConnectionInfo, getConnectionQuality]);

  // Handle online event
  const handleOnline = useCallback(() => {
    console.log('Network: Online');
    updateNetworkStatus(true);
  }, [updateNetworkStatus]);

  // Handle offline event
  const handleOffline = useCallback(() => {
    console.log('Network: Offline');
    updateNetworkStatus(false);
  }, [updateNetworkStatus]);

  // Handle connection change
  const handleConnectionChange = useCallback(() => {
    console.log('Network: Connection changed');
    const connectionInfo = getConnectionInfo();
    const connectionQuality = getConnectionQuality(connectionInfo.downlink, connectionInfo.rtt);

    setNetworkStatus(prev => ({
      ...prev,
      ...connectionInfo,
      connectionQuality
    }));
  }, [getConnectionInfo, getConnectionQuality]);

  // Initialize network status
  useEffect(() => {
    updateNetworkStatus(navigator.onLine);
  }, [updateNetworkStatus]);

  // Add event listeners
  useEffect(() => {
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Add connection change listener if available
    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    if (connection) {
      connection.addEventListener('change', handleConnectionChange);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);

      if (connection) {
        connection.removeEventListener('change', handleConnectionChange);
      }
    };
  }, [handleOnline, handleOffline, handleConnectionChange]);

  // Monitor connection quality periodically when online
  useEffect(() => {
    if (!networkStatus.isOnline) return;

    const interval = setInterval(() => {
      const connectionInfo = getConnectionInfo();
      const connectionQuality = getConnectionQuality(connectionInfo.downlink, connectionInfo.rtt);

      setNetworkStatus(prev => ({
        ...prev,
        ...connectionInfo,
        connectionQuality
      }));
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [networkStatus.isOnline, getConnectionInfo, getConnectionQuality]);

  return networkStatus;
};

// Hook for getting just online/offline status
export const useOnlineStatus = (): boolean => {
  const { isOnline } = useNetworkStatus();
  return isOnline;
};

// Hook for getting connection quality
export const useConnectionQuality = (): NetworkStatus['connectionQuality'] => {
  const { connectionQuality } = useNetworkStatus();
  return connectionQuality;
};

// Hook for getting detailed connection info
export const useConnectionInfo = () => {
  const { connectionType, effectiveType, downlink, rtt } = useNetworkStatus();
  return { connectionType, effectiveType, downlink, rtt };
};
