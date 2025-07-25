const core = require("@actions/core");
const { testExample: TEST_EXAMPLE } = require("./test-examples.js");

const IMPORTS = `
const { startBrowserAgent } = require("magnitude-core");
const { z } = require("zod");
require("dotenv").config();

// Ensure ANTHROPIC_API_KEY is available
if (!process.env.ANTHROPIC_API_KEY && process.env.CLAUDE_API_KEY) {
  process.env.ANTHROPIC_API_KEY = process.env.CLAUDE_API_KEY;
}
`;

class ClaudeService {
  constructor(apiKey) {
    this.claudeApiKey = apiKey;
  }

  async requiresUITesting(prContext) {
    core.info(
      "🤖 Analyzing PR changes to determine if UI testing is needed..."
    );
    core.info(
      `Files to analyze: ${prContext.files.map((f) => f.filename).join(", ")}`
    );

    const prompt = this.buildUIAnalysisPrompt(prContext);

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.claudeApiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-3-haiku-20240307",
          max_tokens: 10,
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
        }),
      });

      if (!response.ok) {
        core.warning(`Claude API request failed: ${response.status}`);
        return this.fallbackUIDetection(prContext);
      }

      const data = await response.json();
      const result = data.content[0].text.trim().toUpperCase();

      core.info(`Claude AI analysis result: ${result}`);

      if (result === "YES") {
        core.info("🎨 UI changes detected by Claude - will run UI tests");
        return true;
      } else if (result === "NO") {
        const hasObviousUIFiles = prContext.files.some((file) => {
          const filename = file.filename;
          return (
            filename.includes("component") ||
            filename.includes("/pages/") ||
            filename.includes("/app/") ||
            filename.includes("/src/") ||
            filename.endsWith(".jsx") ||
            filename.endsWith(".tsx") ||
            filename.endsWith(".css") ||
            filename.endsWith(".scss")
          );
        });

        if (hasObviousUIFiles) {
          core.warning(
            "🔄 Claude said NO but obvious UI files detected - overriding to run UI tests"
          );
          const uiFiles = prContext.files.filter((f) => {
            const filename = f.filename;
            return (
              filename.includes("component") ||
              filename.includes("/pages/") ||
              filename.includes("/app/") ||
              filename.includes("/src/") ||
              filename.endsWith(".jsx") ||
              filename.endsWith(".tsx") ||
              filename.endsWith(".css") ||
              filename.endsWith(".scss")
            );
          });
          core.info(
            `UI files found: ${uiFiles.map((f) => f.filename).join(", ")}`
          );
          return true;
        }

        core.info("🔧 No UI changes detected by Claude - will skip UI tests");
        return false;
      } else {
        core.warning(`Unexpected Claude response: ${result}`);
        return this.fallbackUIDetection(prContext);
      }
    } catch (error) {
      core.warning(`Error analyzing PR with Claude: ${error.message}`);
      return this.fallbackUIDetection(prContext);
    }
  }

  fallbackUIDetection(prContext) {
    core.info("🔍 Using fallback UI detection...");

    core.info(
      `Changed files: ${prContext.files.map((f) => f.filename).join(", ")}`
    );

    const uiFilePatterns = [
      /\.(jsx?|tsx?)$/,
      /\.(vue|svelte)$/,
      /\.(css|scss|sass|less|stylus)$/,
      /\.(html|htm|ejs|hbs|pug|jade)$/,
      /\/components?\//,
      /\/pages?\//,
      /\/app\//,
      /\/src\//,
      /\/views?\//,
      /\/layouts?\//,
      /\/templates?\//,
      /\/styles?\//,
      /\/css\//,
      /\/sass\//,
      /\/scss\//,
      /\/assets?\//,
      /\/public\//,
      /\/static\//,
      /tailwind\.config\./,
      /next\.config\./,
      /nuxt\.config\./,
      /vite\.config\./,
      /webpack\.config\./,
      /package\.json$/,
    ];

    const matchingFiles = prContext.files.filter((file) =>
      uiFilePatterns.some((pattern) => pattern.test(file.filename))
    );

    if (matchingFiles.length > 0) {
      core.info(
        `🎨 UI files detected: ${matchingFiles
          .map((f) => f.filename)
          .join(", ")}`
      );
      core.info("Will run UI tests");
      return true;
    } else {
      core.info("🔧 No UI files detected - will skip UI tests");
      return false;
    }
  }

  async analyzeAndPlan(prContext) {
    const prompt = this.buildAnalysisPrompt(prContext);

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.claudeApiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 2000,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Claude API error (analysis): ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    const data = await response.json();
    return data.content[0].text;
  }

  async analyzeNavigationPaths(testPlan, prContext) {
    const prompt = this.buildNavigationPrompt(testPlan, prContext);

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.claudeApiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Claude API request failed: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();
    return data.content[0].text;
  }

  async generateTestCode(testPlan, prContext, navigationPaths) {
    const prompt = this.buildCodePrompt(testPlan, prContext, navigationPaths);
    console.log("buildCodePrompt", prompt);

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.claudeApiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 4000,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Claude API error (code generation): ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    const data = await response.json();
    return IMPORTS + data.content[0].text;
  }

  buildUIAnalysisPrompt(prContext) {
    return `Analyze the following Pull Request changes and determine if UI testing is necessary.

## PR Details:
- **Title**: ${prContext.pr.title}
- **Description**: ${prContext.pr.body || "No description provided"}

## Changed Files:
${prContext.files
  .map(
    (file) => `
### ${file.filename} (${file.status})
**Changes**: +${file.additions} -${file.deletions}
\`\`\`diff
${file.patch ? file.patch.slice(0, 1000) : "No patch available"}${
      file.patch && file.patch.length > 1000 ? "\n...(truncated)" : ""
    }
\`\`\`
`
  )
  .join("\n")}

