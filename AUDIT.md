# Pax Dei Archives — Code Audit & Technical Debt

_Last updated: March 2026_

This document tracks findings from a full holistic review of the JavaScript codebase. It is a living reference — check items off or update notes as work is completed.

---

## JS File Reference Map

Full audit of which HTML pages load which JS files, and which JS files are imported by other JS modules. Used to identify orphaned files.

### `small_sidebar.js` (496 B)
**Status: ACTIVE**
Loaded by: `quests.html`, `panel.html`, `chronicles.html`, `quest_flow.html`, `features.html`, `stacks.html`, `edit_quest.html`, `trends.html`

### `sidebar.js` (4.9 KB)
**Status: ACTIVE**
Loaded by: `admin.html` only. Distinct from `small_sidebar.js` — full sidebar variant.

### `redemption/redeem.js` (8.1 KB)
**Status: ACTIVE**
Loaded by: `quests.html`. Handles sign-grid / cipher-based secret unlock UI.

### `redemption/redeemQuests.js` (7.3 KB)
**Status: ACTIVE**
Loaded by: `redeem.html`. Handles the quest redemption page.
_Note: These two files have confusingly similar names but serve distinct pages._

### `run_charts.js` (14.9 KB) + `run_history.js` (14.2 KB)
**Status: ACTIVE**
Both loaded by: `runs.html`.

### `import_data.js` (9.8 KB)
**Status: DEAD CODE — candidate for deletion**
Loaded by: `listings.html`, but confirmed as an abandoned manual data import process that was never fully implemented. The `<script>` tag in `listings.html` should be removed at the same time as the file.

### `modules/dashboard.js` (43.8 KB)
**Status: ACTIVE**
Imported by: `trader.js` (`import { renderDashboard, renderMarketPulse } from './modules/dashboard.js'`).

### `dashboard.js` — root level (43.7 KB)
**Status: ORPHANED — candidate for deletion**
Not loaded by any HTML page. Not imported by any JS module. `trader.js` imports `modules/dashboard.js`, not this file. Confirmed as the monolith that powered the old `dashboard.html` page (now removed). When `dashboard.html` was retired, this file was left behind. The `modules/dashboard.js` (43.8 KB) is the current modularised successor.

### `buys.js` (29.5 KB)
**Status: ORPHANED — candidate for deletion**
Not loaded by any HTML page. Not imported by any JS module. No corresponding HTML page found.

### `dungeon.js` (4.3 KB) + `dungeon_modules/`
**Status: TIED TO ABANDONED PAGES**
`dungeon.js` is loaded only by `loot.html`. `dungeon_modules/` (contains `view_dungeon.js`) is loaded only by `view_loot.html`. Both pages are confirmed abandoned and not under active development.

---

## Abandoned Pages

The following HTML pages are confirmed as no longer being developed or used:

| Page | Loads |
|---|---|
| `loot.html` | `dungeon.js`, `dungeon.css` |
| `view_loot.html` | `dungeon_modules/view_dungeon.js`, `dungeon.css` |

These pages and their exclusive JS/CSS dependencies are candidates for removal as a group:
- `loot.html`
- `view_loot.html`
- `frontend/www/js/dungeon.js`
- `frontend/www/js/dungeon_modules/` (entire directory)
- `frontend/www/css/dungeon.css`

**Recommendation:** Do not delete yet — confirm no inbound links from nav or other pages before removing.

---

## Active Technical Debt

### 🔴 High Priority

#### 1. `supabaseClient.js` — Debug Proxy always active in production
The entire Supabase client is wrapped in a `wrapQueryBuilder` Proxy that intercepts and logs every `.from()`, `.select()`, `.eq()`, etc. call at runtime. There is no environment check — this overhead runs for every user in production.

**Fix:** Gate behind an environment check.
```js
const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
export const supabase = isDev ? loggedSupabase : rawSupabase;
```
The `window.supabaseStats` helper can stay for dev builds.

---

#### 2. `utils.js` — Loose top-level code that executes on every import
The bottom of `utils.js` (after all exports) contains raw statements at module top level with no guard: a `document.getElementById('utc-clock-display')`, a `setInterval`, and jQuery event handlers. These execute on every page that imports `utils.js`, even pages where those elements don't exist. The clock logic is already handled correctly in `main.js`.

**Fix:** Delete the dangling block at the bottom of `utils.js` entirely (lines after `export const updateUtcClock`).

Also: `getDungeonRuns`, `deleteDungeonRun`, `updateDungeonRun` are dungeon-specific helpers sitting in a shared utility file. Move them to a dungeon-specific module, or delete them if the dungeon pages are removed.

---

