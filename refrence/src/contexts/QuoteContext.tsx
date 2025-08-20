import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import {
  LaborItem,
  Quote,
  SupplyItem
} from '../models/Quote';
import { apiService } from '../services/api-service';
import {
  calculateLaborItemTotal,
  calculateSupplyItemTotal,
  calculateTotalLabor,
  calculateTotalSupplies,
  calculateTotalTTC,
  calculateVAT
} from '../utils/calculations';
import { generateId, generateQuoteId, extractBaseId, extractVersion, getNextVersion } from '../utils/id-generator';

// Default values
const DEFAULT_EXCHANGE_RATE = 1.2;
const DEFAULT_MARGIN_RATE = 0.8;
const DEFAULT_LABOR_EXCHANGE_RATE = 1.2;
const DEFAULT_LABOR_MARGIN_RATE = 0.8;
const DEFAULT_DESCRIPTION = "";

// State interface
interface QuoteState {
  currentQuote: Quote | null;
  isEditing: boolean;
  isLoading: boolean;
  error: string | null;
  isExistingQuote: boolean;
  originalQuoteId: string | null;
}

// Action types
type QuoteAction =
  | { type: 'SET_QUOTE'; payload: Quote }
  | { type: 'SET_EXISTING_QUOTE'; payload: boolean }
  | { type: 'CLEAR_QUOTE' }
  | { type: 'START_EDIT' }
  | { type: 'CANCEL_EDIT' }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'UPDATE_QUOTE_FIELD'; payload: { field: keyof Quote; value: any } }
  | { type: 'ADD_SUPPLY_ITEM'; payload: Omit<SupplyItem, 'id'> }
  | { type: 'UPDATE_SUPPLY_ITEM'; payload: SupplyItem }
  | { type: 'REMOVE_SUPPLY_ITEM'; payload: string }
  | { type: 'ADD_LABOR_ITEM'; payload: Omit<LaborItem, 'id'> }
  | { type: 'UPDATE_LABOR_ITEM'; payload: LaborItem }
  | { type: 'REMOVE_LABOR_ITEM'; payload: string }
  | { type: 'RECALCULATE_TOTALS' }
  | { type: 'SET_ORIGINAL_QUOTE_ID'; payload: string | null };

// Initial state
const initialState: QuoteState = {
  currentQuote: null,
  isEditing: false,
  isLoading: false,
  error: null,
  isExistingQuote: false,
  originalQuoteId: null,
};

