import { PlaywrightMCPClient } from '../mcp/client';
import { TokenManager } from '../auth/storage';
import { BrowserAutomationAgent } from '../ai/agent';
import { logger } from '../utils/logger';

interface TestCase {
  name: string;
  command: string;
  expectedTools?: string[];
}

const testCases: TestCase[] = [
  {
    name: 'Basic Navigation',
    command: 'Go to https://www.google.com',
    expectedTools: ['browser_navigate']
  },
  {
    name: 'Form Interaction',
    command: 'Go to google.com, type "playwright testing" in the search box and click the search button',
    expectedTools: ['browser_navigate', 'browser_type', 'browser_click']
  },
  {
    name: 'Screenshot with Specific Size',
    command: 'Navigate to https://example.com and take a full page screenshot',
    expectedTools: ['browser_navigate', 'browser_take_screenshot']
  },
  {
    name: 'Complex Multi-Step Task',
    command: 'Go to https://example.com, wait for the page to load completely, take a snapshot of the page structure, then take a screenshot',
    expectedTools: ['browser_navigate', 'browser_wait_for', 'browser_snapshot', 'browser_take_screenshot']
  },
  {
    name: 'Browser Tab Management',
    command: 'Open a new tab, navigate to google.com in the new tab, then list all open tabs',
    expectedTools: ['browser_tab_new', 'browser_navigate', 'browser_tab_list']
  },
  {
    name: 'Page Content Extraction',
    command: 'Go to example.com and get a snapshot of the page content to see what text is available',
    expectedTools: ['browser_navigate', 'browser_snapshot']
  },
  {
    name: 'Console Messages',
    command: 'Navigate to a page and check if there are any console errors or warnings',
    expectedTools: ['browser_navigate', 'browser_console_messages']
  },
  {
    name: 'Element Interaction',
    command: 'Go to example.com and hover over the "More information" link',
    expectedTools: ['browser_navigate', 'browser_hover']
  },
  {
    name: 'Window Resize',
    command: 'Resize the browser window to mobile size (375x667)',
    expectedTools: ['browser_resize']
  },
  {
    name: 'JavaScript Execution',
    command: 'Execute JavaScript to get the page title',
    expectedTools: ['browser_evaluate']
  }
];

async function runComprehensiveTest() {
  console.log('🧪 Starting Comprehensive Playwright AI MCP Test Suite\n');

  try {
    // Check authentication
    console.log('📋 Checking authentication...');
    const tokenManager = new TokenManager();
    const isAuthenticated = await tokenManager.isAuthenticated();
    
    if (!isAuthenticated) {
      console.error('❌ Not authenticated. Please run: npx playwright-ai-mcp --auth');
      process.exit(1);
    }
    console.log('✅ Authentication successful\n');

    // Connect to Playwright MCP
    console.log('🔌 Connecting to Playwright MCP...');
    const client = new PlaywrightMCPClient();
    await client.connect();
    
    const tools = client.getAvailableTools();
    console.log(`✅ Connected to Playwright MCP with ${tools.length} tools\n`);

    // Initialize AI agent
    const token = await tokenManager.getValidToken();
    const agent = new BrowserAutomationAgent(token, tools);
    agent.setPlaywrightClient(client);

    // Install browser first
    console.log('🌐 Installing browser...');
    const installResult = await client.executeTool('browser_install', {});
    console.log(`✅ Browser installation: ${installResult.success ? 'Success' : installResult.error}\n`);

    // Run test cases
    console.log('🚀 Running test cases...\n');
    const results = [];

    for (const testCase of testCases) {
      console.log(`📌 Test: ${testCase.name}`);
      console.log(`   Command: "${testCase.command}"`);
      
      try {
        const startTime = Date.now();
        const result = await agent.executeCommand(testCase.command);
        const duration = Date.now() - startTime;
        
        console.log(`   Status: ${result.success ? '✅ Success' : '❌ Failed'}`);
        console.log(`   Duration: ${duration}ms`);
        
        if (result.success) {
          console.log(`   Response: ${result.response}`);
        } else {
          console.log(`   Error: ${result.response}`);
        }
        
        // Show execution plan
        if (result.details?.plan) {
          console.log('   Execution plan:');
          result.details.plan.forEach((step: any) => {
            console.log(`     - ${step.tool}(${JSON.stringify(step.args)})`);
          });
        }
        
        // Check if expected tools were used
        if (testCase.expectedTools && result.details?.plan) {
          const usedTools = result.details.plan.map((step: any) => step.tool);
          const missingTools = testCase.expectedTools.filter(tool => !usedTools.includes(tool));
          if (missingTools.length > 0) {
            console.log(`   ⚠️  Expected tools not used: ${missingTools.join(', ')}`);
          }
        }
        
        results.push({
          name: testCase.name,
          success: result.success,
          duration,
          tools: result.details?.plan?.map((s: any) => s.tool) || []
        });
        
      } catch (error) {
        console.log(`   Status: ❌ Error`);
        console.log(`   Error: ${error instanceof Error ? error.message : String(error)}`);
        results.push({
          name: testCase.name,
          success: false,
          duration: 0,
          tools: []
        });
      }
      
      console.log(''); // Empty line between tests
    }

    // Summary
    console.log('\n📊 Test Summary:');
    console.log('================');
    const successCount = results.filter(r => r.success).length;
    console.log(`Total tests: ${results.length}`);
    console.log(`Passed: ${successCount}`);
    console.log(`Failed: ${results.length - successCount}`);
    console.log(`Success rate: ${((successCount / results.length) * 100).toFixed(1)}%`);
    
    console.log('\n📈 Performance Summary:');
    const successfulResults = results.filter(r => r.success && r.duration > 0);
    if (successfulResults.length > 0) {
      const avgDuration = successfulResults.reduce((sum, r) => sum + r.duration, 0) / successfulResults.length;
      console.log(`Average execution time: ${avgDuration.toFixed(0)}ms`);
    }
    
    console.log('\n🔧 Most Used Tools:');
    const toolUsage = new Map<string, number>();
    results.forEach(r => {
      r.tools.forEach((tool: string) => {
        toolUsage.set(tool, (toolUsage.get(tool) || 0) + 1);
      });
    });
    const sortedTools = Array.from(toolUsage.entries()).sort((a, b) => b[1] - a[1]);
    sortedTools.slice(0, 5).forEach(([tool, count]: [string, number]) => {
      console.log(`   ${tool}: ${count} times`);
    });

    // Cleanup
    await client.disconnect();
    console.log('\n✨ Test suite completed!');
    
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// Run the test
runComprehensiveTest().catch(console.error);