#!/usr/bin/env node

/**
 * Local Test Runner for PR Test Generator - Static Blog Edition
 * 
 * This script allows you to test the GitHub Action locally with mock data
 * using a static blog site instead of external dependencies.
 */

// Load environment variables from .env file
require('dotenv').config();

const PRTestGenerator = require('../src/pr-test-generator');
const { mockGitHubContext, createMockPRData } = require('./mocks/github-mock');
const { evalSuite } = require('./eval-suite');
const path = require('path');
const fs = require('fs').promises;
const http = require('http');
const { spawn } = require('child_process');

// Mock environment variables
process.env.GITHUB_ACTIONS = 'false'; // Indicate we're not in GitHub Actions
process.env.NODE_ENV = 'test';

class LocalTestRunner {
  constructor(options = {}) {
    this.claudeApiKey = options.claudeApiKey || process.env.CLAUDE_API_KEY;
    this.testDir = path.join(__dirname, '../test-outputs');
    this.blogDir = path.join(__dirname, 'test-sites/simple-blog');
    this.blogPort = 8080;
    this.blogServer = null;
    this.evalResults = [];
    this.startTime = null;
    
    if (!this.claudeApiKey) {
      throw new Error('CLAUDE_API_KEY environment variable is required');
    }
  }

  async setup() {
    // Ensure test output directory exists
    await fs.mkdir(this.testDir, { recursive: true });
    
    console.log('🔧 Setting up local test environment...');
    console.log(`📁 Test output directory: ${this.testDir}`);
    console.log(`📁 Blog directory: ${this.blogDir}`);
    
    // Start the blog server
    await this.startBlogServer();
  }

  async startBlogServer() {
    return new Promise((resolve, reject) => {
      console.log(`🌐 Starting blog server on port ${this.blogPort}...`);
      
      // Simple static file server
      const server = http.createServer(async (req, res) => {
        let filePath = path.join(this.blogDir, req.url === '/' ? 'index.html' : req.url);
        
        try {
          const stat = await fs.stat(filePath);
          if (stat.isDirectory()) {
            filePath = path.join(filePath, 'index.html');
          }
          
          const data = await fs.readFile(filePath);
          const ext = path.extname(filePath);
          
          let contentType = 'text/html';
          if (ext === '.css') contentType = 'text/css';
          if (ext === '.js') contentType = 'application/javascript';
          if (ext === '.png') contentType = 'image/png';
          if (ext === '.jpg') contentType = 'image/jpeg';
          if (ext === '.ico') contentType = 'image/x-icon';
          
          res.writeHead(200, { 'Content-Type': contentType });
          res.end(data);
        } catch (error) {
          res.writeHead(404, { 'Content-Type': 'text/html' });
          res.end('<h1>404 Not Found</h1>');
        }
      });

      server.listen(this.blogPort, (err) => {
        if (err) {
          reject(err);
        } else {
          this.blogServer = server;
          console.log(`✅ Blog server running at http://localhost:${this.blogPort}`);
          
          // Test if server is responding
          setTimeout(async () => {
            try {
              const response = await fetch(`http://localhost:${this.blogPort}`);
              if (response.ok) {
                console.log('✅ Blog server is responding correctly');
                resolve();
              } else {
                reject(new Error('Blog server not responding correctly'));
              }
            } catch (error) {
              reject(new Error('Failed to connect to blog server'));
            }
          }, 1000);
        }
      });
    });
  }

  async stopBlogServer() {
    if (this.blogServer) {
      return new Promise((resolve) => {
        this.blogServer.close(() => {
          console.log('🛑 Blog server stopped');
          resolve();
        });
      });
    }
  }

