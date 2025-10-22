'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Upload, Loader2, Info } from 'lucide-react';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { apiClient } from '@/lib/api-client';
import { CATEGORIES } from '@/lib/constants';
import type { AgentCategory, PricingModel, RuntimeLanguage } from '@/lib/types';

const agentRegistrationSchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters'),
  slug: z
    .string()
    .min(3)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase with hyphens'),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, 'Version must be semver (e.g., 1.0.0)'),
  description: z.string().min(20, 'Description must be at least 20 characters'),
  long_description: z.string().optional(),
  category: z.string() as z.ZodType<AgentCategory>,
  tags: z.string().min(1, 'Add at least one tag'),
  pricing_model: z.string() as z.ZodType<PricingModel>,
  pricing_amount: z.number().min(0),
  pricing_currency: z.string().default('USD'),
  runtime_language: z.string() as z.ZodType<RuntimeLanguage>,
  runtime_version: z.string().min(1),
  runtime_entrypoint: z.string().default('index.js'),
  runtime_timeout_ms: z.number().min(1000).max(300000),
  runtime_memory_mb: z.number().min(128).max(4096),
  runtime_cpu_cores: z.number().min(0.25).max(4),
  code_file: z.instanceof(File).refine((file) => file.size > 0, 'Code file is required'),
});

type FormData = z.infer<typeof agentRegistrationSchema>;

