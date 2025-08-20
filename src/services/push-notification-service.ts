// Push Notification Service for Chanitec PWA
import { generateId } from '../utils/id-generator';

export interface PushNotificationData {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  image?: string;
  tag?: string;
  data?: any;
  actions?: NotificationAction[];
  requireInteraction?: boolean;
  silent?: boolean;
  vibrate?: number[];
}

export interface NotificationAction {
  action: string;
  title: string;
  icon?: string;
}

export interface NotificationPreferences {
  enabled: boolean;
  syncNotifications: boolean;
  conflictNotifications: boolean;
  offlineNotifications: boolean;
  reminderNotifications: boolean;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
}

export interface NotificationHistory {
  id: string;
  title: string;
  body: string;
  timestamp: Date;
  read: boolean;
  actioned: boolean;
  actionType?: string;
}

export class PushNotificationService {
  private isSupported: boolean;
  private permission: NotificationPermission = 'default';
  private registration?: ServiceWorkerRegistration;
  private preferences: NotificationPreferences;
  private notificationHistory: NotificationHistory[] = [];

  constructor() {
    this.isSupported = 'Notification' in window && 'serviceWorker' in navigator;
    this.preferences = this.loadPreferences();
    this.initializeService();
  }

  /**
   * Initialize the push notification service
   */
  private async initializeService(): Promise<void> {
    if (!this.isSupported) {
      console.warn('Push notifications not supported in this browser');
      return;
    }

    try {
      // Request notification permission
      if (this.permission === 'default') {
        this.permission = await Notification.requestPermission();
      }

      // Register service worker for push notifications
      if ('serviceWorker' in navigator) {
        this.registration = await navigator.serviceWorker.ready;
        await this.setupPushSubscription();
      }

      // Load notification history
      this.loadNotificationHistory();

    } catch (error) {
      console.error('Failed to initialize push notification service:', error);
    }
  }

