/**
 * Config Preview - Shows generated FetchConfig as formatted JSON
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { FetchConfig, Prisma } from '@prisma/client';

interface ConfigPreviewProps {
  config: FetchConfig | Record<string, unknown> | Prisma.JsonValue | null | undefined;
  className?: string;
}

function formatJson(value: unknown, indent = 0): string {
  const spaces = '  '.repeat(indent);
  if (value === null) return 'null';
  if (value === undefined) return '';
  if (typeof value === 'string') return `"${value}"`;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    const items = value.map((item) => `${spaces}  ${formatJson(item, indent + 1)}`).join(',\n');
    return `[\n${items}\n${spaces}]`;
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return '{}';
    const lines = entries
      .map(([k, v]) => `${spaces}  "${k}": ${formatJson(v, indent + 1)}`)
      .join(',\n');
    return `{\n${lines}\n${spaces}}`;
  }
  return String(value);
}

export function ConfigPreview({ config, className }: ConfigPreviewProps) {
  if (!config) {
    return (
      <p className="text-muted-foreground text-sm">No config generated yet.</p>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="py-2 px-3">
        <CardTitle className="text-sm font-medium">Generated Config</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[200px] w-full rounded-md border">
          <pre className="text-xs p-3 whitespace-pre-wrap break-all">
            {formatJson(config)}
          </pre>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}