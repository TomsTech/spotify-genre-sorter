# E2E Test Failure Report - 2024-12-17

## Summary
- **Total Tests**: 385
- **Passed**: 376
- **Failed**: 9

---

## Failure 1-6: Playlist Creation Tests

### Affected Tests
| Test File | Test Name |
|-----------|-----------|
| `create-single.spec.ts` | should create a playlist for selected genre |
| `create-single.spec.ts` | should show playlist link after creation |
| `create-single.spec.ts` | should update recent playlists after creation |
| `create-single.spec.ts` | should name playlist correctly |
| `create-single.spec.ts` | should add correct number of tracks to playlist |
| `duplicates.spec.ts` | should warn only when no duplicate exists |

### Error
```
Failed: Cannot read properties of undefined (reading 'map')
```

### Root Cause
The mock server's playlist creation endpoint returns `undefined` instead of a proper response object. When the frontend tries to call `.map()` on the response, it crashes.

### Evidence
From `test-results/tests-playlists-create-sin-*/error-context.md`:
```yaml
status [ref=e356]: "Failed: Cannot read properties of undefined (reading 'map')"
```

### Fix Required
- [ ] Check `e2e/mocks/mock-server.ts` - POST /api/playlist handler
- [ ] Ensure proper response structure is returned

---

## Failure 7-8: Scoreboard Modal Tests

### Affected Tests
| Test File | Test Name |
|-----------|-----------|
| `leaderboard.spec.ts` | Scoreboard modal can be opened |
| `sidebar.spec.ts` | Scoreboard button opens modal |

### Error
Modal not found after clicking "View Scoreboard" button.

### Root Cause
The test expects a modal with selector `.scoreboard-modal` or `[data-testid="scoreboard-modal"]`, but:
1. The button click registers (button shows `[active]` state)
2. No matching modal element appears in the DOM

### Evidence
From error-context.md - button is `[active]` but no modal in snapshot:
```yaml
button "📊 View Scoreboard" [active] [ref=e80]
```

### Fix Required
- [ ] Check if modal exists in frontend code
- [ ] Add `data-testid="scoreboard-modal"` to modal element OR
- [ ] Update test selector to match actual modal class

---

## Failure 9: Mobile Responsive Test

### Affected Test
| Test File | Test Name |
|-----------|-----------|
| `responsive.spec.ts` | Sidebar collapses by default |

### Root Cause
TBD - Need to investigate mobile viewport handling.

### Fix Required
- [ ] Check sidebar collapse behavior in mobile viewport
- [ ] Verify CSS breakpoints and JavaScript viewport detection

---

## Fix Progress

- [ ] Mock server playlist endpoint
- [ ] Scoreboard modal selector
- [ ] Mobile responsive sidebar