  /**
   * Set up push subscription
   */
  private async setupPushSubscription(): Promise<void> {
    if (!this.registration) return;

    try {
      const subscription = await this.registration.pushManager.getSubscription();

      if (!subscription) {
        // Create new subscription
        const newSubscription = await this.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: this.urlBase64ToUint8Array(this.getVapidPublicKey())
        });

        console.log('Push subscription created:', newSubscription);
        // Here you would typically send the subscription to your server
      } else {
        console.log('Existing push subscription found:', subscription);
      }
    } catch (error) {
      console.error('Failed to setup push subscription:', error);
    }
  }

  /**
   * Show a local notification
   */
  public async showNotification(data: PushNotificationData): Promise<boolean> {
    if (!this.isSupported || !this.preferences.enabled) {
      return false;
    }

    try {
      const notification = new Notification(data.title, {
        body: data.body,
        icon: data.icon || this.getDefaultIcon(),
        badge: data.badge,
        image: data.image,
        tag: data.tag,
        data: data.data,
        actions: data.actions,
        requireInteraction: data.requireInteraction || false,
        silent: data.silent || false,
        vibrate: this.preferences.vibrationEnabled ? (data.vibrate || [200, 100, 200]) : undefined
      });

      this.setupNotificationEventHandlers(notification);
      this.addToHistory(data.title, data.body);

      return true;
    } catch (error) {
      console.error('Failed to show notification:', error);
      return false;
    }
  }

  /**
   * Show sync-related notifications
   */
  public showSyncNotification(type: 'start' | 'complete' | 'error' | 'conflict', details?: any): void {
    if (!this.preferences.syncNotifications) return;

    const notifications = {
      start: {
        title: '🔄 Sync Started',
        body: 'Data synchronization has begun...',
        tag: 'sync-start'
      },
      complete: {
        title: '✅ Sync Complete',
        body: `Synchronized ${details?.count || 0} items successfully`,
        tag: 'sync-complete'
      },
      error: {
        title: '❌ Sync Error',
        body: details?.message || 'An error occurred during synchronization',
        tag: 'sync-error',
        requireInteraction: true
      },
      conflict: {
        title: '⚠️ Sync Conflict',
        body: `${details?.count || 0} conflicts detected and resolved`,
        tag: 'sync-conflict'
      }
    };

    const notificationData = notifications[type];
    if (notificationData) {
      this.showNotification(notificationData);
    }
  }

  /**
   * Show offline notification
   */
  public showOfflineNotification(): void {
    if (!this.preferences.offlineNotifications) return;

    this.showNotification({
      title: '📱 Offline Mode',
      body: 'You are currently offline. Changes will be synced when connection is restored.',
      tag: 'offline-status',
      icon: '/logo192.png'
    });
  }

  /**
   * Show reminder notification
   */
  public showReminderNotification(title: string, message: string, reminderTime: Date): void {
    if (!this.preferences.reminderNotifications) return;

    const timeUntil = reminderTime.getTime() - Date.now();
    if (timeUntil > 0) {
      setTimeout(() => {
        this.showNotification({
          title: `⏰ ${title}`,
          body: message,
          tag: 'reminder',
          requireInteraction: true,
          actions: [
            { action: 'dismiss', title: 'Dismiss' },
            { action: 'snooze', title: 'Snooze 5min' }
          ]
        });
      }, timeUntil);
    }
  }

  /**
   * Set up notification event handlers
   */
  private setupNotificationEventHandlers(notification: Notification): void {
    // Handle notification click
    notification.onclick = () => {
      this.handleNotificationClick(notification);
    };

    // Handle notification close
    notification.onclose = () => {
      this.handleNotificationClose(notification);
    };

    // Handle notification action (if supported)
    if ('onaction' in notification) {
      (notification as any).onaction = (event: any) => {
        this.handleNotificationAction(notification, event.action);
      };
    }
  }

  /**
   * Handle notification click
   */
  private handleNotificationClick(notification: Notification): void {
    // Focus the app window
    window.focus();

    // Handle different notification types
    const tag = notification.tag;
    if (tag?.startsWith('sync-')) {
      // Navigate to sync status page
      window.location.hash = '#/phase2-test';
    } else if (tag === 'offline-status') {
      // Show offline indicator
      this.showOfflineIndicator();
    } else if (tag === 'reminder') {
      // Handle reminder click
      this.handleReminderClick(notification);
    }

    // Mark as read in history
    this.markAsRead(notification.tag || '');
  }

  /**
   * Handle notification action
   */
  private handleNotificationAction(notification: Notification, action: string): void {
    if (action === 'dismiss') {
      notification.close();
    } else if (action === 'snooze') {
      // Snooze for 5 minutes
      const snoozeTime = new Date(Date.now() + 5 * 60 * 1000);
      this.showReminderNotification(
        notification.title.replace('⏰ ', ''),
        notification.body || '',
        snoozeTime
      );
      notification.close();
    }
  }

  /**
   * Handle notification close
   */
  private handleNotificationClose(notification: Notification): void {
    // Update history
    this.markAsRead(notification.tag || '');
  }

  /**
   * Show offline indicator
   */
  private showOfflineIndicator(): void {
    // This would typically update the UI to show offline status
    console.log('Showing offline indicator');
  }

  /**
   * Handle reminder click
   */
  private handleReminderClick(notification: Notification): void {
    // Navigate to relevant page based on reminder type
    console.log('Reminder clicked:', notification.title);
  }

  /**
   * Add notification to history
   */
  private addToHistory(title: string, body: string): void {
    const notification: NotificationHistory = {
      id: generateId(),
      title,
      body,
      timestamp: new Date(),
      read: false,
      actioned: false
    };

    this.notificationHistory.unshift(notification);

    // Keep only last 100 notifications
    if (this.notificationHistory.length > 100) {
      this.notificationHistory = this.notificationHistory.slice(0, 100);
    }

    this.saveNotificationHistory();
  }

  /**
   * Mark notification as read
   */
  private markAsRead(tag: string): void {
    const notification = this.notificationHistory.find(n => n.title.includes(tag));
    if (notification) {
      notification.read = true;
      this.saveNotificationHistory();
    }
  }

  /**
   * Get notification history
   */
  public getNotificationHistory(): NotificationHistory[] {
    return [...this.notificationHistory];
  }

  /**
   * Clear notification history
   */
  public clearNotificationHistory(): void {
    this.notificationHistory = [];
    this.saveNotificationHistory();
  }

  /**
   * Update notification preferences
   */
  public updatePreferences(newPreferences: Partial<NotificationPreferences>): void {
    this.preferences = { ...this.preferences, ...newPreferences };
    this.savePreferences();
  }

  /**
   * Get current preferences
   */
  public getPreferences(): NotificationPreferences {
    return { ...this.preferences };
  }

  /**
   * Check if notifications are supported and enabled
   */
  public isEnabled(): boolean {
    return this.isSupported && this.permission === 'granted' && this.preferences.enabled;
  }

  /**
   * Request notification permission
   */
  public async requestPermission(): Promise<boolean> {
    if (!this.isSupported) return false;

    try {
      this.permission = await Notification.requestPermission();
      return this.permission === 'granted';
    } catch (error) {
      console.error('Failed to request notification permission:', error);
      return false;
    }
  }

  /**
   * Load preferences from storage
   */
  private loadPreferences(): NotificationPreferences {
    try {
      const stored = localStorage.getItem('chanitec_notification_preferences');
      if (stored) {
        return { ...this.getDefaultPreferences(), ...JSON.parse(stored) };
      }
    } catch (error) {
      console.error('Failed to load notification preferences:', error);
    }
    return this.getDefaultPreferences();
  }

  /**
   * Save preferences to storage
   */
  private savePreferences(): void {
    try {
      localStorage.setItem('chanitec_notification_preferences', JSON.stringify(this.preferences));
    } catch (error) {
      console.error('Failed to save notification preferences:', error);
    }
  }

  /**
   * Get default preferences
   */
  private getDefaultPreferences(): NotificationPreferences {
    return {
      enabled: true,
      syncNotifications: true,
      conflictNotifications: true,
      offlineNotifications: true,
      reminderNotifications: true,
      soundEnabled: true,
      vibrationEnabled: true
    };
  }

  /**
   * Load notification history from storage
   */
  private loadNotificationHistory(): void {
    try {
      const stored = localStorage.getItem('chanitec_notification_history');
      if (stored) {
        const parsed = JSON.parse(stored);
        this.notificationHistory = parsed.map((item: any) => ({
          ...item,
          timestamp: new Date(item.timestamp)
        }));
      }
    } catch (error) {
      console.error('Failed to load notification history:', error);
    }
  }

  /**
   * Save notification history to storage
   */
  private saveNotificationHistory(): void {
    try {
      localStorage.setItem('chanitec_notification_history', JSON.stringify(this.notificationHistory));
    } catch (error) {
      console.error('Failed to save notification history:', error);
    }
  }

  /**
   * Convert VAPID public key from base64 to Uint8Array
   */
  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  /**
   * Get VAPID public key (replace with your actual key)
   */
  private getVapidPublicKey(): string {
    // This should be replaced with your actual VAPID public key
    return 'BEl62iUYgUivxIkv69yViEuiBIa1HIxVz0K0P5V4LzQ';
  }

  /**
   * Get default icon for notifications
   */
  private getDefaultIcon(): string {
    return '/logo192.png';
  }
}

// Export singleton instance
export const pushNotificationService = new PushNotificationService();
export default PushNotificationService;
