const { startBrowserAgent } = require('magnitude-core');
require('dotenv').config();

async function checkBorderStyles() {
  const agent = await startBrowserAgent({
    url: 'http://localhost:8080',
    narrate: true,
    browser: {
      launchOptions: { headless: true }
    }
  });

  try {
    // Smart login check
    const isLoggedIn = await agent.extract('Check if user is already logged in');
    
    if (!isLoggedIn) {
      await agent.act('Navigate to login page');
      await agent.act('Type email: admin');
      await agent.act('Type password: password');
      await agent.act('Click login button');
      await agent.extract('Verify successful login');
    }

    // Test 1: Check border styling on desktop
    await agent.act('Navigate to blog listing page');
    const desktopBorderStyle = await agent.extract('Get first blog post card border style');
    await agent.verify('Border style should be "2px solid #007acc"', 
      desktopBorderStyle === '2px solid rgb(0, 122, 204)');

    // Test 2: Check border styling on different viewport sizes
    const viewports = [
      { width: 375, height: 667 },  // Mobile
      { width: 768, height: 1024 }, // Tablet
      { width: 1280, height: 720 }  // Desktop
    ];

    for (const viewport of viewports) {
      await agent.act(`Set viewport to ${viewport.width}x${viewport.height}`);
      const borderStyle = await agent.extract('Get first blog post card border style');
      await agent.verify(`Border style should remain consistent at ${viewport.width}px width`,
        borderStyle === '2px solid rgb(0, 122, 204)');
    }

  } finally {
    await agent.stop();
  }
}

checkBorderStyles().catch(error => {
  console.error('Border style test suite failed:', error);
  process.exit(1);
});

module.exports = { checkBorderStyles };