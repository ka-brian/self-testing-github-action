const { startBrowserAgent } = require('magnitude-core');
const { z } = require('zod');
require('dotenv').config();

// Ensure ANTHROPIC_API_KEY is available
if (!process.env.ANTHROPIC_API_KEY && process.env.CLAUDE_API_KEY) {
  process.env.ANTHROPIC_API_KEY = process.env.CLAUDE_API_KEY;
}

async function runTests() {
  const agent = await startBrowserAgent({
    url: 'http://localhost:8080',
    narrate: true,
    llm: {
      provider: 'anthropic',
      options: {
        model: 'claude-sonnet-4-20250514',
        apiKey: process.env.ANTHROPIC_API_KEY
      }
    },
    browser: {
      launchOptions: { headless: true },
      contextOptions: { viewport: { width: 1280, height: 720 } }
    }
  });

  try {
    // Smart login check
    const isLoggedIn = await agent.extract('Check if user is already logged in', z.boolean());
    
    if (!isLoggedIn) {
      await agent.act('Navigate to login page');
      await agent.act('Type email: admin');
      await agent.act('Type password: password');
      await agent.act('Click login button');
    }

    // Test 1: Verify header shows "My Awesome Blog"
    console.log('Test 1: Verifying header title');
    await agent.act('Navigate to the homepage');
    const headerTitle = await agent.extract('Get the main header title text', z.string());
    
    if (headerTitle !== 'My Awesome Blog') {
      throw new Error(`Header title "${headerTitle}" does not match expected "My Awesome Blog"`);
    }
    console.log('Test 1 passed: Header shows correct title');

    // Test 2: Verify header remains correct after refresh
    console.log('Test 2: Verifying header after page refresh');
    await agent.act('Refresh the page');
    const headerTitleAfterRefresh = await agent.extract('Get the main header title text', z.string());
    
    if (headerTitleAfterRefresh !== 'My Awesome Blog') {
      throw new Error(`Header title "${headerTitleAfterRefresh}" does not match expected "My Awesome Blog" after refresh`);
    }
    console.log('Test 2 passed: Header shows correct title after refresh');

    console.log('All tests completed successfully');
  } finally {
    await agent.stop();
  }
}

runTests().catch(error => {
  console.error('Test suite failed:', error);
  process.exit(1);
});