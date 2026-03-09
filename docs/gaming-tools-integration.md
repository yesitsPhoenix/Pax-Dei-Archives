# gaming.tools Market API Integration

**Scope:** `ledger.html` + associated JS modules  
**API Reference:** https://paxdei.gaming.tools/market/api  
**Data CDN Base:** `https://data-cdn.gaming.tools/paxdei/market/`

---

## Status Key

| Badge | Meaning |
|-------|---------|
| ✅ Complete | Built and in place |
| ⚠️ Partial | Code written but has an unresolved dependency |
| 🔲 Not Started | Planned, no work done yet |

---

## Overview

Integrates the gaming.tools public market API into the Ledger page to surface real-time external market data alongside a player's own tracked listings. All new behaviour is gated behind a single feature flag (`GAMING_TOOLS_ENABLED`) inside `gamingToolsService.js`. Setting it to `false` leaves the existing Ledger page completely unaffected.

**Three user-facing features:**

1. **Price context column** on the Active Listings table — shows the current external market low per item, colour-coded against the player's listed price.
2. **Market Pulse section** — a new dashboard panel showing zone-level market activity for the selected character's home valley.
3. **Price hint in the Add Listing modal** — when a player enters an item name, the modal shows the current market low as a reference before they commit a price.

---

## External API

Data refreshes hourly. No authentication required. All requests are made from the browser.

| Method | Endpoint | Returns |
|--------|----------|---------|
| GET | `index.json` | Array of zone JSON URLs keyed by world/domain/zone |
| GET | `{world}/{domain}/{zone}.json` | All active listings in that home valley zone — `item_id`, `quantity`, `price`, `avatar_hash`, `creation_date`, `last_seen` |
| GET | `items.json` | Dictionary: `item_id → { name: { En, De, … }, icon_url, … }` |

**Zone URL mapping from character fields:**

| API field | Character table field | Example |
|-----------|-----------------------|---------|
| `world` | `shard` | `demeter` |
| `domain` | `province` | `merrie` |
| `zone` | `home_valley` | `shire` |

Values are lowercased and spaces replaced with underscores before building the URL (`toApiSlug()`).

---

## File Changes

### ✅ `frontend/www/js/services/gamingToolsService.js` — NEW

Self-contained service module. All API fetch, caching, zone-URL resolution, xxHash64 avatar hashing, and data transform logic lives here. Nothing outside this file makes direct `fetch()` calls to gaming.tools.

**Exports:**

| Export | Description |
|--------|-------------|
| `fetchZoneListings(shard, province, homeValley)` | Fetches raw active listings for a zone; respects 45-min cache |
| `loadZoneDataForCharacter(character)` | Orchestrator — fetches zone, builds price map + summary, stores in module state |
| `clearZoneData()` | Clears module state on character change |
| `buildMarketPriceMap(listings)` | Returns `{ [item_id]: { marketLow, marketAvg, totalListings } }` |
| `getMarketDataForSlug(slug)` | Per-item lookup against current zone state |
| `getCurrentPriceMap()` | Returns the full price map or null |
| `buildZoneSummary(listings)` | Returns `{ totalListings, uniqueSellers, uniqueItems, topItemSlug, topItemCount }` |
| `hashAvatarId(avatarId)` | xxHash64 via WASM; returns 16-char hex; raw ID never stored |
| `findOwnListings(avatarHash)` | Filters current zone listings by avatar hash |
| `summarizeOwnListings(ownListings)` | Returns `{ totalCount, totalValue, uniqueItems }` |
| `getSavedAvatarHash()` / `saveAvatarHash(hash)` / `clearAvatarHash()` | sessionStorage helpers for the hashed avatar ID only |

**Key constants:**

| Constant | Default | Effect |
|----------|---------|--------|
| `GAMING_TOOLS_ENABLED` | `true` | Master toggle — disables all fetches and UI injection when `false` |
| `CACHE_TTL_MS` | `2700000` (45 min) | How long zone data is kept in sessionStorage before re-fetching |

---

### ✅ `frontend/www/js/modules/characters.js` — MODIFY

`getCurrentCharacter()` already selects `shard, province, home_valley` from the `characters` table and returns them in the object. No further changes needed.

---

### ✅ `frontend/www/js/modules/dom.js` — MODIFY

The **"Market Low"** `<th>` column is injected inside `getMarketStallDomElements()` when it dynamically builds the per-stall table. The header includes a tooltip: *"Current lowest price for this item in your home valley (paxdei.gaming.tools)"* and a globe icon.

---

### ✅ `frontend/www/js/modules/render.js` — MODIFY

Imports `getMarketDataForSlug` from `gamingToolsService.js`. For each listing row, it looks up `pax_dei_slug` against the current price map and renders a colour-coded `<td>`:

| Condition | Colour | Icon |
|-----------|--------|------|
| Player's price ≤ market low | 🟢 `text-emerald-400` | `fa-check-circle` |
| 0–15% above market low | 🟡 `text-yellow-400` | `fa-minus-circle` |
| >15% above market low | 🔴 `text-red-400` | `fa-arrow-up` |
| No zone data / no slug | ⚪ `text-gray-400` | em dash |

Each cell also shows a sub-line with the total number of listings for that item in the zone.

---

### ✅ `frontend/www/js/modules/dashboard.js` — MODIFY

`renderMarketPulse(zoneSummary, ownSummary, character, loading, errorMsg)` is fully implemented. It writes into the following DOM IDs (all in `ledger.html`):

