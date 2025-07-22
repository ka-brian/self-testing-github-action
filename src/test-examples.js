const TEST_EXAMPLE = `
      async function runTests() {
        const agent = await startBrowserAgent({
          url: process.env.PREVIEW_URL,
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
            contextOptions: { viewport: { width: 1280, height: 720 } 
          }
        });

        try {
          console.log('Test: Loading dashboard');
          await agent.act('Navigate to the dashboard page');
          const heading = await agent.extract('Get the main dashboard heading text', z.string());
          console.log('Dashboard heading:', heading);

          console.log('Test: User interactions');
          await agent.act('Navigate to the homepage');
          await agent.act('Click on the menu button');
          await agent.act('Wait for the menu to open');

          console.log('All tests completed successfully');
        } finally {
          await agent.stop();
        }
      }

      runTests().catch(error => {
        console.error('Test suite failed:', error);
        process.exit(1);
      });`;

module.exports = { testExample: TEST_EXAMPLE };