## UI Testing is REQUIRED for:
- React/Next.js components (.jsx, .tsx, .js, .ts files in components/, pages/, app/, src/)
- CSS/styling changes (.css, .scss, .sass, .less files)
- HTML template changes
- Frontend routing changes
- User interface modifications
- Form, button, or interactive element changes
- Layout or design changes
- Frontend script changes that affect user interface

## UI Testing is NOT required for:
- Pure backend API changes (no frontend impact)
- Database schema changes
- CI/CD configuration only
- Documentation only changes
- Server-side only configuration

## Instructions:
Look carefully at the file paths and changes. If ANY file appears to be frontend-related (React components, styles, pages, UI scripts), answer YES.

However, if there are UI changes that cannot be tested, for example error states that require specific non-accessible situations, skip the tests.

You are inside of a sandboxed test environment, so you can perform CRUD operations for the sake of the test. Please make sure that you teardown anything that you create.

Respond with ONLY "YES" if UI testing is needed, or "NO" if UI testing is not needed. Do not include any explanation.`;
  }

  buildAnalysisPrompt(prContext) {
    const changedFiles = prContext.files
      .filter((file) => file.patch)
      .slice(0, 10);

    const previewUrlsSection =
      prContext.previewUrls.length > 0
        ? `## Available Preview URLs:
${prContext.previewUrls.map((url) => `- ${url}`).join("\n")}`
        : `## No Preview URLs Found
Tests should target the main application functionality.`;

    return `You are analyzing a GitHub Pull Request to determine what UI tests should be created.

## Repository Context:
${Object.entries(prContext.repoContext)
  .map(
    ([file, content]) =>
      `### ${file}\n\`\`\`\n${content.slice(0, 500)}${
        content.length > 500 ? "..." : ""
      }\n\`\`\`\n`
  )
  .join("\n")}

${previewUrlsSection}

## Pull Request Details:
- **Title**: ${prContext.pr.title}
- **Author**: ${prContext.pr.author}
- **Description**: ${prContext.pr.body || "No description provided"}
- **Files Changed**: ${prContext.files.length}

## Key Changes:
${changedFiles
  .map(
    (file) => `
### ${file.filename} (${file.status})
**Changes**: +${file.additions} -${file.deletions}
\`\`\`diff
${file.patch.slice(0, 1500)}${
      file.patch.length > 1500 ? "\n...(truncated)" : ""
    }
\`\`\`
`
  )
  .join("\n")}

## Your Task:
Analyze the PR changes and create a SIMPLE, focused list of UI tests. 

**IMPORTANT**: Keep tests minimal and focused. For simple changes like copy updates, styling tweaks, or minor functionality:
- Only test what actually changed
- Avoid comprehensive testing of existing features
- Focus on the specific modification, not the entire feature
- Do not include tests around changing viewport size

## Test Planning Guidelines:
- **Simple copy/text changes**: 1-2 tests max (verify text appears correctly)
- **Minor styling changes**: 1-3 tests (verify visual change is applied)
- **Small feature additions**: 2-4 tests (test the new functionality only)
- **Complex features**: Maximum 5 tests

## Output Format:
Provide a numbered list of specific test scenarios in plain English. Each test should:
- Be specific about what to test
- Include expected outcomes
- Focus ONLY on what changed in this PR

Example for simple copy change:
1. Navigate to the homepage and verify the title shows "New Title" instead of "Old Title"

Example for minor feature:
1. Navigate to the settings page and verify the new "Export Data" button is visible
2. Click the "Export Data" button and verify a download starts

