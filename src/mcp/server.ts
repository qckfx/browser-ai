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
        name: 'browser-ai-mcp',
        version: '0.1.1',
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
          name: 'execute',
          description: 'Execute browser automation tasks using natural language commands. This tool interprets your intent and translates it into appropriate browser actions.',
          inputSchema: {
            type: 'object',
            properties: {
              command: {
                type: 'string',
                description: 'Natural language description of the browser task to perform',
              },
              context: {
                type: 'object',
                properties: {
                  url: {
                    type: 'string',
                    description: 'Current URL or target URL for the automation',
                  },
                  sessionId: {
                    type: 'string',
                    description: 'Session ID for continuing previous automation',
                  },
                },
                required: [],
              },
            },
            required: ['command'],
          },
        },
      ],
    };
  }

  private async handleToolCall(request: any): Promise<any> {
    const params = request.params;
    if (params.name !== 'execute') {
      throw new Error(`Unknown tool: ${params.name}`);
    }

    try {
      const args = BrowserAIToolSchema.parse(params.arguments);
      
      if (!this.agent) {
        // Check if Playwright client is connected
        const tools = this.playwrightClient.getAvailableTools();
        if (tools.length === 0) {
          throw new Error('Playwright MCP server is not connected. Please ensure @playwright/mcp is installed.');
        }
        
        const token = await this.tokenManager.getValidToken();
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
        const authError = 'Authentication required. Please either:\n' +
                         '1. Run "npx @qckfx/browser-ai@latest --auth" to authenticate with your Claude account\n' +
                         '2. Set the ANTHROPIC_API_KEY environment variable\n\n' +
                         'For Claude subscribers, option 1 is recommended as usage will be charged to your subscription.';
        
        // Also log to stderr for visibility
        process.stderr.write(`[Browser AI MCP] ${authError}\n`);
        
        return {
          content: [
            {
              type: 'text',
              text: authError,
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
    logger.info('Starting Browser AI MCP server...');
    
    try {
      // Set up the transport
      const transport = new StdioServerTransport();
      
      // Connect the MCP server first to ensure we can handle requests
      await this.server.connect(transport);
      logger.info('MCP server connected');
      
      // Try to connect to Playwright MCP server, but don't fail if it doesn't work
      try {
        logger.info('Connecting to Playwright MCP server...');
        await this.playwrightClient.connect();
        logger.info('Connected to Playwright MCP server');
        
        const tools = this.playwrightClient.getAvailableTools();
        logger.info(`Discovered ${tools.length} tools from Playwright MCP`);
      } catch (playwrightError) {
        logger.warn('Failed to connect to Playwright MCP server:', playwrightError);
        // Continue anyway - errors will be reported when tools are used
      }
      
      logger.info('Browser AI MCP server started successfully');
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