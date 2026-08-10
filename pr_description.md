🎯 **What:** Added comprehensive test coverage for the `getGitHubUser` function in `src/lib/github.ts`, which previously had no tests.
📊 **Coverage:** Covered the following scenarios:
- Successfully getting a GitHub user with a valid access token, asserting correct parsing of the returned user payload.
- Verifying correct `fetch` API call configurations, including the required URL, headers (`Authorization`, `Accept`, `User-Agent`).
- Throwing an error when the fetch response is not `ok`, validating error handling logic.
✨ **Result:** 100% test coverage for the `getGitHubUser` function, improving reliability and preventing future regressions in GitHub user authentication flow.
