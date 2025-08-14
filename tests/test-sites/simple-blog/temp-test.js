const { startBrowserAgent } = require("magnitude-core");
const { z } = require("zod");
require("dotenv").config();

// Ensure ANTHROPIC_API_KEY is available
if (!process.env.ANTHROPIC_API_KEY && process.env.CLAUDE_API_KEY) {
  process.env.ANTHROPIC_API_KEY = process.env.CLAUDE_API_KEY;
}

async function runTests() {
  const agent = await startBrowserAgent({
    url: "http://localhost:8080",
    narrate: true,
    llm: {
      provider: "anthropic",
      options: {
        model: "claude-sonnet-4-20250514",
        apiKey: process.env.ANTHROPIC_API_KEY,
      },
    },
    browser: {
      launchOptions: { headless: false },
      contextOptions: { viewport: { width: 1280, height: 720 } },
    },
  });

  try {
    // Smart login check
    const isLoggedIn = await agent.extract(
      "Check if user is already logged in",
      z.boolean()
    );

    if (!isLoggedIn) {
      await agent.act("Navigate to login page");
      await agent.act("Type email: admin");
      await agent.act("Type password: password");
      await agent.act("Click login button");
    }

    // Test 1: Verify header title on
    await agent.act("Navigate to the incentive index page");
    const headerText = await agent.extract(
      "Get the main header title text",
      z.string()
    );
    if (headerText !== "Whatever You Want") {
      throw new Error(
        `Header text "${headerText}" does not match expected "Whatever You Want"`
      );
    }

    console.log("All tests completed successfully");
  } finally {
    await agent.stop();
  }
}

runTests()
  .then(() => {
    console.log("Test suite succeeded:");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Test suite failed:", error);
    process.exit(1);
  });
