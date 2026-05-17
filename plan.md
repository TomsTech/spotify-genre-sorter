1. **Analyze Security Needs**:
   - Issue: The frontend sets `innerHTML` to unescaped error messages in multiple places inside `src/frontend/app.js`:
     - Lines 887, 1091, 1159, 1459, 1503, 1578 (`${err.message}`)
   - This can be a Cross-Site Scripting (XSS) vulnerability if `err.message` comes from a user-controllable source or API response that lacks escaping.
   - Solution: Wrap `err.message` in `escapeHtml()`.

2. **Modify `src/frontend/app.js`**:
   - Escape `err.message` in all `innerHTML` assignments using the `escapeHtml` function that is already available in the file.
   - Run `pnpm build:frontend` to regenerate `src/generated/frontend.ts`.

3. **Complete pre-commit steps to ensure proper testing, verification, review, and reflection are done.**
   - Run `pnpm format`, `pnpm lint`, `pnpm test`.
   - Call `pre_commit_instructions` tool.

4. **Create PR**:
   - Commit changes with message `🛡️ Sentinel: [HIGH] Fix XSS by escaping error messages in innerHTML`.
   - Push and submit.