Provide 1-5 specific test scenarios based on the changes. Keep it simple and focused.`;
  }

  buildNavigationPrompt(testPlan, prContext) {
    const previewUrlsSection =
      prContext.previewUrls.length > 0
        ? `## Base URL:
${prContext.previewUrls.map((url) => `- ${url}`).join("\n")}`
        : `## Base URL: ${process.env.LOCAL_DEV_TARGET_URL}.`;

    return `You are analyzing a test plan to determine the specific URL paths and navigation instructions needed for each test.
${previewUrlsSection}
## Repository Context:
${Object.entries(prContext.repoContext)
  .map(
    ([file, content]) =>
      `### ${file}\n\`\`\`\n${content.slice(0, 300)}${
        content.length > 300 ? "..." : ""
      }\n\`\`\`\n`
  )
  .join("\n")}
## Pull Request Details:
- **Title**: ${prContext.pr.title}
- **Description**: ${prContext.pr.body || "No description provided"}
## Test Plan:
${testPlan}
## Your Task:
For each test in the test plan above, provide:
1. The specific URL path to navigate to (e.g., "/dashboard", "/settings", "/login")
2. Brief navigation instructions if the target UI element requires specific steps to reach
**Important Guidelines:**
- If a test mentions a specific page (e.g., "homepage", "dashboard", "settings"), provide the likely URL path
- If a test is about a component that appears on multiple pages, suggest the most logical starting path
- For authentication-protected areas, assume login will happen first and provide the post-login path
- If unsure about exact paths, provide reasonable assumptions based on common web app conventions
- Keep navigation instructions brief and focused
## Output Format:
For each test, provide:
**Test 1**: [Brief test description]
- **URL Path**: /path/to/page
- **Navigation**: [Brief instructions if needed, or "Direct navigation to URL"]
**Test 2**: [Brief test description]
- **URL Path**: /different/path
- **Navigation**: [Brief instructions if needed, or "Direct navigation to URL"]
Example:
**Test 1**: Navigate to the homepage and verify the title shows "New Title"
- **URL Path**: /
- **Navigation**: Direct navigation to URL
**Test 2**: Navigate to the settings page and verify the new "Export Data" button is visible
- **URL Path**: /settings
- **Navigation**: Direct navigation to URL (may require authentication)
Provide navigation details for each test in the plan.`;
  }

  buildCodePrompt(testPlan, prContext, navigationPaths) {
    const authenticationSection =
      process.env.TEST_USER_EMAIL && process.env.TEST_USER_PASSWORD
        ? `
## Authentication Available:
**Credentials**: Use these exact values in your tests:
- Email: \`${process.env.TEST_USER_EMAIL}\`
- Password: \`${process.env.TEST_USER_PASSWORD}\`

**Smart Login Pattern**:
\`\`\`javascript
// Check if already logged in first
const isLoggedIn = await agent.extract('Check if user is already logged in', z.boolean());

if (!isLoggedIn) {
  await agent.act('Navigate to login page');
  await agent.act('Type email: ${process.env.TEST_USER_EMAIL}');
  await agent.act('Type password: ${process.env.TEST_USER_PASSWORD}');
  await agent.act('Click login button');
}
// Continue with tests...
\`\`\`
`
        : `
## No Authentication Configured
Tests will run without authentication.
`;

    // note LOCAL_DEV_TARGET_URL should just be used for local dev
    const baseUrlSection =
      prContext.previewUrls.length > 0
        ? `
## Base URL:
Use: \`${prContext.previewUrls[0]}\`
`
        : `
## Base URL:
Use: \`${process.env.LOCAL_DEV_TARGET_URL}`;
    const navigationSection = navigationPaths
      ? `
## Navigation Paths and Instructions:
${navigationPaths}
`
      : `
## Navigation Paths:
No specific navigation paths provided - use standard navigation patterns.
`;

    return `Convert this test plan into executable Magnitude test code.

${authenticationSection}

${baseUrlSection}

${navigationSection}

## Test Plan to Implement:
${testPlan}

## Test Framework Examples:
${TEST_EXAMPLE}

## Requirements:
1. **Implement each test** from the test plan above
2. **Use Magnitude syntax** as shown in examples  
3. **Use \`await agent.extract(query, zodSchema)\`** for checking page state
4. **Use \`await agent.act(query)\`** for all interactions
5. **Include authentication logic** if credentials are provided (use the pattern above)
6. **Use the navigation paths and instructions** provided above to navigate to the correct URLs for each test
7. **Navigate to the base URL** and then to specific paths as needed for each test
8. **DO NOT include any import statements** - startBrowserAgent, z (from zod), and dotenv are already available

## Output:
Return ONLY the complete, executable test code. No explanations or markdown formatting.`;
  }
}

module.exports = ClaudeService;
