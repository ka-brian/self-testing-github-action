require("dotenv").config();
const ClaudeService = require("../src/claude-service");

describe("ClaudeService analyzeAndPlan Evaluation", () => {
  let claudeService;

  beforeEach(() => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error(
        "ANTHROPIC_API_KEY environment variable is required for evaluation tests"
      );
    }
    claudeService = new ClaudeService(apiKey);
  });

  // Mock PR context with changes to the simple blog
  function createMockPRContext() {
    return {
      pr: {
        title: "Add Export Blog Data Feature",
        author: "testuser",
        body: "Added a new export feature that allows users to download their blog data in JSON format. Includes a new Export Data button in the header and modal dialog for export options.",
      },
      files: [
        {
          filename: "tests/test-sites/simple-blog/index.html",
          status: "modified",
          additions: 15,
          deletions: 2,
          patch: `@@ -14,6 +14,8 @@
                 <div class="nav-controls">
                     <input type="text" id="search-input" placeholder="Search posts...">
                     <button id="theme-toggle" aria-label="Toggle dark mode">🌙</button>
+                    <button id="export-btn" class="export-btn" aria-label="Export blog data">📥 Export</button>
                 </div>
             </div>
         </nav>
@@ -164,6 +166,19 @@
         </div>
     </div>

+    <!-- Export Modal -->
+    <div id="export-modal" class="modal-overlay" style="display: none;">
+        <div class="modal-content">
+            <h2>Export Blog Data</h2>
+            <p>Choose what data to export:</p>
+            <div class="export-options">
+                <label><input type="checkbox" id="export-posts" checked> Posts</label>
+                <label><input type="checkbox" id="export-comments" checked> Comments</label>
+                <label><input type="checkbox" id="export-likes"> Likes</label>
+            </div>
+            <button id="download-json">Download JSON</button>
+            <button id="close-export">Cancel</button>
+        </div>
+    </div>
+
     <script src="script.js"></script>`,
        },
        {
          filename: "tests/test-sites/simple-blog/script.js",
          status: "modified",
          additions: 35,
          deletions: 0,
          patch: `@@ -12,6 +12,7 @@ class SimpleBlog {
         this.initializeComments();
         this.initializeLikes();
+        this.initializeExport();
     }

@@ -378,4 +379,38 @@ class SimpleBlog {
         console.log('  blog.getStats() - Get blog statistics');
         console.log('  Ctrl+/ - Focus search box');
     });
+
+    initializeExport() {
+        const exportBtn = document.getElementById('export-btn');
+        const exportModal = document.getElementById('export-modal');
+        const downloadBtn = document.getElementById('download-json');
+        const closeBtn = document.getElementById('close-export');
+
+        exportBtn.addEventListener('click', () => {
+            exportModal.style.display = 'flex';
+        });
+
+        closeBtn.addEventListener('click', () => {
+            exportModal.style.display = 'none';
+        });
+
+        downloadBtn.addEventListener('click', () => {
+            this.exportData();
+            exportModal.style.display = 'none';
+        });
+    }
+
+    exportData() {
+        const exportPosts = document.getElementById('export-posts').checked;
+        const exportComments = document.getElementById('export-comments').checked;
+        const exportLikes = document.getElementById('export-likes').checked;
+
+        const data = {};
+        if (exportPosts) data.posts = Array.from(this.posts).map(post => ({...}));
+        if (exportComments) data.comments = document.querySelectorAll('.comment');
+        if (exportLikes) data.likes = JSON.parse(localStorage.getItem('blog-likes') || '{}');
+
+        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
+        const url = URL.createObjectURL(blob);
+        const a = document.createElement('a');
+        a.href = url;
+        a.download = 'blog-data.json';
+        a.click();
+        this.showNotification('Data exported successfully!', 'success');
+    }`,
        },
        {
          filename: "tests/test-sites/simple-blog/style.css",
          status: "modified",
          additions: 20,
          deletions: 0,
          patch: `@@ -107,6 +107,26 @@
     transform: scale(1.05);
 }

+.export-btn {
+    background-color: var(--primary-color);
+    color: white;
+    border: none;
+    border-radius: 0.5rem;
+    padding: 0.5rem 1rem;
+    cursor: pointer;
+    font-size: 0.875rem;
+    font-weight: 500;
+    transition: background-color 0.2s ease, transform 0.2s ease;
+}
+
+.export-btn:hover {
+    background-color: #1d4ed8;
+    transform: scale(1.05);
+}
+
+.export-options label {
+    display: block;
+    margin: 0.5rem 0;
+}
+
 main {
     padding: 2rem 0;`,
        },
      ],
      repoContext: {
        "package.json": JSON.stringify({
          name: "simple-blog-test-site",
          version: "1.0.0",
          description: "Test site for UI testing",
        }),
        "README.md":
          "Simple blog test site with posts, comments, likes, search, and theme toggle functionality.",
      },
      previewUrls: ["http://localhost:3000/tests/test-sites/simple-blog"],
    };
  }

  // Expected test plan for the export feature changes
  function getExpectedTestPlan() {
    return [
      "Navigate to the blog homepage and verify the Export button (📥 Export) is visible in the header next to the theme toggle",
      "Click the Export button and verify the export modal opens with title 'Export Blog Data'",
      "Verify the export modal contains checkboxes for Posts, Comments, and Likes (with Posts and Comments checked by default)",
      "Click 'Download JSON' button and verify a file download begins",
      "Click 'Cancel' button and verify the modal closes without downloading",
    ];
  }

  // LLM-based evaluation of the generated test plan vs expected
  async function evaluateTestPlan(generatedPlan, expectedPlan) {
    const prompt = `You are evaluating the quality of an AI-generated UI test plan against an expected baseline.

GENERATED TEST PLAN:
${generatedPlan}

EXPECTED TEST PLAN:
${expectedPlan.map((test, i) => `${i + 1}. ${test}`).join("\n")}

EVALUATION CRITERIA:
1. Coverage: Does the generated plan test the main functionality (Export button visibility, modal opening, download functionality)?
2. Accuracy: Are the test descriptions accurate to what was actually changed in the code?
3. Specificity: Are the tests specific enough to be executable by an automation tool?
4. Completeness: Does it cover both the happy path and basic edge cases (like canceling)?
5. Focus: Does it focus on the new export feature rather than existing blog functionality?

Rate the generated test plan on a scale of 1-10 and provide specific feedback on:
- What the generated plan does well
- What it misses or gets wrong
- How it could be improved

Format your response as:
SCORE: X/10
STRENGTHS: [bullet points]
WEAKNESSES: [bullet points]
OVERALL: [2-3 sentence summary]`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 1000,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Evaluation API error: ${response.status}`);
    }

    const data = await response.json();
    return data.content[0].text;
  }

  test("should generate focused test plan for export feature addition", async () => {
    console.log("🧪 Starting analyzeAndPlan evaluation...\n");

    // Create test scenario
    const mockPRContext = createMockPRContext();
    const expectedPlan = getExpectedTestPlan();

    console.log("📋 Mock PR Context:");
    console.log(`Title: ${mockPRContext.pr.title}`);
    console.log(`Files changed: ${mockPRContext.files.length}`);
    console.log(`Key changes: Export button, modal, download functionality\n`);

    console.log("✅ Expected Test Plan:");
    expectedPlan.forEach((test, i) => console.log(`${i + 1}. ${test}`));
    console.log();

    // Call analyzeAndPlan function
    console.log("🤖 Generating test plan with Claude analyzeAndPlan...");
    const generatedPlan = await claudeService.analyzeAndPlan(mockPRContext);

    console.log("📝 Generated Test Plan:");
    console.log(generatedPlan);
    console.log();

    // Evaluate the generated plan
    console.log("🔍 Evaluating generated plan vs expected...");
    const evaluation = await evaluateTestPlan(generatedPlan, expectedPlan);

    console.log("📊 EVALUATION RESULTS:");
    console.log(evaluation);

    // Basic assertions that evaluation completed
    expect(generatedPlan).toBeTruthy();
    expect(generatedPlan.length).toBeGreaterThan(10);
    expect(evaluation).toBeTruthy();
    expect(evaluation).toContain("SCORE:");
    
    // Log success for visibility
    console.log("\n✅ Evaluation completed successfully!");
  }, 30000); // 30 second timeout for LLM calls
});
