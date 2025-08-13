const core = require("@actions/core");
const fs = require("fs");
const path = require("path");
const ClaudeService = require("./claude-service");
const GitHubService = require("./github-service");
const TestExecutor = require("./test-executor");
const TestReporter = require("./test-reporter");
const { discoverRoutes } = require("./route-discovery");

class PRTestGenerator {
  constructor(config) {
    this.config = config;
    this.claudeService = new ClaudeService(config.claudeApiKey);
    this.githubService = new GitHubService({
      githubToken: config.githubToken,
      owner: config.owner,
      repo: config.repo,
      prNumber: config.prNumber,
    });
    this.testExecutor = new TestExecutor({
      timeout: config.timeout || 120000,
      claudeApiKey: config.claudeApiKey,
    });
    this.testReporter = new TestReporter();
    this.testExamples = config.testExamples;
    this.commentOnPR = config.commentOnPR !== false;
    this.waitForPreview = config.waitForPreview || 60;
    this.baseUrl = config.baseUrl;
  }

  async run() {
    const startTime = Date.now();

    try {
      core.info("📋 Fetching PR context...");
      const prContext = await this.githubService.getPRContext();

      // Check if UI testing is needed
      const requiresUITesting = await this.claudeService.requiresUITesting(
        prContext
      );

      if (!requiresUITesting) {
        core.info("🚀 No UI changes detected - skipping UI tests");
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);

        if (this.commentOnPR) {
          await this.githubService.commentSkippedTests();
        }

        return {
          success: true,
          testFilePath: null,
          results: {
            success: true,
            skipped: true,
            reason: "No UI changes detected",
          },
          duration,
        };
      }

      // Wait for preview URLs if needed
      if (
        !this.baseUrl &&
        prContext.previewUrls.length === 0 &&
        this.waitForPreview > 0
      ) {
        core.info(
          `⏳ Waiting up to ${this.waitForPreview}s for preview URLs...`
        );
        const urls = await this.githubService.waitForPreviewUrls(
          this.waitForPreview
        );
        if (urls.length > 0) {
          prContext.previewUrls = urls;
        }
      }

      // Use base URL override if provided
      if (this.baseUrl) {
        prContext.previewUrls = [this.baseUrl];
        core.info(`🔗 Using provided base URL: ${this.baseUrl}`);
      }

      core.info("🤖 Generating tests with Claude...");
      const testCode = await this.generateTests(prContext);

      core.info("Generated test code: ");
      core.info(testCode);

      core.info("🧪 Generating test report...");
      let testReport;
      try {
        testReport = await this.testExecutor.executeTestsAndGenerateReport(
          testCode
        );
      } catch (e) {
        throw new Error(`Error generating test report ${e}`);
      }
      this.testReporter.printTestReport(testReport);

      if (testReport.executionSkipped) {
        core.info(
          "✅ Test generation complete (execution skipped - dependencies not available)"
        );
      } else {
        core.info("✅ Test generation and execution complete");
      }

      if (this.commentOnPR) {
        core.info("💬 Commenting on PR...");
        await this.githubService.commentGenerated(testReport);
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      core.info(`✅ Completed in ${duration}s`);

      return {
        success: true,
        testCode,
        testReport,
        results: {
          success: true,
          message: testReport.executionSkipped
            ? "Test code generated successfully (execution skipped)"
            : "Test code generated and executed successfully",
        },
        duration,
      };
    } catch (error) {
      core.error(`❌ Error in pr-test-generator: ${error.message}`);

      if (this.commentOnPR) {
        await this.githubService.commentError(error);
      }

      throw error;
    }
  }

  async generateTests(prContext) {
    // Step 1: Analyze PR and create test plan
    core.info(
      "🔍 generateTests Step 1: Analyzing PR changes and creating test plan..."
    );
    const testPlan = await this.claudeService.analyzeAndPlan(prContext);

    core.info("📋 Generated test plan:");
    core.info(testPlan);

    // Step 2: Analyze test plan and determine URL paths/navigation
    core.info(
      "🧭 generateTests Step 2: Analyzing navigation paths and URL routes for tests..."
    );

    let sitemap;
    const sitemapPath = path.join(process.cwd(), "sitemap.json");
    
    // Check if user-provided sitemap.json exists
    if (fs.existsSync(sitemapPath)) {
      core.info("📋 Found sitemap.json, using user-provided sitemap...");
      try {
        const sitemapContent = fs.readFileSync(sitemapPath, "utf8");
        sitemap = JSON.parse(sitemapContent);
        core.info("✅ Successfully loaded user-provided sitemap");
      } catch (error) {
        core.warning(`⚠️  Error reading sitemap.json: ${error.message}`);
        core.info("🔍 Falling back to route discovery...");
        sitemap = await discoverRoutes(prContext.previewUrls[0]);
      }
    } else {
      core.info("🔍 No sitemap.json found, discovering routes dynamically...");
      sitemap = await discoverRoutes(prContext.previewUrls[0]);
    }

    core.info("🗺️ Using sitemap:");
    core.info(JSON.stringify(sitemap, null, 2));

    // Step 3: Generate QA instructions using sitemap
    core.info(
      "📋 generateTests Step 3: Generating QA navigation instructions..."
    );
    const qaInstructions = await this.claudeService.generateQAInstructions(
      testPlan,
      prContext,
      sitemap
    );

    core.info("📋 Generated QA instructions:");
    core.info(qaInstructions);

    // Step 4: Convert test plan to code with navigation paths
    core.info(
      "💻 generateTests Step 4: Converting test plan to executable code..."
    );
    const testCode = await this.claudeService.generateTestCode(
      testPlan,
      prContext,
      sitemap
    );

    return testCode;
  }
}

module.exports = PRTestGenerator;
