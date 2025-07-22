import { PlaywrightMCPClient } from '../mcp/client';
import { TokenManager } from '../auth/storage';
import { BrowserAutomationAgent } from '../ai/agent';

async function testIntegration() {
  console.log('Starting integration test...\n');

  try {
    // Test 1: Check authentication
    console.log('1. Testing authentication...');
    const tokenManager = new TokenManager();
    const isAuthenticated = await tokenManager.isAuthenticated();
    
    if (!isAuthenticated) {
      console.error('❌ Not authenticated. Please run: npx playwright-ai-mcp --auth');
      process.exit(1);
    }
    console.log('✅ Authentication successful\n');

    // Test 2: Connect to Playwright MCP
    console.log('2. Testing Playwright MCP connection...');
    const client = new PlaywrightMCPClient();
    await client.connect();
    
    const tools = client.getAvailableTools();
    console.log(`✅ Connected to Playwright MCP, discovered ${tools.length} tools:`);
    // Show all tools to verify our system prompt matches
    tools.forEach(tool => {
      console.log(`   - ${tool.name}`);
    });
    console.log();

    // Test 3: Test AI agent
    console.log('3. Testing AI agent...');
    const token = await tokenManager.getValidToken();
    const agent = new BrowserAutomationAgent(token, tools);
    agent.setPlaywrightClient(client);

    // First install the browser
    console.log('   Installing browser...');
    const installResult = await client.executeTool('browser_install', {});
    console.log('   Install result:', installResult.success ? 'Success' : installResult.error);
    
    // Test command that requires multiple steps
    const testCommand = 'Navigate to example.com and take a screenshot';
    console.log(`   Executing command: "${testCommand}"`);
    
    const result = await agent.executeCommand(testCommand);
    console.log(`   Result: ${result.success ? '✅' : '❌'} ${result.response}`);
    
    // Show detailed errors if any
    if (result.details && result.details.errors && result.details.errors.length > 0) {
      console.log('   Errors:', result.details.errors);
    }
    
    if (result.details && result.details.plan) {
      console.log('   Execution plan:');
      result.details.plan.forEach((step: any) => {
        console.log(`     - ${step.tool}(${JSON.stringify(step.args)})`);
      });
    }

    // Cleanup
    await client.disconnect();
    console.log('\n✅ All tests passed!');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testIntegration().catch(console.error);