| DOM ID | Content |
|--------|---------|
| `market-pulse-section` | The section wrapper — must exist for any rendering to occur |
| `market-pulse-zone-name` | Zone label: `home_valley · province · shard` |
| `market-pulse-status` | Loading spinner or error message |
| `market-pulse-cards` | Wrapper for the stat cards — dimmed during loading |
| `pulse-total-listings` | Total active zone listings |
| `pulse-unique-sellers` | Unique seller count |
| `pulse-unique-items` | Unique item count |
| `pulse-top-item` | Most-listed item slug (linked to gaming.tools) |
| `market-pulse-own-listings` | Own-listings summary (shown only if Avatar ID was hashed) |

---

### ✅ `frontend/www/js/trader.js` — MODIFY

All gaming.tools imports are in place. The zone data flow is fully wired inside `loadTraderPageData()`:

1. Calls `clearZoneData()` on each character load.
2. Calls `renderMarketPulse(null, null, character, true)` immediately to show loading state.
3. Fires `loadZoneDataForCharacter(character)` non-blocking (`.then()`), so it never delays the rest of the page load.
4. On success: re-renders active listings (so Market Low column populates), resolves any saved Avatar ID hash via `getSavedAvatarHash()` + `findOwnListings()`, then calls `renderMarketPulse(result.zoneSummary, ownSummary, character)`.
5. On failure: calls `renderMarketPulse()` with a user-friendly error message.

Avatar ID hash button wiring is also present in `trader.js`, targeting the DOM IDs added in `ledger.html`.

---

### ⚠️ `ledger.html` — MODIFY (blocking — all other completed work depends on this)

**The JS is fully wired but the target DOM IDs do not exist yet.** Until this is done, `renderMarketPulse()` silently returns early on every call and the Market Low column renders as dashes for all rows (since zone data never loads into the UI).

Three blocks need to be added:

**1. Market Pulse section** — between the PVE grid and the Charts section:

Required IDs: `market-pulse-section`, `market-pulse-zone-name`, `market-pulse-status`, `market-pulse-cards`, `pulse-total-listings`, `pulse-unique-sellers`, `pulse-unique-items`, `pulse-top-item`, `market-pulse-own-listings`, `.market-pulse-own-row`

**2. Avatar ID opt-in card** — inside the character selection area:

Required IDs: `avatar-id-input`, `avatar-id-hash-btn`, `avatar-id-status`, `avatar-id-clear-btn`  
Must include the gaming.tools privacy warning: *"Do not share your Avatar ID publicly."*

**3. Price hint `<div>`** — inside the Add Listing modal, adjacent to the `listed_price_per_unit` input:

Required ID: `modal-market-low-hint`

---

## Data Flow (when enabled)

```
trader.js: loadTraderPageData()
  └─ clearZoneData()
  └─ renderMarketPulse(..., loading=true)          ← shows spinner immediately
  └─ loadZoneDataForCharacter(character) [non-blocking]
       └─ checks sessionStorage cache (45 min TTL)
       └─ if stale: fetch {world}/{domain}/{zone}.json
       └─ buildMarketPriceMap(listings)   → stored in module state
       └─ buildZoneSummary(listings)      → zoneSummary
  └─ loadActiveListings()                          ← re-render so Market Low cells populate
  └─ getSavedAvatarHash() → findOwnListings()      → ownSummary
  └─ renderMarketPulse(zoneSummary, ownSummary, character)
```

If `loadZoneDataForCharacter()` fails for any reason (network error, unmapped zone, 404), it returns `null`. All callers treat `null` as "no external data" and render gracefully — no errors are surfaced to the user.

---

## Rollback

**To disable without touching git:**

Set `GAMING_TOOLS_ENABLED = false` in `gamingToolsService.js`, then hard-refresh (Ctrl+Shift+R) to clear the ES module cache. The Ledger renders identically to its pre-integration state.

**To remove entirely:**

```
git checkout HEAD -- frontend/www/js/modules/characters.js
git checkout HEAD -- frontend/www/js/modules/dom.js
git checkout HEAD -- frontend/www/js/modules/render.js
git checkout HEAD -- frontend/www/js/modules/dashboard.js
git checkout HEAD -- frontend/www/js/trader.js
git checkout HEAD -- ledger.html
del frontend\www\js\services\gamingToolsService.js
```

---

## Known Gaps

- **Zone URL mapping** — `toApiSlug()` does a best-effort lowercase + underscore conversion. If gaming.tools uses different casing or naming for any world/domain/zone, those characters will silently get no zone data. A hardcoded fallback map may be needed after live testing.
- **`items.pax_dei_slug` coverage** — price context only works for items with a `pax_dei_slug` populated. Items without a slug show a dash. Backfilling slugs from the gaming.tools `items.json` is a separate task.
- **Price hint in Add Listing modal** — the `modal-market-low-hint` div (to be added in `ledger.html`) is not yet wired in `trader.js`. The autocomplete item selection handler will need a small addition to call `getMarketDataForSlug()` and populate that div.
- **Historical price trends** — the API provides current active listings only, not sale history. Trend charts would require a separate data store or a third-party history endpoint.
- **`marketStateManager.js` Phase 2 note** — the comment `// Phase 2: Add API integration` was left intentionally. If the gaming.tools integration is ever migrated into the state manager, `gamingToolsService.js` can be consumed as a dependency rather than a standalone module.
