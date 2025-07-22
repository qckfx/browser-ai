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

  const tokenManager = new TokenManager();
  const isAuthenticated = await tokenManager.isAuthenticated();
  
  if (!isAuthenticated) {
    console.error('Authentication required. You have two options:');
    console.error('1. Run with --auth flag to authenticate with your Claude account (recommended for Claude subscribers)');
    console.error('2. Set the ANTHROPIC_API_KEY environment variable');
    console.error('\nFor Claude subscribers, option 1 is recommended as usage will be charged to your subscription rather than API costs.');
    process.exit(1);
  }

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
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});