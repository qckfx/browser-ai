import { z } from 'zod';

export const ToolSchema = z.object({
  name: z.string(),
  description: z.string(),
  inputSchema: z.record(z.any()),
});

export type Tool = z.infer<typeof ToolSchema>;

export interface ToolExecutionResult {
  success: boolean;
  result?: any;
  error?: string;
}

export interface MCPClientConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}