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
      {
        id: "comment-report-test",
        name: "Test Report Comment Generation",
        description: "Tests that test execution report is properly formatted in PR comments",
        mockData: {
          prNumber: 302,
          files: [
            {
              filename: "tests/test-sites/simple-blog/style.css",
              patch: `@@ -45,7 +45,7 @@
             .blog-post {
                 background: #fff;
-                border: 1px solid #ddd;
+                border: 2px solid #007acc;
                 margin-bottom: 20px;`,
            },
          ],
          previewUrls: ["http://localhost:8080"],
        },
        expectedOutcomes: {
          shouldSucceed: true,
          shouldGenerateTests: true,
          shouldSkipUITests: false,
          shouldCreateComment: true,
          commentShouldContain: [
            "Test Execution Report",
            "Overall Status:",
            "Test Summary:",
            "Test Cases:",
            "**Total Test Cases**:",
          ],
        },
        baseUrl: "http://localhost:8080",
      },
    ];
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

module.exports = {
  evalSuite: new EvalSuite(),
};