  async runSingleTest(scenario) {
    const scenarioStartTime = Date.now();
    console.log(`\n🧪 Running test scenario: ${scenario.name}`);
    console.log(`📝 Description: ${scenario.description}`);
    
    try {
      // Create mock GitHub context for this scenario
      const mockContext = mockGitHubContext(scenario.mockData);
      
      // Ensure the blog site files are included in the repo context
      const blogRepoContext = await this.getBlogRepoContext();
      mockContext.prContext.repoContext = { ...mockContext.prContext.repoContext, ...blogRepoContext };
      
      // Create PR test generator with mock data
      const config = {
        claudeApiKey: this.claudeApiKey,
        githubToken: 'mock-token',
        owner: mockContext.owner,
        repo: mockContext.repo,
        prNumber: mockContext.prNumber,
        testExamples: scenario.testExamples || this.getDefaultTestExamples(),
        timeout: 60000, // 1 minute for local testing
        commentOnPR: false, // Don't try to comment in local mode
        baseUrl: scenario.baseUrl || `http://localhost:${this.blogPort}`,
      };

      // Mock the GitHub API calls in PRTestGenerator
      const generator = new MockPRTestGenerator(config, mockContext);
      
      const results = await generator.run();
      const duration = Date.now() - scenarioStartTime;
      
      const testResult = {
        scenario: scenario.name,
        id: scenario.id,
        success: results.success,
        duration: duration,
        testCode: results.testCode,
        outputs: results.results,
        expectedOutcomes: scenario.expectedOutcomes,
        evaluation: this.evaluateResults(results, scenario.expectedOutcomes)
      };
      
      this.evalResults.push(testResult);
      
      const status = testResult.evaluation.pass ? '✅ PASS' : '❌ FAIL';
      console.log(`${status} ${scenario.name} (${duration}ms)`);
      
      if (!testResult.evaluation.pass) {
        console.log(`   💡 ${testResult.evaluation.reason}`);
        if (testResult.evaluation.details && testResult.evaluation.details.length > 0) {
          testResult.evaluation.details.forEach(detail => {
            console.log(`   - ${detail}`);
          });
        }
      }
      
      return testResult;
      
    } catch (error) {
      console.error(`❌ Scenario failed: ${error.message}`);
      const testResult = {
        scenario: scenario.name,
        id: scenario.id,
        success: false,
        error: error.message,
        duration: Date.now() - scenarioStartTime,
        evaluation: { pass: false, reason: `Runtime error: ${error.message}` }
      };
      
      this.evalResults.push(testResult);
      return testResult;
    }
  }

  async getBlogRepoContext() {
    const context = {};
    
    try {
      // Read the actual blog files
      const files = ['index.html', 'style.css', 'script.js'];
      
      for (const file of files) {
        const filePath = path.join(this.blogDir, file);
        try {
          const content = await fs.readFile(filePath, 'utf8');
          context[file] = content;
        } catch (error) {
          console.warn(`⚠️  Could not read ${file}: ${error.message}`);
        }
      }
    } catch (error) {
      console.warn(`⚠️  Could not read blog files: ${error.message}`);
    }
    
    return context;
  }

  async runEvalSuite() {
    this.startTime = Date.now();
    console.log('🚀 Starting LLM Evaluation Suite for PR Test Generator - Blog Edition');
    console.log('='.repeat(80));
    
    await this.setup();
    
    const scenarios = evalSuite.getScenarios();
    console.log(`📊 Found ${scenarios.length} test scenarios\n`);
    
    // Run scenarios sequentially to avoid conflicts
    for (let i = 0; i < scenarios.length; i++) {
      const scenario = scenarios[i];
      process.stdout.write(`[${i + 1}/${scenarios.length}] `);
      await this.runSingleTest(scenario);
    }
    
    await this.stopBlogServer();
    
    return this.generateReport();
  }

  evaluateResults(results, expectedOutcomes) {
    const evaluation = {
      pass: true,
      details: [],
      reason: null
    };
    
    // Check basic success
    if (expectedOutcomes.shouldSucceed && !results.success) {
      evaluation.pass = false;
      evaluation.reason = 'Expected test to succeed but it failed';
      return evaluation;
    }
    
    if (!expectedOutcomes.shouldSucceed && results.success) {
      evaluation.pass = false;
      evaluation.reason = 'Expected test to fail but it succeeded';
      return evaluation;
    }
    
    // Check if test code was generated
    if (expectedOutcomes.shouldGenerateTests && !results.testCode) {
      evaluation.pass = false;
      evaluation.reason = 'Expected test code to be generated but none was found';
      return evaluation;
    }
    
    // Check if UI testing was skipped when expected
    if (expectedOutcomes.shouldSkipUITests && !results.results?.skipped) {
      evaluation.pass = false;
      evaluation.reason = 'Expected UI tests to be skipped but they were not';
      return evaluation;
    }
    
    // Check for expected patterns in generated test code
    if (expectedOutcomes.outputPatterns && expectedOutcomes.outputPatterns.length > 0) {
      const testCodeText = (results.testCode || '').toLowerCase();
      const missingPatterns = [];
      
      for (const pattern of expectedOutcomes.outputPatterns) {
        if (!testCodeText.includes(pattern.toLowerCase())) {
          missingPatterns.push(pattern);
        }
      }
      
      if (missingPatterns.length > 0) {
        evaluation.pass = false;
        evaluation.reason = `Missing expected patterns in test code: ${missingPatterns.join(', ')}`;
        evaluation.details = missingPatterns.map(p => `Missing pattern: "${p}"`);
      }
    }
    
    return evaluation;
  }

