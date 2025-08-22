const core = require("@actions/core");
const github = require("@actions/github");
const PRTestGenerator = require("./pr-test-generator");

async function run() {
  try {
    // Get inputs
    const claudeApiKey = core.getInput("claude-api-key", { required: true });
    const githubToken = core.getInput("github-token", { required: true });
    const testExamples = core.getInput("test-examples");
    const outputDir = core.getInput("output-dir");
    const timeout = 600000;
    const commentOnPR = core.getInput("comment-on-pr") === "true";
    const baseUrl = core.getInput("base-url");
    const waitForPreview = parseInt(core.getInput("wait-for-preview")) || 60;
    const enableCaching = core.getInput("enable-caching") === "true";
    
    // Get authentication inputs and set as environment variables
    const testUserEmail = core.getInput("test-user-email");
    const testUserPassword = core.getInput("test-user-password");
    
    if (testUserEmail) {
      process.env.TEST_USER_EMAIL = testUserEmail;
    }
    if (testUserPassword) {
      process.env.TEST_USER_PASSWORD = testUserPassword;
    }

    // Get GitHub context
    const context = github.context;

    // Validate that this is running on a PR
    if (!context.payload.pull_request) {
      core.setFailed("This action must be run on a pull request event");
      return;
    }

    const config = {
      claudeApiKey,
      githubToken,
      owner: context.repo.owner,
      repo: context.repo.repo,
      prNumber: context.payload.pull_request.number,
      testExamples,
      outputDir,
      timeout,
      commentOnPR,
      baseUrl,
      waitForPreview,
      enableCaching,
    };

    core.info(`🚀 Starting test generation for PR #${config.prNumber}`);
    core.info(`Repository: ${config.owner}/${config.repo}`);

    // Create and run test generator
    const generator = new PRTestGenerator(config);
    const results = await generator.run();

    // Set outputs
    core.setOutput("test-results", JSON.stringify(results));
    core.setOutput("test-file-path", results.testFilePath);
    core.setOutput("tests-passed", results.success);

    if (results.success) {
      core.info("✅ All tests passed!");
    } else {
      core.warning(
        "❌ Some tests failed, but this is not necessarily a problem"
      );
      core.warning("Check the PR comments for details");
    }

    // Note: We don't fail the action if tests fail, as test failures are expected
    // The purpose is to generate and run tests, not to gate the PR
  } catch (error) {
    core.error(`Action failed: ${error.message}`);
    core.setFailed(error.message);
  }
}

// Handle both action and manual execution
if (require.main === module) {
  run();
}

module.exports = { run };
