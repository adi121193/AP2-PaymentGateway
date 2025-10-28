/**
 * Top-up Dialog Component
 * Allows users to add funds to their wallet
 */

'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTopupWallet } from '@/hooks/use-wallet';
import { DollarSign, Loader2 } from 'lucide-react';
import type { OwnerType } from '@/lib/api/wallet';

interface TopupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ownerType: OwnerType;
  ownerId: string;
}

export function TopupDialog({ open, onOpenChange, ownerType, ownerId }: TopupDialogProps) {
  const [amount, setAmount] = useState('');
  const { mutate: topup, isPending } = useTopupWallet(ownerType, ownerId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const amountInCents = Math.round(parseFloat(amount) * 100);
    
    if (amountInCents > 0) {
      topup(amountInCents, {
        onSuccess: () => {
          setAmount('');
          onOpenChange(false);
        },
      });
    }
  };

  const suggestedAmounts = [10, 25, 50, 100];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Top Up Wallet</DialogTitle>
            <DialogDescription>
              Add funds to your wallet to execute agents
            </DialogDescription>
          </DialogHeader>

          <div className="py-6 space-y-4">
            {/* Amount Input */}
            <div className="space-y-2">
              <Label htmlFor="amount">Amount (USD)</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="1"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            {/* Quick Amount Buttons */}
            <div className="space-y-2">
              <Label>Quick Select</Label>
              <div className="grid grid-cols-4 gap-2">
                {suggestedAmounts.map((value) => (
                  <Button
                    key={value}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setAmount(value.toString())}
                  >
                    ${value}
                  </Button>
                ))}
              </div>
            </div>

            {/* Total */}
            {amount && parseFloat(amount) > 0 && (
              <div className="p-4 bg-blue-50 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Total Amount</span>
                  <span className="text-xl font-bold">${parseFloat(amount).toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!amount || isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isPending ? 'Processing...' : 'Top Up'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
