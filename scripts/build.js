#!/usr/bin/env node

/**
 * Build script for GitHub Action
 * Compiles the action into a single distributable file
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

console.log("🏗️  Building PR Test Generator Action...");

// Ensure dist directory exists
const distDir = path.join(__dirname, "..", "dist");
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// Install dependencies
console.log("📦 Installing dependencies...");
execSync("npm ci", { stdio: "inherit" });

// Build using ncc (Node.js Compiler Collection)
console.log("🔨 Compiling with ncc...");
execSync("npx ncc build src/index.js -o dist --minify", { stdio: "inherit" });

// Verify build
const indexPath = path.join(distDir, "index.js");
if (fs.existsSync(indexPath)) {
  const stats = fs.statSync(indexPath);
  console.log(
    `✅ Build successful! Generated ${indexPath} (${Math.round(
      stats.size / 1024
    )}KB)`
  );
} else {
  console.error("❌ Build failed: index.js not found in dist/");
  process.exit(1);
}

// Create a simple test to verify the build
console.log("🧪 Testing build...");
try {
  const builtModule = require(indexPath);
  if (typeof builtModule.run === "function") {
    console.log("✅ Build test passed!");
  } else {
    console.error("❌ Build test failed: run function not found");
    process.exit(1);
  }
} catch (error) {
  console.error("❌ Build test failed:", error.message);
  process.exit(1);
}

console.log("\n🎉 Action built successfully!");
console.log("\nNext steps:");
console.log("1. Commit the dist/ folder to your repository");
console.log("2. Create a release/tag (e.g., v1.0.0)");
console.log("3. Publish to GitHub Marketplace");
console.log("\nUsers can then reference your action as:");
console.log("  uses: yourusername/pr-test-generator@v1");
