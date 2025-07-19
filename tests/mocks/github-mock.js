/**
 * GitHub API Mock Data Generator - Static Blog Edition
 * 
 * Provides realistic mock data for testing the PR Test Generator locally
 * with a focus on static blog site changes
 */

const sampleFiles = {
  themeToggleJS: {
    filename: 'script.js',
    status: 'modified',
    additions: 5,
    deletions: 2,
    patch: `@@ -15,6 +15,11 @@
   initializeTheme() {
     const savedTheme = localStorage.getItem('blog-theme') || 'light';
     this.setTheme(savedTheme);
+    
+    // Improve theme persistence
+    if (!savedTheme) {
+      this.setTheme('light'); // Default to light theme
+    }
   }

   setTheme(theme) {
     document.documentElement.setAttribute('data-theme', theme);
     this.themeToggle.textContent = theme === 'dark' ? '☀️' : '🌙';
     localStorage.setItem('blog-theme', theme);
   }`
  },

  themeToggleCSS: {
    filename: 'style.css',
    status: 'modified',
    additions: 8,
    deletions: 1,
    patch: `@@ -91,7 +91,14 @@
 #theme-toggle {
     background: none;
     border: 1px solid var(--border-color);
     border-radius: 0.5rem;
     padding: 0.5rem;
     cursor: pointer;
     font-size: 1rem;
-    transition: background-color 0.2s ease, transform 0.2s ease;
+    transition: background-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
+}
+
+#theme-toggle:hover {
+    background-color: var(--border-color);
+    transform: scale(1.05);
+    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
 }`
  },

  searchFeatureJS: {
    filename: 'script.js',
    status: 'modified',
    additions: 35,
    deletions: 10,
    patch: `@@ -75,6 +75,41 @@
   handleSearch() {
     const searchTerm = this.searchInput.value.toLowerCase().trim();
     let visiblePosts = 0;
+    
+    // Add search highlighting
+    this.clearHighlights();

     this.posts.forEach(post => {
       const title = post.querySelector('.post-title').textContent.toLowerCase();
       const content = post.querySelector('.post-content').textContent.toLowerCase();
       const category = post.querySelector('.post-category').textContent.toLowerCase();
       const date = post.querySelector('.post-date').textContent.toLowerCase();

       const matches = title.includes(searchTerm) || 
                     content.includes(searchTerm) || 
                     category.includes(searchTerm) ||
                     date.includes(searchTerm);

       if (matches || searchTerm === '') {
         post.style.display = 'block';
         visiblePosts++;
+        
+        // Highlight matching terms
+        if (searchTerm && matches) {
+          this.highlightTerm(post, searchTerm);
+        }
       } else {
         post.style.display = 'none';
       }
     });
+    
+    // Add search analytics
+    if (searchTerm) {
+      this.trackSearch(searchTerm, visiblePosts);
+    }

     this.noResults.style.display = visiblePosts === 0 ? 'block' : 'none';
     this.postsContainer.style.display = visiblePosts === 0 ? 'none' : 'grid';
+  }
+  
+  highlightTerm(post, term) {
+    // Implementation for highlighting search terms
+    const elements = post.querySelectorAll('.post-title, .post-content');
+    // ... highlighting logic
+  }
+  
+  trackSearch(term, resultCount) {
+    console.log(\`Search: "\${term}" - \${resultCount} results\`);
   }`
  },

  commentSystemJS: {
    filename: 'script.js',
    status: 'modified',
    additions: 45,
    deletions: 5,
    patch: `@@ -120,6 +120,50 @@
   addComment(input, commentsSection) {
     const commentText = input.value.trim();
     
     if (commentText === '') {
       this.showNotification('Please enter a comment', 'warning');
       return;
     }
+    
+    // Add character limit validation
+    if (commentText.length > 500) {
+      this.showNotification('Comment too long (max 500 characters)', 'warning');
+      return;
+    }
+    
+    // Add spam detection
+    if (this.isSpam(commentText)) {
+      this.showNotification('Comment appears to be spam', 'warning');
+      return;
+    }

     const newComment = document.createElement('div');
     newComment.className = 'comment';
-    newComment.innerHTML = \`<strong>You:</strong> \${this.escapeHtml(commentText)}\`;
+    newComment.innerHTML = \`
+      <div class="comment-header">
+        <strong>You</strong>
+        <span class="comment-time">Just now</span>
+      </div>
+      <div class="comment-text">\${this.escapeHtml(commentText)}</div>
+      <div class="comment-actions">
+        <button class="reply-btn">Reply</button>
+        <button class="like-comment-btn">❤️</button>
+      </div>
+    \`;
     
     const addCommentDiv = commentsSection.querySelector('.add-comment');
     commentsSection.insertBefore(newComment, addCommentDiv);
     
     input.value = '';
+    
+    // Update comment counter
+    this.updateCommentCount(commentsSection);
     
     newComment.style.opacity = '0';
     newComment.style.transform = 'translateY(-10px)';
@@ -135,6 +179,11 @@
     this.showNotification('Comment added!', 'success');
+  }
+  
+  isSpam(text) {
+    const spamKeywords = ['viagra', 'casino', 'lottery', 'winner'];
+    return spamKeywords.some(keyword => text.toLowerCase().includes(keyword));
+  }
+  
+  updateCommentCount(section) {
+    const commentCount = section.querySelectorAll('.comment').length - 1; // Exclude add-comment div
+    console.log(\`Comments updated: \${commentCount}\`);
   }`
  },

  cssOnlyChanges: {
    filename: 'style.css',
    status: 'modified',
    additions: 30,
    deletions: 5,
    patch: `@@ -180,6 +180,35 @@
 .post {
     background-color: var(--surface-color);
     border: 1px solid var(--border-color);
     border-radius: 0.75rem;
     padding: 1.5rem;
     box-shadow: var(--shadow);
-    transition: transform 0.2s ease, box-shadow 0.2s ease;
+    transition: transform 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease;
+    position: relative;
+    overflow: hidden;
+}
+
+.post::before {
+    content: '';
+    position: absolute;
+    top: 0;
+    left: -100%;
+    width: 100%;
+    height: 2px;
+    background: linear-gradient(90deg, var(--primary-color), var(--accent-color, #60a5fa));
+    transition: left 0.5s ease;
 }

 .post:hover {
-    transform: translateY(-2px);
+    transform: translateY(-4px) scale(1.02);
     box-shadow: var(--shadow-lg);
+    border-color: var(--primary-color);
+}
+
+.post:hover::before {
+    left: 0;
+}
+
+/* Responsive grid improvements */
+@media (max-width: 768px) {
+    .post:hover {
+        transform: translateY(-2px) scale(1.01);
+    }
 }`
  },

  htmlContentChanges: {
    filename: 'index.html',
    status: 'modified',
    additions: 40,
    deletions: 10,
    patch: `@@ -25,6 +25,20 @@
                 <div class="nav-controls">
                     <input type="text" id="search-input" placeholder="Search posts...">
                     <button id="theme-toggle" aria-label="Toggle dark mode">🌙</button>
+                    <div class="nav-menu">
+                        <button class="nav-menu-btn" aria-label="Menu">☰</button>
+                        <div class="nav-dropdown">
+                            <a href="#home">Home</a>
+                            <a href="#about">About</a>
+                            <a href="#archive">Archive</a>
+                            <a href="#contact">Contact</a>
+                        </div>
+                    </div>
                 </div>
             </div>
         </nav>
+        <div class="nav-secondary">
+            <div class="container">
+                <div class="breadcrumb">Home > Blog</div>
+                <div class="post-stats">Showing 4 posts</div>
+            </div>
+        </div>
     </header>

     <main class="container">
+        <section class="hero-section">
+            <h1>Welcome to Simple Blog</h1>
+            <p>Exploring technology, life, and everything in between.</p>
+        </section>
+        
+        <div class="filter-bar">
+            <button class="filter-btn active" data-category="all">All Posts</button>
+            <button class="filter-btn" data-category="tech">Tech</button>
+            <button class="filter-btn" data-category="life">Life</button>
+        </div>
+        
         <div class="posts-grid" id="posts-container">`
  },

  configurationFile: {
    filename: '.gitignore',
    status: 'modified',
    additions: 5,
    deletions: 0,
    patch: `@@ -15,6 +15,11 @@
 *.log
 logs
 
+# Local environment files
+.env.local
+.env.development.local
+.env.test.local
+.env.production.local
+
 # Runtime data
 pids
 *.pid`
  },

  packageJsonFile: {
    filename: 'package.json',
    status: 'added',
    additions: 25,
    deletions: 0,
    patch: `@@ -0,0 +1,25 @@
+{
+  "name": "simple-blog",
+  "version": "1.0.0",
+  "description": "A simple static blog for testing purposes",
+  "main": "index.html",
+  "scripts": {
+    "start": "npx http-server . -p 8080",
+    "dev": "npx live-server --port=8080",
+    "test": "echo 'No tests specified' && exit 0",
+    "lint": "npx htmlhint index.html",
+    "validate": "npx html-validate index.html"
+  },
+  "keywords": [
+    "blog",
+    "static",
+    "html",
+    "css",
+    "javascript"
+  ],
+  "author": "Test Author",
+  "license": "MIT",
+  "devDependencies": {
+    "http-server": "^14.1.1",
+    "live-server": "^1.2.2"
+  }
+}`
  },

  documentationFile: {
    filename: 'README.md',
    status: 'modified',
    additions: 35,
    deletions: 5,
    patch: `@@ -1,10 +1,40 @@
-# Simple Blog
+# Simple Blog - Static Site Evaluation Suite

-A simple static blog site.
+A comprehensive static blog site designed for testing PR test generation capabilities.

 ## Features

-- Blog posts
-- Comments
-- Search
+### Core Functionality
+- **Dynamic Theme System**: Dark/light mode with system preference detection
+- **Advanced Search**: Real-time post filtering with search highlighting  
+- **Interactive Comments**: Spam detection, character limits, and reply system
+- **Like System**: Persistent likes with local storage
+- **Responsive Design**: Mobile-first approach with CSS Grid
+- **Keyboard Navigation**: Ctrl+/ for search focus, Enter for comment submission
+
+### Blog Content
+- 4 sample blog posts covering tech and life topics
+- Category-based filtering (Tech, Life)
+- Post metadata with dates and categories
+- Rich content with multiple paragraphs per post
+
+### Technical Features
+- Vanilla JavaScript with ES6+ features
+- CSS custom properties for theming
+- Local storage for user preferences
+- Accessible design with ARIA labels
+- Performance optimized with CSS transitions
+
+## Usage
+
+### Development Server
+\`\`\`bash
+npm install
+npm run dev
+\`\`\`
+
+### Production Build
+\`\`\`bash
+npm run start
+\`\`\`
+
+Visit http://localhost:8080 to view the blog.`
  }
};