// Reducer function
const quoteReducer = (state: QuoteState, action: QuoteAction): QuoteState => {
  switch (action.type) {
    case 'SET_QUOTE':
      return {
        ...state,
        currentQuote: action.payload,
        isEditing: false,
        error: null,
      };

    case 'SET_EXISTING_QUOTE':
      return {
        ...state,
        isExistingQuote: action.payload,
      };

    case 'CLEAR_QUOTE':
      return {
        ...state,
        currentQuote: null,
        isEditing: false,
        isExistingQuote: false,
      };

    case 'START_EDIT':
      return {
        ...state,
        isEditing: true,
      };

    case 'CANCEL_EDIT':
      return {
        ...state,
        isEditing: false,
      };

    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload,
      };

    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload,
        isLoading: false,
      };

    case 'UPDATE_QUOTE_FIELD':
      if (!state.currentQuote) return state;

      return {
        ...state,
        currentQuote: {
          ...state.currentQuote,
          [action.payload.field]: action.payload.value,
        },
      };

    case 'ADD_SUPPLY_ITEM': {
      if (!state.currentQuote) return state;

      const newItem: SupplyItem = {
        id: generateId(),
        ...action.payload,
      };

      // Calculate prices
      const calculatedItem = calculateSupplyItemTotal(
        newItem,
        state.currentQuote.supplyExchangeRate,
        state.currentQuote.supplyMarginRate
      );

      const updatedItems = [...state.currentQuote.supplyItems, calculatedItem];
      const totalSuppliesHT = calculateTotalSupplies(updatedItems);
      const totalHT = Number(totalSuppliesHT) + Number(state.currentQuote.totalLaborHT);
      const tva = calculateVAT(totalHT);
      const totalTTC = totalHT + tva;

      return {
        ...state,
        currentQuote: {
          ...state.currentQuote,
          supplyItems: updatedItems,
          totalSuppliesHT,
          totalHT,
          tva,
          totalTTC,
        },
      };
    }

    case 'UPDATE_SUPPLY_ITEM': {
      if (!state.currentQuote) return state;

      const updatedItems = (state.currentQuote.supplyItems ?? []).map(item =>
        item.id === action.payload.id
          ? calculateSupplyItemTotal(
              action.payload,
              state.currentQuote!.supplyExchangeRate,
              state.currentQuote!.supplyMarginRate
            )
          : item
      );

      const totalSuppliesHT = calculateTotalSupplies(updatedItems);
      const totalHT = Number(totalSuppliesHT) + Number(state.currentQuote.totalLaborHT);
      const tva = calculateVAT(totalHT);
      const totalTTC = totalHT + tva;

      return {
        ...state,
        currentQuote: {
          ...state.currentQuote,
          supplyItems: updatedItems,
          totalSuppliesHT,
          totalHT,
          tva,
          totalTTC,
        },
      };
    }

    case 'REMOVE_SUPPLY_ITEM': {
      if (!state.currentQuote) return state;

      const updatedItems = state.currentQuote.supplyItems.filter(
        item => item.id !== action.payload
      );

      const totalSuppliesHT = calculateTotalSupplies(updatedItems);
      const totalHT = Number(totalSuppliesHT) + Number(state.currentQuote.totalLaborHT);
      const tva = calculateVAT(totalHT);
      const totalTTC = totalHT + tva;

      return {
        ...state,
        currentQuote: {
          ...state.currentQuote,
          supplyItems: updatedItems,
          totalSuppliesHT,
          totalHT,
          tva,
          totalTTC,
        },
      };
    }

    case 'ADD_LABOR_ITEM': {
      if (!state.currentQuote) return state;

      const newItem: LaborItem = {
        id: generateId(),
        ...action.payload,
      };

      // Calculate prices
      const calculatedItem = calculateLaborItemTotal(
        newItem,
        state.currentQuote.laborExchangeRate,
        state.currentQuote.laborMarginRate
      );

      const updatedItems = [...state.currentQuote.laborItems, calculatedItem];
      const totalLaborHT = calculateTotalLabor(updatedItems);
      const totalHT = Number(totalLaborHT) + Number(state.currentQuote.totalSuppliesHT);
      const tva = calculateVAT(totalHT);
      const totalTTC = totalHT + tva;

      return {
        ...state,
        currentQuote: {
          ...state.currentQuote,
          laborItems: updatedItems,
          totalLaborHT,
          totalHT,
          tva,
          totalTTC,
        },
      };
    }

    case 'UPDATE_LABOR_ITEM': {
      if (!state.currentQuote) return state;

      const updatedItems = (state.currentQuote.laborItems ?? []).map(item =>
        item.id === action.payload.id
          ? calculateLaborItemTotal(
              action.payload,
              state.currentQuote!.laborExchangeRate,
              state.currentQuote!.laborMarginRate
            )
          : item
      );

      const totalLaborHT = calculateTotalLabor(updatedItems);
      const totalHT = Number(totalLaborHT) + Number(state.currentQuote.totalSuppliesHT);
      const tva = calculateVAT(totalHT);
      const totalTTC = totalHT + tva;

      return {
        ...state,
        currentQuote: {
          ...state.currentQuote,
          laborItems: updatedItems,
          totalLaborHT,
          totalHT,
          tva,
          totalTTC,
        },
      };
    }

    case 'REMOVE_LABOR_ITEM': {
      if (!state.currentQuote) return state;

      const updatedItems = state.currentQuote.laborItems.filter(
        item => item.id !== action.payload
      );

      const totalLaborHT = calculateTotalLabor(updatedItems);
      const totalHT = Number(totalLaborHT) + Number(state.currentQuote.totalSuppliesHT);
      const tva = calculateVAT(totalHT);
      const totalTTC = totalHT + tva;

      return {
        ...state,
        currentQuote: {
          ...state.currentQuote,
          laborItems: updatedItems,
          totalLaborHT,
          totalHT,
          tva,
          totalTTC,
        },
      };
    }

    case 'RECALCULATE_TOTALS': {
      if (!state.currentQuote) return state;

      const recalculatedSupplyItems = (state.currentQuote.supplyItems ?? []).map(item =>
        calculateSupplyItemTotal(
          item,
          state.currentQuote!.supplyExchangeRate,
          state.currentQuote!.supplyMarginRate
        )
      );

      const recalculatedLaborItems = (state.currentQuote.laborItems ?? []).map(item =>
        calculateLaborItemTotal(
          item,
          state.currentQuote!.laborExchangeRate,
          state.currentQuote!.laborMarginRate
        )
      );

      // Recalculate totals
      const totalSuppliesHT = calculateTotalSupplies(recalculatedSupplyItems);
      const totalLaborHT = calculateTotalLabor(recalculatedLaborItems);
      const totalHT = Number(totalSuppliesHT) + Number(totalLaborHT);
      const tva = calculateVAT(totalHT);
      const totalTTC = totalHT + tva;

      return {
        ...state,
        currentQuote: {
          ...state.currentQuote,
          supplyItems: recalculatedSupplyItems,
          laborItems: recalculatedLaborItems,
          totalSuppliesHT,
          totalLaborHT,
          totalHT,
          tva,
          totalTTC,
        },
      };
    }

    case 'SET_ORIGINAL_QUOTE_ID': {
      return {
        ...state,
        originalQuoteId: action.payload,
      };
    }

    default:
      return state;
  }
};

