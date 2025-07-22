import { generateText } from 'ai';
import { createClaudeModel } from '../provider/anthropic-oauth';
import { Tool } from '../mcp/types';
import { PlaywrightMCPClient } from '../mcp/client';
import { createSystemPrompt, createToolSelectionPrompt } from './prompts';
import { ToolMapper, ToolPlan, ExecutionResult } from './tools';
import { TodoManager, TodoWriteTool, TodoWriteParamsSchema, Todo } from './todo-tool';

export interface CommandResult {
  success: boolean;
  response: string;
  details?: any;
}

export class BrowserAutomationAgent {
  private model: any;
  private toolMapper: ToolMapper;
  private systemPrompt: string;
  private playwrightClient: PlaywrightMCPClient | null = null;
  private todoManager: TodoManager;

  constructor(accessToken: string, availableTools: Tool[]) {
    this.model = createClaudeModel(accessToken);
    
    // Add TodoWrite as an internal tool alongside Playwright tools
    const allTools = [...availableTools, TodoWriteTool];
    this.toolMapper = new ToolMapper(allTools);
    
    this.systemPrompt = createSystemPrompt(this.toolMapper.getToolsDescription());
    this.todoManager = new TodoManager();
  }

  setPlaywrightClient(client: PlaywrightMCPClient): void {
    this.playwrightClient = client;
  }

  async executeCommand(command: string, context?: any): Promise<CommandResult> {
    try {
      const messages: any[] = [
        {
          role: 'system',
          content: 'You are Claude Code, Anthropic\'s official CLI for Claude.'
        },
        {
          role: 'system',
          content: this.systemPrompt
        },
        {
          role: 'user',
          content: createToolSelectionPrompt(command, context)
        }
      ];

      const executedTools: any[] = [];
      const errors: string[] = [];
      let finalResponse = '';
      const maxIterations = 30;

      // Continue conversation until AI returns text instead of tools
      for (let i = 0; i < maxIterations; i++) {
        const { text } = await generateText({
          model: this.model,
          messages,
          temperature: 0.3,
          maxTokens: 1000,
        });

        console.log(`[DEBUG] Iteration ${i + 1} AI Response:`, text);

        // Try to parse as tool calls
        try {
          const plan = this.toolMapper.parseAIResponse(text);
          
          if (plan.steps.length === 0) {
            // AI returned text instead of tools - we're done!
            finalResponse = text;
            break;
          }

          // Execute the tools and collect results
          const toolResults: string[] = [];
          
          for (const step of plan.steps) {
            try {
              let result;
              
              if (step.tool === 'todo_write') {
                result = await this.executeInternalTool(step.tool, step.args);
              } else {
                if (!this.playwrightClient) {
                  throw new Error('Playwright client not initialized');
                }
                result = await this.playwrightClient.executeTool(step.tool, step.args);
              }
              
              executedTools.push({
                tool: step.tool,
                args: step.args,
                result: result.success ? result.result : result.error
              });

              if (result.success) {
                // Include actual result data for browser_snapshot
                if (step.tool === 'browser_snapshot' && result.result?.content) {
                  // Include full snapshot content so AI can extract information
                  toolResults.push(`${step.tool}: Success\nContent:\n${result.result.content}`);
                } else {
                  toolResults.push(`${step.tool}: Success${result.result ? '\nResult: ' + JSON.stringify(result.result) : ''}`);
                }
              } else {
                const error = `${step.tool}: ${result.error}`;
                toolResults.push(error);
                errors.push(error);
              }
            } catch (error) {
              const errorMsg = `${step.tool}: ${error instanceof Error ? error.message : String(error)}`;
              toolResults.push(errorMsg);
              errors.push(errorMsg);
            }
          }

          // Add assistant message with tool results
          messages.push({
            role: 'assistant',
            content: text
          });

          // Add user message with tool results
          messages.push({
            role: 'user',
            content: `Tool execution results:\n${toolResults.join('\n')}\n\nContinue with the task. If you have gathered all necessary information, provide a final response to the user about what was accomplished.`
          });

        } catch (parseError) {
          // Not valid JSON/tools - treat as final response
          finalResponse = text;
          break;
        }
      }

      if (!finalResponse) {
        finalResponse = 'I completed the browser automation task but reached the maximum number of steps. ' + 
                       (errors.length > 0 ? `Some errors occurred: ${errors.join(', ')}` : 'All steps executed successfully.');
      }

      return {
        success: errors.length === 0,
        response: finalResponse,
        details: {
          executedTools,
          errors
        }
      };
    } catch (error) {
      return {
        success: false,
        response: `An error occurred: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }


  private async executeInternalTool(toolName: string, args: any): Promise<{ success: boolean; result?: any; error?: string }> {
    try {
      switch (toolName) {
        case 'todo_write':
          const params = TodoWriteParamsSchema.parse(args);
          this.todoManager.setTodos(params.todos);
          return { 
            success: true, 
            result: { 
              message: 'Todo list updated',
              todoCount: params.todos.length 
            } 
          };
        default:
          return { 
            success: false, 
            error: `Unknown internal tool: ${toolName}` 
          };
      }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      };
    }
  }

}