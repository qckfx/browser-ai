#!/usr/bin/env node

import { Command } from 'commander';
import { PlaywrightAIMCPServer } from './mcp/server';
import { AnthropicOAuth } from './auth/anthropic';
import { TokenManager } from './auth/storage';
import open from 'open';
import * as readline from 'readline';

const program = new Command()
  .name('playwright-ai-mcp')
  .version('0.1.0')
  .description('AI-powered MCP server for Playwright browser automation')
  .option('--auth', 'Run authentication flow')
  .option('--playwright-path <path>', 'Path to Playwright MCP executable', '@playwright/mcp@latest')
  .option('--debug', 'Enable debug logging')
  .parse(process.argv);

const options = program.opts();

async function runAuthFlow(): Promise<void> {
  console.log('Starting authentication flow...');
  
  const oauth = new AnthropicOAuth();
  const authUrl = oauth.getAuthorizationUrl();
  
  console.log(`\nOpening browser for authentication...`);
  console.log(`If the browser doesn't open, visit: ${authUrl}`);
  console.log(`\nAfter authorizing, the page will display a code to paste into Claude Code.`);
  console.log(`The code will look like: YOUR_CODE#YOUR_STATE`);
  console.log(`\nCopy and paste the entire code (including the # and everything after it):`);
  
  // Open the browser
  await open(authUrl);
  
  // Set up readline for proper input handling
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true
  });
  
  // Enable raw mode to show the prompt
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(false);
  }
  
  const code = await new Promise<string>((resolve, reject) => {
    rl.question('Code: ', (answer) => {
      rl.close();
      if (answer.trim()) {
        resolve(answer.trim());
      } else {
        reject(new Error('No code provided'));
      }
    });
  });
  
  try {
    console.log('\nExchanging code for token...');
    await oauth.exchangeCodeForToken(code);
    console.log('Authentication successful! Token saved.');
  } catch (error) {
    console.error('Authentication failed:', error);
    process.exit(1);
  }
}

async function main() {
  if (options.debug) {
    process.env.DEBUG = 'true';
  }

  if (options.auth) {
    await runAuthFlow();
    return;
  }

  // Don't check authentication here - let the server start
  // Authentication errors will be reported when tools are used

  if (options.playwrightPath) {
    process.env.PLAYWRIGHT_MCP_PATH = options.playwrightPath;
  }

  const server = new PlaywrightAIMCPServer();
  
  process.on('SIGINT', async () => {
    console.log('\nShutting down...');
    await server.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await server.stop();
    process.exit(0);
  });

  try {
    await server.start();
  } catch (error) {
    process.stderr.write(`Failed to start server: ${error instanceof Error ? error.message : String(error)}\n`);
    if (error instanceof Error && error.stack) {
      process.stderr.write(`Stack trace:\n${error.stack}\n`);
    }
    process.exit(1);
  }
}

main().catch((error) => {
  process.stderr.write(`Fatal error: ${error instanceof Error ? error.message : String(error)}\n`);
  if (error instanceof Error && error.stack) {
    process.stderr.write(`Stack trace:\n${error.stack}\n`);
  }
  process.exit(1);
});