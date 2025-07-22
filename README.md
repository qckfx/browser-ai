# Browser AI MCP Server

[![smithery badge](https://smithery.ai/badge/@qckfx/browser-ai)](https://smithery.ai/server/@qckfx/browser-ai)

An AI-powered MCP (Model Context Protocol) server that provides a natural language interface to browser automation. This server acts as an intelligent wrapper around the official Playwright MCP server, allowing you to control browsers using plain English commands through Claude.

## Features

- **Natural Language Browser Control**: Execute browser automation tasks using plain English commands
- **Claude Integration**: Leverages Claude's AI capabilities through OAuth (using your Claude Code subscription)
- **Intelligent Tool Mapping**: AI automatically translates your commands into appropriate Playwright tool calls
- **Session Management**: Maintain context across multiple browser automation commands
- **Error Recovery**: Smart error handling with helpful feedback

## Installation

### Installing via Smithery

To install Browser AI for Claude Desktop automatically via [Smithery](https://smithery.ai/server/@qckfx/browser-ai):

```bash
npx -y @smithery/cli install @qckfx/browser-ai --client claude
```

### Manual Installation
```bash
npm install -g @qckfx/browser-ai
```

Or use directly with npx:

```bash
npx @qckfx/browser-ai
```

## Setup

### 1. Authentication

The Browser AI MCP server requires Anthropic API access. You have two authentication options:

#### Option 1: OAuth Authentication (Recommended for Claude Subscribers)
If you have a Claude subscription, authenticate with your Claude account to use your subscription credits:

```bash
npx @qckfx/browser-ai --auth
```

This will open a browser window for OAuth authentication. After authorizing, the token will be saved securely and your API usage will be charged to your Claude subscription rather than requiring separate API credits.

#### Option 2: API Key Authentication
Alternatively, you can use an Anthropic API key by setting the environment variable:

```bash
export ANTHROPIC_API_KEY="your-api-key-here"
```

### 2. Configure with Claude Code

After authentication, add the server to Claude Code:

```bash
claude mcp add browser-ai -- npx --yes @qckfx/browser-ai@latest
```

If using API key authentication, you can pass it as an environment variable:

```bash
claude mcp add browser-ai --env ANTHROPIC_API_KEY="your-api-key-here" -- npx --yes @qckfx/browser-ai@latest
```

### 3. Configure Claude Desktop (Alternative)

If using Claude Desktop instead, add the following to your Claude Desktop configuration file (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "browser-ai": {
      "command": "npx",
      "args": ["@qckfx/browser-ai"],
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
browser-ai/
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
cd browser-ai
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
npx browser-ai --debug
```

## Architecture

```
User Command → Claude → Browser AI MCP → AI Agent → Playwright MCP → Browser
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

1. Run `npx browser-ai --auth` to re-authenticate
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
