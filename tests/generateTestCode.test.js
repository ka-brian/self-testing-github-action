require("dotenv").config();
const ClaudeService = require("../src/claude-service.js");
const { testExample: TEST_EXAMPLE } = require("../src/test-examples.js");

describe("ClaudeService - generateTestCode Function", () => {
  let claudeService;

  beforeEach(() => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error(
        "ANTHROPIC_API_KEY environment variable is required for evaluation tests"
      );
    }
    claudeService = new ClaudeService(apiKey);
  });

  const basicTestPlan = `1. Navigate to the homepage and verify the title shows "New Home Page"
2. Click on the "Get Started" button and verify it navigates to the signup page
3. Fill out the contact form and verify success message appears`;

  const basicPrContext = {
    pr: {
      title: "Update homepage title and add contact form",
      body: "This PR updates the homepage title text and adds a new contact form component",
      author: "testuser",
    },
    files: [
      {
        filename: "src/components/HomePage.jsx",
        status: "modified",
        additions: 15,
        deletions: 3,
        patch:
          "@@ -1,5 +1,5 @@\n export default function HomePage() {\n   return (\n     <div>\n-      <h1>Welcome</h1>\n+      <h1>New Home Page</h1>\n       <ContactForm />",
      },
    ],
    repoContext: {
      "package.json": '{"name": "test-app", "scripts": {"dev": "next dev"}}',
      "README.md": "A React application",
    },
    previewUrls: ["http://localhost:3000"],
  };

  const basicNavigationPaths = `**Test 1**: Navigate to the homepage and verify the title shows "New Home Page"
- **URL Path**: /
- **Navigation**: Direct navigation to URL

**Test 2**: Click on the "Get Started" button and verify it navigates to the signup page  
- **URL Path**: /
- **Navigation**: Start at homepage, click Get Started button

**Test 3**: Fill out the contact form and verify success message appears
- **URL Path**: /contact
- **Navigation**: Direct navigation to contact page`;

  test("should generate test code with expected structure", async () => {
    const result = await claudeService.generateTestCode(
      basicTestPlan,
      basicPrContext,
      basicNavigationPaths
    );

    // Basic structure checks
    expect(result).toContain("async function runTests()");
    expect(result).toContain("startBrowserAgent");
    expect(result).toContain("await agent.stop()");
    expect(result).toContain("process.exit(1)");

    // Magnitude-specific patterns
    expect(result).toContain("await agent.act");
    expect(result).toContain("await agent.extract");

    // Should include test plan elements
    expect(result).toContain("New Home Page") ||
      expect(result).toContain("homepage");
    expect(result).toContain("Get Started") ||
      expect(result).toContain("button");
    expect(result).toContain("contact") || expect(result).toContain("form");
  }, 30000);

  test("should use LLM to compare generated code format with test-examples.js", async () => {
    const generatedCode = await claudeService.generateTestCode(
      basicTestPlan,
      basicPrContext,
      basicNavigationPaths
    );

    // Use Claude to compare the formats
    const comparisonPrompt = `Compare these two test code examples and determine if they follow the same structural format and patterns:

REFERENCE FORMAT (from test-examples.js):
${TEST_EXAMPLE}

GENERATED CODE:
${generatedCode}

Do they both follow the same format? Check for:
1. Similar startBrowserAgent configuration structure
2. Both use try/finally blocks with agent.stop()
3. Both use agent.act() and agent.extract() methods appropriately
4. Both have console.log statements for test descriptions
5. Both handle errors with process.exit(1)
6. Similar overall code structure and organization

Respond with only "YES" if they match the expected format patterns, or "NO" if they don't.`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-haiku-20240307",
        max_tokens: 10,
        messages: [
          {
            role: "user",
            content: comparisonPrompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Claude API error: ${response.status}`);
    }

    const data = await response.json();
    const formatMatches = data.content[0].text.trim();

    expect(formatMatches).toBe("YES");
  }, 45000);

  test("should include navigation paths in generated code", async () => {
    const result = await claudeService.generateTestCode(
      basicTestPlan,
      basicPrContext,
      basicNavigationPaths
    );

    // Should reference the specific paths from navigation
    expect(result).toContain("/") || expect(result).toContain("homepage");
    expect(result).toContain("/contact") || expect(result).toContain("contact");
  }, 30000);

  test("should handle simple test plan with minimal steps", async () => {
    const simpleTestPlan =
      "1. Navigate to homepage and verify title is correct";
    const simplePrContext = {
      pr: {
        title: "Update homepage title",
        body: "Changed title text",
        author: "testuser",
      },
      files: [
        {
          filename: "index.html",
          status: "modified",
          additions: 1,
          deletions: 1,
          patch: "-<title>Old Title</title>\n+<title>New Title</title>",
        },
      ],
      repoContext: {},
      previewUrls: ["http://localhost:3000"],
    };
    const simpleNavigation = `**Test 1**: Navigate to homepage
- **URL Path**: /
- **Navigation**: Direct navigation`;

    const result = await claudeService.generateTestCode(
      simpleTestPlan,
      simplePrContext,
      simpleNavigation
    );

    expect(result).toContain("async function runTests()");
    expect(result).toContain("startBrowserAgent");
    expect(result).toContain("title") || expect(result).toContain("homepage");
  }, 30000);
});
