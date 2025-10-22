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
import { useToast } from '@/hooks/use-toast';
import { DynamicInputField } from './dynamic-input-field';
import { apiClient } from '@/lib/api-client';
import { Loader2, Play } from 'lucide-react';
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

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
  } = useForm<Record<string, unknown>>();

  // Execute agent mutation
  const executeMutation = useMutation({
    mutationFn: (inputs: Record<string, unknown>) => {
      return apiClient.executeAgent(agent.id, { inputs });
    },
    onSuccess: (execution) => {
      setExecutionId(execution.id);
      toast({
        title: 'Execution Started',
        description: `Agent execution ${execution.id} has been queued`,
      });
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
          <DialogTitle>Execute {agent.manifest.name}</DialogTitle>
          <DialogDescription>
            {agent.manifest.inputs.length === 0
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
            {agent.manifest.inputs.length > 0 ? (
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
                {agent.manifest.pricing.model === 'free' ? (
                  <span className="text-green-600 font-semibold">FREE</span>
                ) : (
                  <span>
                    {agent.manifest.pricing.currency}{' '}
                    {(agent.manifest.pricing.amount / 100).toFixed(2)}
                  </span>
                )}
              </p>
            </div>

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
              <Button type="submit" disabled={executeMutation.isPending}>
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
