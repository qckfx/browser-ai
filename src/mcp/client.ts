import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { spawn } from 'child_process';
import { Tool, ToolExecutionResult, MCPClientConfig } from './types';
import { logger } from '../utils/logger';
import { z } from 'zod';

export class PlaywrightMCPClient {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;
  private tools: Map<string, Tool> = new Map();
  private config: MCPClientConfig;

  constructor(config?: MCPClientConfig) {
    this.config = config || {
      command: 'npx',
      args: ['@playwright/mcp@latest', '--browser', 'chromium'],
      env: process.env as Record<string, string>
    };
  }

  async connect(): Promise<void> {
    try {
      logger.info('Connecting to Playwright MCP server...');
      
      this.transport = new StdioClientTransport({
        command: this.config.command,
        args: this.config.args,
        env: this.config.env,
      });

      this.client = new Client(
        {
          name: 'playwright-ai-mcp-client',
          version: '0.1.0',
        },
        {
          capabilities: {},
        }
      );

      await this.client.connect(this.transport);
      logger.info('Connected to Playwright MCP server');

      await this.discoverTools();
    } catch (error) {
      logger.error('Failed to connect to Playwright MCP:', error);
      throw error;
    }
  }

  private async discoverTools(): Promise<void> {
    if (!this.client) {
      throw new Error('Client not connected');
    }

    try {
      const response = await this.client.request(
        { method: 'tools/list' },
        z.object({
          tools: z.array(z.object({
            name: z.string(),
            description: z.string().optional(),
            inputSchema: z.any().optional(),
          })),
        })
      );

      if ('tools' in response && Array.isArray(response.tools)) {
        this.tools.clear();
        for (const tool of response.tools) {
          this.tools.set(tool.name, {
            name: tool.name,
            description: tool.description || '',
            inputSchema: tool.inputSchema || {},
          });
        }
        logger.info(`Discovered ${this.tools.size} tools from Playwright MCP`);
      }
    } catch (error) {
      logger.error('Failed to discover tools:', error);
      throw error;
    }
  }

  getAvailableTools(): Tool[] {
    return Array.from(this.tools.values());
  }

  getTool(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  async executeTool(name: string, args: any): Promise<ToolExecutionResult> {
    if (!this.client) {
      throw new Error('Client not connected');
    }

    const tool = this.tools.get(name);
    if (!tool) {
      return {
        success: false,
        error: `Tool '${name}' not found`,
      };
    }

    try {
      logger.info(`Executing tool: ${name} with args:`, args);
      
      const response = await this.client.request(
        {
          method: 'tools/call',
          params: {
            name,
            arguments: args,
          },
        },
        z.object({
          content: z.any().optional(),
          error: z.string().optional(),
        })
      );
      
      logger.info(`Tool ${name} response:`, response);

      if ('content' in response) {
        return {
          success: true,
          result: response.content,
        };
      } else if ('error' in response) {
        return {
          success: false,
          error: response.error as string,
        };
      } else {
        return {
          success: true,
          result: response,
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
    }
    if (this.transport) {
      await this.transport.close();
      this.transport = null;
    }
    this.tools.clear();
    logger.info('Disconnected from Playwright MCP server');
  }

  isConnected(): boolean {
    return this.client !== null;
  }
}