import { Tool } from '../mcp/types';
import { z } from 'zod';

export interface ToolCall {
  tool: string;
  args: any;
}

export interface ToolPlan {
  steps: ToolCall[];
  explanation: string;
}

export interface ExecutionResult {
  success: boolean;
  results: any[];
  errors: string[];
}

export class ToolMapper {
  private tools: Map<string, Tool>;

  constructor(tools: Tool[]) {
    this.tools = new Map(tools.map(t => [t.name, t]));
  }

  getToolsDescription(): string {
    const descriptions = Array.from(this.tools.values())
      .map(tool => `- ${tool.name}: ${tool.description}`)
      .join('\n');
    return descriptions;
  }

  validateToolCall(toolCall: ToolCall): boolean {
    const tool = this.tools.get(toolCall.tool);
    if (!tool) {
      return false;
    }

    try {
      if (tool.inputSchema && typeof tool.inputSchema === 'object') {
        const schema = z.object(tool.inputSchema as any);
        schema.parse(toolCall.args);
      }
      return true;
    } catch {
      return false;
    }
  }

  getToolSchema(toolName: string): any {
    const tool = this.tools.get(toolName);
    return tool?.inputSchema || {};
  }

  parseAIResponse(response: string): ToolPlan {
    const steps: ToolCall[] = [];
    let explanation = 'Executing browser automation task';

    // Log the raw response for debugging
    console.log('[DEBUG] Raw AI response to parse:', response);

    // First, try to parse the entire response as JSON array
    try {
      const parsed = JSON.parse(response.trim());
      if (Array.isArray(parsed)) {
        parsed.forEach(item => {
          if (item.tool && item.args !== undefined) {
            steps.push(item);
          }
        });
        if (steps.length > 0) {
          return { steps, explanation };
        }
      }
    } catch (e) {
      console.log('[DEBUG] Direct JSON parse failed:', e);
    }

    // Try to extract JSON array from the response
    // Look for array patterns like [...] 
    const arrayMatch = response.match(/\[\s*\{[\s\S]*?\}\s*\]/);
    if (arrayMatch) {
      try {
        const parsed = JSON.parse(arrayMatch[0]);
        if (Array.isArray(parsed)) {
          parsed.forEach(item => {
            if (item.tool && item.args !== undefined) {
              steps.push(item);
            }
          });
          if (steps.length > 0) {
            return { steps, explanation };
          }
        }
      } catch (e) {
        console.log('[DEBUG] Array extraction parse failed:', e);
      }
    }

    // Try to parse JSON from markdown code blocks
    const codeBlockMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      try {
        const parsed = JSON.parse(codeBlockMatch[1].trim());
        if (Array.isArray(parsed)) {
          parsed.forEach(item => {
            if (item.tool && item.args !== undefined) {
              steps.push(item);
            }
          });
          if (steps.length > 0) {
            return { steps, explanation };
          }
        }
      } catch (e) {
        console.log('[DEBUG] Code block parse failed:', e);
      }
    }

    // Fallback: try to find individual tool calls in JSON format
    const toolCallMatches = response.matchAll(/\{"tool":\s*"([^"]+)",\s*"args":\s*(\{[^}]*\})\}/g);
    for (const match of toolCallMatches) {
      try {
        const tool = match[1];
        const args = JSON.parse(match[2]);
        steps.push({ tool, args });
      } catch (e) {
        console.log('[DEBUG] Individual tool call parse failed:', e);
      }
    }

    // Last resort: function call syntax parsing
    if (steps.length === 0) {
      const functionCallRegex = /(\w+)\((.*?)\)/g;
      let match;
      while ((match = functionCallRegex.exec(response)) !== null) {
        const [, tool, argsStr] = match;
        try {
          const args = argsStr ? JSON.parse(argsStr) : {};
          steps.push({ tool, args });
        } catch {
          steps.push({ tool, args: {} });
        }
      }
    }

    console.log('[DEBUG] Final parsed steps:', steps);

    return {
      steps,
      explanation,
    };
  }

  isInternalTool(toolName: string): boolean {
    // Check if this is an internal tool (not a Playwright tool)
    return toolName === 'todo_write';
  }

  getToolsForExternalUse(): string {
    // Return descriptions of only Playwright tools (exclude internal tools)
    const descriptions = Array.from(this.tools.values())
      .filter(tool => !this.isInternalTool(tool.name))
      .map(tool => `- ${tool.name}: ${tool.description}`)
      .join('\n');
    return descriptions;
  }
}