# PR Test Generator GitHub Action

🤖 Automatically generate and run end-to-end tests for your Pull Requests using Claude API and Magnitude testing framework.

## Features

- 🔍 **Smart Analysis**: Analyzes PR changes and repository context
- 🧪 **Auto-Generated Tests**: Creates comprehensive E2E tests using Claude AI
- ⚡ **Instant Execution**: Runs tests immediately using Magnitude framework
- 💬 **PR Integration**: Comments results directly on your Pull Request
- 🎯 **Zero Configuration**: Works out of the box with sensible defaults

## Quick Start!

### 1. Add the workflow to your repository

Create `.github/workflows/pr-tests.yml`:

```yaml
name: Auto-Generate PR Tests

on:
  pull_request:
    types: [opened, synchronize]

jobs:
  generate-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ka-brian/pr-test-generator@v1
        with:
          claude-api-key: ${{ secrets.CLAUDE_API_KEY }}
```

### 2. Configure your secrets

In your repository settings, add:

- `CLAUDE_API_KEY`: Your Claude API key from [Anthropic Console](https://console.anthropic.com/)

**Optional secrets for authentication:**

- `TEST_USER_EMAIL`: Email for test user authentication (if preview URLs require login)
- `TEST_USER_PASSWORD`: Password for test user authentication (if preview URLs require login)

### 3. Open a Pull Request

The action will automatically:

1. Analyze your PR changes
2. Generate relevant tests
3. Execute the tests
4. Comment the results on your PR

## Example Output

The action will add a comment to your PR like this:

```
## 🎉 Generated Tests PASSED

*Auto-generated tests for PR #123 • 2025-07-18T10:30:00.000Z*

### Test Results:
✅ should navigate to updated dashboard
✅ should handle new form validation
✅ should display error messages correctly

### Test File:
- **Location**: `.github/generated-tests/pr-123-tests.js`
- **Status**: ✅ Tests executed successfully
```

## Configuration

### Inputs

| Input                | Description                                                       | Required | Default                   |
| -------------------- | ----------------------------------------------------------------- | -------- | ------------------------- |
| `claude-api-key`     | Claude API key from Anthropic                                     | ✅       | -                         |
| `github-token`       | GitHub token for API access                                       | ❌       | `${{ github.token }}`     |
| `test-examples`      | Custom test examples to guide Claude                              | ❌       | Built-in examples         |
| `output-dir`         | Directory for generated test files                                | ❌       | `.github/generated-tests` |
| `timeout`            | Test execution timeout (seconds)                                  | ❌       | `120`                     |
| `comment-on-pr`      | Whether to comment results on PR                                  | ❌       | `true`                    |
| `wait-for-preview`   | Wait for preview URLs to appear in PR comments (seconds)          | ❌       | `60`                      |
| `base-url`           | Base URL to use for tests (overrides preview URL detection)       | ❌       | -                         |
| `test-user-email`    | Email for test user authentication (if preview requires login)    | ❌       | -                         |
| `test-user-password` | Password for test user authentication (if preview requires login) | ❌       | -                         |

### Outputs

| Output           | Description                             |
| ---------------- | --------------------------------------- |
| `test-results`   | JSON string with test execution results |
| `test-file-path` | Path to generated test file             |
| `tests-passed`   | Boolean indicating if tests passed      |

### Advanced Configuration

```yaml
- uses: yourusername/pr-test-generator@v1
  with:
    claude-api-key: ${{ secrets.CLAUDE_API_KEY }}
    # Custom test examples for your project
    test-examples: |
      const { startBrowserAgent } = require('magnitude-core');
      require('dotenv').config();

      async function runTests() {
        const agent = await startBrowserAgent({
          url: process.env.PREVIEW_URL || 'http://localhost:3000',
          narrate: true,
          browser: {
            launchOptions: { headless: true },
            contextOptions: { viewport: { width: 1280, height: 720 } 
          }
        });

        try {
          console.log('Test: Loading dashboard');
          await agent.act('Navigate to the dashboard page');
          const heading = await agent.extract('Get the main dashboard heading text', z.string());
          console.log('Dashboard heading:', heading);

          console.log('Test: User interactions');
          await agent.act('Navigate to the homepage');
          await agent.act('Click on the menu button');
          await agent.act('Wait for the menu to open');

          console.log('All tests completed successfully');
        } finally {
          await agent.stop();
        }
      }

      runTests().catch(error => {
        console.error('Test suite failed:', error);
        process.exit(1);
      });
    # Save tests to custom location
    output-dir: "./e2e/generated"
    # Increase timeout for complex tests
    timeout: 300
    # Disable PR commenting (use outputs instead)
    comment-on-pr: "false"
    # Wait longer for preview URLs to appear
    wait-for-preview: 120
    # Override preview URL detection with specific base URL
    base-url: "https://my-staging-env.example.com"
    # Authentication for preview environments that require login
    test-user-email: ${{ secrets.TEST_USER_EMAIL }}
    test-user-password: ${{ secrets.TEST_USER_PASSWORD }}
```

## Setup Requirements

### Claude API Key

1. Go to [Anthropic Console](https://console.anthropic.com/)
2. Create an API key
3. Add it to your repository secrets as `CLAUDE_API_KEY`

### Repository Access

The action needs access to:

- Read repository content and PR details
- Write comments on Pull Requests
- Execute tests in the GitHub Actions environment

This is handled automatically by the default `GITHUB_TOKEN`.

### Preview URLs and Authentication

The action can automatically detect preview URLs from PR comments (Vercel, Netlify, Railway, etc.) and use them for testing. If your preview environments require authentication, you can configure test credentials:

1. **Automatic Detection**: The action scans PR comments for preview URLs
2. **Manual Override**: Use `base-url` input to specify a custom URL
3. **Authentication**: Set `test-user-email` and `test-user-password` for login-protected previews
4. **Environment Variables**: Tests can access credentials via `process.env.TEST_USER_EMAIL` and `process.env.TEST_USER_PASSWORD`

**Important Security Note**: Create a dedicated sandboxed testing environment for the test user account. This test user should have restricted permissions and access only to non-production data to prevent any potential security risks during automated testing.

#### Supported Preview Platforms

- Vercel (\*.vercel.app)
- Netlify (\*.netlify.app)
- Railway (\*.railway.app)
- Custom preview URLs matching pattern `https://preview-*`

## How It Works

1. **Context Analysis**: Fetches PR details, changed files, and repository structure
2. **Test Generation**: Sends context to Claude API with your test examples
3. **Test Execution**: Runs generated tests using Magnitude in a headless browser
4. **Results Reporting**: Comments detailed results on the PR

## Best Practices

### Security

```yaml
# Only run on PRs from the same repository (not forks)
if: github.event.pull_request.head.repo.full_name == github.repository

# Optional: only run on specific file changes
on:
  pull_request:
    paths:
      - "src/**"
      - "components/**"
      - "pages/**"
```

### Performance

```yaml
# Run only on specific PR events
on:
  pull_request:
    types: [opened, synchronize] # Skip 'ready_for_review', etc.

# Set appropriate timeout
with:
  timeout: 120 # Adjust based on your app's complexity
```

### Customization

```yaml
# Provide project-specific test patterns
test-examples: |
  // Your actual test patterns
  const { startBrowserAgent } = require('magnitude-core');
  require('dotenv').config();

  async function runTests() {
    const agent = await startBrowserAgent({
      url: process.env.PREVIEW_URL || 'http://localhost:3000',
      narrate: true,
      browser: {
        launchOptions: { headless: true },
        contextOptions: { viewport: { width: 1280, height: 720 } 
      }
    });
    
    try {
      console.log('Test: User authentication');
      await agent.act('Navigate to the login page');
      await agent.act('Login with credentials', {
        data: {
          email: process.env.TEST_USER_EMAIL,
          password: process.env.TEST_USER_PASSWORD
        }
      });
      await agent.act('Wait for redirect to dashboard');
      
      console.log('Test: Access protected route');
      await agent.act('Navigate to the admin section');
      await agent.act('Wait for admin dashboard to load');
      
      console.log('All tests completed successfully');
    } finally {
      await agent.stop();
    }
  }

  runTests().catch(error => {
    console.error('Test suite failed:', error);
    process.exit(1);
  });
```

## Troubleshooting

### Common Issues

**Tests fail to execute**

- Ensure your app can run in the GitHub Actions environment
- Check that all dependencies are properly installed
- Verify test syntax is compatible with Magnitude

**Claude API errors**

- Verify your API key is correctly set in secrets
- Check API rate limits and quotas
- Ensure your repository context isn't too large

**No tests generated**

- Check that your PR has meaningful code changes
- Ensure changed files are in supported formats
- Review the action logs for detailed error messages

### Debug Mode

Enable debug logging by setting the `ACTIONS_STEP_DEBUG` secret to `true` in your repository.

## Limitations

- Works best with web applications that can run in CI environments
- Requires Magnitude-compatible test structure
- Subject to Claude API rate limits and token limits
- Generated tests may require manual review and adjustment

## Local Testing

You can test the PR Test Generator locally without needing to create actual PRs:

```bash
# Set up environment
cp .env.example .env
# Add your CLAUDE_API_KEY to .env

# Run local test suite
npm test
```

This runs a comprehensive test that:

- Starts a local blog server
- Simulates a GitHub PR with HTML changes
- Tests the full test generation pipeline
- Validates Claude AI integration

See [TESTING.md](TESTING.md) for detailed testing documentation.

## Generating a Sitemap

You can use the included route discovery tool to generate a comprehensive sitemap of your web application:

```bash
# Run the discover routes script with your website URL
node src/discover-routes.js
```

The script will:
1. Navigate through your website's main navigation
2. Explore dropdown menus and submenus
3. Extract information about each page including available actions
4. Generate a detailed sitemap with page descriptions

**Configuration:**
- Set `TEST_USER_EMAIL` and `TEST_USER_PASSWORD` environment variables if your site requires authentication
- The script will automatically handle login and project/workspace selection
- Modify the URL in `src/discover-routes.js` or pass it as an argument

**Output:**
The script saves the discovered routes to `discovered-routes.json` in your project root. Save this file as `sitemap.json` in the root of your project for use by the test generation system.

The sitemap includes:
- Page URLs and descriptions
- Available actions and functionality
- Navigation hierarchy (main vs submenu items)
- Discovery timestamps

This sitemap helps the AI generate more targeted and comprehensive tests by understanding your application's structure.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `npm test`
5. Submit a Pull Request

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Support

- [GitHub Issues](https://github.com/yourusername/pr-test-generator/issues)
- [Claude API Documentation](https://docs.anthropic.com/)
- [Magnitude Testing Framework](https://github.com/magnitudedev/magnitude)
