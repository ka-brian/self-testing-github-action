# PR Test Generator GitHub Action

🤖 Automatically generate and run end-to-end tests for your Pull Requests using Claude API and Magnitude testing framework.

## Features

- 🔍 **Smart Analysis**: Analyzes PR changes and repository context
- 🧪 **Auto-Generated Tests**: Creates comprehensive E2E tests using Claude AI
- ⚡ **Instant Execution**: Runs tests immediately using Magnitude framework
- 💬 **PR Integration**: Comments results directly on your Pull Request
- 🎯 **Zero Configuration**: Works out of the box with sensible defaults

## Quick Start

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
      - uses: yourusername/pr-test-generator@v1
        with:
          claude-api-key: ${{ secrets.CLAUDE_API_KEY }}
```

### 2. Configure your secrets

In your repository settings, add:

- `CLAUDE_API_KEY`: Your Claude API key from [Anthropic Console](https://console.anthropic.com/)

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

| Input            | Description                          | Required | Default                   |
| ---------------- | ------------------------------------ | -------- | ------------------------- |
| `claude-api-key` | Claude API key from Anthropic        | ✅       | -                         |
| `github-token`   | GitHub token for API access          | ❌       | `${{ github.token }}`     |
| `test-examples`  | Custom test examples to guide Claude | ❌       | Built-in examples         |
| `output-dir`     | Directory for generated test files   | ❌       | `.github/generated-tests` |
| `timeout`        | Test execution timeout (seconds)     | ❌       | `120`                     |
| `comment-on-pr`  | Whether to comment results on PR     | ❌       | `true`                    |

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
      import { test, expect } from 'magnitude';

      test('should load dashboard', async (page) => {
        await page.goto('http://localhost:3000/dashboard');
        await page.waitForSelector('.dashboard-header');
        expect(await page.textContent('h1')).toBe('Dashboard');
      });

      test('should handle user interactions', async (page) => {
        await page.goto('http://localhost:3000');
        await page.click('[data-testid="menu-button"]');
        await page.waitForSelector('.menu-open');
      });
    # Save tests to custom location
    output-dir: "./e2e/generated"
    # Increase timeout for complex tests
    timeout: 300
    # Disable PR commenting (use outputs instead)
    comment-on-pr: "false"
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
  import { test, expect } from 'magnitude';

  test('should authenticate user', async (page) => {
    await page.goto('/login');
    await page.fill('#email', 'test@example.com');
    await page.fill('#password', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
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

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `npm test`
5. Build: `npm run build`
6. Submit a Pull Request

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Support

- [GitHub Issues](https://github.com/yourusername/pr-test-generator/issues)
- [Claude API Documentation](https://docs.anthropic.com/)
- [Magnitude Testing Framework](https://github.com/magnitudedev/magnitude)
