/**
 * Withdraw Dialog Component
 * Allows developers to request withdrawal of earnings
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useRequestWithdrawal } from '@/hooks/use-wallet';
import { DollarSign, Loader2, AlertCircle } from 'lucide-react';

interface WithdrawDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WithdrawDialog({ open, onOpenChange }: WithdrawDialogProps) {
  const [amount, setAmount] = useState('');
  const { mutate: withdraw, isPending } = useRequestWithdrawal();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const amountInCents = Math.round(parseFloat(amount) * 100);
    
    if (amountInCents > 0) {
      withdraw(amountInCents, {
        onSuccess: () => {
          setAmount('');
          onOpenChange(false);
        },
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Request Withdrawal</DialogTitle>
            <DialogDescription>
              Withdraw your earnings to your bank account
            </DialogDescription>
          </DialogHeader>

          <div className="py-6 space-y-4">
            {/* Info Alert */}
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Withdrawal requests are processed within 3-5 business days. A processing fee may apply.
              </AlertDescription>
            </Alert>

            {/* Amount Input */}
            <div className="space-y-2">
              <Label htmlFor="withdraw-amount">Amount (USD)</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="withdraw-amount"
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
              <p className="text-sm text-gray-500">
                Minimum withdrawal: $10.00
              </p>
            </div>

            {/* Total */}
            {amount && parseFloat(amount) >= 10 && (
              <div className="p-4 bg-green-50 rounded-lg space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Withdrawal Amount</span>
                  <span className="text-lg font-semibold">${parseFloat(amount).toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">Processing Fee</span>
                  <span>$0.00</span>
                </div>
                <div className="pt-2 border-t border-green-200 flex justify-between items-center">
                  <span className="font-medium">You'll Receive</span>
                  <span className="text-xl font-bold text-green-700">
                    ${parseFloat(amount).toFixed(2)}
                  </span>
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
            <Button type="submit" disabled={!amount || parseFloat(amount) < 10 || isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isPending ? 'Processing...' : 'Request Withdrawal'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
