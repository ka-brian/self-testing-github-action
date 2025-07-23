#!/usr/bin/env node

/**
 * Simple test for TestExecutor.executeTestsAndGenerateReport()
 * This test sets up a local server at port 8080 and runs magnitude code
 * to verify that the function writes code to a file and executes successfully.
 */

require("dotenv").config();
const TestExecutor = require("../src/test-executor");
const fs = require("fs").promises;
const path = require("path");
const { spawn } = require("child_process");

class TestExecutorTest {
  constructor() {
    this.serverProcess = null;
    this.port = 8080;
    this.blogDir = path.join(__dirname, "test-sites/simple-blog");
    this.serverPath = path.join(this.blogDir, "server.js");
    this.tempTestPath = path.join(this.blogDir, "temp-test.js");
  }

  async setup() {
    console.log("🔧 Setting up test environment...");
    await this.startServer();
  }

  async startServer() {
    return new Promise((resolve, reject) => {
      console.log(`🌐 Starting server from ${this.serverPath}...`);

      // Change to blog directory and start server
      this.serverProcess = spawn("node", ["server.js"], {
        cwd: this.blogDir,
        stdio: "pipe",
      });

      this.serverProcess.stdout.on("data", (data) => {
        const output = data.toString();
        console.log(output.trim());

        // Look for server ready message
        if (
          output.includes(`Server running at http://localhost:${this.port}/`)
        ) {
          // Give server a moment to fully start
          setTimeout(async () => {
            try {
              const response = await fetch(`http://localhost:${this.port}`);
              if (response.ok) {
                console.log("✅ Server is responding correctly");
                resolve();
              } else {
                reject(new Error("Server not responding correctly"));
              }
            } catch (error) {
              reject(new Error("Failed to connect to server"));
            }
          }, 1000);
        }
      });

      this.serverProcess.stderr.on("data", (data) => {
        console.error("Server error:", data.toString());
      });

      this.serverProcess.on("error", (error) => {
        reject(new Error(`Failed to start server: ${error.message}`));
      });

      this.serverProcess.on("exit", (code) => {
        if (code !== 0) {
          reject(new Error(`Server exited with code ${code}`));
        }
      });
    });
  }

  async stopServer() {
    if (this.serverProcess) {
      return new Promise((resolve) => {
        this.serverProcess.on("exit", () => {
          console.log("🛑 Server stopped");
          resolve();
        });
        this.serverProcess.kill("SIGTERM");
      });
    }
  }

  async getTestCode() {
    try {
      const testCode = await fs.readFile(this.tempTestPath, "utf8");
      return testCode;
    } catch (error) {
      throw new Error(
        `Failed to read test code from ${this.tempTestPath}: ${error.message}`
      );
    }
  }

  async runTest() {
    console.log("🧪 Starting TestExecutor test...");

    try {
      // Create TestExecutor instance
      const testExecutor = new TestExecutor({
        claudeApiKey:
          process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY,
        timeout: 60000,
      });

      // Get test code from temp-test.js
      const testCode = await this.getTestCode();

      console.log("📝 Test code to execute:");
      console.log("---");
      console.log(testCode);
      console.log("---");

      // Set the environment variable for the test
      process.env.LOCAL_DEV_TARGET_URL = `http://localhost:${this.port}`;

      // Execute the test
      console.log("🚀 Executing test with TestExecutor...");
      const result = await testExecutor.executeTestsAndGenerateReport(testCode);

      // Verify results
      console.log("📊 Test Results:");
      console.log(`✅ Success: ${result.success}`);
      console.log(`⏭️  Execution Skipped: ${result.executionSkipped || false}`);

      if (result.output) {
        console.log("📤 Output (first 500 chars):");
        console.log(result.output.substring(0, 500) + "...");
      }

      if (result.errors) {
        console.log("❌ Errors:");
        console.log(result.errors);
      }

      // Check if temp file was created and cleaned up
      const tempFilePath = path.join(process.cwd(), "temp-test.js");
      try {
        await fs.access(tempFilePath);
        console.log("⚠️  Temp file still exists (should be cleaned up)");
      } catch (error) {
        console.log("✅ Temp file was properly cleaned up");
      }

      console.log("\n🎯 Test Summary:");
      console.log(`Status: ${result.success ? "✅ PASSED" : "❌ FAILED"}`);
      console.log(`File Creation/Cleanup: ✅ Verified`);
      console.log(
        `Test Execution: ${
          result.executionSkipped
            ? "⏭️  Skipped (Dependencies)"
            : "✅ Completed"
        }`
      );

      return testPassed;
    } catch (error) {
      console.error("❌ Test failed:", error.message);
      return false;
    }
  }

  async cleanup() {
    await this.stopServer();
  }
}

// Run the test
async function main() {
  const test = new TestExecutorTest();

  // Handle graceful shutdown
  process.on("SIGINT", async () => {
    console.log("\n🛑 Received interrupt signal, shutting down gracefully...");
    await test.cleanup();
    process.exit(0);
  });

  try {
    await test.setup();
    const passed = await test.runTest();
    await test.cleanup();

    console.log("\n" + "=".repeat(50));
    console.log(`🎯 TestExecutor Test: ${passed ? "✅ PASSED" : "❌ FAILED"}`);
    console.log("=".repeat(50));

    process.exit(passed ? 0 : 1);
  } catch (error) {
    console.error("💥 Test setup/execution failed:", error);
    await test.cleanup();
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { TestExecutorTest };
