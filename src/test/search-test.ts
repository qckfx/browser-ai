#!/usr/bin/env node

/**
 * Test: Google Search Result Extraction
 * 
 * This test verifies that the browser automation agent can:
 * 1. Navigate to Google
 * 2. Perform a search
 * 3. Extract and report the first search result
 */

import { PlaywrightAIMCPServer } from '../mcp/server';
import { TokenManager } from '../auth/storage';

async function runSearchTest() {
  console.log('🧪 Starting Google Search Test...\n');

  try {
    // Check authentication
    const tokenManager = new TokenManager();
    const isAuthenticated = await tokenManager.isAuthenticated();
    
    if (!isAuthenticated) {
      console.error('❌ Not authenticated. Please run with --auth flag first.');
      process.exit(1);
    }

    // Initialize server
    const server = new PlaywrightAIMCPServer();
    
    // Test command
    const testCommand = 'Search for "qckfx" on Google and tell me what the first search result is';
    console.log(`📝 Test Command: "${testCommand}"\n`);

    // Simulate MCP tool call
    const toolCallRequest = {
      params: {
        name: 'execute',
        arguments: {
          command: testCommand,
          context: {}
        }
      }
    };

    console.log('🚀 Executing browser automation...\n');
    
    // Start server (this connects to Playwright MCP)
    await server.start();
    
    // Execute the command
    const result = await server['handleToolCall'](toolCallRequest);
    
    console.log('📊 Results:\n');
    console.log('Response:', result.content[0].text);
    
    if (result.isError) {
      console.error('\n❌ Test failed with error');
    } else {
      console.log('\n✅ Test completed successfully');
    }

    // Clean up
    await server.stop();

  } catch (error) {
    console.error('❌ Test error:', error);
    process.exit(1);
  }
}

// Run the test
runSearchTest().catch(console.error);