import { create } from 'zustand';
import {
  homeStockApi,
  emergencyStockApi,
  recipesApi,
  shoppingListApi,
  dashboardApi,
} from '../api/client';
import {
  HomeStockItem,
  EmergencyStockItem,
  Recipe,
  ShoppingListItem,
  DashboardData,
} from '../types';

interface AppState {
  // Data
  homeStock: HomeStockItem[];
  emergencyStock: EmergencyStockItem[];
  recipes: Recipe[];
  shoppingList: ShoppingListItem[];
  dashboard: DashboardData | null;

  // Loading states
  loading: boolean;
  error: string | null;

  // Actions - Home Stock
  fetchHomeStock: () => Promise<void>;
  addHomeStockItem: (item: any) => Promise<void>;
  updateHomeStockItem: (id: string, item: any) => Promise<void>;
  deleteHomeStockItem: (id: string) => Promise<void>;
  quickAddHomeStock: (id: string, change: number) => Promise<void>;

  // Actions - Emergency Stock
  fetchEmergencyStock: () => Promise<void>;
  addEmergencyStockItem: (item: any) => Promise<void>;
  updateEmergencyStockItem: (id: string, item: any) => Promise<void>;
  deleteEmergencyStockItem: (id: string) => Promise<void>;

  // Actions - Recipes
  fetchRecipes: () => Promise<void>;
  addRecipe: (recipe: any) => Promise<void>;
  updateRecipe: (id: string, recipe: any) => Promise<void>;
  deleteRecipe: (id: string) => Promise<void>;

  // Actions - Shopping List
  fetchShoppingList: () => Promise<void>;
  addShoppingListItem: (item: any) => Promise<void>;
  updateShoppingListItem: (id: string, item: any) => Promise<void>;
  deleteShoppingListItem: (id: string) => Promise<void>;
  moveCheckedToStock: () => Promise<void>;

  // Actions - Dashboard
  fetchDashboard: () => Promise<void>;

  // Utility
  clearError: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  // Initial state
  homeStock: [],
  emergencyStock: [],
  recipes: [],
  shoppingList: [],
  dashboard: null,
  loading: false,
  error: null,

  // Home Stock Actions
  fetchHomeStock: async () => {
    try {
      set({ loading: true, error: null });
      const response = await homeStockApi.getAll();
      set({ homeStock: response.data, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },

  addHomeStockItem: async (item) => {
    try {
      set({ loading: true, error: null });
      await homeStockApi.create(item);
      await get().fetchHomeStock();
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },

  updateHomeStockItem: async (id, item) => {
    try {
      set({ loading: true, error: null });
      await homeStockApi.update(id, item);
      await get().fetchHomeStock();
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },

  deleteHomeStockItem: async (id) => {
    try {
      set({ loading: true, error: null });
      await homeStockApi.delete(id);
      await get().fetchHomeStock();
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },

  quickAddHomeStock: async (id, change) => {
    try {
      await homeStockApi.quickAdd(id, change);
      await get().fetchHomeStock();
    } catch (error: any) {
      set({ error: error.message });
    }
  },

  // Emergency Stock Actions
  fetchEmergencyStock: async () => {
    try {
      set({ loading: true, error: null });
      const response = await emergencyStockApi.getAll();
      set({ emergencyStock: response.data, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },

  addEmergencyStockItem: async (item) => {
    try {
      set({ loading: true, error: null });
      await emergencyStockApi.create(item);
      await get().fetchEmergencyStock();
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },

  updateEmergencyStockItem: async (id, item) => {
    try {
      set({ loading: true, error: null });
      await emergencyStockApi.update(id, item);
      await get().fetchEmergencyStock();
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },

  deleteEmergencyStockItem: async (id) => {
    try {
      set({ loading: true, error: null });
      await emergencyStockApi.delete(id);
      await get().fetchEmergencyStock();
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },

  // Recipe Actions
  fetchRecipes: async () => {
    try {
      set({ loading: true, error: null });
      const response = await recipesApi.getAll();
      set({ recipes: response.data, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },

  addRecipe: async (recipe) => {
    try {
      set({ loading: true, error: null });
      await recipesApi.create(recipe);
      await get().fetchRecipes();
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },

  updateRecipe: async (id, recipe) => {
    try {
      set({ loading: true, error: null });
      await recipesApi.update(id, recipe);
      await get().fetchRecipes();
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },

  deleteRecipe: async (id) => {
    try {
      set({ loading: true, error: null });
      await recipesApi.delete(id);
      await get().fetchRecipes();
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },

  // Shopping List Actions
  fetchShoppingList: async () => {
    try {
      set({ loading: true, error: null });
      const response = await shoppingListApi.getAll();
      set({ shoppingList: response.data, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },

  addShoppingListItem: async (item) => {
    try {
      set({ loading: true, error: null });
      await shoppingListApi.create(item);
      await get().fetchShoppingList();
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },

  updateShoppingListItem: async (id, item) => {
    try {
      set({ loading: true, error: null });
      await shoppingListApi.update(id, item);
      await get().fetchShoppingList();
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },

  deleteShoppingListItem: async (id) => {
    try {
      set({ loading: true, error: null });
      await shoppingListApi.delete(id);
      await get().fetchShoppingList();
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },

  moveCheckedToStock: async () => {
    try {
      set({ loading: true, error: null });
      await shoppingListApi.moveToStock();
      await get().fetchShoppingList();
      await get().fetchHomeStock();
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },

  // Dashboard Actions
  fetchDashboard: async () => {
    try {
      set({ loading: true, error: null });
      const response = await dashboardApi.get();
      set({ dashboard: response.data, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },

  // Utility
  clearError: () => set({ error: null }),
}));
