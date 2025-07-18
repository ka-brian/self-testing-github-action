const { Octokit } = require("@octokit/rest");
const { exec } = require("child_process");
const fs = require("fs").promises;
const path = require("path");
const { promisify } = require("util");
const core = require("@actions/core");

const execAsync = promisify(exec);

class PRTestGenerator {
  constructor(config) {
    this.github = new Octokit({ auth: config.githubToken });
    this.claudeApiKey = config.claudeApiKey;
    this.owner = config.owner;
    this.repo = config.repo;
    this.prNumber = config.prNumber;
    this.testExamples = config.testExamples;
    this.outputDir = config.outputDir || ".github/generated-tests";
    this.timeout = config.timeout || 120000;
    this.commentOnPR = config.commentOnPR !== false;
  }

  async run() {
    const startTime = Date.now();

    try {
      core.info("📋 Fetching PR context...");
      const prContext = await this.getPRContext();

      core.info("🤖 Generating tests with Claude...");
      const testCode = await this.generateTests(prContext);

      core.info("💾 Writing test file...");
      const testFilePath = await this.writeTestFile(testCode);

      core.info("🧪 Executing tests...");
      const testResults = await this.executeTests(testFilePath);

      if (this.commentOnPR) {
        core.info("💬 Commenting results on PR...");
        await this.commentResults(testResults);
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      core.info(`✅ Completed in ${duration}s`);

      return {
        success: testResults.success,
        testFilePath,
        results: testResults,
        duration,
      };
    } catch (error) {
      core.error(`❌ Error: ${error.message}`);

      if (this.commentOnPR) {
        await this.commentError(error);
      }

      throw error;
    }
  }

  async getPRContext() {
    // Get PR details
    const { data: pr } = await this.github.pulls.get({
      owner: this.owner,
      repo: this.repo,
      pull_number: this.prNumber,
    });

    // Get PR files/changes
    const { data: files } = await this.github.pulls.listFiles({
      owner: this.owner,
      repo: this.repo,
      pull_number: this.prNumber,
    });

    // Get repo context
    const repoContext = await this.getRepoContext();

    return {
      pr: {
        title: pr.title,
        body: pr.body,
        head: pr.head.sha,
        base: pr.base.sha,
        author: pr.user.login,
      },
      files: files.map((file) => ({
        filename: file.filename,
        status: file.status,
        additions: file.additions,
        deletions: file.deletions,
        patch: file.patch,
      })),
      repoContext,
    };
  }

  async getRepoContext() {
    const contextFiles = [
      "package.json",
      "README.md",
      "tsconfig.json",
      "next.config.js",
      "vite.config.js",
      "webpack.config.js",
      ".env.example",
    ];

    const context = {};

    for (const filename of contextFiles) {
      try {
        const { data } = await this.github.repos.getContent({
          owner: this.owner,
          repo: this.repo,
          path: filename,
        });

        if (data.content && data.size < 50000) {
          // Limit file size
          context[filename] = Buffer.from(data.content, "base64").toString(
            "utf8"
          );
        }
      } catch (error) {
        // File doesn't exist or is too large, skip
        core.debug(`${filename} not found or too large, skipping`);
      }
    }

    return context;
  }

  async generateTests(prContext) {
    const prompt = this.buildPrompt(prContext);

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.claudeApiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 4000,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Claude API error: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    const data = await response.json();
    return data.content[0].text;
  }

  buildPrompt(prContext) {
    const changedFiles = prContext.files
      .filter((file) => file.patch) // Only files with actual changes
      .slice(0, 10); // Limit to prevent token overflow

    return `You are a test generator for a GitHub Pull Request. Generate comprehensive end-to-end tests using the Magnitude testing framework.

## Repository Context:
${Object.entries(prContext.repoContext)
  .map(
    ([file, content]) =>
      `### ${file}\n\`\`\`\n${content.slice(0, 1000)}${
        content.length > 1000 ? "..." : ""
      }\n\`\`\`\n`
  )
  .join("\n")}

## Pull Request Details:
- **Title**: ${prContext.pr.title}
- **Author**: ${prContext.pr.author}
- **Description**: ${prContext.pr.body || "No description provided"}
- **Files Changed**: ${prContext.files.length}

## Key Changes:
${changedFiles
  .map(
    (file) => `
### ${file.filename} (${file.status})
**Changes**: +${file.additions} -${file.deletions}
\`\`\`diff
${file.patch.slice(0, 2000)}${
      file.patch.length > 2000 ? "\n...(truncated)" : ""
    }
\`\`\`
`
  )
  .join("\n")}

## Test Framework Examples:
${this.testExamples}

