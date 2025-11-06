/**
 * Execute Agent Dialog Component
 *
 * Dynamic form dialog for executing agents with custom inputs
 * Generates form fields based on agent.manifest.inputs
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { useMutation } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { DynamicInputField } from './dynamic-input-field';
import { apiClient } from '@/lib/api-client';
import { useWallet } from '@/hooks/use-wallet';
import { Loader2, Play, Wallet, CreditCard, AlertCircle } from 'lucide-react';
import type { AgentDefinition } from '@/lib/types';

interface ExecuteAgentDialogProps {
  agent: AgentDefinition;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ExecuteAgentDialog({ agent, open, onOpenChange }: ExecuteAgentDialogProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [executionId, setExecutionId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'wallet' | 'cashfree'>('wallet');
  const userId = 'user_demo_001'; // TODO: Get from auth context
  
  // Fetch wallet balance
  const { data: wallet, isLoading: walletLoading } = useWallet('USER', userId);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
  } = useForm<Record<string, unknown>>();

  // Check if agent has pricing
  const isFree = agent.manifest.pricing?.model === 'free';
  const price = (agent.manifest.pricing as any)?.amount || (agent.manifest.pricing as any)?.price_per_execution || 0;
  const currency = agent.manifest.pricing?.currency || 'USD';
  
  // Check if wallet has sufficient balance
  const walletBalance = wallet ? wallet.availableBalance / 100 : 0;
  const hasSufficientBalance = walletBalance >= price;

  // Execute agent mutation
  const executeMutation = useMutation({
    mutationFn: (inputs: Record<string, unknown>) => {
      return apiClient.executeAgent(agent.id, { 
        inputs,
        paymentMethod,
        userId,
      });
    },
    onSuccess: (execution: any) => {
      setExecutionId(execution.id);
      
      // Check if payment is required (API client converts to camelCase)
      if (execution.paymentRequired && execution.payment) {
        toast({
          title: 'Payment Required',
          description: execution.payment.message,
        });
      } else {
        toast({
          title: 'Execution Started',
          description: `Agent execution ${execution.id} has been queued`,
        });
      }
      reset();
    },
    onError: (error) => {
      toast({
        title: 'Execution Failed',
        description: error instanceof Error ? error.message : 'Failed to execute agent',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: Record<string, unknown>) => {
    // Parse JSON fields for array and object types
    const processedInputs: Record<string, unknown> = {};

    if (agent.manifest?.inputs) {
      agent.manifest.inputs.forEach((input) => {
        const value = data[input.name];

        if (input.type === 'array' || input.type === 'object') {
          try {
            processedInputs[input.name] = JSON.parse(String(value));
          } catch {
            // Validation should have caught this, but fallback to string
            processedInputs[input.name] = value;
          }
        } else if (input.type === 'number') {
          processedInputs[input.name] = Number(value);
        } else if (input.type === 'boolean') {
          processedInputs[input.name] = Boolean(value);
        } else {
          processedInputs[input.name] = value;
        }
      });
    }

    executeMutation.mutate(processedInputs);
  };

  const handleViewExecution = () => {
    if (executionId) {
      router.push(`/executions/${executionId}`);
      onOpenChange(false);
      setExecutionId(null);
    }
  };

  const handleClose = () => {
    if (!executeMutation.isPending) {
      onOpenChange(false);
      setExecutionId(null);
      reset();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Execute {agent.manifest?.name || 'Agent'}</DialogTitle>
          <DialogDescription>
            {!agent.manifest?.inputs || agent.manifest.inputs.length === 0
              ? 'This agent does not require any inputs. Click execute to run.'
              : 'Fill in the required inputs to execute this agent.'}
          </DialogDescription>
        </DialogHeader>

        {/* Success State - Show execution ID and view button */}
        {executionId && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-sm text-green-800 mb-2">
              <strong>Execution ID:</strong>{' '}
              <code className="bg-green-100 px-2 py-1 rounded font-mono text-xs">
                {executionId}
              </code>
            </p>
            <Button onClick={handleViewExecution} variant="outline" size="sm">
              View Execution
            </Button>
          </div>
        )}

        {/* Form */}
        {!executionId && (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Dynamic Input Fields */}
            {agent.manifest?.inputs && agent.manifest.inputs.length > 0 ? (
              <div className="space-y-4">
                {agent.manifest.inputs.map((input) => (
                  <DynamicInputField
                    key={input.name}
                    input={input}
                    register={register}
                    errors={errors}
                    onChange={(value) => setValue(input.name, value)}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p>No inputs required</p>
              </div>
            )}

            {/* Pricing Info */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <strong>Cost:</strong>{' '}
                {isFree ? (
                  <span className="text-green-600 font-semibold">FREE</span>
                ) : (
                  <span>
                    {currency} {price.toFixed(2)}
                  </span>
                )}
              </p>
            </div>

            {/* Payment Method Selection (only for paid agents) */}
            {!isFree && (
              <div className="space-y-3">
                <Label className="text-sm font-medium">Payment Method</Label>
                <div className="space-y-2">
                  <label
                    className={`flex items-center space-x-3 border rounded-lg p-3 cursor-pointer transition-colors ${
                      paymentMethod === 'wallet' ? 'bg-blue-50 border-blue-300' : 'hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="wallet"
                      checked={paymentMethod === 'wallet'}
                      onChange={(e) => setPaymentMethod(e.target.value as 'wallet' | 'cashfree')}
                      className="h-4 w-4"
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Wallet className="h-4 w-4" />
                          <span>Wallet Balance</span>
                        </div>
                        {walletLoading ? (
                          <span className="text-sm text-gray-500">Loading...</span>
                        ) : wallet ? (
                          <span className={`text-sm font-semibold ${hasSufficientBalance ? 'text-green-600' : 'text-red-600'}`}>
                            ${walletBalance.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-500">No wallet</span>
                        )}
                      </div>
                    </div>
                  </label>
                  
                  <label
                    className={`flex items-center space-x-3 border rounded-lg p-3 cursor-pointer transition-colors ${
                      paymentMethod === 'cashfree' ? 'bg-blue-50 border-blue-300' : 'hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="cashfree"
                      checked={paymentMethod === 'cashfree'}
                      onChange={(e) => setPaymentMethod(e.target.value as 'wallet' | 'cashfree')}
                      className="h-4 w-4"
                    />
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4" />
                      <span>Credit/Debit Card</span>
                    </div>
                  </label>
                </div>

                {/* Insufficient Balance Warning */}
                {paymentMethod === 'wallet' && !hasSufficientBalance && wallet && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Insufficient wallet balance. You need ${price.toFixed(2)} but have ${walletBalance.toFixed(2)}.
                      Please top up your wallet or select a different payment method.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}

            {/* Form Actions */}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={executeMutation.isPending}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={
                  executeMutation.isPending || 
                  (!isFree && paymentMethod === 'wallet' && !hasSufficientBalance)
                }
              >
                {executeMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Executing...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Execute Agent
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        )}

        {/* Close button after success */}
        {executionId && (
          <DialogFooter>
            <Button onClick={handleClose}>Close</Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
