const core = require("@actions/core");

class TestReporter {
  printTestReport(testReport) {
    core.info("📊 Test Execution Report:");
    core.info("=".repeat(50));

    if (testReport.success) {
      if (testReport.executionSkipped) {
        core.info("✅ Test generation: SUCCESS (execution skipped)");
      } else {
        core.info("✅ Test execution: SUCCESS");
      }
    } else {
      core.info("❌ Test execution: FAILED");
    }

    if (testReport.executionSkipped) {
      core.info(
        "📋 Tests generated and ready to run (dependencies not available for execution)"
      );
    }

    if (testReport.errors && testReport.errors.length > 0) {
      core.info("🔍 Details:");
      core.info(testReport.errors);
    }

    core.info("=".repeat(50));
  }
}

module.exports = TestReporter;
