/**
 * Execution Output Component
 *
 * Displays execution output with JSON formatting and download option
 */

'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import type { AgentExecution } from '@/lib/types';

interface ExecutionOutputProps {
  execution: AgentExecution;
}

export function ExecutionOutput({ execution }: ExecutionOutputProps) {
  const hasOutput = execution.outputs && Object.keys(execution.outputs).length > 0;

  const handleDownload = () => {
    if (!execution.outputs) return;

    const dataStr = JSON.stringify(execution.outputs, null, 2);
    const dataUri = `data:application/json;charset=utf-8,${encodeURIComponent(dataStr)}`;

    const exportFileDefaultName = `execution-${execution.id}-output.json`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  if (!hasOutput) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Output</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500 italic">
            {execution.status === 'succeeded'
              ? 'No output data available'
              : 'Output will appear when execution completes'}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Output</CardTitle>
        <Button size="sm" variant="outline" onClick={handleDownload}>
          <Download className="h-4 w-4 mr-2" />
          Download JSON
        </Button>
      </CardHeader>
      <CardContent>
        <div className="bg-gray-50 rounded-lg p-4 overflow-x-auto">
          <pre className="text-sm font-mono">
            {JSON.stringify(execution.outputs, null, 2)}
          </pre>
        </div>
      </CardContent>
    </Card>
  );
}
