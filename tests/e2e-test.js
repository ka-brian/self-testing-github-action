#!/usr/bin/env node

require("dotenv").config();

const PRTestGenerator = require("../src/pr-test-generator");
const path = require("path");
const fs = require("fs").promises;
const http = require("http");

process.env.GITHUB_ACTIONS = "false";
process.env.NODE_ENV = "test";

class LocalTestRunner {
  constructor(options = {}) {
    this.claudeApiKey = options.claudeApiKey || process.env.CLAUDE_API_KEY;
    this.blogDir = path.join(__dirname, "test-sites/simple-blog");
    this.blogPort = 8080;
    this.blogServer = null;

    if (!this.claudeApiKey) {
      throw new Error("CLAUDE_API_KEY environment variable is required");
    }
  }

  async setup() {
    console.log("🔧 Starting blog server...");
    await this.startBlogServer();
  }

  async startBlogServer() {
    return new Promise((resolve, reject) => {
      console.log(`🌐 Starting blog server on port ${this.blogPort}...`);

      // Simple static file server
      const server = http.createServer(async (req, res) => {
        let filePath = path.join(
          this.blogDir,
          req.url === "/" ? "index.html" : req.url
        );

        try {
          const stat = await fs.stat(filePath);
          if (stat.isDirectory()) {
            filePath = path.join(filePath, "index.html");
          }

          const data = await fs.readFile(filePath);
          const ext = path.extname(filePath);

          let contentType = "text/html";
          if (ext === ".css") contentType = "text/css";
          if (ext === ".js") contentType = "application/javascript";
          if (ext === ".png") contentType = "image/png";
          if (ext === ".jpg") contentType = "image/jpeg";
          if (ext === ".ico") contentType = "image/x-icon";

          res.writeHead(200, { "Content-Type": contentType });
          res.end(data);
        } catch (error) {
          res.writeHead(404, { "Content-Type": "text/html" });
          res.end("<h1>404 Not Found</h1>");
        }
      });

      server.listen(this.blogPort, (err) => {
        if (err) {
          reject(err);
        } else {
          this.blogServer = server;
          console.log(
            `✅ Blog server running at http://localhost:${this.blogPort}`
          );

          // Test if server is responding
          setTimeout(async () => {
            try {
              const response = await fetch(`http://localhost:${this.blogPort}`);
              if (response.ok) {
                console.log("✅ Blog server is responding correctly");
                resolve();
              } else {
                reject(new Error("Blog server not responding correctly"));
              }
            } catch (error) {
              reject(new Error("Failed to connect to blog server"));
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
          console.log("🛑 Blog server stopped");
          resolve();
        });
      });
    }
  }

  async run() {
    console.log("🚀 Starting simplified local test runner...");
    
    await this.setup();
    
    try {
      // Create mock PR context with file changes
      const prContext = await this.createMockPRContext();
      
      // Create generator
      const generator = new PRTestGenerator({
        claudeApiKey: this.claudeApiKey,
        githubToken: "mock-token",
        owner: "test",
        repo: "test",
        prNumber: 1,
        baseUrl: `http://localhost:${this.blogPort}`
      });
      
      // Generate tests
      console.log("🤖 Generating tests...");
      const testCode = await generator.generateTests(prContext);
      
      // Execute tests and generate report
      console.log("🧪 Executing tests...");
      const testReport = await generator.testExecutor.executeTestsAndGenerateReport(testCode);
      
      console.log("✅ Test generation complete!");
      console.log("Test Code:", testCode);
      console.log("Test Report:", testReport);
      
      return { testCode, testReport };
      
    } finally {
      await this.stopBlogServer();
    }
  }

  async createMockPRContext() {
    // Read blog files for repository context
    const repoContext = {};
    const configFiles = ["index.html", "style.css", "script.js"];
    
    for (const file of configFiles) {
      const filePath = path.join(this.blogDir, file);
      try {
        repoContext[file] = await fs.readFile(filePath, "utf8");
      } catch (error) {
        console.warn(`⚠️ Could not read ${file}: ${error.message}`);
      }
    }

    // Create mock file changes - simulating changes to the blog
    const files = [
      {
        filename: "index.html",
        status: "modified",
        additions: 5,
        deletions: 2,
        patch: `@@ -10,7 +10,10 @@
 <body>
     <header>
-        <h1>My Simple Blog</h1>
+        <h1>My Updated Blog</h1>
+        <nav>
+            <a href="#about">About</a>
+        </nav>
     </header>
     <main>`
      },
      {
        filename: "style.css", 
        status: "modified",
        additions: 3,
        deletions: 0,
        patch: `@@ -15,6 +15,9 @@
 header h1 {
     color: #333;
     margin: 0;
+}
+nav a {
+    margin: 0 10px;
 }`
      }
    ];

    return {
      pr: {
        title: "Update blog header and navigation",
        body: "Added navigation links and updated header styling",
        head: "abc123",
        base: "main",
        author: "testuser"
      },
      files,
      repoContext,
      previewUrls: [`http://localhost:${this.blogPort}`]
    };
  }

}

if (require.main === module) {
  const runner = new LocalTestRunner();

  process.on("SIGINT", async () => {
    console.log("\n🛑 Shutting down...");
    await runner.stopBlogServer();
    process.exit(0);
  });

  runner
    .run()
    .then((result) => {
      console.log("\n🎯 Complete!");
      process.exit(0);
    })
    .catch(async (error) => {
      console.error("💥 Failed:", error);
      await runner.stopBlogServer();
      process.exit(1);
    });
}

module.exports = { LocalTestRunner };