  generateReport() {
    const totalDuration = Date.now() - this.startTime;
    const totalTests = this.evalResults.length;
    const passedTests = this.evalResults.filter(r => r.evaluation.pass).length;
    const failedTests = totalTests - passedTests;
    const successRate = totalTests > 0 ? (passedTests / totalTests) * 100 : 0;
    
    console.log('\n' + '='.repeat(80));
    console.log('📊 TEST RESULTS SUMMARY');
    console.log('='.repeat(80));
    
    // Jest-like summary
    const suiteStatus = failedTests === 0 ? '✅ PASS' : '❌ FAIL';
    console.log(`${suiteStatus} Blog Test Suite`);
    console.log(`Tests:       ${failedTests} failed, ${passedTests} passed, ${totalTests} total`);
    console.log(`Time:        ${(totalDuration / 1000).toFixed(2)}s`);
    console.log(`Success:     ${successRate.toFixed(1)}%`);
    
    if (failedTests > 0) {
      console.log('\n❌ FAILED TESTS:');
      this.evalResults
        .filter(r => !r.evaluation.pass)
        .forEach(result => {
          console.log(`  ❌ ${result.scenario}`);
          console.log(`     ${result.evaluation.reason}`);
          if (result.evaluation.details && result.evaluation.details.length > 0) {
            result.evaluation.details.forEach(detail => {
              console.log(`     - ${detail}`);
            });
          }
        });
    }
    
    if (passedTests > 0) {
      console.log('\n✅ PASSED TESTS:');
      this.evalResults
        .filter(r => r.evaluation.pass)
        .forEach(result => {
          console.log(`  ✅ ${result.scenario} (${result.duration}ms)`);
        });
    }
    
    // Coverage breakdown
    const stats = evalSuite.getStats();
    console.log('\n📈 COVERAGE BREAKDOWN:');
    Object.entries(stats.coverageAreas).forEach(([area, count]) => {
      console.log(`  ${area}: ${count} scenarios`);
    });
    
    console.log('\n' + '='.repeat(80));
    
    return {
      totalTests,
      passedTests,
      failedTests,
      successRate,
      duration: totalDuration,
      results: this.evalResults
    };
  }

  getDefaultTestExamples() {
    return `// Example blog tests:
const { startBrowserAgent } = require('magnitude-core');
require('dotenv').config();

async function runBlogTests() {
  const agent = await startBrowserAgent({
    url: process.env.PREVIEW_URL || 'http://localhost:8080',
    narrate: true,
    browser: {
      launchOptions: { headless: true },
      contextOptions: { viewport: { width: 1280, height: 720 } }
    }
  });
  
  try {
    console.log('Test: Navigate to blog homepage');
    await agent.act('Navigate to the blog homepage');
    const title = await agent.extract('Get the main heading text');
    console.log('Blog title:', title);
    
    console.log('Test: Search functionality');
    await agent.act('Click on the search input field');
    await agent.act('Type "tech" in the search field');
    const results = await agent.extract('Count the number of visible blog posts');
    console.log('Search results:', results);
    
    console.log('Test: Theme toggle');
    await agent.act('Click the theme toggle button');
    const theme = await agent.extract('Check if dark theme is applied');
    console.log('Theme changed:', theme);
    
    console.log('Test: Comment interaction');
    await agent.act('Click on the first blog post comment button');
    await agent.act('Type "Great post!" in the comment input');
    await agent.act('Click the submit comment button');
    
    console.log('All blog tests completed successfully');
  } finally {
    await agent.stop();
  }
}

runBlogTests().catch(error => {
  console.error('Blog test suite failed:', error);
  process.exit(1);
});`;
  }
}

// Mock PRTestGenerator that doesn't make real GitHub API calls
class MockPRTestGenerator extends PRTestGenerator {
  constructor(config, mockContext) {
    super(config);
    this.mockContext = mockContext;
  }

  async getPRContext() {
    return this.mockContext.prContext;
  }

  async getPreviewUrls() {
    return this.mockContext.previewUrls || [`http://localhost:8080`];
  }

  async waitForPreviewUrls() {
    return this.mockContext.previewUrls || [`http://localhost:8080`];
  }

  async commentGenerated() {
    // Skip commenting in local mode
    console.log('📝 (Skipped commenting on PR in local mode)');
  }

  async commentSkippedTests() {
    // Skip commenting in local mode
    console.log('📝 (Skipped commenting skipped tests in local mode)');
  }

  async commentError() {
    // Skip commenting in local mode
    console.log('📝 (Skipped commenting error in local mode)');
  }
}

// CLI interface
if (require.main === module) {
  const runner = new LocalTestRunner();
  
  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 Received interrupt signal, shutting down gracefully...');
    await runner.stopBlogServer();
    process.exit(0);
  });
  
  runner.runEvalSuite()
    .then(report => {
      console.log('\n🎯 Evaluation complete!');
      process.exit(report.failedTests > 0 ? 1 : 0);
    })
    .catch(async (error) => {
      console.error('💥 Evaluation failed:', error);
      await runner.stopBlogServer();
      process.exit(1);
    });
}

module.exports = { LocalTestRunner, MockPRTestGenerator };