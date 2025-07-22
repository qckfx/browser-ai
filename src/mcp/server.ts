import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { PlaywrightMCPClient } from './client';
import { BrowserAutomationAgent } from '../ai/agent';
import { TokenManager } from '../auth/storage';
import { logger } from '../utils/logger';

const BrowserAIToolSchema = z.object({
  command: z.string().describe('Natural language description of the browser task to perform'),
  context: z.object({
    url: z.string().optional().describe('Current URL or target URL for the automation'),
    sessionId: z.string().optional().describe('Session ID for continuing previous automation'),
  }).optional(),
});

export class PlaywrightAIMCPServer {
  private server: Server;
  private playwrightClient: PlaywrightMCPClient;
  private agent: BrowserAutomationAgent | null = null;
  private tokenManager: TokenManager;

  constructor() {
    this.server = new Server(
      {
        name: 'playwright-ai-mcp',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.playwrightClient = new PlaywrightMCPClient();
    this.tokenManager = new TokenManager();
    this.setupHandlers();
  }

  private setupHandlers(): void {
    this.server.setRequestHandler(
      z.object({ method: z.literal('tools/list') }),
      this.handleToolsList.bind(this)
    );
    this.server.setRequestHandler(
      z.object({ 
        method: z.literal('tools/call'),
        params: z.object({
          name: z.string(),
          arguments: z.any(),
        }),
      }),
      this.handleToolCall.bind(this)
    );
  }

  private async handleToolsList(): Promise<any> {
    return {
      tools: [
        {
          name: 'browser_ai',
          description: 'Execute browser automation tasks using natural language commands. This tool interprets your intent and translates it into appropriate browser actions.',
          inputSchema: BrowserAIToolSchema,
        },
      ],
    };
  }

  private async handleToolCall(request: any): Promise<any> {
    const params = request.params;
    if (params.name !== 'browser_ai') {
      throw new Error(`Unknown tool: ${params.name}`);
    }

    try {
      const args = BrowserAIToolSchema.parse(params.arguments);
      
      if (!this.agent) {
        const token = await this.tokenManager.getValidToken();
        const tools = this.playwrightClient.getAvailableTools();
        this.agent = new BrowserAutomationAgent(token, tools);
        this.agent.setPlaywrightClient(this.playwrightClient);
      }

      const result = await this.agent.executeCommand(args.command, args.context);

      return {
        content: [
          {
            type: 'text',
            text: result.response,
          },
        ],
      };
    } catch (error) {
      if (error instanceof Error && error.message.includes('Authentication required')) {
        return {
          content: [
            {
              type: 'text',
              text: 'Authentication required. Please run the server with --auth flag to authenticate with Claude.',
            },
          ],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: 'text',
            text: `Error: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }

  async start(): Promise<void> {
    logger.info('Starting Playwright AI MCP server...');
    
    try {
      await this.playwrightClient.connect();
      
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      
      logger.info('Playwright AI MCP server started successfully');
    } catch (error) {
      logger.error('Failed to start server:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    await this.playwrightClient.disconnect();
    await this.server.close();
  }

  getPlaywrightClient(): PlaywrightMCPClient {
    return this.playwrightClient;
  }
}