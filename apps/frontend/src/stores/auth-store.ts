/**
 * Authentication Store (Zustand)
 *
 * Manages authentication state and mock authentication flow.
 * Since backend auth endpoints don't exist yet, this uses localStorage
 * to persist mock developer data and API keys.
 */

import { create } from 'zustand';
import type { AuthState, Developer } from '@/lib/types';

// ============================================================================
// Mock Authentication Helpers
// ============================================================================

/**
 * Mock login - generates a fake API key and developer data
 */
function mockLogin(email: string): { apiKey: string; developer: Developer } {
  const apiKey = `dev_mock_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const developer: Developer = {
    id: `dev_${Math.random().toString(36).substring(7)}`,
    email,
    name: email.split('@')[0],
    verified: true,
    created_at: new Date().toISOString(),
  };

  return { apiKey, developer };
}

/**
 * Mock signup - same as login for now
 */
function mockSignup(name: string, email: string): { apiKey: string; developer: Developer } {
  const apiKey = `dev_mock_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const developer: Developer = {
    id: `dev_${Math.random().toString(36).substring(7)}`,
    email,
    name,
    verified: true,
    created_at: new Date().toISOString(),
  };

  return { apiKey, developer };
}

// ============================================================================
// Zustand Store
// ============================================================================

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  developer: null,
  apiKey: null,

  /**
   * Initialize auth state from localStorage
   * Call this on app mount
   */
  initialize: () => {
    if (typeof window === 'undefined') return;

    const apiKey = localStorage.getItem('apiKey');
    const developerJson = localStorage.getItem('developer');

    if (apiKey && developerJson) {
      try {
        const developer = JSON.parse(developerJson);
        set({
          isAuthenticated: true,
          developer,
          apiKey,
        });
      } catch (error) {
        console.error('Failed to parse developer data from localStorage', error);
        localStorage.removeItem('apiKey');
        localStorage.removeItem('developer');
      }
    }
  },

  /**
   * Mock login function
   * In production, this would call POST /auth/login
   */
  login: async (email: string, _password: string) => {
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 500));

    const { apiKey, developer } = mockLogin(email);

    // Persist to localStorage
    localStorage.setItem('apiKey', apiKey);
    localStorage.setItem('developer', JSON.stringify(developer));

    set({
      isAuthenticated: true,
      developer,
      apiKey,
    });
  },

  /**
   * Mock signup function
   * In production, this would call POST /auth/signup
   */
  signup: async (name: string, email: string, _password: string) => {
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 500));

    const { apiKey, developer } = mockSignup(name, email);

    // Persist to localStorage
    localStorage.setItem('apiKey', apiKey);
    localStorage.setItem('developer', JSON.stringify(developer));

    set({
      isAuthenticated: true,
      developer,
      apiKey,
    });
  },

  /**
   * Logout - clear auth state
   */
  logout: () => {
    localStorage.removeItem('apiKey');
    localStorage.removeItem('developer');

    set({
      isAuthenticated: false,
      developer: null,
      apiKey: null,
    });
  },
}));
