import { create } from 'zustand';
import axios from 'axios';

const API_BASE = process.env.EXPO_PUBLIC_BACKEND_URL || '';

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

  // Auth actions
  register: (username: string, pin: string) => Promise<boolean>;
  login: (username: string, pin: string) => Promise<boolean>;
  logout: () => void;
  
  // Household actions
  createHousehold: (name: string) => Promise<boolean>;
  joinHousehold: (inviteCode: string) => Promise<boolean>;
  leaveHousehold: () => Promise<boolean>;
  fetchHousehold: () => Promise<void>;
  
  // Utility
  clearError: () => void;
  getHouseholdId: () => string | null;
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  user: null,
  household: null,
  isAuthenticated: false,
  loading: false,
  error: null,

  register: async (username: string, pin: string) => {
    try {
      set({ loading: true, error: null });
      const response = await axios.post(`${API_BASE}/api/auth/register`, {
        username,
        pin,
      });
      set({
        user: response.data,
        isAuthenticated: true,
        loading: false,
      });
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
      set({
        user: response.data,
        isAuthenticated: true,
        loading: false,
      });
      
      // Fetch household info if user has one
      if (response.data.household_id) {
        await get().fetchHousehold();
      }
      
      return true;
    } catch (error: any) {
      const message = error.response?.data?.detail || 'Login failed';
      set({ error: message, loading: false });
      return false;
    }
  },

  logout: () => {
    set({
      user: null,
      household: null,
      isAuthenticated: false,
      error: null,
    });
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
      
      // Update user with new household_id
      set({
        household: response.data,
        user: { ...user, household_id: response.data.id },
        loading: false,
      });
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
      
      // Update user with new household_id
      set({
        household: response.data,
        user: { ...user, household_id: response.data.id },
        loading: false,
      });
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
      
      set({
        household: null,
        user: { ...user, household_id: null },
        loading: false,
      });
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
        set({ household: response.data });
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
