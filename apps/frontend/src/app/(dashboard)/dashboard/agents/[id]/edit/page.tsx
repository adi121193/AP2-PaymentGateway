'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { apiClient } from '@/lib/api-client';
import { CATEGORIES } from '@/lib/constants';
import type { AgentDefinition, AgentCategory, PricingModel, AgentStatus } from '@/lib/types';

const editAgentSchema = z.object({
  description: z.string().min(20, 'Description must be at least 20 characters'),
  long_description: z.string().optional(),
  tags: z.string().min(1, 'Add at least one tag'),
  pricing_amount: z.number().min(0),
  status: z.enum(['active', 'inactive', 'pending_review']) as z.ZodType<AgentStatus>,
});

type FormData = z.infer<typeof editAgentSchema>;

export default function EditAgentPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const agentId = params.id as string;

  const { data: agent, isLoading } = useQuery({
    queryKey: ['agent', agentId],
    queryFn: async () => {
      const response = await apiClient.get<AgentDefinition>(`/agents/${agentId}`);
      return response.data;
    },
  });

  const form = useForm<FormData>({
    resolver: zodResolver(editAgentSchema),
    values: agent
      ? {
          description: agent.manifest.description,
          long_description: agent.manifest.long_description || '',
          tags: agent.manifest.tags.join(', '),
          pricing_amount: agent.manifest.pricing.amount,
          status: agent.status,
        }
      : undefined,
  });

  const { mutate: updateAgent, isPending: isUpdating } = useMutation({
    mutationFn: async (data: FormData) => {
      const response = await apiClient.patch(`/agents/${agentId}`, {
        description: data.description,
        long_description: data.long_description,
        tags: data.tags.split(',').map((t) => t.trim()),
        pricing_amount: data.pricing_amount,
        status: data.status,
      });
      return response.data;
    },
    onSuccess: () => {
      toast.success('Agent updated successfully!');
      queryClient.invalidateQueries({ queryKey: ['agent', agentId] });
      queryClient.invalidateQueries({ queryKey: ['my-agents'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to update agent');
    },
  });

  const { mutate: deleteAgent, isPending: isDeleting } = useMutation({
    mutationFn: async () => {
      await apiClient.delete(`/agents/${agentId}`);
    },
    onSuccess: () => {
      toast.success('Agent deleted successfully');
      router.push('/dashboard/agents');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to delete agent');
    },
  });

  const onSubmit = (data: FormData) => {
    updateAgent(data);
  };

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="flex h-96 flex-col items-center justify-center">
        <p className="text-lg font-semibold">Agent not found</p>
        <Button asChild className="mt-4">
          <a href="/dashboard/agents">Back to My Agents</a>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Edit Agent</h1>
          <p className="text-muted-foreground">{agent.manifest.name}</p>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm" disabled={isDeleting}>
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Agent
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete your agent
                and remove all associated data from our servers.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => deleteAgent()}>
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Immutable Info */}
      <Card>
        <CardHeader>
          <CardTitle>Agent Information</CardTitle>
          <CardDescription>These fields cannot be changed</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Agent ID</p>
              <p className="text-sm">{agent.id}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Slug</p>
              <p className="text-sm">{agent.manifest.slug}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Version</p>
              <p className="text-sm">{agent.manifest.version}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Category</p>
              <p className="text-sm capitalize">{agent.manifest.category.replace('_', ' ')}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Runtime</p>
              <p className="text-sm">
                {agent.manifest.runtime.language} {agent.manifest.runtime.version}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Created</p>
              <p className="text-sm">
                {new Date(agent.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Editable Form */}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Description & Tags</CardTitle>
              <CardDescription>Update your agent's description</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Short Description</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormDescription>
                      Brief one-line description shown in cards
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="long_description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Long Description</FormLabel>
                    <FormControl>
                      <Textarea rows={6} {...field} />
                    </FormControl>
                    <FormDescription>
                      Detailed description with markdown support
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="tags"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tags</FormLabel>
                    <FormControl>
                      <Input placeholder="automation, api, data" {...field} />
                    </FormControl>
                    <FormDescription>
                      Comma-separated tags for discoverability
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Pricing</CardTitle>
              <CardDescription>Adjust pricing (model cannot be changed)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Pricing Model</p>
                  <p className="text-sm capitalize">
                    {agent.manifest.pricing.model.replace('_', ' ')}
                  </p>
                </div>
                <FormField
                  control={form.control}
                  name="pricing_amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Amount (cents)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        />
                      </FormControl>
                      <FormDescription>
                        Current: ${(agent.manifest.pricing.amount / 100).toFixed(2)}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Status</CardTitle>
              <CardDescription>Control agent availability</CardDescription>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Agent Status</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                        <SelectItem value="pending_review" disabled>
                          Pending Review
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Inactive agents won't appear in marketplace
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              disabled={isUpdating}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isUpdating}>
              {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Save className="mr-2 h-4 w-4" />
              Save Changes
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
