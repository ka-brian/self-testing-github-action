const { exec } = require("child_process");
const fs = require("fs").promises;
const path = require("path");
const { promisify } = require("util");
const core = require("@actions/core");

const execAsync = promisify(exec);

class TestExecutor {
  constructor(config) {
    this.timeout = config.timeout || 120000;
    this.claudeApiKey = config.claudeApiKey;
  }

  async executeTestsAndGenerateReport(testCode) {
    const testCases = this.parseTestCasesFromCode(testCode);

    const hasMagnitudeCore = await this.checkDependency("magnitude-core");

    if (!hasMagnitudeCore) {
      core.info("📦 Installing required test dependencies...");
      try {
        await this.installDependencies([
          "magnitude-core@latest",
          "dotenv@latest",
          "playwright@latest",
          "zod@3.24",
        ]);

        core.info("📦 Installing Playwright browser binaries...");
        await this.installPlaywriteBrowsers();

        core.info("✅ Dependencies installed successfully");
      } catch (error) {
        core.warning(`Failed to install dependencies: ${error.message}`);
        testCases.forEach((testCase) => {
          testCase.status = "READY_TO_RUN";
        });

        return {
          success: true,
          testCases,
          output:
            "Test code generated successfully but not executed (dependency installation failed)",
          errors: `Failed to install dependencies: ${error.message}`,
          executionSkipped: true,
        };
      }
    }

    try {
      let cleanTestCode = testCode
        .replace(/```(?:javascript|js)?\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();

      // if (
      //   !cleanTestCode.includes("import") &&
      //   !cleanTestCode.includes("require")
      // ) {
      const imports =
        "const { startBrowserAgent } = require('magnitude-core');\nconst { z } = require('zod');\nrequire('dotenv').config();\n\n" +
        "// Ensure ANTHROPIC_API_KEY is available\n" +
        "if (!process.env.ANTHROPIC_API_KEY && process.env.CLAUDE_API_KEY) {\n" +
        "  process.env.ANTHROPIC_API_KEY = process.env.CLAUDE_API_KEY;\n" +
        "}\n\n";
      cleanTestCode = imports + cleanTestCode;
      // }

      const testFilePath = path.join(process.cwd(), "temp-test.js");
      await fs.writeFile(testFilePath, cleanTestCode);

      core.info("🚀 Running generated tests...");
      const env = {
        ...process.env,
        ANTHROPIC_API_KEY: this.claudeApiKey,
      };

      const { stdout, stderr } = await execAsync(`node ${testFilePath}`, {
        timeout: this.timeout,
        env: env,
      });

      const updatedTestCases = this.parseTestResults(
        cleanTestCode,
        stdout,
        stderr
      );

      await fs.unlink(testFilePath);

      return {
        success: true,
        testCases: updatedTestCases,
        output: stdout,
        errors: stderr,
        executionSkipped: false,
      };
    } catch (error) {
      core.warning(`Test execution failed: ${error.message}`);

      testCases.forEach((testCase) => {
        testCase.status = "READY_TO_RUN";
      });

      return {
        success: true,
        testCases,
        output: "",
        errors: `Execution failed (dependencies may be missing): ${error.message}`,
        executionSkipped: true,
      };
    }
  }

  async checkDependency(moduleName) {
    try {
      require.resolve(moduleName);
      return true;
    } catch (error) {
      return false;
    }
  }

  async installDependencies(packages) {
    core.info(`📦 Installing packages: ${packages.join(", ")}`);

    const installCommand = `npm install ${packages.join(" ")}`;

    try {
      const { stdout, stderr } = await execAsync(installCommand, {
        timeout: 120000,
      });

      if (stderr && stderr.includes("error")) {
        throw new Error(stderr);
      }

      core.info(
        `✅ Installation completed: ${stdout.split("\n").slice(-3).join(" ")}`
      );
      return true;
    } catch (error) {
      core.error(`❌ Installation failed: ${error.message}`);
      throw error;
    }
  }

  async installPlaywriteBrowsers() {
    core.info("🔧 Downloading Playwright browser binaries...");

    try {
      const { stdout, stderr } = await execAsync("npx playwright install", {
        timeout: 300000,
      });

      if (stderr && stderr.includes("error")) {
        throw new Error(stderr);
      }

      core.info("✅ Playwright browsers installed successfully");
      return true;
    } catch (error) {
      core.error(`❌ Playwright browser installation failed: ${error.message}`);
      throw error;
    }
  }

  parseTestResults(testCode, stdout, stderr) {
    const testCases = this.parseTestCasesFromCode(testCode);

    if (stdout.length > 50 || stderr.length > 0) {
      testCases.forEach((testCase) => {
        const hasSuccess =
          stdout.includes("✓") ||
          stdout.includes("PASS") ||
          stdout.includes("SUCCESS") ||
          stdout.includes("completed");
        const hasError =
          stderr.length > 0 ||
          stdout.includes("✗") ||
          stdout.includes("FAIL") ||
          stdout.includes("ERROR");

        testCase.status = hasError
          ? "FAILED"
          : hasSuccess
          ? "PASSED"
          : "UNKNOWN";
      });
    } else {
      testCases.forEach((testCase) => {
        testCase.status = "READY_TO_RUN";
      });
    }

    return testCases;
  }

  parseTestCasesFromCode(testCode) {
    const testCases = [];

    const lines = testCode.split("\n");

    lines.forEach((line, index) => {
      const testCommentMatch = line.match(
        /\/\/\s*(Test\s*\d*:?\s*(.+)|(\d+)\.\s*(.+))/i
      );
      if (testCommentMatch) {
        const description =
          testCommentMatch[2] || testCommentMatch[4] || testCommentMatch[1];
        if (description && description.trim().length > 5) {
          testCases.push({
            name: description.trim(),
            status: "GENERATED",
            lineNumber: index + 1,
          });
        }
      }
    });

    if (testCases.length === 0) {
      const blockComments = testCode.match(/\/\*[\s\S]*?\*\//g) || [];
      blockComments.forEach((comment, index) => {
        const cleanComment = comment.replace(/\/\*|\*\//g, "").trim();
        if (cleanComment.length > 20 && !cleanComment.includes("TODO")) {
          testCases.push({
            name:
              cleanComment.substring(0, 100) +
              (cleanComment.length > 100 ? "..." : ""),
            status: "GENERATED",
            lineNumber: index + 1,
          });
        }
      });
    }

    if (testCases.length === 0) {
      let testCount = 1;
      const patterns = [
        /agent\.navigate\(/,
        /await\s+agent\.act\(['"].*navigate/i,
        /await\s+agent\.act\(['"].*click.*button/i,
        /await\s+agent\.act\(['"].*verify/i,
      ];

      patterns.forEach((pattern) => {
        const matches = testCode.match(new RegExp(pattern.source, "gi"));
        if (matches && matches.length > 0) {
          testCases.push({
            name: `Test Scenario ${testCount++}`,
            status: "GENERATED",
            lineNumber: 1,
          });
        }
      });
    }

    if (testCases.length === 0) {
      testCases.push({
        name: "Generated test execution",
        status: "GENERATED",
        lineNumber: 1,
      });
    }

    return testCases;
  }
}

module.exports = TestExecutor;
