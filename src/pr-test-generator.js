const core = require("@actions/core");
const ClaudeService = require("./claude-service");
const GitHubService = require("./github-service");
const TestExecutor = require("./test-executor");
const TestReporter = require("./test-reporter");

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

      core.info("Generated test code: ", testCode);

      core.info("🧪 Generating test report...");
      const testReport = await this.testExecutor.executeTestsAndGenerateReport(
        testCode
      );
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
      core.error(`❌ Error: ${error.message}`);

      if (this.commentOnPR) {
        await this.githubService.commentError(error);
      }

      throw error;
    }
  }

  async generateTests(prContext) {
    // Step 1: Analyze PR and create test plan
    core.info("🔍 Step 1: Analyzing PR changes and creating test plan...");
    const testPlan = await this.claudeService.analyzeAndPlan(prContext);

    core.info("📋 Generated test plan:");
    core.info(testPlan);

    // Step 2: Analyze test plan and determine URL paths/navigation
    core.info(
      "🧭 Step 2: Analyzing navigation paths and URL routes for tests..."
    );
    const navigationPaths = await this.claudeService.analyzeNavigationPaths(
      testPlan,
      prContext
    );

    core.info("🗺️ Generated navigation paths:");
    core.info(navigationPaths);

    // Step 3: Convert test plan to code with navigation paths
    core.info("💻 Step 3: Converting test plan to executable code...");
    const testCode = await this.claudeService.generateTestCode(
      testPlan,
      prContext,
      navigationPaths
    );

    return testCode;
  }
}

module.exports = PRTestGenerator;
