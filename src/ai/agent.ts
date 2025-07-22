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
      const plan = await this.generateToolPlan(command, context);
      
      if (plan.steps.length === 0) {
        return {
          success: false,
          response: 'I couldn\'t determine how to execute that command. Please try rephrasing it.',
        };
      }

      const result = await this.executePlan(plan);
      
      const response = await this.generateResponse(command, plan, result);
      
      return {
        success: result.success,
        response,
        details: {
          plan: plan.steps,
          results: result.results,
          errors: result.errors,
        },
      };
    } catch (error) {
      return {
        success: false,
        response: `An error occurred: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  private async generateToolPlan(command: string, context?: any): Promise<ToolPlan> {
    const prompt = createToolSelectionPrompt(command, context);
    
    const { text } = await generateText({
      model: this.model,
      messages: [
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
          content: prompt
        }
      ],
      temperature: 0.3,
      maxTokens: 1000,
    });

    // Always log AI response for debugging
    console.log('[DEBUG] AI Response:', text);

    const plan = this.toolMapper.parseAIResponse(text);
    
    // Log parsing result
    console.log('[DEBUG] Parsed plan:', JSON.stringify(plan, null, 2));
    
    return plan;
  }

  private async executePlan(plan: ToolPlan): Promise<ExecutionResult> {
    const results: any[] = [];
    const errors: string[] = [];
    let success = true;

    for (const step of plan.steps) {
      try {
        // Handle internal tools (like todo_write) differently
        if (step.tool === 'todo_write') {
          const result = await this.executeInternalTool(step.tool, step.args);
          if (result.success) {
            results.push({
              tool: step.tool,
              result: result.result,
            });
          } else {
            errors.push(`${step.tool}: ${result.error}`);
            success = false;
            break;
          }
        } else {
          // Regular Playwright tools
          if (!this.playwrightClient) {
            throw new Error('Playwright client not initialized');
          }
          
          const result = await this.playwrightClient.executeTool(step.tool, step.args);
          
          if (result.success) {
            results.push({
              tool: step.tool,
              result: result.result,
            });
          } else {
            errors.push(`${step.tool}: ${result.error}`);
            success = false;
            break;
          }
        }
      } catch (error) {
        errors.push(`${step.tool}: ${error instanceof Error ? error.message : String(error)}`);
        success = false;
        break;
      }
    }

    return { success, results, errors };
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

  private async generateResponse(
    command: string,
    plan: ToolPlan,
    result: ExecutionResult
  ): Promise<string> {
    const prompt = `
User command: "${command}"

I executed the following plan:
${plan.steps.map(s => `- ${s.tool}(${JSON.stringify(s.args)})`).join('\n')}

Results:
${result.success ? 'All steps completed successfully.' : 'Some steps failed.'}
${result.errors.length > 0 ? `Errors: ${result.errors.join(', ')}` : ''}

Please provide a brief, user-friendly summary of what was accomplished.`;

    const { text } = await generateText({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: 'You are Claude Code, Anthropic\'s official CLI for Claude.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.5,
      maxTokens: 200,
    });

    return text.trim();
  }
}