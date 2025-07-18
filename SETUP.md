# Repository Setup Guide

This guide will help you set up the PR Test Generator as a GitHub Action.

## Quick Setup Steps

### 1. Create the Repository Structure

```
pr-test-generator/
├── action.yml                 # Action definition
├── package.json              # Dependencies
├── src/
│   ├── index.js              # Entry point
│   └── pr-test-generator.js  # Core logic
├── dist/                     # Built action (auto-generated)
├── scripts/
│   └── build.js              # Build script
├── .github/
│   └── workflows/
│       └── example.yml       # Usage example
├── README.md                 # Documentation
├── .gitignore
├── .eslintrc.js
└── LICENSE
```

### 2. Initialize the Repository

```bash
# Clone or create your repository
git clone https://github.com/yourusername/pr-test-generator.git
cd pr-test-generator

# Install dependencies
npm install

# Build the action
npm run build
```

### 3. Commit and Push

```bash
# Add all files (including dist/)
git add .
git commit -m "Initial commit: PR Test Generator action"
git push origin main
```

### 4. Create a Release

1. Go to your GitHub repository
2. Click "Releases" → "Create a new release"
3. Tag: `v1.0.0`
4. Title: `v1.0.0 - Initial Release`
5. Description: Brief description of features
6. Click "Publish release"

### 5. Publish to Marketplace (Optional)

1. Go to your repository settings
2. Scroll to "GitHub Actions"
3. Check "Publish this Action to the GitHub Marketplace"
4. Follow the marketplace guidelines

## Development Workflow

### Making Changes

```bash
# Make your changes to src/ files
vim src/pr-test-generator.js

# Test locally (if possible)
npm test

# Rebuild
npm run build

# Commit including dist/
git add .
git commit -m "Update: description of changes"
git push
```

### Testing the Action

Create a test repository with this workflow:

```yaml
# .github/workflows/test-action.yml
name: Test PR Test Generator

on:
  pull_request:
    types: [opened, synchronize]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: yourusername/pr-test-generator@main # Use @main for testing
        with:
          claude-api-key: ${{ secrets.CLAUDE_API_KEY }}
```

### Releasing Updates

```bash
# Create a new version
git tag v1.1.0
git push origin v1.1.0

# Update major version tag (optional)
git tag -f v1
git push -f origin v1
```

## Environment Variables for Development

Create a `.env` file for local testing (not committed):

```bash
CLAUDE_API_KEY=your_claude_api_key
GITHUB_TOKEN=your_github_token
```

## Common Issues

### Build Errors

```bash
# Clear and rebuild
rm -rf node_modules dist/
npm ci
npm run build
```

### Action Not Found

- Ensure `dist/index.js` is committed
- Check that `action.yml` points to the correct main file
- Verify the repository is public (for public actions)

### Permission Errors

- Ensure `GITHUB_TOKEN` has appropriate permissions
- Check that the action has access to the repository

## File Descriptions

- **`action.yml`**: Defines the action interface, inputs, outputs
- **`src/index.js`**: GitHub Actions entry point, handles inputs/outputs
- **`src/pr-test-generator.js`**: Core logic for test generation and execution
- **`dist/index.js`**: Compiled single-file action (auto-generated)
- **`package.json`**: Dependencies and build scripts
- **`scripts/build.js`**: Builds the action using ncc

## Security Considerations

- Never commit API keys or secrets
- Use `secrets` for sensitive data in workflows
- Consider limiting action scope to specific file paths
- Review generated tests before trusting them completely

## Support

- GitHub Issues: Report bugs and feature requests
- Discussions: Community support and questions
- Documentation: Keep README.md updated
