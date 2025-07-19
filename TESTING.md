# Local Testing Guide

This guide explains how to test the PR Test Generator locally without needing to push to GitHub and run the action.

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your actual Claude API key
   ```

## Running Tests

### Full Test Suite

Run the evaluation suite with the built-in test scenario:

```bash
npm test
```

This will:
- Start a local blog server on port 8080
- Test the "Simple Copy Change" scenario
- Validate test generation quality
- Check Claude AI integration
- Provide detailed output and evaluation

### What the Test Does

The current test suite includes one comprehensive scenario:

**Simple Copy Change Test**: Tests basic copy change detection where a blog title changes from "Simple Blog" to "My Awesome Blog" in an HTML file.

The test:
1. Starts a local static blog server
2. Mocks a GitHub PR with HTML changes
3. Runs the PR Test Generator against the mock data
4. Generates test code using Claude AI
5. Evaluates the generated code quality
6. Provides detailed pass/fail results

## Test Environment

### Local Blog Server
The test uses a simple static blog located in `tests/test-sites/simple-blog/` with:
- `index.html`: Main blog page with posts and theme toggle
- `style.css`: Blog styling with light/dark theme support
- `script.js`: Interactive features (search, comments, theme toggle)

The blog runs on `http://localhost:8080` during testing.

### Mock GitHub Data
Test scenarios are defined in `tests/eval-suite.js` and include:
- Mock PR details (title, description, author)
- Mock file changes with diff patches
- Mock preview URLs
- Expected test outcomes

## Understanding Results

### Success Criteria
The test evaluates:
- **Test Generation**: Whether Claude successfully generates test code
- **Code Quality**: Whether the generated code follows expected patterns
- **API Integration**: Whether Claude API calls work correctly
- **Error Handling**: Whether failures are handled gracefully

### Test Output
Results include:
- ✅/❌ Pass/fail status for each test scenario
- Generated test code preview with line numbers
- Claude AI analysis reasoning
- Detailed evaluation metrics
- Performance timing information

### Example Success Output
```
✅ PASS Simple Copy Change Test (24701ms)
📊 TEST RESULTS SUMMARY
✅ PASS Blog Test Suite
Tests:       0 failed, 1 passed, 1 total
Time:        25.75s
Success:     100.0%
```

## Debugging

### Common Issues

1. **Missing CLAUDE_API_KEY**: Ensure your `.env` file has a valid Claude API key
2. **Port conflicts**: The test uses port 8080 - ensure it's available
3. **Claude API errors**: Check API key validity and rate limits
4. **Network issues**: Test requires internet access for Claude API calls

### Debug Output
The test provides verbose logging including:
- Blog server startup/shutdown
- GitHub API mock responses
- Claude API request/response details
- Step-by-step test execution logs
- Generated test code with line numbers

### Log Files
Test outputs are saved in `/test-outputs/` for inspection.

## Extending Tests

### Adding New Scenarios

To add new test scenarios, edit `tests/eval-suite.js`:

```javascript
{
  id: "your-scenario-id",
  name: "Your Test Name",
  description: "What this scenario tests",
  mockData: {
    prNumber: 123,
    files: [{
      filename: "path/to/changed/file.html",
      patch: `@@ -1,1 +1,1 @@
-<h1>Old Title</h1>
+<h1>New Title</h1>`
    }],
    previewUrls: ["http://localhost:8080"]
  },
  expectedOutcomes: {
    shouldSucceed: true,
    shouldGenerateTests: true,
    shouldSkipUITests: false,
    outputPatterns: ["New Title"] // Optional: patterns to expect in generated code
  },
  baseUrl: "http://localhost:8080"
}
```

### Test Site Modifications

To test different scenarios, you can modify the blog site in `tests/test-sites/simple-blog/`:
- Update HTML structure in `index.html`
- Modify styles in `style.css`
- Add interactions in `script.js`

Remember to restart tests after making changes to see the effects.

## Environment Variables

### Required
- `CLAUDE_API_KEY`: Your Claude API key from [Anthropic Console](https://console.anthropic.com/)

### Optional
- `TEST_USER_EMAIL`: Email for authentication testing (not used in current scenario)
- `TEST_USER_PASSWORD`: Password for authentication testing (not used in current scenario)

## Performance

Current test performance:
- **Blog server startup**: ~1 second
- **Test execution**: 20-30 seconds (depends on Claude API response time)
- **Total runtime**: 25-35 seconds for full suite

The test is optimized for:
- Local development feedback
- Consistent results using mock data
- Minimal external dependencies
- Fast iteration cycles