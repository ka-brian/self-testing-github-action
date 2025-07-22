require("dotenv").config();
const ClaudeService = require("../src/claude-service.js");

describe("ClaudeService Evaluation", () => {
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

  describe("requiresUITesting", () => {
    test("should detect UI changes and return true for simple-blog style modifications", async () => {
      const prContext = {
        pr: {
          title: "Update blog title and add dark mode feature",
          body: 'Changed the main title from "My Awesome Blog" to "My Amazing Blog" and added a new dark mode toggle feature with CSS updates',
        },
        files: [
          {
            filename: "index.html",
            status: "modified",
            additions: 3,
            deletions: 2,
            patch: `@@ -6,7 +6,7 @@
-    <title>My Awesome Blog - Tech & Life</title>
+    <title>My Amazing Blog - Tech & Life</title>
     <link rel="stylesheet" href="style.css">
 </head>
-<body class="login-required">
+<body class="login-required dark-mode-enabled">
     <header>`,
          },
          {
            filename: "script.js",
            status: "modified",
            additions: 15,
            deletions: 0,
            patch: `@@ -95,6 +95,21 @@ class SimpleBlog {
     this.setTheme(newTheme);
   }
 
+  enableDarkModeByDefault() {
+    if (!localStorage.getItem('blog-theme')) {
+      this.setTheme('dark');
+      this.showNotification('Dark mode enabled by default!', 'info');
+    }
+  }
+
   initializeEventListeners() {`,
          },
          {
            filename: "style.css",
            status: "modified",
            additions: 8,
            deletions: 1,
            patch: `@@ -13,7 +13,14 @@
 [data-theme="dark"] {
     --bg-color: #0f172a;
     --surface-color: #1e293b;
-    --text-color: #f1f5f9;
+    --text-color: #ffffff;
+    --accent-color: #60a5fa;
+}
+
+.dark-mode-enabled {
+    transition: all 0.3s ease;
+}
+
+.dark-mode-enabled .blog-title {
+    color: var(--accent-color);
 }`,
          },
        ],
      };

      const result = await claudeService.requiresUITesting(prContext);

      expect(result).toBe(true);
    }, 10000);

    test("should return false for pure documentation changes", async () => {
      const prContext = {
        pr: {
          title: "Update API documentation",
          body: "Added new API endpoints documentation and updated README",
        },
        files: [
          {
            filename: "api-docs.md",
            status: "modified",
            additions: 20,
            deletions: 5,
            patch: `@@ -1,5 +1,10 @@
 # API Documentation
 
+## New Endpoints
+- GET /api/users - Get all users
+- POST /api/auth - Authenticate user
+
 ## Existing Endpoints
 - GET /api/posts`,
          },
          {
            filename: "README.md",
            status: "modified",
            additions: 3,
            deletions: 1,
            patch: `@@ -10,7 +10,9 @@
 ## Installation
 
-npm install
+npm install
+npm run build
+npm start`,
          },
        ],
      };

      const result = await claudeService.requiresUITesting(prContext);

      expect(result).toBe(false);
    }, 10000);

    test("should return true for React component changes", async () => {
      const prContext = {
        pr: {
          title: "Add new user profile component",
          body: "Created a new UserProfile React component with avatar display",
        },
        files: [
          {
            filename: "src/components/UserProfile.jsx",
            status: "added",
            additions: 45,
            deletions: 0,
            patch: `@@ -0,0 +1,45 @@
+import React from 'react';
+
+const UserProfile = ({ user }) => {
+  return (
+    <div className="user-profile">
+      <img src={user.avatar} alt="Avatar" className="avatar" />
+      <h2>{user.name}</h2>
+      <p>{user.email}</p>
+    </div>
+  );
+};
+
+export default UserProfile;`,
          },
        ],
      };

      const result = await claudeService.requiresUITesting(prContext);

      expect(result).toBe(true);
    }, 10000);

    test("should return true for CSS styling changes", async () => {
      const prContext = {
        pr: {
          title: "Update button styles",
          body: "Changed button colors and hover effects",
        },
        files: [
          {
            filename: "styles/buttons.css",
            status: "modified",
            additions: 10,
            deletions: 5,
            patch: `@@ -1,8 +1,13 @@
 .btn-primary {
-  background-color: blue;
-  color: white;
+  background-color: #3b82f6;
+  color: #ffffff;
+  border-radius: 0.375rem;
+  transition: background-color 0.2s ease;
 }
 
+.btn-primary:hover {
+  background-color: #1d4ed8;
+}`,
          },
        ],
      };

      const result = await claudeService.requiresUITesting(prContext);

      expect(result).toBe(true);
    }, 10000);
  });

  describe("prompt building", () => {
    test("should build UI analysis prompt with simple-blog context", () => {
      const prContext = {
        pr: {
          title: "Update blog title",
          body: 'Changed title from "My Awesome Blog" to "My Amazing Blog"',
        },
        files: [
          {
            filename: "index.html",
            status: "modified",
            additions: 1,
            deletions: 1,
            patch:
              "-    <title>My Awesome Blog - Tech & Life</title>\n+    <title>My Amazing Blog - Tech & Life</title>",
          },
        ],
      };

      const prompt = claudeService.buildUIAnalysisPrompt(prContext);

      expect(prompt).toContain("Update blog title");
      expect(prompt).toContain("index.html");
      expect(prompt).toContain("My Amazing Blog");
      expect(prompt).toContain("## UI Testing is REQUIRED for:");
      expect(prompt).toContain('Respond with ONLY "YES"');
    });
  });
});
