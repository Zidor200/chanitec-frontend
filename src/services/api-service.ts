import { Client, Quote, Site, SupplyItem, LaborItem } from '../models/Quote';
import { PriceOffer } from '../models/PriceOffer';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

class ApiService {
    // Helper method for making API calls
    private async fetchApi<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
            },
        });

        if (!response.ok) {
            throw new Error(`API call failed: ${response.statusText}`);
        }

        // Handle 204 No Content responses
        if (response.status === 204) {
            return undefined as T;
        }

        return response.json();
    }

    // Quotes
    async getQuotes(): Promise<Quote[]> {
        return this.fetchApi<Quote[]>('/quotes');
    }

    async getQuoteById(id: string): Promise<Quote> {
        return this.fetchApi<Quote>(`/quotes/${id}`);
    }

    async saveQuote(quote: Quote): Promise<Quote> {
        return this.fetchApi<Quote>('/quotes', {
            method: 'POST',
            body: JSON.stringify(quote),
        });
    }

    async deleteQuote(id: string): Promise<void> {
        await this.fetchApi(`/quotes/${id}`, {
            method: 'DELETE',
        });
    }

    async updateQuote(quote: Quote): Promise<Quote> {
        console.log('Updating quote in API service:', quote);
        const response = await fetch(`${API_BASE_URL}/quotes/${quote.id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(quote),
        });

        if (!response.ok) {
            throw new Error(`Failed to update quote: ${response.statusText}`);
        }

        const updatedQuote = await response.json();
        console.log('Update quote response:', updatedQuote);
        return updatedQuote;
    }

    // Clients
    async getClients(): Promise<Client[]> {
        return this.fetchApi<Client[]>('/clients');
    }

    async getClientById(id: string): Promise<Client> {
        return this.fetchApi<Client>(`/clients/${id}`);
    }

    async saveClient(client: Omit<Client, 'id'> & { id?: string }): Promise<Client> {
        return this.fetchApi<Client>('/clients', {
            method: 'POST',
            body: JSON.stringify(client),
        });
    }

    async deleteClient(id: string): Promise<void> {
        await this.fetchApi(`/clients/${id}`, {
            method: 'DELETE',
        });
    }

    // Sites
    async getSitesByClientId(clientId: string): Promise<Site[]> {
        return this.fetchApi<Site[]>(`/sites/by-client?clientId=${clientId}`);
    }

    async saveSite(site: Omit<Site, 'id'> & { id?: string }): Promise<Site> {
        return this.fetchApi<Site>('/sites', {
            method: 'POST',
            body: JSON.stringify(site),
        });
    }

    async deleteSite(id: string): Promise<void> {
        await this.fetchApi(`/sites/${id}`, {
            method: 'DELETE',
        });
    }

    // Supply Items
    async getSupplies(): Promise<SupplyItem[]> {
        return this.fetchApi<SupplyItem[]>('/items');
    }

    async getSupplyItems(quoteId: string): Promise<SupplyItem[]> {
        return this.fetchApi<SupplyItem[]>(`/supply-items/${quoteId}`);
    }

    async saveSupply(supply: Omit<SupplyItem, 'id'> & { id?: string }, quoteId: string): Promise<SupplyItem> {
        return this.fetchApi<SupplyItem>(`/supply-items/${quoteId}`, {
            method: 'POST',
            body: JSON.stringify(supply),
        });
    }

    async clearItems(): Promise<{ message: string; deletedCount: number }> {
        return this.fetchApi('/items/clear', {
            method: 'DELETE'
        });
    }

    async deleteSupply(id: string): Promise<void> {
        await this.fetchApi(`/supply-items/${id}`, {
            method: 'DELETE',
        });
    }

    // Labor Items
    async getLaborItems(quoteId: string): Promise<LaborItem[]> {
        return this.fetchApi<LaborItem[]>(`/labor-items/${quoteId}`);
    }

    async createLaborItem(item: Omit<LaborItem, 'id'>, quoteId: string): Promise<LaborItem> {
        // Transform the item properties to match backend expectations and ensure correct data types
        const transformedItem = {
            quote_id: quoteId,                                    // varchar(36)
            description: String(item.description),                // text
            nb_technicians: parseInt(String(item.nbTechnicians)), // int
            nb_hours: parseFloat(Number(item.nbHours).toFixed(2)),            // decimal(10,2)
            weekend_multiplier: parseFloat(Number(item.weekendMultiplier).toFixed(2)), // decimal(10,2)
            price_euro: parseFloat(Number(item.priceEuro).toFixed(2)),        // decimal(10,2)
            price_dollar: parseFloat(Number(item.priceDollar || 0).toFixed(2)),    // decimal(10,2)
            unit_price_dollar: parseFloat(Number(item.unitPriceDollar || 0).toFixed(2)), // decimal(10,2)
            total_price_dollar: parseFloat(Number(item.totalPriceDollar || 0).toFixed(2)) // decimal(10,2)
        };

        // Log the transformed item for debugging
        console.log('Sending labor item data:', transformedItem);

        return this.fetchApi<LaborItem>(`/labor-items/${quoteId}`, {
            method: 'POST',
            body: JSON.stringify(transformedItem)
        });
    }

    // Price Offers
    async getPriceOffers(): Promise<PriceOffer[]> {
        return this.fetchApi<PriceOffer[]>('/price-offers');
    }

    async createPriceOffer(offer: Omit<PriceOffer, 'createdAt' | 'updatedAt'>): Promise<PriceOffer> {
        return this.fetchApi<PriceOffer>('/price-offers', {
            method: 'POST',
            body: JSON.stringify(offer)
        });
    }
}

// Export a singleton instance
export const apiService = new ApiService();