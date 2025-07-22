const ClaudeService = require("../src/claude-service");
const TestExecutor = require("../src/test-executor");
require("dotenv").config();

class EvalSuite {
  constructor() {
    this.scenarios = this.defineScenarios();
  }

  defineScenarios() {
    return [
      {
        id: "simple-copy-change",
        name: "Simple Copy Change Test",
        description: "Tests basic copy change detection and verification",
        mockData: {
          prNumber: 301,
          files: [
            {
              filename: "tests/test-sites/simple-blog/index.html",
              patch: `@@ -12,7 +12,7 @@
             <div class="nav-container">
-                <h1 class="blog-title">Simple Blog</h1>
+                <h1 class="blog-title">My Awesome Blog</h1>
                 <div class="nav-controls">`,
              status: "modified",
              additions: 1,
              deletions: 1,
            },
          ],
          previewUrls: ["http://localhost:8080"],
        },
        expectedOutcomes: {
          shouldSucceed: true,
          shouldGenerateTests: true,
          shouldSkipUITests: false,
          // outputPatterns: ["My Awesome Blog", "blog-title"]
        },
        baseUrl: "http://localhost:8080",
      },
    ];
  }

  // Convert scenario mockData to prContext format expected by services
  createPRContext(scenario) {
    return {
      pr: {
        title: `${scenario.name} - Test PR`,
        body: scenario.description,
        author: "test-user",
        number: scenario.mockData.prNumber,
      },
      files: scenario.mockData.files,
      previewUrls: scenario.mockData.previewUrls,
      repoContext: {
        "package.json": '{"name": "test-app", "dependencies": {}}',
        "README.md":
          "# Test Application\nThis is a test application for UI testing.",
      },
    };
  }

  async runScenario(scenarioId, claudeApiKey) {
    if (!claudeApiKey) {
      throw new Error(
        "Claude API key is required. Set ANTHROPIC_API_KEY environment variable."
      );
    }

    const scenario = this.getScenarioById(scenarioId);
    if (!scenario) {
      throw new Error(`Scenario ${scenarioId} not found`);
    }

    console.log(`\n🚀 Running scenario: ${scenario.name}`);
    console.log(`📋 Description: ${scenario.description}`);

    // Create services without GitHub auth
    const claudeService = new ClaudeService(claudeApiKey);
    const testExecutor = new TestExecutor({
      timeout: 120000,
      claudeApiKey: claudeApiKey,
    });

    // Create mock PR context
    const prContext = this.createPRContext(scenario);

    try {
      // Generate tests using Claude (same as PRTestGenerator.generateTests)
      console.log("🔍 Step 1: Analyzing PR changes and creating test plan...");
      const testPlan = await claudeService.analyzeAndPlan(prContext);
      console.log("📋 Generated test plan:");
      console.log(testPlan);

      console.log("💻 Step 2: Converting test plan to executable code...");
      
      const testExamples = `
Example of correct Magnitude test format:

const { startBrowserAgent } = require('magnitude-core');
const { z } = require('zod');

async function main() {
  const agent = await startBrowserAgent({
    url: 'http://localhost:8080',
    narrate: true
  });

  try {
    // Navigate to page (if needed)
    await agent.nav('http://localhost:8080');
    
    // Extract data with schema
    const titleText = await agent.extract('get the text of h1.blog-title', z.string());
    
    // Verify result
    console.log('Title found:', titleText);
    if (titleText === 'My Awesome Blog') {
      console.log('✓ Test passed: Title matches expected value');
    } else {
      console.log('✗ Test failed: Expected "My Awesome Blog" but got:', titleText);
    }
    
  } catch (error) {
    console.error('Test failed:', error.message);
  } finally {
    await agent.stop();
  }
}

main().catch(console.error);
`;

      const testCode = await claudeService.generateTestCode(
        testPlan,
        prContext,
        testExamples, // Provide correct examples
        null, // No test user email
        null // No test user password
      );

      console.log("🧪 Step 3: Executing generated tests...");
      const testReport = await testExecutor.executeTestsAndGenerateReport(
        testCode
      );

      // Print results
      console.log("\n📊 Test Results:");
      console.log(`✅ Success: ${testReport.success}`);
      console.log(`🧪 Test Cases: ${testReport.testCases.length}`);
      console.log(`⏭️  Execution Skipped: ${testReport.executionSkipped}`);

      if (testReport.testCases.length > 0) {
        testReport.testCases.forEach((testCase, i) => {
          console.log(`  ${i + 1}. ${testCase.name} - ${testCase.status}`);
        });
      }

      if (testReport.output) {
        console.log("\n📝 Test Output:");
        console.log(testReport.output);
      }

      if (testReport.errors) {
        console.log("\n⚠️  Errors:");
        console.log(testReport.errors);
      }

      return {
        scenario: scenario.id,
        success: testReport.success,
        testCode,
        testReport,
        executionSkipped: testReport.executionSkipped,
      };
    } catch (error) {
      console.error(`❌ Error running scenario ${scenarioId}:`, error.message);
      throw error;
    }
  }

  async runAll(claudeApiKey) {
    const results = [];
    
    for (const scenario of this.scenarios) {
      try {
        const result = await this.runScenario(scenario.id, claudeApiKey);
        results.push(result);
      } catch (error) {
        results.push({
          scenario: scenario.id,
          success: false,
          error: error.message,
        });
      }
    }

    console.log("\n🎯 Summary:");
    results.forEach(result => {
      const status = result.success ? "✅" : "❌";
      console.log(`${status} ${result.scenario}: ${result.success ? "PASSED" : result.error}`);
    });

    return results;
  }

  getScenarios() {
    return this.scenarios;
  }

  getScenarioById(id) {
    return this.scenarios.find((scenario) => scenario.id === id);
  }

  getStats() {
    return {
      total: this.scenarios.length,
      expectingTestGeneration: this.scenarios.filter(
        (s) => s.expectedOutcomes.shouldGenerateTests
      ).length,
      expectingUISkips: this.scenarios.filter(
        (s) => s.expectedOutcomes.shouldSkipUITests
      ).length,
      coverageAreas: {
        "Simple Copy Change": this.scenarios.length,
      },
    };
  }
}

// CLI runner if called directly
if (require.main === module) {
  const evalSuite = new EvalSuite();
  const claudeApiKey =
    process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;

  if (!claudeApiKey) {
    console.error(
      "❌ Please set ANTHROPIC_API_KEY or CLAUDE_API_KEY environment variable"
    );
    process.exit(1);
  }

  const scenarioId = process.argv[2] || "simple-copy-change";
  
  evalSuite.runScenario(scenarioId, claudeApiKey)
    .then(result => {
      console.log(`\n🎉 Eval suite completed successfully for scenario: ${result.scenario}`);
      process.exit(0);
    })
    .catch(error => {
      console.error(`\n💥 Eval suite failed:`, error.message);
      process.exit(1);
    });
}

module.exports = {
  evalSuite: new EvalSuite(),
};