#### 3. `featureFlags.js` — Migration scaffolding that has outlived its purpose
Built to gradually roll out `MarketStateManager` across pages. All page flags are now `true` except `ledger` (which doesn't use `featureFlags` at all). The dual old-path / new-path code in `dashboard.js` (root, orphaned) still exists with live `console.log` and `console.time` calls.

**Fix:** 
- Delete `featureFlags.js`
- Delete the root `dashboard.js` (orphaned — see above)
- Remove `featureFlags` imports and the old fallback paths from any files still importing it

**Files to check for `featureFlags` imports:** `dashboard.js` (root), `trending_sales_v2.js`, `market_listings.js`

---

### 🟡 Medium Priority

#### 4. `redemption/auth.js` — Parallel auth listener bypasses `authSessionManager`
`auth.js` (loaded by `quests.html`) sets up its own raw `supabase.auth.onAuthStateChange` with a 300ms debounce, running completely independently of `authSessionManager.js`. This means the quest page can receive duplicate `SIGNED_IN` events on token refresh — exactly the problem `authSessionManager` was built to prevent.

**Fix:** Replace the raw `onAuthStateChange` in `auth.js` with `authSession.onChange()` from `authSessionManager.js`.
_Flagged as lower-risk-timing fix — tackle in a dedicated quest-system pass._

---

#### 5. `adminManager.js` — Potential double fetch of `admin_users`
`handleAdminAccess()` queries `admin_users` and populates `_roleCache`. But `getAdminRoles()` will also fire its own query if called before `handleAdminAccess` resolves. On busy pages both can race, resulting in two DB hits for the same data.

**Fix:** Set `_roleCache.resolved = true` at the start of `handleAdminAccess` before the async query, or merge both into a single shared fetch promise.

---

#### 6. `MarketStateManager.debug = true` hardcoded
`this.debug = true` in the `MarketStateManager` constructor means every cache hit and miss is logged to the console for every user in production.

**Fix:** Set to `false`. Optionally gate via `localStorage.getItem('pda_debug')` for dev use.

---

#### 7. `adminManager.js` calls `initializeCharacterSystem` on every auth event
Including on pages that have nothing to do with characters (lore pages, articles, etc.). It's inexpensive if already initialized, but is unnecessary noise.

**Fix:** Guard with a page check, or restructure so `initializeCharacterSystem` is only called on pages that declare they need it.

---

### 🟢 Minor / Best Practices

#### 8. `profile_v2.js` naming
The `_v2` suffix is legacy noise from when a v1 was replaced. Rename to `profile.js` at next opportunity (requires updating the `<script>` tag in `profile.html`).

#### 9. Inconsistent null checking
Some files use `?.` optional chaining correctly (`record?.is_admin`). Others use verbose patterns (`data && data.length > 0 && data[0].field`). Normalize to optional chaining during any file you're already editing.

#### 10. Live `console.log` / `console.time` in production paths
`dashboard.js` (root, orphaned) and other files have multiple timing and data logs in what were intended as production paths. These should be removed or gated behind the `debug` flag when files are touched.

#### 11. `import_data.js` on `listings.html`
Confirmed dead code — an abandoned manual data import process that was never fully implemented. The file is loaded by `listings.html` but does nothing useful. Remove the `<script>` tag from `listings.html` and delete the file.

---

## Deletion Candidates (do not delete until confirmed)

| File / Directory | Reason | Blocker |
|---|---|---|
| `frontend/www/js/dashboard.js` (root) | Orphaned — leftover from deleted `dashboard.html` | None — confirmed safe |
| `frontend/www/js/buys.js` | Orphaned — no HTML loads it, no JS imports it | None — confirmed safe |
| `frontend/www/js/import_data.js` | Dead feature — abandoned manual import process | Remove `<script>` tag from `listings.html` first |
| `frontend/www/js/dungeon.js` | Only used by abandoned `loot.html` | Remove with loot pages as a group |
| `frontend/www/js/dungeon_modules/` | Only used by abandoned `view_loot.html` | Remove with loot pages as a group |
| `frontend/www/css/dungeon.css` | Only used by abandoned loot pages | Remove with loot pages as a group |
| `loot.html` | Confirmed abandoned | Check for inbound nav links |
| `view_loot.html` | Confirmed abandoned | Check for inbound nav links |
| `featureFlags.js` | Migration scaffolding, all flags permanently true | Clean up featureFlags imports first |

---

## Completed Items

_Move items here once resolved._

- [x] Consistent login/lock prompt styling across `ledger.html`, `quests.html`, `trends.html`, `profile.html`
- [x] `ledger.html` content correctly hidden when logged out (`#traderDashboardAndForms` ID added)
- [x] `profile.html` login prompt added with Discord OAuth button wired in `profile_v2.js`
