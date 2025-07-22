const { startBrowserAgent } = require('magnitude-core');
const { z } = require('zod');

async function runBlogTests() {
  const agent = await startBrowserAgent({
    url: 'http://localhost:8080',
    narrate: true,
    browser: {
      launchOptions: { headless: true },
      contextOptions: { viewport: { width: 1280, height: 720 } }
    }
  });

  try {
    // Check authentication
    const isLoggedIn = await agent.extract('Check if user is already logged in', z.boolean());

    if (!isLoggedIn) {
      await agent.act('Navigate to login page');
      await agent.act('Type email: admin');
      await agent.act('Type password: password');
      await agent.act('Click login button');
    }

    // Test 1: Verify header title on homepage
    await agent.act('Navigate to the homepage');
    const headerTitle = await agent.extract(
      'Get the header title text',
      z.string().includes('My Awesome Blog')
    );

    // Test 2: Verify header title remains correct when switching themes
    const initialTitle = await agent.extract(
      'Get the header title text in light theme',
      z.string().includes('My Awesome Blog')
    );

    await agent.act('Click the theme toggle button');
    
    const darkThemeTitle = await agent.extract(
      'Get the header title text in dark theme',
      z.string().includes('My Awesome Blog')
    );

    console.log('All blog header tests completed successfully');

  } catch (error) {
    console.error('Test execution error:', error);
    throw error;
  } finally {
    await agent.stop();
  }
}

runBlogTests().catch(error => {
  console.error('Blog test suite failed:', error);
  process.exit(1);
});