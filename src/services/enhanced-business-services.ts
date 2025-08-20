// Enhanced Business Services with Offline Support
import { enhancedStorageService } from './enhanced-storage-service';
import { offlineSyncService } from './offline-sync-service';
import { SyncOperationType, SyncEntityType } from '../models/SyncOperation';
import { generateId } from '../utils/id-generator';

// API base URL for database operations
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Notification helper function
const showNotification = (title: string, options?: NotificationOptions) => {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, {
      icon: '/logo192.png',
      badge: '/logo192.png',
      ...options
    });
  }
};

// Request notification permission
const requestNotificationPermission = async () => {
  if ('Notification' in window && Notification.permission === 'default') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }
  return Notification.permission === 'granted';
};

// Enhanced Client Service
export class EnhancedClientService {
  async getAllClients() {
    try {
      // First, try to fetch from database if online
      if (navigator.onLine) {
        try {
          // Show sync notification
          await requestNotificationPermission();
          showNotification('🔄 Syncing Data', {
            body: 'Processing pending operations...',
            tag: 'sync-progress'
          });

          // Process any pending sync operations first
          await offlineSyncService.processPendingOperations();

          // Show sync completion notification
          showNotification('✅ Sync Complete', {
            body: 'All pending operations have been processed',
            tag: 'sync-complete'
          });

          const response = await fetch(`${API_BASE_URL}/clients`);
          if (response.ok) {
            const clients = await response.json();

            // Also fetch sites for each client
            const clientsWithSites = await Promise.all(
              clients.map(async (client: any) => {
                try {
                  const sitesResponse = await fetch(`${API_BASE_URL}/sites?client_id=${client.id}`);
                  if (sitesResponse.ok) {
                    const sites = await sitesResponse.json();
                    // Fetch splits for each site
                    const sitesWithSplits = await Promise.all(
                      sites.map(async (site: any) => {
                        try {
                          const splitsResponse = await fetch(`${API_BASE_URL}/splits?site_id=${site.id}`);
                          if (splitsResponse.ok) {
                            const splits = await splitsResponse.json();
                            return { ...site, splits };
                          }
                        } catch (error) {
                          console.warn('Failed to fetch splits for site:', site.id, error);
                        }
                        return { ...site, splits: [] };
                      })
                    );
                    return { ...client, sites: sitesWithSplits };
                  }
                } catch (error) {
                  console.warn('Failed to fetch sites for client:', client.id, error);
                }
                return { ...client, sites: [] };
              })
            );

            // Update local storage with fresh data
            clientsWithSites.forEach(client => {
              enhancedStorageService.saveClient(client);
              client.sites?.forEach((site: any) => {
                enhancedStorageService.saveSite(site);
              });
            });

            return clientsWithSites;
          }
        } catch (error) {
          console.warn('Failed to fetch from database, falling back to local storage:', error);
          showNotification('⚠️ Sync Warning', {
            body: 'Failed to sync with database, using local data',
            tag: 'sync-warning'
          });
        }
      }

      // Fallback to local storage (works offline)
      return await enhancedStorageService.getClients();
    } catch (error) {
      console.error('Error getting clients:', error);
      return [];
    }
  }

  async getClientById(id: string) {
    try {
      // First, try to fetch from database if online
      if (navigator.onLine) {
        try {
          // Show sync notification
          await requestNotificationPermission();
          showNotification('🔄 Syncing Data', {
            body: 'Processing pending operations...',
            tag: 'sync-progress'
          });

          // Process any pending sync operations first
          await offlineSyncService.processPendingOperations();

          // Show sync completion notification
          showNotification('✅ Sync Complete', {
            body: 'All pending operations have been processed',
            tag: 'sync-complete'
          });

          const response = await fetch(`${API_BASE_URL}/clients/${id}`);
          if (response.ok) {
            const client = await response.json();

            // Fetch sites for this client
            try {
              const sitesResponse = await fetch(`${API_BASE_URL}/sites?client_id=${id}`);
              if (sitesResponse.ok) {
                const sites = await sitesResponse.json();
                // Fetch splits for each site
                const sitesWithSplits = await Promise.all(
                  sites.map(async (site: any) => {
                    try {
                      const splitsResponse = await fetch(`${API_BASE_URL}/splits?site_id=${site.id}`);
                      if (splitsResponse.ok) {
                        const splits = await splitsResponse.json();
                        return { ...site, splits };
                      }
                    } catch (error) {
                      console.warn('Failed to fetch splits for site:', site.id, error);
                    }
                    return { ...site, splits: [] };
                  })
                );
                const clientWithSites = { ...client, sites: sitesWithSplits };

                // Update local storage
                enhancedStorageService.saveClient(clientWithSites);
                sitesWithSplits.forEach((site: any) => {
                  enhancedStorageService.saveSite(site);
                });

                return clientWithSites;
              }
            } catch (error) {
              console.warn('Failed to fetch sites for client:', id, error);
            }

            return { ...client, sites: [] };
          }
        } catch (error) {
          console.warn('Failed to fetch from database, falling back to local storage:', error);
          showNotification('⚠️ Sync Warning', {
            body: 'Failed to sync with database, using local data',
            tag: 'sync-warning'
          });
        }
      }

      // Fallback to local storage (works offline)
      return await enhancedStorageService.getClientById(id);
    } catch (error) {
      console.error('Error getting client by ID:', error);
      return undefined;
    }
  }