## Requirements:
1. **Analyze the PR changes** and identify what functionality needs testing
2. **Generate realistic tests** that cover the new/modified behavior
3. **Use Magnitude syntax** as shown in the examples
4. **Focus on user-facing features** rather than internal implementation
5. **Include error cases** and edge cases where appropriate
6. **Make tests runnable** without requiring specific URLs or authentication

## Important Notes:
- Tests should work against a local development server
- Don't hardcode specific URLs - use relative paths
- Include appropriate waits and assertions
- Test both success and failure scenarios
- Return ONLY the test code, no explanations or markdown

Generate a complete, executable test file:`;
  }

  async writeTestFile(testCode) {
    // Ensure output directory exists
    await fs.mkdir(this.outputDir, { recursive: true });

    // Clean up the test code (remove markdown formatting)
    const cleanTestCode = testCode
      .replace(/```(?:javascript|js)?\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    // Add any necessary imports if not present
    if (
      !cleanTestCode.includes("import") &&
      !cleanTestCode.includes("require")
    ) {
      const imports = "import { test, expect } from 'magnitude';\n\n";
      cleanTestCode = imports + cleanTestCode;
    }

    const testFilePath = path.join(
      this.outputDir,
      `pr-${this.prNumber}-tests.js`
    );
    await fs.writeFile(testFilePath, cleanTestCode);

    core.info(`📝 Test file written: ${testFilePath}`);
    return testFilePath;
  }

  async executeTests(testFilePath) {
    try {
      // Install magnitude if not already installed
      await this.ensureMagnitudeInstalled();

      // Run the test file with timeout
      const { stdout, stderr } = await execAsync(
        `npx magnitude ${path.basename(testFilePath)}`,
        {
          timeout: this.timeout,
          cwd: this.outputDir,
          env: {
            ...process.env,
            NODE_ENV: "test",
          },
        }
      );

      return {
        success: true,
        stdout,
        stderr,
        testFilePath,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        stdout: error.stdout || "",
        stderr: error.stderr || "",
        testFilePath,
      };
    }
  }

  async ensureMagnitudeInstalled() {
    try {
      await execAsync("npm list magnitude", { cwd: this.outputDir });
      core.debug("✅ Magnitude already installed");
    } catch (error) {
      core.info("📦 Installing Magnitude...");

      // Create package.json if it doesn't exist
      try {
        await fs.access(path.join(this.outputDir, "package.json"));
      } catch {
        await execAsync("npm init -y", { cwd: this.outputDir });
      }

      await execAsync("npm install magnitude", { cwd: this.outputDir });
      core.info("✅ Magnitude installed");
    }
  }

  async commentResults(testResults) {
    const comment = this.formatResultsComment(testResults);

    await this.github.issues.createComment({
      owner: this.owner,
      repo: this.repo,
      issue_number: this.prNumber,
      body: comment,
    });
  }

  formatResultsComment(testResults) {
    const timestamp = new Date().toISOString();
    const emoji = testResults.success ? "🎉" : "❌";
    const status = testResults.success ? "PASSED" : "FAILED";

    return `## ${emoji} Generated Tests ${status}

*Auto-generated tests for PR #${this.prNumber} • ${timestamp}*

### Test Results:
\`\`\`
${testResults.stdout || "No output"}
\`\`\`

${
  testResults.stderr ? `### Errors:\n\`\`\`\n${testResults.stderr}\n\`\`\`` : ""
}

### Test File:
- **Location**: \`${testResults.testFilePath}\`
- **Status**: ${
      testResults.success ? "✅ Tests executed successfully" : "❌ Tests failed"
    }

${
  testResults.success
    ? "> **Note**: Test success indicates the generated tests ran without errors. Review the test logic to ensure it properly validates your changes."
    : "> **Note**: Test failures may indicate issues with the generated tests or the code changes. Please review and adjust as needed."
}

---
<sub>Generated by [PR Test Generator](https://github.com/yourusername/pr-test-generator)</sub>`;
  }

  async commentError(error) {
    try {
      await this.github.issues.createComment({
        owner: this.owner,
        repo: this.repo,
        issue_number: this.prNumber,
        body: `## ❌ Test Generation Failed

An error occurred while generating tests for PR #${this.prNumber}:

\`\`\`
${error.message}
\`\`\`

This might be due to:
- Repository structure not being recognized
- Claude API rate limits or errors
- Test execution environment issues

Please check the action logs for more details.

---
<sub>Generated by [PR Test Generator](https://github.com/yourusername/pr-test-generator)</sub>`,
      });
    } catch (commentError) {
      core.error(`Failed to comment error: ${commentError.message}`);
    }
  }
}

module.exports = PRTestGenerator;