export default function RegisterAgentPage() {
  const router = useRouter();
  const [dragActive, setDragActive] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(agentRegistrationSchema),
    defaultValues: {
      pricing_model: 'per_execution',
      pricing_amount: 0,
      pricing_currency: 'USD',
      runtime_language: 'nodejs',
      runtime_version: '20.0.0',
      runtime_entrypoint: 'index.js',
      runtime_timeout_ms: 30000,
      runtime_memory_mb: 512,
      runtime_cpu_cores: 1,
    },
  });

  const { mutate: registerAgent, isPending } = useMutation({
    mutationFn: async (data: FormData) => {
      const formData = new FormData();

      const manifest = {
        name: data.name,
        slug: data.slug,
        version: data.version,
        description: data.description,
        long_description: data.long_description || '',
        category: data.category,
        tags: data.tags.split(',').map((t) => t.trim()),
        pricing: {
          model: data.pricing_model,
          amount: data.pricing_amount,
          currency: data.pricing_currency,
        },
        runtime: {
          language: data.runtime_language,
          version: data.runtime_version,
          entrypoint: data.runtime_entrypoint,
          timeout_ms: data.runtime_timeout_ms,
          memory_mb: data.runtime_memory_mb,
          cpu_cores: data.runtime_cpu_cores,
        },
        inputs: [],
        outputs: [],
        capabilities: [],
      };

      formData.append('manifest', JSON.stringify(manifest));
      formData.append('code', data.code_file);

      const response = await apiClient.post('/agents/register', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      return response.data;
    },
    onSuccess: (data) => {
      toast.success('Agent registered successfully!');
      router.push(`/dashboard/agents`);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to register agent');
    },
  });

  const onSubmit = (data: FormData) => {
    registerAgent(data);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      form.setValue('code_file', e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Register New Agent</h1>
        <p className="text-muted-foreground">
          Upload your agent code and configure its settings
        </p>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Your agent will be reviewed by our team before being published to the marketplace.
          This usually takes 24-48 hours.
        </AlertDescription>
      </Alert>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
              <CardDescription>
                General information about your agent
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Agent Name</FormLabel>
                    <FormControl>
                      <Input placeholder="My Awesome Agent" {...field} />
                    </FormControl>
                    <FormDescription>
                      A user-friendly name for your agent
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="slug"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Slug</FormLabel>
                    <FormControl>
                      <Input placeholder="my-awesome-agent" {...field} />
                    </FormControl>
                    <FormDescription>
                      URL-friendly identifier (lowercase, hyphens only)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="version"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Version</FormLabel>
                    <FormControl>
                      <Input placeholder="1.0.0" {...field} />
                    </FormControl>
                    <FormDescription>
                      Semantic version (major.minor.patch)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Short Description</FormLabel>
                    <FormControl>
                      <Input placeholder="A brief one-line description" {...field} />
                    </FormControl>
                    <FormDescription>
                      This will be shown in search results and cards
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
                    <FormLabel>Long Description (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Detailed description with features, use cases, etc."
                        rows={5}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Markdown supported
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {CATEGORIES.map((cat) => (
                            <SelectItem key={cat.value} value={cat.value}>
                              {cat.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
                        Comma-separated tags
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Pricing */}
          <Card>
            <CardHeader>
              <CardTitle>Pricing</CardTitle>
              <CardDescription>
                Configure how users will pay for your agent
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <FormField
                  control={form.control}
                  name="pricing_model"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pricing Model</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="free">Free</SelectItem>
                          <SelectItem value="per_execution">Per Execution</SelectItem>
                          <SelectItem value="pay_per_use">Pay Per Use</SelectItem>
                          <SelectItem value="subscription">Subscription</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="pricing_amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Amount (cents)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="100"
                          {...field}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        />
                      </FormControl>
                      <FormDescription>
                        $1.00 = 100 cents
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="pricing_currency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Currency</FormLabel>
                      <FormControl>
                        <Input placeholder="USD" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Runtime Configuration */}
          <Card>
            <CardHeader>
              <CardTitle>Runtime Configuration</CardTitle>
              <CardDescription>
                Specify runtime requirements and resources
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="runtime_language"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Language</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="nodejs">Node.js</SelectItem>
                          <SelectItem value="python">Python</SelectItem>
                          <SelectItem value="go">Go</SelectItem>
                          <SelectItem value="rust">Rust</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="runtime_version"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Runtime Version</FormLabel>
                      <FormControl>
                        <Input placeholder="20.0.0" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="runtime_entrypoint"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Entrypoint</FormLabel>
                    <FormControl>
                      <Input placeholder="index.js" {...field} />
                    </FormControl>
                    <FormDescription>
                      Main file to execute (relative to uploaded code)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-4 md:grid-cols-3">
                <FormField
                  control={form.control}
                  name="runtime_timeout_ms"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Timeout (ms)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        />
                      </FormControl>
                      <FormDescription>
                        Max 300000 (5 min)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="runtime_memory_mb"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Memory (MB)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        />
                      </FormControl>
                      <FormDescription>
                        128 - 4096 MB
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="runtime_cpu_cores"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CPU Cores</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.25"
                          {...field}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        />
                      </FormControl>
                      <FormDescription>
                        0.25 - 4 cores
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Code Upload */}
          <Card>
            <CardHeader>
              <CardTitle>Upload Code</CardTitle>
              <CardDescription>
                Upload your agent code as a ZIP file
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="code_file"
                render={({ field: { value, onChange, ...field } }) => (
                  <FormItem>
                    <FormLabel>Code Archive</FormLabel>
                    <FormControl>
                      <div
                        className={`relative rounded-lg border-2 border-dashed p-8 transition-colors ${
                          dragActive
                            ? 'border-primary bg-primary/5'
                            : 'border-muted-foreground/25'
                        }`}
                        onDragEnter={handleDrag}
                        onDragLeave={handleDrag}
                        onDragOver={handleDrag}
                        onDrop={handleDrop}
                      >
                        <Input
                          type="file"
                          accept=".zip"
                          className="absolute inset-0 cursor-pointer opacity-0"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) onChange(file);
                          }}
                          {...field}
                        />
                        <div className="flex flex-col items-center text-center">
                          <Upload className="mb-4 h-12 w-12 text-muted-foreground" />
                          <p className="mb-2 text-sm font-medium">
                            {value ? value.name : 'Drop your ZIP file here'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            or click to browse
                          </p>
                        </div>
                      </div>
                    </FormControl>
                    <FormDescription>
                      Include all dependencies and a README.md file
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Submit */}
          <div className="flex gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Register Agent
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
