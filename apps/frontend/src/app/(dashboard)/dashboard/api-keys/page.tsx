'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Key, Plus, Copy, Trash2, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { apiClient } from '@/lib/api-client';

interface ApiKey {
  id: string;
  name: string;
  key: string;
  last_used_at?: string;
  created_at: string;
}

export default function ApiKeysPage() {
  const queryClient = useQueryClient();
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
  const [newKey, setNewKey] = useState<string | null>(null);

  const { data: apiKeys, isLoading } = useQuery({
    queryKey: ['api-keys'],
    queryFn: async () => {
      const response = await apiClient.get<ApiKey[]>('/developers/me/api-keys');
      return response.data;
    },
  });

  const { mutate: createKey, isPending: isCreating } = useMutation({
    mutationFn: async () => {
      const response = await apiClient.post<ApiKey>('/developers/me/api-keys', {
        name: `API Key ${new Date().toLocaleDateString()}`,
      });
      return response.data;
    },
    onSuccess: (data) => {
      setNewKey(data.key);
      toast.success('API key created successfully!');
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to create API key');
    },
  });

  const { mutate: deleteKey } = useMutation({
    mutationFn: async (keyId: string) => {
      await apiClient.delete(`/developers/me/api-keys/${keyId}`);
    },
    onSuccess: () => {
      toast.success('API key deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to delete API key');
    },
  });

  const toggleKeyVisibility = (keyId: string) => {
    setVisibleKeys((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(keyId)) {
        newSet.delete(keyId);
      } else {
        newSet.add(keyId);
      }
      return newSet;
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
  };

  const maskKey = (key: string) => {
    return `${key.slice(0, 8)}${'•'.repeat(24)}${key.slice(-4)}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">API Keys</h1>
          <p className="text-muted-foreground">
            Manage your API keys for programmatic access
          </p>
        </div>
        <Button onClick={() => createKey()} disabled={isCreating}>
          <Plus className="mr-2 h-4 w-4" />
          Create New Key
        </Button>
      </div>

      {/* New Key Alert */}
      {newKey && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-2">
              <p className="font-medium">Your new API key:</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded bg-muted px-3 py-2 text-sm font-mono">
                  {newKey}
                </code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyToClipboard(newKey)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                ⚠️ Save this key now - you won't be able to see it again!
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setNewKey(null)}
              >
                I've saved my key
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">How to use API keys</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            Include your API key in the <code className="rounded bg-muted px-1 py-0.5">Authorization</code> header:
          </p>
          <pre className="overflow-x-auto rounded-lg bg-muted p-3 text-xs">
            {`curl -X POST https://api.frameos.dev/agents/execute \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"agent_id": "...", "inputs": {...}}'`}
          </pre>
        </CardContent>
      </Card>

      {/* API Keys List */}
      <Card>
        <CardHeader>
          <CardTitle>Your API Keys</CardTitle>
          <CardDescription>
            {apiKeys?.length ?? 0} active key{apiKeys?.length !== 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-20 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          ) : apiKeys && apiKeys.length > 0 ? (
            <div className="space-y-3">
              {apiKeys.map((key) => {
                const isVisible = visibleKeys.has(key.id);
                const displayKey = isVisible ? key.key : maskKey(key.key);

                return (
                  <div
                    key={key.id}
                    className="flex items-center justify-between rounded-lg border p-4"
                  >
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <Key className="h-4 w-4 text-muted-foreground" />
                        <p className="font-medium">{key.name}</p>
                        <Badge variant="outline" className="text-xs">
                          Active
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <code className="text-sm font-mono text-muted-foreground">
                          {displayKey}
                        </code>
                      </div>
                      <div className="flex gap-4 text-xs text-muted-foreground">
                        <span>
                          Created: {new Date(key.created_at).toLocaleDateString()}
                        </span>
                        {key.last_used_at && (
                          <span>
                            Last used: {new Date(key.last_used_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => toggleKeyVisibility(key.id)}
                      >
                        {isVisible ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyToClipboard(key.key)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete API key?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will immediately revoke the key. Any applications using
                              this key will stop working.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteKey(key.id)}>
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Key className="mb-4 h-12 w-12 text-muted-foreground/50" />
              <h3 className="mb-2 text-lg font-semibold">No API keys yet</h3>
              <p className="mb-6 text-sm text-muted-foreground">
                Create your first API key to get started with the FrameOS API
              </p>
              <Button onClick={() => createKey()} disabled={isCreating}>
                <Plus className="mr-2 h-4 w-4" />
                Create Your First Key
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Security Best Practices */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Security Best Practices</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <ul className="list-inside list-disc space-y-1">
            <li>Never share your API keys or commit them to version control</li>
            <li>Use environment variables to store keys in your applications</li>
            <li>Rotate keys regularly and delete unused keys</li>
            <li>Each application should have its own API key</li>
            <li>Monitor the "Last used" date to detect suspicious activity</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