// Context interface
interface QuoteContextProps {
  state: QuoteState;
  createNewQuote: () => void;
  loadQuote: (id: string, createdAt: string, fromHistory?: boolean) => void;
  saveQuote: () => Promise<boolean>;
  updateQuote: () => Promise<boolean>;
  setQuoteField: <K extends keyof Quote>(field: K, value: Quote[K]) => void;
  addSupplyItem: (item: Omit<SupplyItem, 'id'>) => void;
  updateSupplyItem: (item: SupplyItem) => void;
  removeSupplyItem: (id: string) => void;
  addLaborItem: (item: Omit<LaborItem, 'id'>) => void;
  updateLaborItem: (item: LaborItem) => void;
  removeLaborItem: (id: string) => void;
  recalculateTotals: () => void;
  clearQuote: () => void;
}

// Create context
const QuoteContext = createContext<QuoteContextProps | undefined>(undefined);

// Provider props
interface QuoteProviderProps {
  children: ReactNode;
}

// Provider component
export const QuoteProvider: React.FC<QuoteProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(quoteReducer, initialState);

  // Create a new quote
  const createNewQuote = async () => {
    let exchangeRate = DEFAULT_EXCHANGE_RATE;
    try {
      exchangeRate = await apiService.getExchangeRate('EUR', 'USD');
      exchangeRate = Math.round(exchangeRate * 1000) / 1000;
    } catch (e) {
      console.warn('Failed to fetch real-time exchange rate, using default:', e);
    }
    const newQuote: Quote = {
      id: generateQuoteId(), // This will create ID with version 000
      clientName: '',
      siteName: '',
      object: '',
      date: new Date().toISOString().split('T')[0],
      supplyDescription: DEFAULT_DESCRIPTION,
      laborDescription: DEFAULT_DESCRIPTION,
      supplyExchangeRate: exchangeRate,
      supplyMarginRate: DEFAULT_MARGIN_RATE,
      laborExchangeRate: exchangeRate,
      laborMarginRate: DEFAULT_LABOR_MARGIN_RATE,
      supplyItems: [],
      laborItems: [],
      totalSuppliesHT: 0,
      totalLaborHT: 0,
      totalHT: 0,
      tva: 0,
      totalTTC: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 0,
      totalAmount: 0,
      status: 'draft',
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 0
      }
    };

    dispatch({ type: 'SET_QUOTE', payload: newQuote });
    dispatch({ type: 'SET_EXISTING_QUOTE', payload: false });
  };

  // Load a quote by ID
  const loadQuote = async (id: string, createdAt: string, fromHistory: boolean = false) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const quote = await apiService.getQuoteById(id);
      if (!quote) {
        throw new Error('Quote not found');
      }
      dispatch({ type: 'SET_ORIGINAL_QUOTE_ID', payload: id });
      dispatch({ type: 'SET_QUOTE', payload: quote });
      dispatch({ type: 'SET_EXISTING_QUOTE', payload: true });
      dispatch({ type: 'SET_ERROR', payload: null });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Failed to load quote' });
      dispatch({ type: 'CLEAR_QUOTE' });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  // Save or update quote
  const saveQuote = async (): Promise<boolean> => {
    if (!state.currentQuote) return false;
    try {
      dispatch({ type: 'SET_LOADING', payload: true });

      let quoteToSave = { ...state.currentQuote };
      let newId = state.currentQuote.id;
      let isUpdate = false;
      let parentId: string | undefined = undefined;

      // Only refresh exchange rate if it hasn't been manually modified by the user
      // For new quotes, use the current values (which may have been fetched initially)
      // For existing quotes, preserve the user's modifications
      if (!state.currentQuote.id || state.currentQuote.version === 0) {
        // For new quotes, keep the current exchange rates (they were set during creation)
        // No need to refresh them here as they're already set to the latest values
      } else {
        // For existing quotes, preserve the user's modifications
        // Don't overwrite the exchange rates with fresh API values
      }

      // If it's a new quote (no ID or version 0), create it
      if (!state.currentQuote.id || state.currentQuote.version === 0) {
        // Create new quote
        quoteToSave = {
          ...quoteToSave,
          parentId: "",
        };
        const savedQuote = await apiService.saveQuote(quoteToSave);
        dispatch({ type: 'SET_QUOTE', payload: savedQuote });
        dispatch({ type: 'SET_EXISTING_QUOTE', payload: true });
        dispatch({ type: 'SET_ORIGINAL_QUOTE_ID', payload: savedQuote.id });
        return true;
      } else {
        // For updating an existing quote: create a new quote with a new ID and parent reference
        isUpdate = true;
        // If the current quote has a parentId, use it (unless it's 0 or '0'); otherwise, use the current quote's id
        let rawParentId = state.currentQuote.parentId;
        if (rawParentId === '0') {
          rawParentId = undefined;
        }
        parentId = rawParentId ? rawParentId : state.currentQuote.id;
        newId = generateQuoteId();
        quoteToSave = {
          ...state.currentQuote,
          id: newId,
          parentId: parentId,
          version: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          supplyExchangeRate: quoteToSave.supplyExchangeRate,
          laborExchangeRate: quoteToSave.laborExchangeRate,
          metadata: {
            ...state.currentQuote.metadata,
            version: 1,
            updatedAt: new Date().toISOString(),
          }
        };
      }

      // Save the new quote (as a new entry)
      const savedQuote = await apiService.saveQuote(quoteToSave);

      // Create new supply items
      if (state.currentQuote.supplyItems.length > 0) {
        const supplyItemPromises = state.currentQuote.supplyItems.map(item => {
          const newItem = {
            ...item,
            id: undefined,
            quote_id: newId
          };
          return apiService.createSupplyItem(newId, newItem);
        });
        await Promise.all(supplyItemPromises);
      }

      // Create new labor items
      if (state.currentQuote.laborItems.length > 0) {
        const laborItemPromises = state.currentQuote.laborItems.map(item => {
          const newItem = {
            ...item,
            id: undefined,
            quote_id: newId
          };
          return apiService.createLaborItem(newId, newItem);
        });
        await Promise.all(laborItemPromises);
      }

      // Fetch the complete updated quote with new items
      const completeQuoteResponse = await apiService.getQuoteById(newId);
      if (!completeQuoteResponse) {
        throw new Error('Failed to fetch updated quote');
      }
      dispatch({ type: 'SET_QUOTE', payload: completeQuoteResponse });
      dispatch({ type: 'SET_EXISTING_QUOTE', payload: true });
      dispatch({ type: 'SET_ORIGINAL_QUOTE_ID', payload: newId });
      return true;
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Failed to save quote' });
      return false;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  // Remove the updateQuote function since it's now consolidated with saveQuote
  const updateQuote = async (): Promise<boolean> => {
    return saveQuote();
  };

  // Update a field in the quote
  const setQuoteField = <K extends keyof Quote>(field: K, value: Quote[K]) => {
    dispatch({
      type: 'UPDATE_QUOTE_FIELD',
      payload: { field, value }
    });

    // Recalculate totals if rates are changed
    if (
      field === 'supplyExchangeRate' ||
      field === 'supplyMarginRate' ||
      field === 'laborExchangeRate' ||
      field === 'laborMarginRate'
    ) {
      dispatch({ type: 'RECALCULATE_TOTALS' });
    }
  };

  // Add a supply item
  const addSupplyItem = (item: Omit<SupplyItem, 'id'>) => {
    dispatch({ type: 'ADD_SUPPLY_ITEM', payload: item });
  };

  // Update a supply item
  const updateSupplyItem = (item: SupplyItem) => {
    dispatch({ type: 'UPDATE_SUPPLY_ITEM', payload: item });
  };

  // Remove a supply item
  const removeSupplyItem = (id: string) => {
    dispatch({ type: 'REMOVE_SUPPLY_ITEM', payload: id });
  };

  // Add a labor item
  const addLaborItem = (item: Omit<LaborItem, 'id'>) => {
    dispatch({ type: 'ADD_LABOR_ITEM', payload: item });
  };

  // Update a labor item
  const updateLaborItem = (item: LaborItem) => {
    dispatch({ type: 'UPDATE_LABOR_ITEM', payload: item });
  };

  // Remove a labor item
  const removeLaborItem = (id: string) => {
    dispatch({ type: 'REMOVE_LABOR_ITEM', payload: id });
  };

  // Recalculate all totals
  const recalculateTotals = () => {
    dispatch({ type: 'RECALCULATE_TOTALS' });
  };

  const clearQuote = () => {
    dispatch({ type: 'CLEAR_QUOTE' });
  };

  const value = {
    state,
    createNewQuote,
    loadQuote,
    saveQuote,
    updateQuote,
    setQuoteField,
    addSupplyItem,
    updateSupplyItem,
    removeSupplyItem,
    addLaborItem,
    updateLaborItem,
    removeLaborItem,
    recalculateTotals,
    clearQuote
  };

  return (
    <QuoteContext.Provider value={value}>
      {children}
    </QuoteContext.Provider>
  );
};

// Custom hook for using the quote context
export const useQuote = (): QuoteContextProps => {
  const context = useContext(QuoteContext);

  if (context === undefined) {
    throw new Error('useQuote must be used within a QuoteProvider');
  }

  return context;
};