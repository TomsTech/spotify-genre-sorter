# AGENTS.md

Instructions for AI agents (Claude Code, GitHub Copilot, etc.) working in this repository.

## Quick Start

```bash
# Run tests
python -m pytest
```

---

## Agent Entry Points

### Bug Fixes
1. Read `CLAUDE.md` for architecture overview
2. Check tests/ for existing test coverage
3. Run python -m pytest before and after changes


### Feature Additions
1. Check existing patterns in src/
2. Follow the project's coding conventions
3. Add tests for new functionality
4. Update documentation as needed

### Documentation Updates
1. Update `README.md` for user-facing changes
2. Update `CLAUDE.md` for structural changes


---

## Do's and Don'ts

### Do
- Run tests before committing
- Follow existing naming conventions
- Use proper error handling
- Test with both dry-run and actual execution (where applicable)
- Keep commits focused and atomic

### Don't
- Modify CI workflow unless explicitly asked
- Add dependencies without documenting them
- Change default config values without justification
- Commit sensitive files (credentials, API keys, etc.)
- Use syntax incompatible with Python 3.10+

---

## Testing Requirements

Before any PR:
1. All tests must pass: `python -m pytest`
2. No linting errors
3. CI must pass

---

## File Ownership

| Files | Modify Freely | Requires Review |
|-------|---------------|-----------------|
| `CLAUDE.md`, `AGENTS.md` | Yes | No |
| `README.md` | Yes | No |
| `.github/workflows/*` | No | Yes - CI/CD |

---

## Known Limitations

- **Cloudflare Workers Environment**: The project runs on Cloudflare Workers. Standard Node.js built-in modules (e.g., `fs`, `path`) are not available. Use Web Standard APIs instead.
- **Cloudflare KV Eventual Consistency**: Writes to Cloudflare KV are not immediately globally visible. Be aware of eventual consistency.
- **Spotify API Limits**: The Spotify API has strict rate limits and limits on track numbers (max 10,000 tracks). Large libraries require patience (paginated API calls).
- **Genre Derivation**: Genres are derived from **artists**, not individual tracks.
- **Playlists**: Playlists are created as **private** by default.
- **Session Expiration**: Sessions expire after 7 days.
- **Testing**: E2E tests use a mocked Spotify API. Real API changes will not be caught by tests unless mocks are updated.

---

## Commit Message Format

```
<type>: <short description>

Types: fix, feat, docs, test, chore, refactor
```

Examples:
- `fix: handle edge case in data processing`
- `feat: add new configuration option`
- `docs: update installation instructions`

