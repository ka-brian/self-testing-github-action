const { startBrowserAgent } = require("magnitude-core");
const { z } = require("zod");
require("dotenv").config();

// Ensure ANTHROPIC_API_KEY is available
if (!process.env.ANTHROPIC_API_KEY && process.env.CLAUDE_API_KEY) {
  process.env.ANTHROPIC_API_KEY = process.env.CLAUDE_API_KEY;
}

async function discoverRoutes(url) {
  const agent = await startBrowserAgent({
    url: url,
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
    const routeMap = {};

    await agent.act("Start from homepage");

    // Login if credentials are provided
    if (process.env.TEST_USER_EMAIL && process.env.TEST_USER_PASSWORD) {
      await agent.act("Login with credentials", {
        data: {
          email: process.env.TEST_USER_EMAIL,
          password: process.env.TEST_USER_PASSWORD,
        },
      });

      // Check if we need to select a project/workspace/organization
      const needsSelection = await agent.extract(
        "Does this page show a list of projects, workspaces, organizations, or tenants that need to be selected to access the main application? Look for project cards, dropdown selectors, or lists where you must choose one to continue. Answer true if you see selectable projects/workspaces, false if you're already in the main app with normal navigation.",
        z.boolean()
      );

      if (needsSelection) {
        console.log(
          "Detected project/workspace selection page, selecting first option..."
        );
        await agent.act(
          "Select the first available project, workspace, or organization to continue"
        );
      }
    }

    // Get main page URL and info
    const mainPageUrl = await agent.extract("Get current URL", z.string());
    console.log(`Main page: ${mainPageUrl}`);

    // Extract all main navigation items
    const navItems = await agent.extract(
      "List all main navigation menu items (typically found in header/top navigation) that lead to different pages. Include only the most important top-level sections. Exclude user-specific content, forms, action buttons, and deep links.",
      z.array(z.string())
    );

    console.log(`Found navigation items: ${navItems.join(", ")}`);

    // Explore each navigation item
    for (const item of navItems) {
      try {
        console.log(`\n→ Exploring: ${item}`);
        
        // First, check if this item has expandable content (dropdown/accordion)
        const hasExpandableContent = await agent.extract(
          `Does the navigation item "${item}" have expandable content like a dropdown menu, accordion, or submenu? Look for arrows, chevrons, or other indicators that suggest it can be expanded to show more options.`,
          z.boolean()
        );

        if (hasExpandableContent) {
          console.log(`  ↳ ${item} has expandable content, exploring submenu...`);
          
          // Expand the navigation item to reveal submenu
          await agent.act(`Hover over or click to expand the "${item}" navigation item to show its submenu or dropdown`);
          
          // Extract submenu items
          const submenuItems = await agent.extract(
            `List all submenu items that appeared when expanding "${item}". Include only the actual navigation links/options in the expanded menu.`,
            z.array(z.string())
          );

          console.log(`  ↳ Found submenu items: ${submenuItems.join(", ")}`);

          // Explore each submenu item
          for (const submenuItem of submenuItems) {
            try {
              console.log(`    → Exploring submenu: ${submenuItem}`);
              await agent.act(`Click on "${submenuItem}" from the ${item} submenu`);

              const pageUrl = await agent.extract("Get current URL", z.string());
              const pageDescription = await agent.extract(
                "Describe what this page contains, its main functionality, and what actions or information are available here",
                z.string()
              );

              const availableActions = await agent.extract(
                "List the main actions, features, or sections available on this page (buttons, links, key functionality)",
                z.array(z.string())
              );

              // Record this page in the sitemap with hierarchy info
              routeMap[pageUrl] = {
                navigationItem: submenuItem,
                parentNavigation: item,
                url: pageUrl,
                description: pageDescription,
                availableActions: availableActions,
                discoveredAt: new Date().toISOString(),
                level: "submenu"
              };

              console.log(`    URL: ${pageUrl}`);
              console.log(`    Description: ${pageDescription}`);
              console.log(`    Available actions: ${availableActions.join(", ")}`);

              // Navigate back to main page
              await agent.act("Go back to the main page with navigation");
            } catch (submenuError) {
              console.log(`    Error exploring submenu ${submenuItem}: ${submenuError.message}`);
              try {
                await agent.act("Go back to the main page with navigation");
              } catch (recoveryError) {
                console.log(`    Submenu recovery failed: ${recoveryError.message}`);
              }
            }
          }
        } else {
          // Regular navigation item - click directly
          await agent.act(`Click on ${item}`);

          const pageUrl = await agent.extract("Get current URL", z.string());
          const pageDescription = await agent.extract(
            "Describe what this page contains, its main functionality, and what actions or information are available here",
            z.string()
          );

          const availableActions = await agent.extract(
            "List the main actions, features, or sections available on this page (buttons, links, key functionality)",
            z.array(z.string())
          );

          // Record this page in the sitemap
          routeMap[pageUrl] = {
            navigationItem: item,
            url: pageUrl,
            description: pageDescription,
            availableActions: availableActions,
            discoveredAt: new Date().toISOString(),
            level: "main"
          };

          console.log(`  URL: ${pageUrl}`);
          console.log(`  Description: ${pageDescription}`);
          console.log(`  Available actions: ${availableActions.join(", ")}`);

          // Navigate back to main page
          await agent.act("Go back to the main page with navigation");
        }
      } catch (error) {
        console.log(`Error exploring ${item}: ${error.message}`);
        try {
          await agent.act("Go back to the main page with navigation");
        } catch (recoveryError) {
          console.log(`Recovery failed: ${recoveryError.message}`);
        }
      }
    }

    return {
      routeMap,
      statistics: {
        totalPagesDiscovered: Object.keys(routeMap).length,
        maxDepthReached: Math.max(
          ...Object.values(routeMap).map((page) => page.depth)
        ),
        explorationComplete: true,
      },
    };
  } finally {
    await agent.stop();
  }
}

module.exports = { discoverRoutes };

// Run when file is executed directly
if (require.main === module) {
  const fs = require("fs");
  const url = "https://conduiit-tax-incentives.vercel.app/";

  console.log(`Discovering routes for: ${url}`);

  discoverRoutes(url)
    .then((result) => {
      const outputFile = "discovered-routes.json";
      fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));
      console.log(`\nExploration complete!`);
      console.log(`📊 Statistics:`);
      console.log(
        `  • Total pages discovered: ${result.statistics.totalPagesDiscovered}`
      );
      console.log(
        `  • Maximum depth reached: ${result.statistics.maxDepthReached}`
      );
      console.log(`  • Route map written to: ${outputFile}`);
    })
    .catch((error) => {
      console.error("Error discovering routes:", error);
      process.exit(1);
    });
}
