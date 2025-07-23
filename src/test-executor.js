const { exec, spawn } = require("child_process");
const fs = require("fs").promises;
const path = require("path");
const { promisify } = require("util");
const core = require("@actions/core");

const execAsync = promisify(exec);

class TestExecutor {
  constructor(config) {
    this.timeout = 120000;
    this.claudeApiKey = config.claudeApiKey;
  }

  async executeTestsAndGenerateReport(testCode) {
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
          output:
            "Test code generated successfully but not executed (dependency installation failed)",
          errors: `Failed to install dependencies: ${error.message}`,
          executionSkipped: true,
        };
      }
    }

    try {
      const testFilePath = path.join(process.cwd(), "temp-test.js");
      await fs.writeFile(testFilePath, testCode);

      core.info("🚀 Running generated tests...");
      const env = {
        ...process.env,
        ANTHROPIC_API_KEY: this.claudeApiKey,
      };

      let stdoutCopy;
      let stderrCopy;

      try {
        core.info(`📝 About to execute: node ${testFilePath}`);
        core.info(`📝 Working directory: ${process.cwd()}`);
        core.info(`📝 Timeout: ${this.timeout}ms`);

        const { stdout, stderr } = await this.executeWithRealTimeLogging(
          testFilePath,
          env
        );

        core.info(`📝 Command completed successfully`);
        if (stderr) {
          core.info("⚠️ stderr output:");
          core.info(stderr);
        }

        stdoutCopy = stdout;
        stderrCopy = stderr;
      } catch (e) {
        core.error("❌ Command failed with error:");
        core.error(`Error message: ${e.message}`);
        core.error(`Error code: ${e.code}`);
        core.error(`Error signal: ${e.signal}`);
        if (e.stdout) {
          core.error(`stdout: ${e.stdout}`);
        }
        if (e.stderr) {
          core.error(`stderr: ${e.stderr}`);
        }

        // Re-throw to be caught by outer try-catch
        throw e;
      }

      await fs.unlink(testFilePath);

      return {
        success: true,
        output: stdoutCopy,
        errors: stderrCopy,
        executionSkipped: false,
      };
    } catch (error) {
      core.warning(`Test execution failed: ${error.message}`);

      return {
        success: true,
        output: "",
        errors: `Execution failed (dependencies may be missing): ${error.message}`,
        executionSkipped: true,
      };
    }
  }

  async executeWithRealTimeLogging(testFilePath, env) {
    return new Promise((resolve, reject) => {
      const child = spawn("node", [testFilePath], {
        env: env,
        stdio: ["pipe", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (data) => {
        const output = data.toString();
        stdout += output;
        // Log each line in real-time
        output.split("\n").forEach((line) => {
          if (line.trim()) {
            core.info(`📤 ${line}`);
          }
        });
      });

      child.stderr.on("data", (data) => {
        const output = data.toString();
        stderr += output;
        // Log stderr in real-time
        output.split("\n").forEach((line) => {
          if (line.trim()) {
            core.error(`🚨 ${line}`);
          }
        });
      });

      const timeout = setTimeout(() => {
        core.warning(
          `⏰ TIMEOUT REACHED: Test execution timed out after ${
            this.timeout
          }ms (${this.timeout / 1000} seconds)`
        );
        core.warning(`🛑 Killing process and terminating test execution...`);
        child.kill("SIGTERM");
        reject(new Error(`Command timed out after ${this.timeout}ms`));
      }, this.timeout);

      child.on("close", (code, signal) => {
        clearTimeout(timeout);
        if (code === 0) {
          resolve({ stdout, stderr });
        } else {
          const error = new Error(`Command failed: node ${testFilePath}`);
          error.code = code;
          error.signal = signal;
          error.stdout = stdout;
          error.stderr = stderr;
          reject(error);
        }
      });

      child.on("error", (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
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
}

module.exports = TestExecutor;
