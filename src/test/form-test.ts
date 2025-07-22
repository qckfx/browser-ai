import { PlaywrightMCPClient } from '../mcp/client';
import { TokenManager } from '../auth/storage';
import { BrowserAutomationAgent } from '../ai/agent';

// Set a longer timeout for the entire process
process.on('unhandledRejection', (error) => {
  console.error('Unhandled rejection:', error);
  process.exit(1);
});

async function testFormInteraction() {
  console.log('🧪 Testing Form Interaction with Playwright AI MCP\n');

  try {
    // Check authentication
    const tokenManager = new TokenManager();
    const isAuthenticated = await tokenManager.isAuthenticated();
    
    if (!isAuthenticated) {
      console.error('❌ Not authenticated. Please run: npx playwright-ai-mcp --auth');
      process.exit(1);
    }

    // Connect to Playwright MCP
    const client = new PlaywrightMCPClient();
    await client.connect();
    
    const tools = client.getAvailableTools();
    const token = await tokenManager.getValidToken();
    const agent = new BrowserAutomationAgent(token, tools);
    agent.setPlaywrightClient(client);

    // Install browser
    console.log('Installing browser...');
    await client.executeTool('browser_install', {});

    // Test 1: Simple form search (with improved prompt)
    console.log('\n📝 Test 1: Google Search with proper snapshot');
    const test1 = await agent.executeCommand(
      'Navigate to google.com, take a snapshot to see the search box, then type "Playwright testing" in the search box'
    );
    console.log('Result:', test1.success ? '✅' : '❌', test1.response);
    if (test1.details?.plan) {
      console.log('Plan:', test1.details.plan.map((s: any) => s.tool).join(' → '));
    }

    // Test 2: Console messages check
    console.log('\n📋 Test 2: Check console messages');
    const test2 = await agent.executeCommand(
      'Get the browser console messages to see if there are any errors'
    );
    console.log('Result:', test2.success ? '✅' : '❌', test2.response);

    // Test 3: Complex task with TodoWrite
    console.log('\n📋 Test 3: Complex multi-step task');
    const test3 = await agent.executeCommand(
      'Go to example.com, take a snapshot, hover over the "More information" link, wait 2 seconds, then take a screenshot of the page showing the hover effect'
    );
    console.log('Result:', test3.success ? '✅' : '❌', test3.response);
    if (test3.details?.plan) {
      console.log('Plan:', test3.details.plan.map((s: any) => s.tool).join(' → '));
    }

    // Cleanup
    await client.disconnect();
    console.log('\n✨ Tests completed!');
    
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

testFormInteraction().catch(console.error);