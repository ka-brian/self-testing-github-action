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

    core.info(`📝 Total test cases: ${testReport.testCases.length}`);

    if (testReport.executionSkipped) {
      core.info(
        "📋 Tests generated and ready to run (dependencies not available for execution)"
      );
    }

    testReport.testCases.forEach((testCase, index) => {
      const statusIcon =
        testCase.status === "PASSED"
          ? "✅"
          : testCase.status === "FAILED"
          ? "❌"
          : testCase.status === "READY_TO_RUN"
          ? "🚀"
          : "📝";
      core.info(
        `${statusIcon} ${index + 1}. ${testCase.name} [${testCase.status}]`
      );
    });

    if (testReport.errors && testReport.errors.length > 0) {
      core.info("🔍 Details:");
      core.info(testReport.errors);
    }

    core.info("=".repeat(50));
  }

  generateTestSummary(testReport) {
    const passedCount = testReport.testCases.filter(
      (t) => t.status === "PASSED"
    ).length;
    const failedCount = testReport.testCases.filter(
      (t) => t.status === "FAILED"
    ).length;
    const readyToRunCount = testReport.testCases.filter(
      (t) => t.status === "READY_TO_RUN"
    ).length;
    const generatedCount = testReport.testCases.filter(
      (t) => t.status === "GENERATED"
    ).length;

    return {
      total: testReport.testCases.length,
      passed: passedCount,
      failed: failedCount,
      readyToRun: readyToRunCount,
      generated: generatedCount,
      success: testReport.success,
      executionSkipped: testReport.executionSkipped,
    };
  }

  formatTestCasesList(testCases) {
    return testCases
      .map((testCase, index) => {
        const statusIcon =
          testCase.status === "PASSED"
            ? "✅"
            : testCase.status === "FAILED"
            ? "❌"
            : testCase.status === "READY_TO_RUN"
            ? "🚀"
            : "📝";
        return `${statusIcon} **${index + 1}.** ${testCase.name}`;
      })
      .join("\n");
  }

  getStatusIcon(success) {
    return success ? "✅" : "❌";
  }

  getOverallStatus(success, executionSkipped) {
    return success
      ? executionSkipped
        ? "TESTS GENERATED"
        : "TESTS EXECUTED"
      : "EXECUTION FAILED";
  }
}

module.exports = TestReporter;