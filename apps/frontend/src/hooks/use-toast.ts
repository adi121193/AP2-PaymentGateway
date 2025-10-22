/**
 * Toast Hook
 *
 * Wrapper around sonner toast for consistent toast notifications
 */

import { toast as sonnerToast } from 'sonner';

type ToastVariant = 'default' | 'destructive';

interface ToastOptions {
  title: string;
  description?: string;
  variant?: ToastVariant;
}

export function useToast() {
  const toast = (options: ToastOptions) => {
    const { title, description, variant = 'default' } = options;

    if (variant === 'destructive') {
      sonnerToast.error(title, {
        description,
      });
    } else {
      sonnerToast.success(title, {
        description,
      });
    }
  };

  return { toast };
}