const sampleRepoContext = {
  'package.json': `{
  "name": "simple-blog",
  "version": "1.0.0",
  "description": "A simple static blog for testing purposes",
  "main": "index.html",
  "scripts": {
    "start": "npx http-server . -p 8080",
    "dev": "npx live-server --port=8080",
    "test": "echo 'No tests specified' && exit 0"
  },
  "keywords": ["blog", "static", "html", "css", "javascript"],
  "author": "Test Author",
  "license": "MIT"
}`,
  
  'README.md': `# Simple Blog

A simple static blog site for testing PR test generation.

## Features

- Blog posts with categories (Tech, Life)
- Dark/light theme toggle
- Search functionality
- Comment system
- Like functionality
- Responsive design

## Getting Started

Open index.html in a web browser or serve with:

\`\`\`bash
npx http-server . -p 8080
\`\`\`

Visit http://localhost:8080 to view the blog.

## Files

- \`index.html\` - Main blog page
- \`style.css\` - Blog styling and theme system
- \`script.js\` - Interactive functionality
`,

  'index.html': `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Simple Blog - Tech & Life</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <header>
        <nav class="navbar">
            <div class="nav-container">
                <h1 class="blog-title">Simple Blog</h1>
                <div class="nav-controls">
                    <input type="text" id="search-input" placeholder="Search posts...">
                    <button id="theme-toggle" aria-label="Toggle dark mode">🌙</button>
                </div>
            </div>
        </nav>
    </header>
    <main class="container">
        <div class="posts-grid" id="posts-container">
            <!-- Blog posts content -->
        </div>
    </main>
    <script src="script.js"></script>
</body>
</html>`
};

