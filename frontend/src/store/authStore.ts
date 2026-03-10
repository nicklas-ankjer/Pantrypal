import { create } from 'zustand';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE = process.env.EXPO_PUBLIC_BACKEND_URL || '';
const AUTH_STORAGE_KEY = '@kitchen_counter_auth';

export interface User {
  id: string;
  username: string;
  household_id: string | null;
  created_at: string;
}

export interface HouseholdMember {
  user_id: string;
  username: string;
  joined_at: string;
  is_owner: boolean;
}

export interface Household {
  id: string;
  name: string;
  invite_code: string;
  members: HouseholdMember[];
  created_at: string;
}

interface AuthState {
  user: User | null;
  household: Household | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
  hydrated: boolean;

  // Auth actions
  register: (username: string, pin: string) => Promise<boolean>;
  login: (username: string, pin: string) => Promise<boolean>;
  logout: () => Promise<void>;
  
  // Household actions
  createHousehold: (name: string) => Promise<boolean>;
  joinHousehold: (inviteCode: string) => Promise<boolean>;
  leaveHousehold: () => Promise<boolean>;
  fetchHousehold: () => Promise<void>;
  
  // Utility
  clearError: () => void;
  getHouseholdId: () => string | null;
  
  // Persistence
  hydrate: () => Promise<void>;
  persist: () => Promise<void>;
}

// Helper to save auth state to storage
const saveToStorage = async (user: User | null, household: Household | null) => {
  try {
    if (user) {
      await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ user, household }));
    } else {
      await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
    }
  } catch (e) {
    console.error('Failed to save auth state:', e);
  }
};

// Helper to load auth state from storage
const loadFromStorage = async (): Promise<{ user: User | null; household: Household | null }> => {
  try {
    const stored = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
    if (stored) {
      const data = JSON.parse(stored);
      return { user: data.user || null, household: data.household || null };
    }
  } catch (e) {
    console.error('Failed to load auth state:', e);
  }
  return { user: null, household: null };
};

export const useAuthStore = create<AuthState>()((set, get) => ({
  user: null,
  household: null,
  isAuthenticated: false,
  loading: false,
  error: null,
  hydrated: false,

  // Hydrate auth state from storage on app start
  hydrate: async () => {
    try {
      const { user, household } = await loadFromStorage();
      if (user) {
        set({
          user,
          household,
          isAuthenticated: true,
          hydrated: true,
        });
        // Refresh household data if user has one
        if (user.household_id) {
          await get().fetchHousehold();
        }
      } else {
        set({ hydrated: true });
      }
    } catch (e) {
      console.error('Failed to hydrate auth state:', e);
      set({ hydrated: true });
    }
  },

  // Persist current auth state to storage
  persist: async () => {
    const { user, household } = get();
    await saveToStorage(user, household);
  },

  register: async (username: string, pin: string) => {
    try {
      set({ loading: true, error: null });
      const response = await axios.post(`${API_BASE}/api/auth/register`, {
        username,
        pin,
      });
      
      const user = response.data;
      set({
        user,
        isAuthenticated: true,
        loading: false,
      });
      
      // Save to storage
      await saveToStorage(user, null);
      
      return true;
    } catch (error: any) {
      const message = error.response?.data?.detail || 'Registration failed';
      set({ error: message, loading: false });
      return false;
    }
  },

  login: async (username: string, pin: string) => {
    try {
      set({ loading: true, error: null });
      const response = await axios.post(`${API_BASE}/api/auth/login`, {
        username,
        pin,
      });
      
      const user = response.data;
      set({
        user,
        isAuthenticated: true,
        loading: false,
      });
      
      // Fetch household info if user has one
      let household = null;
      if (user.household_id) {
        await get().fetchHousehold();
        household = get().household;
      }
      
      // Save to storage
      await saveToStorage(user, household);
      
      return true;
    } catch (error: any) {
      const message = error.response?.data?.detail || 'Login failed';
      set({ error: message, loading: false });
      return false;
    }
  },

  logout: async () => {
    set({
      user: null,
      household: null,
      isAuthenticated: false,
      error: null,
    });
    // Clear storage
    await saveToStorage(null, null);
  },

  createHousehold: async (name: string) => {
    const { user } = get();
    if (!user) {
      set({ error: 'Not authenticated' });
      return false;
    }

    try {
      set({ loading: true, error: null });
      const response = await axios.post(
        `${API_BASE}/api/household/create?user_id=${user.id}`,
        { name }
      );
      
      const household = response.data;
      const updatedUser = { ...user, household_id: response.data.id };
      
      set({
        household,
        user: updatedUser,
        loading: false,
      });
      
      // Save to storage
      await saveToStorage(updatedUser, household);
      
      return true;
    } catch (error: any) {
      const message = error.response?.data?.detail || 'Failed to create household';
      set({ error: message, loading: false });
      return false;
    }
  },

  joinHousehold: async (inviteCode: string) => {
    const { user } = get();
    if (!user) {
      set({ error: 'Not authenticated' });
      return false;
    }

    try {
      set({ loading: true, error: null });
      const response = await axios.post(
        `${API_BASE}/api/household/join?user_id=${user.id}`,
        { invite_code: inviteCode }
      );
      
      const household = response.data;
      const updatedUser = { ...user, household_id: response.data.id };
      
      set({
        household,
        user: updatedUser,
        loading: false,
      });
      
      // Save to storage
      await saveToStorage(updatedUser, household);
      
      return true;
    } catch (error: any) {
      const message = error.response?.data?.detail || 'Failed to join household';
      set({ error: message, loading: false });
      return false;
    }
  },

  leaveHousehold: async () => {
    const { user } = get();
    if (!user) {
      set({ error: 'Not authenticated' });
      return false;
    }

    try {
      set({ loading: true, error: null });
      await axios.post(`${API_BASE}/api/household/leave/${user.id}`);
      
      const updatedUser = { ...user, household_id: null };
      
      set({
        household: null,
        user: updatedUser,
        loading: false,
      });
      
      // Save to storage
      await saveToStorage(updatedUser, null);
      
      return true;
    } catch (error: any) {
      const message = error.response?.data?.detail || 'Failed to leave household';
      set({ error: message, loading: false });
      return false;
    }
  },

  fetchHousehold: async () => {
    const { user } = get();
    if (!user) return;

    try {
      const response = await axios.get(`${API_BASE}/api/household/${user.id}`);
      if (response.data && response.data.id) {
        const household = response.data;
        set({ household });
        // Also save to storage
        await saveToStorage(user, household);
      } else {
        set({ household: null });
      }
    } catch (error) {
      console.error('Failed to fetch household:', error);
    }
  },

  clearError: () => set({ error: null }),
  
  getHouseholdId: () => {
    const { user } = get();
    return user?.household_id || null;
  },
}));