  async createClient(clientData: any) {
    try {
      // Create client locally first (immediate feedback)
      const newClient = {
        ...clientData,
        id: generateId(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Save to local storage immediately
      await enhancedStorageService.saveClient(newClient);

      // Queue for sync when online
      await offlineSyncService.queueOperation(
        SyncOperationType.CREATE,
        SyncEntityType.CLIENT,
        newClient.id,
        newClient,
        1 // High priority
      );

      // Show notification about queued operation
      await requestNotificationPermission();
      if (navigator.onLine) {
        showNotification('📤 Client Queued', {
          body: `Client "${newClient.name}" will be synced to database`,
          tag: 'client-queued'
        });
      } else {
        showNotification('📱 Offline Mode', {
          body: `Client "${newClient.name}" saved locally and queued for sync`,
          tag: 'client-offline'
        });
      }

      return newClient;
    } catch (error) {
      console.error('Error creating client:', error);
      showNotification('❌ Error', {
        body: 'Failed to create client',
        tag: 'client-error'
      });
      throw error;
    }
  }

  async updateClient(id: string, clientData: any) {
    try {
      // Update locally first
      const updatedClient = {
        ...clientData,
        id,
        updatedAt: new Date().toISOString()
      };

      await enhancedStorageService.saveClient(updatedClient);

      // Queue for sync
      await offlineSyncService.queueOperation(
        SyncOperationType.UPDATE,
        SyncEntityType.CLIENT,
        id,
        updatedClient,
        1
      );

      // Show notification about queued operation
      await requestNotificationPermission();
      if (navigator.onLine) {
        showNotification('📤 Client Update Queued', {
          body: `Client "${updatedClient.name}" will be synced to database`,
          tag: 'client-update-queued'
        });
      } else {
        showNotification('📱 Offline Mode', {
          body: `Client "${updatedClient.name}" updated locally and queued for sync`,
          tag: 'client-update-offline'
        });
      }

      return updatedClient;
    } catch (error) {
      console.error('Error updating client:', error);
      showNotification('❌ Error', {
        body: 'Failed to update client',
        tag: 'client-update-error'
      });
      throw error;
    }
  }

  async deleteClient(id: string) {
    try {
      // Get client name for notification
      const client = await enhancedStorageService.getClientById(id);
      const clientName = client?.name || 'Unknown Client';

      // Delete locally first
      await enhancedStorageService.deleteClient(id);

      // Queue for sync
      await offlineSyncService.queueOperation(
        SyncOperationType.DELETE,
        SyncEntityType.CLIENT,
        id,
        { id },
        1
      );

      // Show notification about queued operation
      await requestNotificationPermission();
      if (navigator.onLine) {
        showNotification('📤 Client Deletion Queued', {
          body: `Client "${clientName}" will be deleted from database`,
          tag: 'client-delete-queued'
        });
      } else {
        showNotification('📱 Offline Mode', {
          body: `Client "${clientName}" deleted locally and queued for sync`,
          tag: 'client-delete-offline'
        });
      }

      return true;
    } catch (error) {
      console.error('Error deleting client:', error);
      showNotification('❌ Error', {
        body: 'Failed to delete client',
        tag: 'client-delete-error'
      });
      throw error;
    }
  }
}

// Enhanced Site Service
export class EnhancedSiteService {
  async getSitesByClientId(clientId: string) {
    try {
      // First, try to fetch from database if online
      if (navigator.onLine) {
        try {
          // Show sync notification
          await requestNotificationPermission();
          showNotification('🔄 Syncing Sites', {
            body: 'Processing pending operations...',
            tag: 'sites-sync-progress'
          });

          // Process any pending sync operations first
          await offlineSyncService.processPendingOperations();

          // Show sync completion notification
          showNotification('✅ Sites Sync Complete', {
            body: 'All pending operations have been processed',
            tag: 'sites-sync-complete'
          });

          const response = await fetch(`${API_BASE_URL}/sites?client_id=${clientId}`);
          if (response.ok) {
            const sites = await response.json();

            // Fetch splits for each site
            const sitesWithSplits = await Promise.all(
              sites.map(async (site: any) => {
                try {
                  const splitsResponse = await fetch(`${API_BASE_URL}/splits?site_id=${site.id}`);
                  if (splitsResponse.ok) {
                    const splits = await splitsResponse.json();
                    return { ...site, splits };
                  }
                } catch (error) {
                  console.warn('Failed to fetch splits for site:', site.id, error);
                }
                return { ...site, splits: [] };
              })
            );

            // Update local storage with fresh data
            sitesWithSplits.forEach(site => {
              enhancedStorageService.saveSite(site);
            });

            return sitesWithSplits;
          }
        } catch (error) {
          console.warn('Failed to fetch from database, falling back to local storage:', error);
          showNotification('⚠️ Sites Sync Warning', {
            body: 'Failed to sync sites with database, using local data',
            tag: 'sites-sync-warning'
          });
        }
      }

      // Fallback to local storage (works offline)
      return await enhancedStorageService.getSitesByClientId(clientId);
    } catch (error) {
      console.error('Error getting sites by client ID:', error);
      return [];
    }
  }

  async createSite(siteData: any) {
    try {
      // Create site locally first (immediate feedback)
      const newSite = {
        ...siteData,
        id: generateId(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Save to local storage immediately
      await enhancedStorageService.saveSite(newSite);

      // Queue for sync when online
      await offlineSyncService.queueOperation(
        SyncOperationType.CREATE,
        SyncEntityType.SITE,
        newSite.id,
        newSite,
        1 // High priority
      );

      // Show notification about queued operation
      await requestNotificationPermission();
      if (navigator.onLine) {
        showNotification('📤 Site Queued', {
          body: `Site "${newSite.name}" will be synced to database`,
          tag: 'site-queued'
        });
      } else {
        showNotification('📱 Offline Mode', {
          body: `Site "${newSite.name}" saved locally and queued for sync`,
          tag: 'site-offline'
        });
      }

      return newSite;
    } catch (error) {
      console.error('Error creating site:', error);
      showNotification('❌ Error', {
        body: 'Failed to create site',
        tag: 'site-error'
      });
      throw error;
    }
  }

  async updateSite(id: string, siteData: any) {
    try {
      // Update locally first
      const updatedSite = {
        ...siteData,
        id,
        updatedAt: new Date().toISOString()
      };

      await enhancedStorageService.saveSite(updatedSite);

      // Queue for sync
      await offlineSyncService.queueOperation(
        SyncOperationType.UPDATE,
        SyncEntityType.SITE,
        id,
        updatedSite,
        1
      );

      return updatedSite;
    } catch (error) {
      console.error('Error updating site:', error);
      throw error;
    }
  }

  async deleteSite(id: string) {
    try {
      // Delete locally first
      await enhancedStorageService.deleteSite(id);

      // Queue for sync
      await offlineSyncService.queueOperation(
        SyncOperationType.DELETE,
        SyncEntityType.SITE,
        id,
        { id },
        1
      );

      return true;
    } catch (error) {
      console.error('Error deleting site:', error);
      throw error;
    }
  }
}

// Enhanced Quote Service
export class EnhancedQuoteService {
  async getAllQuotes() {
    try {
      // First, try to fetch from database if online
      if (navigator.onLine) {
        try {
          // Process any pending sync operations first
          await offlineSyncService.processPendingOperations();

          const response = await fetch(`${API_BASE_URL}/quotes`);
          if (response.ok) {
            const quotes = await response.json();

            // Update local storage with fresh data
            quotes.forEach((quote: any) => {
              enhancedStorageService.saveQuote(quote);
            });

            return quotes;
          }
        } catch (error) {
          console.warn('Failed to fetch from database, falling back to local storage:', error);
        }
      }

      // Fallback to local storage (works offline)
      return await enhancedStorageService.getQuotes();
    } catch (error) {
      console.error('Error getting quotes:', error);
      return [];
    }
  }

  async getQuoteById(id: string) {
    try {
      // First, try to fetch from database if online
      if (navigator.onLine) {
        try {
          // Process any pending sync operations first
          await offlineSyncService.processPendingOperations();

          const response = await fetch(`${API_BASE_URL}/quotes/${id}`);
          if (response.ok) {
            const quote = await response.json();

            // Update local storage
            enhancedStorageService.saveQuote(quote);

            return quote;
          }
        } catch (error) {
          console.warn('Failed to fetch from database, falling back to local storage:', error);
        }
      }

      // Fallback to local storage (works offline)
      return await enhancedStorageService.getQuoteById(id);
    } catch (error) {
      console.error('Error getting quote by ID:', error);
      return undefined;
    }
  }

  async createQuote(quoteData: any) {
    try {
      // Create quote locally first (immediate feedback)
      const newQuote = {
        ...quoteData,
        id: generateId(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Save to local storage immediately
      await enhancedStorageService.saveQuote(newQuote);

      // Queue for sync when online
      await offlineSyncService.queueOperation(
        SyncOperationType.CREATE,
        SyncEntityType.QUOTE,
        newQuote.id,
        newQuote,
        1 // High priority
      );

      return newQuote;
    } catch (error) {
      console.error('Error creating quote:', error);
      throw error;
    }
  }

  async updateQuote(id: string, quoteData: any) {
    try {
      // Update locally first
      const updatedQuote = {
        ...quoteData,
        id,
        updatedAt: new Date().toISOString()
      };

      await enhancedStorageService.saveQuote(updatedQuote);

      // Queue for sync
      await offlineSyncService.queueOperation(
        SyncOperationType.UPDATE,
        SyncEntityType.QUOTE,
        id,
        updatedQuote,
        1
      );

      return updatedQuote;
    } catch (error) {
      console.error('Error updating quote:', error);
      throw error;
    }
  }

  async deleteQuote(id: string) {
    try {
      // Delete locally first
      await enhancedStorageService.deleteQuote(id);

      // Queue for sync
      await offlineSyncService.queueOperation(
        SyncOperationType.DELETE,
        SyncEntityType.QUOTE,
        id,
        { id },
        1
      );

      return true;
    } catch (error) {
      console.error('Error deleting quote:', error);
      throw error;
    }
  }
}

// Enhanced Items Service
export class EnhancedItemsService {
  async getAllItems() {
    try {
      // First, try to fetch from database if online
      if (navigator.onLine) {
        try {
          // Show sync notification
          await requestNotificationPermission();
          showNotification('🔄 Syncing Items', {
            body: 'Processing pending operations...',
            tag: 'items-sync-progress'
          });

          // Process any pending sync operations first
          await offlineSyncService.processPendingOperations();

          // Show sync completion notification
          showNotification('✅ Items Sync Complete', {
            body: 'All pending operations have been processed',
            tag: 'items-sync-complete'
          },);

          const response = await fetch(`${API_BASE_URL}/items`);
          if (response.ok) {
            const items = await response.json();

            // Update local storage with fresh data
            items.forEach((item: any) => {
              enhancedStorageService.saveSupply(item);
            });

            return items;
          }
        } catch (error) {
          console.warn('Failed to fetch from database, falling back to local storage:', error);
          showNotification('⚠️ Sync Warning', {
            body: 'Failed to sync with database, using local data',
            tag: 'items-sync-warning'
          });
        }
      }

      // Fallback to local storage (works offline)
      return await enhancedStorageService.getSupplies();
    } catch (error) {
      console.error('Error getting items:', error);
      return [];
    }
  }

  async getItemById(id: string) {
    try {
      // First, try to fetch from database if online
      if (navigator.onLine) {
        try {
          const response = await fetch(`${API_BASE_URL}/items/${id}`);
          if (response.ok) {
            const item = await response.json();

            // Update local storage
            enhancedStorageService.saveSupply(item);
            return item;
          }
        } catch (error) {
          console.warn('Failed to fetch from database, falling back to local storage:', error);
        }
      }

      // Fallback to local storage
      const supplies = await enhancedStorageService.getSupplies();
      return supplies.find(supply => supply.id === id) || null;
    } catch (error) {
      console.error('Error getting item by ID:', error);
      return null;
    }
  }

  async createItem(itemData: any) {
    try {
      // Create locally first
      const newItem = await enhancedStorageService.saveSupply(itemData);

      // Queue for sync
      await offlineSyncService.queueOperation(
        SyncOperationType.CREATE,
        SyncEntityType.SUPPLY_ITEM,
        newItem.id,
        newItem,
        1
      );

      // Show notification
      await requestNotificationPermission();
      if (navigator.onLine) {
        showNotification('📤 Item Creation Queued', {
          body: `Item "${itemData.description}" will be created in database`,
          tag: 'item-create-queued'
        });
      } else {
        showNotification('📱 Offline Mode', {
          body: `Item "${itemData.description}" created locally and queued for sync`,
          tag: 'item-create-offline'
        });
      }

      return newItem;
    } catch (error) {
      console.error('Error creating item:', error);
      showNotification('❌ Error', {
        body: 'Failed to create item',
        tag: 'item-create-error'
      });
      throw error;
    }
  }

  async updateItem(id: string, itemData: any) {
    try {
      // Update locally first
      const updatedItem = await enhancedStorageService.saveSupply({ ...itemData, id });

      // Queue for sync
      await offlineSyncService.queueOperation(
        SyncOperationType.UPDATE,
        SyncEntityType.SUPPLY_ITEM,
        id,
        updatedItem,
        1
      );

      // Show notification
      await requestNotificationPermission();
      if (navigator.onLine) {
        showNotification('📤 Item Update Queued', {
          body: `Item "${itemData.description}" will be updated in database`,
          tag: 'item-update-queued'
        });
      } else {
        showNotification('📱 Offline Mode', {
          body: `Item "${itemData.description}" updated locally and queued for sync`,
          tag: 'item-update-offline'
        });
      }

      return updatedItem;
    } catch (error) {
      console.error('Error updating item:', error);
      showNotification('❌ Error', {
        body: 'Failed to update item',
        tag: 'item-update-error'
      });
      throw error;
    }
  }

  async deleteItem(id: string) {
    try {
      // Get item data before deletion for sync
      const supplies = await enhancedStorageService.getSupplies();
      const item = supplies.find(supply => supply.id === id);
      const itemDescription = item?.description || 'Unknown Item';

      // Delete locally first
      await enhancedStorageService.deleteSupply(id);

      // Queue for sync
      await offlineSyncService.queueOperation(
        SyncOperationType.DELETE,
        SyncEntityType.SUPPLY_ITEM,
        id,
        { id },
        1
      );

      // Show notification
      await requestNotificationPermission();
      if (navigator.onLine) {
        showNotification('📤 Item Deletion Queued', {
          body: `Item "${itemDescription}" will be deleted from database`,
          tag: 'item-delete-queued'
        });
      } else {
        showNotification('📱 Offline Mode', {
          body: `Item "${itemDescription}" deleted locally and queued for sync`,
          tag: 'item-delete-offline'
        });
      }

      return true;
    } catch (error) {
      console.error('Error deleting item:', error);
      showNotification('❌ Error', {
        body: 'Failed to delete item',
        tag: 'item-delete-error'
      });
      throw error;
    }
  }

  async createItemWithCustomId(itemData: any) {
    try {
      // Create locally first with custom ID
      const newItem = await enhancedStorageService.saveSupply(itemData);

      // Queue for sync
      await offlineSyncService.queueOperation(
        SyncOperationType.CREATE,
        SyncEntityType.SUPPLY_ITEM,
        newItem.id,
        newItem,
        1
      );

      // Show notification
      await requestNotificationPermission();
      if (navigator.onLine) {
        showNotification('📤 Item Creation Queued', {
          body: `Item "${itemData.description}" with ID ${itemData.id} will be created in database`,
          tag: 'item-create-custom-queued'
        });
      } else {
        showNotification('📱 Offline Mode', {
          body: `Item "${itemData.description}" with ID ${itemData.id} created locally and queued for sync`,
          tag: 'item-create-custom-offline'
        });
      }

      return newItem;
    } catch (error) {
      console.error('Error creating item with custom ID:', error);
      showNotification('❌ Error', {
        body: 'Failed to create item with custom ID',
        tag: 'item-create-custom-error'
      });
      throw error;
    }
  }
}

// Export singleton instances
export const enhancedClientService = new EnhancedClientService();
export const enhancedSiteService = new EnhancedSiteService();
export const enhancedQuoteService = new EnhancedQuoteService();
export const enhancedItemsService = new EnhancedItemsService();

export default {
  client: enhancedClientService,
  site: enhancedSiteService,
  quote: enhancedQuoteService,
  items: enhancedItemsService
};
