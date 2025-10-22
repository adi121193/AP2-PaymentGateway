/**
 * Auth Initializer Component
 *
 * Loads authentication state from localStorage on app mount
 * Must be used in a client component
 */

'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/stores/auth-store';

export function AuthInitializer() {
  const initialize = useAuthStore((state) => state.initialize);

  useEffect(() => {
    initialize();
  }, [initialize]);

  return null;
}
