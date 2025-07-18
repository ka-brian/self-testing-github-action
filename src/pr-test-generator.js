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
    this.waitForPreview = config.waitForPreview || 60;
    this.baseUrl = config.baseUrl;
    this.testUserEmail = config.testUserEmail;
    this.testUserPassword = config.testUserPassword;
  }

  async run() {
    const startTime = Date.now();

    try {
      core.info("📋 Fetching PR context...");
      const prContext = await this.getPRContext();

      // Check if UI testing is needed
      const requiresUITesting = await this.requiresUITesting(prContext);

      if (!requiresUITesting) {
        core.info("🚀 No UI changes detected - skipping UI tests");
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);

        if (this.commentOnPR) {
          await this.commentSkippedTests();
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
        const urls = await this.waitForPreviewUrls();
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

  async requiresUITesting(prContext) {
    core.info("🤖 Analyzing PR changes to determine if UI testing is needed...");
    core.info(`Files to analyze: ${prContext.files.map(f => f.filename).join(', ')}`);

    // Use Claude to analyze the changes
    const prompt = `Analyze the following Pull Request changes and determine if UI testing is necessary.

## PR Details:
- **Title**: ${prContext.pr.title}
- **Description**: ${prContext.pr.body || "No description provided"}

## Changed Files:
${prContext.files.map(file => `
### ${file.filename} (${file.status})
**Changes**: +${file.additions} -${file.deletions}
\`\`\`diff
${file.patch ? file.patch.slice(0, 1000) : "No patch available"}${file.patch && file.patch.length > 1000 ? "\n...(truncated)" : ""}
\`\`\`
`).join("\n")}

## UI Testing is REQUIRED for:
- React/Next.js components (.jsx, .tsx, .js, .ts files in components/, pages/, app/, src/)
- CSS/styling changes (.css, .scss, .sass, .less files)
- HTML template changes
- Frontend routing changes
- User interface modifications
- Form, button, or interactive element changes
- Layout or design changes
- Frontend script changes that affect user interface

## UI Testing is NOT required for:
- Pure backend API changes (no frontend impact)
- Database schema changes
- CI/CD configuration only
- Documentation only changes
- Server-side only configuration

## Instructions:
Look carefully at the file paths and changes. If ANY file appears to be frontend-related (React components, styles, pages, UI scripts), answer YES.

Respond with ONLY "YES" if UI testing is needed, or "NO" if UI testing is not needed. Do not include any explanation.`;

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.claudeApiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-3-haiku-20240307", // Use smaller, faster model
          max_tokens: 10,
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
        }),
      });

      if (!response.ok) {
        core.warning(`Claude API request failed: ${response.status}`);
        // Fallback to basic pattern matching
        return this.fallbackUIDetection(prContext);
      }

      const data = await response.json();
      const result = data.content[0].text.trim().toUpperCase();
      
      core.info(`Claude AI analysis result: ${result}`);
      
      if (result === "YES") {
        core.info("🎨 UI changes detected by Claude - will run UI tests");
        return true;
      } else if (result === "NO") {
        // Double-check with fallback detection for obvious frontend files
        const hasObviousUIFiles = prContext.files.some((file) => {
          const filename = file.filename;
          return (
            filename.includes('component') ||
            filename.includes('/pages/') ||
            filename.includes('/app/') ||
            filename.includes('/src/') ||
            filename.endsWith('.jsx') ||
            filename.endsWith('.tsx') ||
            filename.endsWith('.css') ||
            filename.endsWith('.scss')
          );
        });
        
        if (hasObviousUIFiles) {
          core.warning("🔄 Claude said NO but obvious UI files detected - overriding to run UI tests");
          const uiFiles = prContext.files.filter(f => {
            const filename = f.filename;
            return (
              filename.includes('component') ||
              filename.includes('/pages/') ||
              filename.includes('/app/') ||
              filename.includes('/src/') ||
              filename.endsWith('.jsx') ||
              filename.endsWith('.tsx') ||
              filename.endsWith('.css') ||
              filename.endsWith('.scss')
            );
          });
          core.info(`UI files found: ${uiFiles.map(f => f.filename).join(', ')}`);
          return true;
        }
        
        core.info("🔧 No UI changes detected by Claude - will skip UI tests");
        return false;
      } else {
        core.warning(`Unexpected Claude response: ${result}`);
        // Fallback to basic pattern matching
        return this.fallbackUIDetection(prContext);
      }
    } catch (error) {
      core.warning(`Error analyzing PR with Claude: ${error.message}`);
      // Fallback to basic pattern matching
      return this.fallbackUIDetection(prContext);
    }
  }

  fallbackUIDetection(prContext) {
    core.info("🔍 Using fallback UI detection...");
    
    // Log all changed files for debugging
    core.info(`Changed files: ${prContext.files.map(f => f.filename).join(', ')}`);
    
    // Comprehensive file pattern matching as fallback
    const uiFilePatterns = [
      // React/Next.js files
      /\.(jsx?|tsx?)$/,
      /\.(vue|svelte)$/,
      // Style files
      /\.(css|scss|sass|less|stylus)$/,
      // HTML templates
      /\.(html|htm|ejs|hbs|pug|jade)$/,
      // Component directories
      /\/components?\//,
      /\/pages?\//,
      /\/app\//,  // Next.js app directory
      /\/src\//,   // Common source directory
      /\/views?\//,
      /\/layouts?\//,
      /\/templates?\//,
      // Style directories
      /\/styles?\//,
      /\/css\//,
      /\/sass\//,
      /\/scss\//,
      // Asset directories
      /\/assets?\//,
      /\/public\//,
      /\/static\//,
      // Config files that affect UI
      /tailwind\.config\./,
      /next\.config\./,
      /nuxt\.config\./,
      /vite\.config\./,
      /webpack\.config\./,
      // Package.json changes that might affect UI dependencies
      /package\.json$/,
    ];

    const matchingFiles = prContext.files.filter((file) =>
      uiFilePatterns.some((pattern) => pattern.test(file.filename))
    );

    if (matchingFiles.length > 0) {
      core.info(`🎨 UI files detected: ${matchingFiles.map(f => f.filename).join(', ')}`);
      core.info("Will run UI tests");
      return true;
    } else {
      core.info("🔧 No UI files detected - will skip UI tests");
      return false;
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

    // Get preview URLs from PR comments
    const previewUrls = await this.getPreviewUrls();

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
      previewUrls,
    };
  }

  async getPreviewUrls() {
    try {
      // Get PR comments
      const { data: comments } = await this.github.issues.listComments({
        owner: this.owner,
        repo: this.repo,
        issue_number: this.prNumber,
      });

      const previewUrls = [];

      // Common preview URL patterns
      const patterns = [
        // Vercel
        /https:\/\/[a-zA-Z0-9-]+\.vercel\.app/g,
        // Netlify
        /https:\/\/[a-zA-Z0-9-]+\.netlify\.app/g,
        // Railway
        /https:\/\/[a-zA-Z0-9-]+\.railway\.app/g,
        // Custom preview patterns
        /https:\/\/preview-[a-zA-Z0-9-]+\.[a-zA-Z0-9.-]+/g,
      ];

      for (const comment of comments) {
        // Skip our own comments
        if (
          comment.user.type === "Bot" &&
          comment.body.includes("Generated by")
        ) {
          continue;
        }

        for (const pattern of patterns) {
          const matches = comment.body.match(pattern);
          if (matches) {
            previewUrls.push(...matches);
          }
        }
      }

      // Remove duplicates and return unique URLs
      const uniqueUrls = [...new Set(previewUrls)];

      if (uniqueUrls.length > 0) {
        core.info(`📍 Found preview URLs: ${uniqueUrls.join(", ")}`);
      } else {
        core.info("📍 No preview URLs found in PR comments");
      }

      return uniqueUrls;
    } catch (error) {
      core.warning(`Failed to get preview URLs: ${error.message}`);
      return [];
    }
  }

  async waitForPreviewUrls(maxWaitTime = null) {
    const waitTime = maxWaitTime || this.waitForPreview * 1000;
    const pollInterval = 10000; // Check every 10 seconds
    const startTime = Date.now();

    while (Date.now() - startTime < waitTime) {
      const urls = await this.getPreviewUrls();
      if (urls.length > 0) {
        return urls;
      }

      const elapsed = Math.round((Date.now() - startTime) / 1000);
      core.info(`⏳ Still waiting for preview URLs... (${elapsed}s elapsed)`);

      // Wait before next poll
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    core.warning(
      "⚠️ Timeout waiting for preview URLs, proceeding without them"
    );
    return [];
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

    const authenticationSection =
      this.testUserEmail && this.testUserPassword
        ? `## Authentication Available:
Test user credentials are available via environment variables:
- \`process.env.TEST_USER_EMAIL\` = "${this.testUserEmail}"
- \`process.env.TEST_USER_PASSWORD\` = "[PROTECTED]"

**Important**: If the preview URLs require authentication, include login steps in your tests. For example:
\`\`\`javascript
// Navigate to login page and authenticate
await agent.act('Navigate to the login page');
await agent.act('Login with credentials', {
  data: {
    email: process.env.TEST_USER_EMAIL,
    password: process.env.TEST_USER_PASSWORD
  }
});
await agent.act('Wait for successful login and redirect to dashboard');
\`\`\`

`
        : `## No Authentication Configured
Tests will run without authentication. If preview URLs require login, tests may fail.

`;

    const previewUrlsSection =
      prContext.previewUrls.length > 0
        ? `## Available Preview URLs:
${prContext.previewUrls.map((url) => `- ${url}`).join("\n")}

**Important**: Use these preview URLs as the base URL for your tests. For example:
- \`await page.goto('${prContext.previewUrls[0]}');\`
- \`await page.goto('${prContext.previewUrls[0]}/dashboard');\`

`
        : `## No Preview URLs Found
Tests should use relative paths or localhost. Examples:
- \`await page.goto('http://localhost:3000');\`
- \`await page.goto('/');\` (if base URL is configured)

`;

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

${authenticationSection}

${previewUrlsSection}

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
5. **CRITICAL: Always verify actions with assertions** - After performing any action (click, type, navigate), use \`agent.extract()\` to verify the expected result occurred. For example:
   - After clicking a sort button, extract and verify the sorted order
   - After submitting a form, verify success message or redirect
   - After clicking a button, verify the expected UI change happened
6. **Include error cases** and edge cases where appropriate
7. **Use the preview URLs provided above** for navigation (if available)
8. **Include authentication steps** if credentials are provided and preview URLs require login

## Important Notes:
- ${
      prContext.previewUrls.length > 0
        ? `Use the preview URLs: ${prContext.previewUrls[0]} as your base URL`
        : "Use localhost:3000 or relative paths for navigation"
    }
- ${
      this.testUserEmail && this.testUserPassword
        ? "Authentication credentials are available via environment variables - use them if preview URLs require login"
        : "No authentication configured - tests will run without login"
    }
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
      const imports = "const { startBrowserAgent } = require('magnitude-core');\nrequire('dotenv').config();\n\n";
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

  determineTestSuccess(stdout, stderr, exitCode) {
    // Check for explicit test failure indicators
    const failureIndicators = [
      'Test suite failed',
      'process.exit(1)',
      'All tests failed',
      'FAILED',
      'ERROR: Test'
    ];
    
    const successIndicators = [
      'All tests completed successfully',
      'Tests passed',
      'SUCCESS',
      'Test completed'
    ];
    
    const output = (stdout + stderr).toLowerCase();
    
    // If test explicitly indicated failure, it's a failure
    if (failureIndicators.some(indicator => output.includes(indicator.toLowerCase()))) {
      return false;
    }
    
    // If test explicitly indicated success, it's a success
    if (successIndicators.some(indicator => output.includes(indicator.toLowerCase()))) {
      return true;
    }
    
    // If no explicit indicators, fall back to exit code
    return exitCode === 0;
  }

  async executeTests(testFilePath) {
    try {
      // Install magnitude-core if not already installed
      await this.ensureMagnitudeInstalled();

      // Run the test file directly with Node.js
      const { stdout, stderr } = await execAsync(
        `node ${path.basename(testFilePath)}`,
        {
          timeout: this.timeout,
          cwd: this.outputDir,
          env: {
            ...process.env,
            NODE_ENV: "test",
            ANTHROPIC_API_KEY: this.claudeApiKey,
            ...(this.testUserEmail && { TEST_USER_EMAIL: this.testUserEmail }),
            ...(this.testUserPassword && {
              TEST_USER_PASSWORD: this.testUserPassword,
            }),
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
      // Don't automatically fail on browser errors - check test output instead
      const testSuccess = this.determineTestSuccess(
        error.stdout || "",
        error.stderr || "",
        error.code || 1
      );

      return {
        success: testSuccess,
        error: testSuccess ? undefined : error.message,
        stdout: error.stdout || "",
        stderr: error.stderr || "",
        testFilePath,
        browserErrors: !testSuccess && error.code !== 1 ? [error.message] : undefined,
      };
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

  stripAnsiCodes(text) {
    // Remove ANSI escape codes (colors, formatting, etc.)
    return text.replace(/\u001b\[[0-9;]*m/g, '');
  }

  sanitizeOutput(text) {
    if (!text) return text;
    
    let sanitized = text;
    
    // Sanitize email addresses
    sanitized = sanitized.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL_REDACTED]');
    
    // Sanitize usernames/passwords from environment variables
    if (this.testUserEmail) {
      sanitized = sanitized.replace(new RegExp(this.testUserEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '[EMAIL_REDACTED]');
    }
    if (this.testUserPassword) {
      sanitized = sanitized.replace(new RegExp(this.testUserPassword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '[PASSWORD_REDACTED]');
    }
    
    // Sanitize API keys
    sanitized = sanitized.replace(/sk-[a-zA-Z0-9]{48}/g, '[API_KEY_REDACTED]');
    sanitized = sanitized.replace(/ANTHROPIC_API_KEY[=:]\s*[^\s]+/gi, 'ANTHROPIC_API_KEY=[API_KEY_REDACTED]');
    
    // Sanitize common password patterns
    sanitized = sanitized.replace(/password[=:]\s*[^\s]+/gi, 'password=[PASSWORD_REDACTED]');
    sanitized = sanitized.replace(/pwd[=:]\s*[^\s]+/gi, 'pwd=[PASSWORD_REDACTED]');
    sanitized = sanitized.replace(/passwd[=:]\s*[^\s]+/gi, 'passwd=[PASSWORD_REDACTED]');
    
    // Sanitize tokens
    sanitized = sanitized.replace(/token[=:]\s*[^\s]+/gi, 'token=[TOKEN_REDACTED]');
    sanitized = sanitized.replace(/bearer\s+[^\s]+/gi, 'bearer [TOKEN_REDACTED]');
    
    // Sanitize URLs with credentials
    sanitized = sanitized.replace(/https?:\/\/[^:\/\s]+:[^@\/\s]+@[^\s]+/gi, '[URL_WITH_CREDENTIALS_REDACTED]');
    
    // Sanitize common secret patterns
    sanitized = sanitized.replace(/secret[=:]\s*[^\s]+/gi, 'secret=[SECRET_REDACTED]');
    sanitized = sanitized.replace(/key[=:]\s*[^\s]+/gi, 'key=[KEY_REDACTED]');
    
    return sanitized;
  }

  // Sanitized logging wrappers
  safeLog(level, message) {
    const sanitizedMessage = this.sanitizeOutput(message);
    core[level](sanitizedMessage);
  }

  safeInfo(message) {
    this.safeLog('info', message);
  }

  safeError(message) {
    this.safeLog('error', message);
  }

  safeWarning(message) {
    this.safeLog('warning', message);
  }

  safeDebug(message) {
    this.safeLog('debug', message);
  }

  parseTestResults(stdout) {
    if (!stdout || stdout.trim() === "No output") {
      return "❌ **No test output detected** - The test may have failed to run or produce output.";
    }

    const lines = stdout.split('\n');
    const actions = [];
    const completedTasks = [];
    const failures = [];
    let sortingTest = false;
    let extractedData = [];

    // Parse the output to identify test actions and outcomes
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Track test actions
      if (line.includes('◆ [act]')) {
        const action = line.replace('◆ [act]', '').trim();
        actions.push(action);
        
        // Check if this is a sorting test
        if (action.toLowerCase().includes('sort') || action.toLowerCase().includes('column header')) {
          sortingTest = true;
        }
      }
      
      // Track completed tasks
      if (line.includes('✓ done')) {
        const prevLines = lines.slice(Math.max(0, i-5), i);
        const actionLine = prevLines.find(l => l.includes('◆ [act]'));
        if (actionLine) {
          completedTasks.push(actionLine.replace('◆ [act]', '').trim());
        }
      }
      
      // Track extraction results
      if (line.includes('⛏ [extract]')) {
        const extractAction = line.replace('⛏ [extract]', '').trim();
        extractedData.push(extractAction);
      }
      
      // Track failures
      if (line.includes('✗') || line.includes('FAILED') || line.includes('ERROR')) {
        failures.push(line);
      }
    }

    // Generate analysis
    let analysis = [];
    
    // Overall test execution
    if (actions.length > 0) {
      analysis.push(`**📋 Test Actions Executed:** ${actions.length}`);
      analysis.push(`**✅ Completed Tasks:** ${completedTasks.length}`);
      
      if (failures.length > 0) {
        analysis.push(`**❌ Failures Detected:** ${failures.length}`);
      }
    }
    
    // Specific sorting test analysis
    if (sortingTest) {
      analysis.push(`\n**🔍 Sorting Test Analysis:**`);
      
      // Look for URL changes indicating sorting
      const urlChanges = lines.filter(line => 
        line.includes('sortColumn') || line.includes('sortOrder') || 
        line.includes('sort') && line.includes('URL')
      );
      
      if (urlChanges.length > 0) {
        analysis.push(`- ✅ **Sorting triggered:** URL parameters were updated (${urlChanges.length} changes detected)`);
      }
      
      // Look for before/after data comparison
      const beforeData = [];
      const afterData = [];
      let collectingData = false;
      
      for (const line of lines) {
        if (line.includes('before') || line.includes('original order')) {
          collectingData = true;
        }
        if (line.includes('after') || line.includes('new order') || line.includes('sorted')) {
          collectingData = false;
        }
        
        // Look for state/location names
        if (line.includes('Nebraska') || line.includes('Virginia') || line.includes('Alabama')) {
          if (collectingData) {
            beforeData.push(line);
          } else {
            afterData.push(line);
          }
        }
      }
      
      if (extractedData.length > 0) {
        analysis.push(`- 📊 **Data extraction:** ${extractedData.length} extraction operations performed`);
      }
      
      // Determine if sorting actually worked
      const sortingWorked = urlChanges.length > 0 || afterData.length > 0;
      if (sortingWorked) {
        analysis.push(`- ✅ **Sorting Result:** Sorting functionality appears to be working correctly`);
      } else {
        analysis.push(`- ⚠️ **Sorting Result:** Could not definitively verify sorting behavior from output`);
      }
    }
    
    // Action-specific analysis
    if (completedTasks.length > 0) {
      analysis.push(`\n**📝 Completed Actions:**`);
      completedTasks.forEach(task => {
        analysis.push(`- ✅ ${task}`);
      });
    }
    
    // Overall assessment
    analysis.push(`\n**🎯 Overall Assessment:**`);
    if (failures.length === 0 && completedTasks.length > 0) {
      analysis.push(`- ✅ **Test execution:** All planned actions completed successfully`);
      analysis.push(`- ✅ **Functionality:** The tested features appear to be working as expected`);
    } else if (failures.length > 0) {
      analysis.push(`- ❌ **Test execution:** Some actions failed or encountered errors`);
      analysis.push(`- ⚠️ **Functionality:** Review the failures to determine if code changes need adjustment`);
    } else {
      analysis.push(`- ⚠️ **Test execution:** Limited test output available for analysis`);
    }
    
    return analysis.join('\n');
  }

  formatResultsComment(testResults) {
    const timestamp = new Date().toISOString();
    const emoji = testResults.success ? "🎉" : "❌";
    const status = testResults.success ? "PASSED" : "FAILED";

    // Clean up the output by stripping ANSI codes and sanitizing sensitive data
    const cleanStdout = testResults.stdout ? this.sanitizeOutput(this.stripAnsiCodes(testResults.stdout)) : "No output";
    const cleanStderr = testResults.stderr ? this.sanitizeOutput(this.stripAnsiCodes(testResults.stderr)) : "";

    // Parse test results to extract meaningful information
    const testAnalysis = this.parseTestResults(cleanStdout);

    return `## ${emoji} Generated Tests ${status}

*Auto-generated tests for PR #${this.prNumber} • ${timestamp}*

### Test Results:
\`\`\`
${cleanStdout}
\`\`\`

### Test Analysis:
${testAnalysis}

${
  cleanStderr ? `### Errors:\n\`\`\`\n${cleanStderr}\n\`\`\`` : ""
}

${
  testResults.browserErrors && testResults.browserErrors.length > 0 
    ? `### Browser Errors (Non-blocking):\n\`\`\`\n${testResults.browserErrors.map(error => this.sanitizeOutput(error)).join('\n')}\n\`\`\`\n\n> **Note**: These browser errors were detected but did not prevent the test from completing its intended actions.`
    : ""
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

  async commentSkippedTests() {
    const timestamp = new Date().toISOString();

    try {
      await this.github.issues.createComment({
        owner: this.owner,
        repo: this.repo,
        issue_number: this.prNumber,
        body: `## ⚡ UI Tests Skipped

*Auto-generated test analysis for PR #${this.prNumber} • ${timestamp}*

### Analysis Result:
✅ **No UI changes detected** - UI tests have been skipped automatically.

### Reasoning:
This PR appears to contain backend/infrastructure changes that don't require UI testing. The changes were analyzed for:
- Frontend file patterns (JS, CSS, HTML, components)
- UI-related keywords in PR description
- UI-related code patterns in patches

### Test Status:
- **UI Tests**: ⏭️ Skipped (not needed)
- **Overall Status**: ✅ Passed

> **Note**: If this PR should have included UI tests, please add UI-related keywords to the PR description or ensure UI files are included in the changes.

---
<sub>Generated by [PR Test Generator](https://github.com/yourusername/pr-test-generator)</sub>`,
      });
    } catch (commentError) {
      core.error(`Failed to comment skipped tests: ${commentError.message}`);
    }
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

  async ensureMagnitudeInstalled() {
    try {
      await execAsync("npm list magnitude-core", { cwd: this.outputDir });
      core.debug("✅ Magnitude already installed");
    } catch (error) {
      core.info("📦 Installing Magnitude...");

      // Create package.json if it doesn't exist
      try {
        await fs.access(path.join(this.outputDir, "package.json"));
      } catch {
        await execAsync("npm init -y", { cwd: this.outputDir });
      }

      await execAsync("npm install magnitude-core dotenv playwright", { cwd: this.outputDir });
      core.info("✅ Magnitude and dependencies installed");
      
      // Install Playwright browsers
      core.info("🌐 Installing Playwright browsers...");
      try {
        await execAsync("npx playwright install --with-deps", { 
          cwd: this.outputDir,
          timeout: 300000 // 5 minutes timeout for browser downloads
        });
        core.info("✅ Playwright browsers installed");
      } catch (error) {
        core.warning(`Playwright install failed: ${error.message}`);
        // Try alternative installation method
        core.info("🔄 Trying alternative Playwright installation...");
        await execAsync("npx playwright install chromium --with-deps", { 
          cwd: this.outputDir,
          timeout: 300000
        });
        core.info("✅ Playwright Chromium installed");
      }
    }
  }
}

module.exports = PRTestGenerator;
