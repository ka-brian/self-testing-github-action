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
    // Test 1: Verify header shows "My Awesome Blog"
    console.log('Test 1: Checking header text');
    await agent.act('Navigate to the homepage');
    const headerText = await agent.extract(
      'Get the text content of the main header',
      z.string()
    );
    if (headerText !== 'My Awesome Blog') {
      throw new Error(`Header text "${headerText}" does not match "My Awesome Blog"`);
    }

    // Test 2: Verify header remains correct after refresh
    console.log('Test 2: Checking header after refresh');
    await agent.act('Refresh the page');
    const headerTextAfterRefresh = await agent.extract(
      'Get the text content of the main header',
      z.string()
    );
    if (headerTextAfterRefresh !== 'My Awesome Blog') {
      throw new Error(`Header text "${headerTextAfterRefresh}" does not match "My Awesome Blog" after refresh`);
    }

    console.log('All tests completed successfully');
  } finally {
    await agent.stop();
  }
}

runTests().catch(error => {
  console.error('Test suite failed:', error);
  process.exit(1);
});