function createMockPRData(scenario) {
  const baseData = {
    pr: {
      title: scenario.title || 'Test Blog Enhancement',
      body: scenario.description || 'Test blog enhancement description',
      head: 'abc123',
      base: 'main',
      author: 'testuser'
    },
    files: scenario.files || [],
    repoContext: sampleRepoContext,
    previewUrls: scenario.previewUrls || ['http://localhost:8080']
  };

  return baseData;
}

function mockGitHubContext(mockData) {
  return {
    owner: 'testowner',
    repo: 'simple-blog',
    prNumber: mockData.prNumber || 123,
    prContext: createMockPRData(mockData),
    previewUrls: mockData.previewUrls || ['http://localhost:8080']
  };
}

// Predefined test scenarios for the blog
const testScenarios = {
  themeToggleChanges: {
    title: 'Improve theme toggle functionality',
    description: 'Simple improvements to the dark/light theme toggle button and styling.',
    files: [sampleFiles.themeToggleJS, sampleFiles.themeToggleCSS],
    previewUrls: ['http://localhost:8080']
  },

  searchFeatureChanges: {
    title: 'Add search highlighting and analytics',
    description: 'Enhances the blog search functionality with term highlighting and search result tracking.',
    files: [sampleFiles.searchFeatureJS],
    previewUrls: ['http://localhost:8080']
  },

  commentSystemChanges: {
    title: 'Improve comment system with spam detection',
    description: 'Adds character limits, spam detection, and improved comment UI to the blog comment system.',
    files: [sampleFiles.commentSystemJS],
    previewUrls: ['http://localhost:8080']
  },

  cssOnlyChanges: {
    title: 'Enhance post card styling and animations',
    description: 'Improves blog post card visual design with better hover effects and responsive behavior.',
    files: [sampleFiles.cssOnlyChanges],
    previewUrls: ['http://localhost:8080']
  },

  javascriptOnlyChanges: {
    title: 'Add keyboard shortcuts and interaction improvements',
    description: 'Adds Ctrl+/ search focus, improved like animations, and better notification system.',
    files: [sampleFiles.searchFeatureJS, sampleFiles.commentSystemJS],
    previewUrls: ['http://localhost:8080']
  },

  htmlContentChanges: {
    title: 'Add navigation menu and hero section',
    description: 'Enhances blog layout with navigation menu, breadcrumbs, and hero section for better user experience.',
    files: [sampleFiles.htmlContentChanges],
    previewUrls: ['http://localhost:8080']
  },

  mixedUIChanges: {
    title: 'Comprehensive blog UI enhancement',
    description: 'Major update combining theme improvements, search enhancements, and layout updates for the blog.',
    files: [
      sampleFiles.themeToggleJS,
      sampleFiles.themeToggleCSS,
      sampleFiles.searchFeatureJS,
      sampleFiles.htmlContentChanges,
      sampleFiles.cssOnlyChanges
    ],
    previewUrls: ['http://localhost:8080']
  },

  configurationOnly: {
    title: 'Update .gitignore and add package.json',
    description: 'Adds proper .gitignore patterns and package.json for blog development workflow.',
    files: [sampleFiles.configurationFile, sampleFiles.packageJsonFile],
    previewUrls: []
  },

  documentationOnly: {
    title: 'Update README with comprehensive documentation',
    description: 'Updates blog documentation with detailed feature descriptions and usage instructions.',
    files: [sampleFiles.documentationFile],
    previewUrls: []
  }
};

module.exports = {
  mockGitHubContext,
  createMockPRData,
  sampleFiles,
  sampleRepoContext,
  testScenarios
};