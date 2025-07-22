# Playwright AI MCP Server

An AI-powered MCP (Model Context Protocol) server that provides a natural language interface to Playwright browser automation. This server acts as an intelligent wrapper around the official Playwright MCP server, allowing you to control browsers using plain English commands through Claude.

## Features

- **Natural Language Browser Control**: Execute browser automation tasks using plain English commands
- **Claude Integration**: Leverages Claude's AI capabilities through OAuth (using your Claude Code subscription)
- **Intelligent Tool Mapping**: AI automatically translates your commands into appropriate Playwright tool calls
- **Session Management**: Maintain context across multiple browser automation commands
- **Error Recovery**: Smart error handling with helpful feedback

## Installation

```bash
npm install -g @playwright/ai-mcp
```

Or use directly with npx:

```bash
npx @playwright/ai-mcp
```

## Setup

### 1. Authentication

First, authenticate with your Claude account:

```bash
npx playwright-ai-mcp --auth
```

This will open a browser window for OAuth authentication. After authorizing, the token will be saved securely.

### 2. Configure Claude Desktop

Add the following to your Claude Desktop configuration file (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "playwright-ai": {
      "command": "npx",
      "args": ["@playwright/ai-mcp"],
      "env": {
        "PLAYWRIGHT_MCP_PATH": "@playwright/mcp@latest"
      }
    }
  }
}
```

## Usage

Once configured, you can use natural language commands in Claude to control browser automation:

### Example Commands

- **Navigation**: "Go to example.com and wait for the page to load"
- **Clicking**: "Click the login button"
- **Form Filling**: "Fill the username field with 'john.doe@example.com'"
- **Screenshots**: "Take a screenshot of the current page"
- **Complex Tasks**: "Fill out the registration form with test data and submit it"

### How It Works

1. You provide a natural language command to Claude
2. The AI interprets your intent and breaks it down into Playwright tool calls
3. The server executes these tools via the Playwright MCP server
4. Results are returned in a user-friendly format

## Development

### Project Structure

```
playwright-ai-mcp/
├── src/
│   ├── auth/          # OAuth authentication
│   ├── mcp/           # MCP server and client
│   ├── ai/            # AI agent and tool mapping
│   ├── provider/      # Custom AI SDK provider
│   └── index.ts       # CLI entry point
```

### Building from Source

```bash
git clone <repository>
cd playwright-ai-mcp
npm install
npm run build
```

### Testing

Run the integration test:

```bash
npm test
```

### Debug Mode

Enable debug logging:

```bash
npx playwright-ai-mcp --debug
```

## Architecture

```
User Command → Claude → Playwright AI MCP → AI Agent → Playwright MCP → Browser
                              ↓
                        Claude (via OAuth)
```

The server exposes a single `browser_ai` tool that accepts natural language commands. It then:

1. Uses Claude to interpret the command
2. Generates a sequence of Playwright tool calls
3. Executes them via the Playwright MCP client
4. Returns a human-friendly summary

## Troubleshooting

### Authentication Issues

If you encounter authentication errors:

1. Run `npx playwright-ai-mcp --auth` to re-authenticate
2. Ensure you have an active Claude Code subscription
3. Check that the token hasn't expired

### Connection Issues

If the server fails to connect to Playwright MCP:

1. Ensure Playwright MCP is installed: `npm install -g @playwright/mcp`
2. Check the `PLAYWRIGHT_MCP_PATH` environment variable
3. Enable debug mode to see detailed logs

### Tool Execution Errors

If commands fail to execute:

1. Ensure the browser is in the expected state
2. Try breaking complex commands into simpler steps
3. Check the debug logs for specific error messages

## Requirements

- Node.js 18 or higher
- Active Claude Code subscription
- Playwright MCP server

## License

MIT

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

## Support

For issues and feature requests, please use the GitHub issue tracker.