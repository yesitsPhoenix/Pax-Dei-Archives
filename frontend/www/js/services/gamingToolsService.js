/**
 * gamingToolsService.js
 *
 * Integration with the paxdei.gaming.tools public market API.
 * Data updates hourly on their end; we cache responses for 45 minutes.
 * No authentication required. All hashing runs client-side.
 *
 * API reference: https://paxdei.gaming.tools/market/api
 *
 * URL structure: https://data-cdn.gaming.tools/paxdei/market/{world}/{domain}/{zone}.json
 *   world  = character.shard      (e.g. "demeter", "tyr", "sif")
 *   domain = character.province   (e.g. "merrie", "ancien", "inis_gallia", "kerys")
 *   zone   = character.home_valley (e.g. "shire", "yarborn", "salias")
 */

const API_BASE = 'https://data-cdn.gaming.tools/paxdei/market';
const CACHE_TTL_MS = 45 * 60 * 1000; // 45 minutes
const CACHE_PREFIX = 'pda_gt_';
const LEGACY_AVATAR_HASH_KEY = 'pda_avatar_hash';

// ── Module-level state ──────────────────────────────────────────────────────

/** Price map for the currently active character's zone. */
let _currentPriceMap = null;

/** Quality-keyed price map: "${bareId}::mc${0|1}::enc${0-3}" → price stats */
let _currentQualityMap = null;

/** Name-based lookup map: English display name (lowercase) → item_id */
let _currentNameMap = null;

/** Items data from items.json: item_id → { name, url } */
let _itemsData = null;

/** Raw zone listings for the currently active character's zone. */
let _currentZoneListings = [];

/** Timestamp (ms) of the last successful zone data fetch. */
let _lastFetchTime = null;

/** Whether a zone fetch is currently in flight (prevent duplicate calls). */
let _fetchInProgress = false;

// ── Session cache helpers ───────────────────────────────────────────────────

function cacheGet(key) {
    try {
        const raw = sessionStorage.getItem(CACHE_PREFIX + key);
        if (!raw) return null;
        const { data, ts } = JSON.parse(raw);
        if (Date.now() - ts > CACHE_TTL_MS) {
            sessionStorage.removeItem(CACHE_PREFIX + key);
            return null;
        }
        return data;
    } catch {
        return null;
    }
}

function cacheSet(key, data) {
    try {
        sessionStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ data, ts: Date.now() }));
    } catch {
        // Silently fail on quota exceeded
    }
}

// ── URL normalization ───────────────────────────────────────────────────────

/**
 * Converts a display string to the API slug format.
 * e.g. "Inis Gallia" → "inis_gallia", "Merrie" → "merrie"
 */
function toApiSlug(str) {
    if (!str) return '';
    return str.toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
}

/**
 * Strips the path prefix from a pax_dei_slug stored in the DB.
 * The DB stores path-prefixed slugs (e.g. "items/item_foo", "wieldables/wieldable_bar")
 * but gaming.tools zone listings and items.json use bare item IDs (e.g. "item_foo").
 * This normalizer makes all lookups work regardless of which format is passed in.
 *
 * @param {string} slug
 * @returns {string}
 */
function toBareId(slug) {
    if (!slug) return slug;
    const slash = slug.lastIndexOf('/');
    return slash !== -1 ? slug.slice(slash + 1) : slug;
}

// ── API fetching ────────────────────────────────────────────────────────────

/**
 * Fetches active market listings for a character's home valley zone.
 * @param {string} shard      - e.g. "Demeter"
 * @param {string} province   - e.g. "Merrie"
 * @param {string} homeValley - e.g. "Shire"
 * @returns {Promise<Array>}  raw listing objects from gaming.tools
 */
export async function fetchZoneListings(shard, province, homeValley) {
    const world = toApiSlug(shard);
    const domain = toApiSlug(province);
    const zone = toApiSlug(homeValley);

    if (!world || !domain || !zone) {
        throw new Error(`Character zone data incomplete (shard="${shard}", province="${province}", homeValley="${homeValley}")`);
    }

    const cacheKey = `zone_${world}_${domain}_${zone}`;
    const cached = cacheGet(cacheKey);
    if (cached) return cached;

    const url = `${API_BASE}/${world}/${domain}/${zone}.json`;
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`Zone not found in gaming.tools API: ${world}/${domain}/${zone}`);
    }
    const data = await res.json();
    cacheSet(cacheKey, data);
    return data;
}

/**
 * Fetches and caches the gaming.tools items dictionary (item_id → { name, url }).
 * Loaded once per session; persists across zone changes.
 * @returns {Promise<Object>}
 */
export async function loadItemsData() {
    if (_itemsData) return _itemsData;
    const cached = cacheGet('items_data_v2');
    if (cached) {
        _itemsData = cached;
        return _itemsData;
    }
    try {
        const res = await fetch(`${API_BASE}/items.json`);
        if (!res.ok) throw new Error('items.json fetch failed');
        const raw = await res.json();
        _itemsData = {};
        for (const [id, item] of Object.entries(raw)) {
            _itemsData[id] = {
                name: item.name?.En || id,
                url: item.url || null,
                iconPath: item.iconPath || null
            };
        }
        cacheSet('items_data_v2', _itemsData);
    } catch (e) {
        console.warn('[GamingTools] items.json load failed:', e.message);
        _itemsData = {};
    }
    return _itemsData;
}

/**
 * Loads zone listings for a character and stores the results in module-level state.
 * Safe to call multiple times; prevents duplicate in-flight requests.
 *
 * @param {object} character - Must include shard, province, home_valley
 * @returns {Promise<{ priceMap: object, zoneSummary: object }|null>}
 */
export async function loadZoneDataForCharacter(character) {
    if (_fetchInProgress) return null;
    if (!character?.shard || !character?.province || !character?.home_valley) return null;

    _fetchInProgress = true;
    try {
        const [listings] = await Promise.all([
            fetchZoneListings(character.shard, character.province, character.home_valley),
            loadItemsData()
        ]);
        _currentZoneListings = listings;
        _currentPriceMap = buildMarketPriceMap(listings);
        _currentQualityMap = buildQualityMarketMap(listings);
        _currentNameMap = buildNameMap(_currentPriceMap);
        _lastFetchTime = Date.now();

        return {
            priceMap: _currentPriceMap,
            zoneSummary: buildZoneSummary(listings),
            listings
        };
    } catch (err) {
        console.warn('[GamingTools] Zone data unavailable:', err.message);
        _currentZoneListings = [];
        _currentPriceMap = null;
        return null;
    } finally {
        _fetchInProgress = false;
    }
}

/**
 * Clears the current zone state (call when character changes).
 */
export function clearZoneData() {
    _currentPriceMap = null;
    _currentQualityMap = null;
    _currentNameMap = null;
    _currentZoneListings = [];
    _lastFetchTime = null;
}

/**
 * Returns how many minutes ago the zone data was last fetched, or null if never.
 * @returns {number|null}
 */
export function getZoneDataAge() {
    if (!_lastFetchTime) return null;
    return Math.floor((Date.now() - _lastFetchTime) / 60000);
}

/**
 * Returns own listing count and listings for a specific item slug.
 * Used to show "X of those N listings are yours" in the add-listing hint.
 *
 * @param {string} avatarHash - from getSavedAvatarHash()
 * @param {string} slug       - pax_dei_slug / gaming.tools item_id
 * @returns {{ ownCount: number, ownListings: Array }}
 */
export function getOwnListingCountForSlug(avatarHash, slug) {
    if (!avatarHash || !slug || !_currentZoneListings.length) {
        return { ownCount: 0, ownListings: [] };
    }
    const bareSlug = toBareId(slug);
    const ownListings = _currentZoneListings.filter(
        l => l.item_id === bareSlug && l.avatar_hash === avatarHash
    );
    return { ownCount: ownListings.length, ownListings };
}

// ── Price map ───────────────────────────────────────────────────────────────

/**
 * Builds a price lookup map from raw zone listings.
 * Keys are pax_dei_slug (= item_id in gaming.tools).
 *
 * @param {Array} zoneListings
 * @returns {Object<string, { marketLow: number, marketAvg: number, totalListings: number }>}
 */
export function buildMarketPriceMap(zoneListings) {
    const grouped = {};
    for (const listing of zoneListings) {
        const slug = listing.item_id;
        if (!grouped[slug]) grouped[slug] = [];
        const qty = listing.quantity || 1;
        grouped[slug].push(listing.price / qty); // price is total stack price; convert to per-unit
    }
    const result = {};
    for (const [slug, prices] of Object.entries(grouped)) {
        const sorted = prices.slice().sort((a, b) => a - b);
        const sum = sorted.reduce((s, p) => s + p, 0);
        result[slug] = {
            marketLow: sorted[0],
            marketAvg: parseFloat((sum / sorted.length).toFixed(2)),
            totalListings: sorted.length
        };
    }
    return result;
}

/**
 * Builds a quality-keyed price map from raw zone listings.
 * Groups by item_id + mastercraft + enchantment_level.
 * Key format: "${item_id}::mc${0|1}::enc${0-3}"
 *
 * @param {Array} zoneListings
 * @returns {Object<string, { marketLow: number, marketAvg: number, totalListings: number }>}
 */
function buildQualityMarketMap(zoneListings) {
    const grouped = {};
    for (const listing of zoneListings) {
        const slug = listing.item_id;
        const mc   = listing.mastercraft ? 1 : 0;
        const enc  = listing.enchantment_level || 0;
        const key  = `${slug}::mc${mc}::enc${enc}`;
        if (!grouped[key]) grouped[key] = [];
        const qty = listing.quantity || 1;
        grouped[key].push(listing.price / qty);
    }
    const result = {};
    for (const [key, prices] of Object.entries(grouped)) {
        const sorted = prices.slice().sort((a, b) => a - b);
        const sum = sorted.reduce((s, p) => s + p, 0);
        result[key] = {
            marketLow:     sorted[0],
            marketAvg:     parseFloat((sum / sorted.length).toFixed(2)),
            totalListings: sorted.length
        };
    }
    return result;
}

/**
 * Builds a name-based lookup map for items in the current zone price map.
 * Keys are lowercase English display names (from items.json).
 * Values are item_ids, used to then look up the price map.
 *
 * @param {Object} priceMap - from buildMarketPriceMap()
 * @returns {Object<string, string>} lowercase name → item_id
 */
function buildNameMap(priceMap) {
    const nameMap = {};
    if (!_itemsData) return nameMap;
    for (const itemId of Object.keys(priceMap)) {
        const item = _itemsData[itemId];
        if (item?.name) {
            nameMap[item.name.toLowerCase()] = itemId;
        }
    }
    return nameMap;
}

/**
 * Looks up market price data for a single item slug using current zone state.
 * Returns null if no zone data is loaded or the item has no listings.
 *
 * @param {string} paxDeiSlug
 * @returns {{ marketLow: number, marketAvg: number, totalListings: number }|null}
 */
export function getMarketDataForSlug(paxDeiSlug) {
    if (!_currentPriceMap || !paxDeiSlug) return null;
    return _currentPriceMap[toBareId(paxDeiSlug)] || null;
}

/**
 * Returns the English display name for a given slug/item_id from items.json.
 * Used to cross-check that a slug lookup actually refers to the expected item.
 *
 * @param {string} paxDeiSlug
 * @returns {string|null}
 */
export function getItemNameForSlug(paxDeiSlug) {
    if (!_itemsData || !paxDeiSlug) return null;
    return _itemsData[toBareId(paxDeiSlug)]?.name || null;
}

/**
 * Looks up the gaming.tools item_id for a given English display name.
 * Used when pax_dei_slug is missing or mismatched, as a fallback to
 * still identify the correct item in the zone listings.
 *
 * @param {string} itemName - e.g. "Charcoal"
 * @returns {string|null} gaming.tools item_id, or null if not found in zone
 */
export function getItemIdByName(itemName) {
    if (!_currentNameMap || !itemName) return null;
    return _currentNameMap[itemName.toLowerCase().trim()] || null;
}

/**
 * Looks up market price data by English display name (e.g. "Iron Skinning Knife").
 * Uses the items.json name → item_id map, then the price map.
 * Used as a fallback when pax_dei_slug is not populated in the DB.
 *
 * @param {string} itemName - Display name as stored in the DB
 * @returns {{ marketLow: number, marketAvg: number, totalListings: number }|null}
 */
export function getMarketDataByItemName(itemName) {
    if (!_currentNameMap || !_currentPriceMap || !itemName) return null;
    const itemId = _currentNameMap[itemName.toLowerCase().trim()];
    return itemId ? (_currentPriceMap[itemId] || null) : null;
}

/**
 * Looks up quality-specific market price data for a single item slug.
 * Filters zone listings to only those matching the given mastercraft + enchantment level.
 *
 * @param {string}  paxDeiSlug      - DB slug or gaming.tools item_id
 * @param {boolean} isMastercrafted
 * @param {number}  enchantmentTier - 0–3
 * @returns {{ marketLow: number, marketAvg: number, totalListings: number }|null}
 */
export function getMarketDataForSlugByQuality(paxDeiSlug, isMastercrafted, enchantmentTier) {
    if (!_currentQualityMap || !paxDeiSlug) return null;
    const bareId = toBareId(paxDeiSlug);
    const mc  = isMastercrafted ? 1 : 0;
    const enc = enchantmentTier || 0;
    return _currentQualityMap[`${bareId}::mc${mc}::enc${enc}`] || null;
}

/**
 * Looks up quality-specific market price data by English display name.
 *
 * @param {string}  itemName
 * @param {boolean} isMastercrafted
 * @param {number}  enchantmentTier - 0–3
 * @returns {{ marketLow: number, marketAvg: number, totalListings: number }|null}
 */
export function getMarketDataByItemNameAndQuality(itemName, isMastercrafted, enchantmentTier) {
    if (!_currentNameMap || !_currentQualityMap || !itemName) return null;
    const itemId = _currentNameMap[itemName.toLowerCase().trim()];
    if (!itemId) return null;
    const mc  = isMastercrafted ? 1 : 0;
    const enc = enchantmentTier || 0;
    return _currentQualityMap[`${itemId}::mc${mc}::enc${enc}`] || null;
}

/**
 * Returns raw zone listings for a single item + quality variant.
 * Used when the UI needs stack-aware comparisons instead of per-unit aggregates.
 *
 * @param {string|null} paxDeiSlug
 * @param {string|null} itemName
 * @param {boolean} isMastercrafted
 * @param {number} enchantmentTier
 * @returns {Array}
 */
export function getZoneListingsForItemByQuality(paxDeiSlug, itemName, isMastercrafted, enchantmentTier) {
    if (!_currentZoneListings.length) return [];

    const bareId = paxDeiSlug
        ? toBareId(paxDeiSlug)
        : (_currentNameMap && itemName ? _currentNameMap[itemName.toLowerCase().trim()] : null);

    if (!bareId) return [];

    const expectedMc = isMastercrafted ? 1 : 0;
    const expectedEnc = enchantmentTier || 0;

    return _currentZoneListings.filter(listing =>
        listing.item_id === bareId &&
        (listing.mastercraft ? 1 : 0) === expectedMc &&
        (listing.enchantment_level || 0) === expectedEnc
    );
}

/**
 * Returns name and URL for a given item_id from the items.json dictionary.
 *
 * @param {string} itemId - e.g. "wearable_leather_hands_pilgrim_0_t4_common"
 * @returns {{ name: string, url: string }|null}
 */
export function getItemData(itemId) {
    if (!_itemsData || !itemId) return null;
    return _itemsData[toBareId(itemId)] || null;
}

/**
 * Returns the current price map (or null).
 */
export function getCurrentPriceMap() {
    return _currentPriceMap;
}

// ── Zone summary ────────────────────────────────────────────────────────────

/**
 * Builds a human-readable summary of the zone's market activity.
 *
 * @param {Array} zoneListings
 * @returns {{ totalListings: number, uniqueSellers: number, uniqueItems: number, topItemSlug: string|null, topItemCount: number }}
 */
export function buildZoneSummary(zoneListings) {
    if (!zoneListings || zoneListings.length === 0) {
        return { totalListings: 0, uniqueSellers: 0, uniqueItems: 0, topItemSlug: null, topItemCount: 0 };
    }
    const totalListings = zoneListings.length;
    const uniqueSellers = new Set(zoneListings.map(l => l.avatar_hash)).size;
    const uniqueItems = new Set(zoneListings.map(l => l.item_id)).size;

    const itemCounts = {};
    for (const l of zoneListings) {
        itemCounts[l.item_id] = (itemCounts[l.item_id] || 0) + 1;
    }
    const sorted = Object.entries(itemCounts).sort((a, b) => b[1] - a[1]);
    const topItemSlug = sorted[0]?.[0] || null;
    const topItemCount = sorted[0]?.[1] || 0;

    return { totalListings, uniqueSellers, uniqueItems, topItemSlug, topItemCount };
}

// ── Avatar ID hashing ───────────────────────────────────────────────────────

let _xxhashInstance = null;

async function getXxHash() {
    if (_xxhashInstance) return _xxhashInstance;
    try {
        const mod = await import('https://cdn.jsdelivr.net/npm/xxhash-wasm@1.1.0/esm/xxhash-wasm.js');
        const init = mod.default ?? mod;
        _xxhashInstance = await init();
    } catch (e) {
        console.warn('[GamingTools] xxhash-wasm failed to load:', e);
        _xxhashInstance = null;
    }
    return _xxhashInstance;
}

/**
 * Computes the xxHash64 of an Avatar ID string (the same algorithm gaming.tools uses).
 * Runs entirely client-side. The raw Avatar ID is never stored or transmitted.
 *
 * @param {string} avatarId - UUID string from PaxDei.log
 * @returns {Promise<string|null>} 16-char lowercase hex string, or null on failure
 */
export async function hashAvatarId(avatarId) {
    if (!avatarId?.trim()) return null;
    const hasher = await getXxHash();
    if (!hasher) return null;
    try {
        const hash = hasher.h64(avatarId.trim());
        return hash.toString(16).padStart(16, '0');
    } catch (e) {
        console.warn('[GamingTools] Hashing failed:', e);
        return null;
    }
}

// ── Own listing identification ──────────────────────────────────────────────

/**
 * Returns listings from the current zone data that match the given avatar hash.
 *
 * @param {string} avatarHash - 16-char hex from hashAvatarId()
 * @returns {Array} matching listing objects
 */
export function findOwnListings(avatarHash) {
    if (!avatarHash || !_currentZoneListings.length) return [];
    return _currentZoneListings.filter(l => l.avatar_hash === avatarHash);
}

/**
 * Returns a summary of the player's own external listings.
 *
 * @param {Array} ownListings - from findOwnListings()
 * @returns {{ totalCount: number, totalValue: number, uniqueItems: number }}
 */
export function summarizeOwnListings(ownListings) {
    const totalCount = ownListings.length;
    const totalValue = ownListings.reduce((sum, l) => sum + (l.price * (l.quantity || 1)), 0);
    const uniqueItems = new Set(ownListings.map(l => l.item_id)).size;
    return { totalCount, totalValue, uniqueItems };
}

/**
 * Patches the in-memory zone listings to immediately reflect a price change the
 * player just saved in Archives — so the valley presence modal updates instantly
 * rather than waiting for gaming.tools' next hourly sync.
 *
 * @param {string} avatarHash     - 16-char hex hash of the player's Avatar ID
 * @param {string} itemId         - gaming.tools item_id (bare or path-prefixed)
 * @param {number} newPricePerUnit - new per-unit price in gold
 */
export function updateOwnListingPrices(avatarHash, itemId, newPricePerUnit) {
    if (!avatarHash || !itemId || !_currentZoneListings.length) return;
    const bareId = toBareId(itemId);
    for (const listing of _currentZoneListings) {
        if (listing.avatar_hash === avatarHash && listing.item_id === bareId) {
            // price in gaming.tools is total stack price; quantity is items per stack
            listing.price = newPricePerUnit * Math.max(listing.quantity || 1, 1);
        }
    }
}

/**
 * Analyses the player's own listings against the rest of the valley.
 * For each item the player has listed, determines whether they are leading
 * (lowest price) or being undercut (someone else is cheaper).
 *
 * @param {string} avatarHash - 16-char hex from getSavedAvatarHash()
 * @returns {{
 *   leading:  Array<{ itemId, itemName, yourLow, marketLow, yourCount, totalCount }>,
 *   undercut: Array<{ itemId, itemName, yourLow, marketLow, gap, gapPct, yourCount, totalCount }>,
 *   valleySharePct: number,
 *   totalOwnListings: number,
 *   totalValleyListings: number
 * }|null}  null if no zone data or no own listings
 */
export function analyzeOwnListings(avatarHash) {
    if (!avatarHash || !_currentZoneListings.length) return null;

    const ownAll = _currentZoneListings.filter(l => l.avatar_hash === avatarHash);
    if (!ownAll.length) return null;

    const totalValleyListings = _currentZoneListings.length;
    const totalOwnListings = ownAll.length;
    const valleySharePct = Math.round((totalOwnListings / totalValleyListings) * 100);

    // Group own listings by item_id
    const ownByItem = {};
    for (const l of ownAll) {
        if (!ownByItem[l.item_id]) ownByItem[l.item_id] = [];
        ownByItem[l.item_id].push(l.price / Math.max(l.quantity || 1, 1));
    }

    // Group all valley listings by item_id for market low
    const valleyByItem = {};
    for (const l of _currentZoneListings) {
        if (!valleyByItem[l.item_id]) valleyByItem[l.item_id] = [];
        valleyByItem[l.item_id].push(l.price / Math.max(l.quantity || 1, 1));
    }

    const leading = [];
    const undercut = [];

    for (const [itemId, ownPrices] of Object.entries(ownByItem)) {
        const allPrices = valleyByItem[itemId] || [];
        const yourLow   = Math.min(...ownPrices);
        const marketLow = Math.min(...allPrices);
        const yourCount = ownPrices.length;
        const totalCount = allPrices.length;
        const itemName = _itemsData?.[itemId]?.name || itemId.replace(/_/g, ' ');

        // Leading if your lowest price equals (or beats) the market low
        if (yourLow <= marketLow + 0.001) {
            leading.push({ itemId, itemName, yourLow, marketLow, yourCount, totalCount });
        } else {
            const gap    = yourLow - marketLow;
            const gapPct = Math.round((gap / marketLow) * 100);
            undercut.push({ itemId, itemName, yourLow, marketLow, gap, gapPct, yourCount, totalCount });
        }
    }

    // Sort undercut by gap descending (worst first)
    undercut.sort((a, b) => b.gap - a.gap);
    // Sort leading alphabetically
    leading.sort((a, b) => a.itemName.localeCompare(b.itemName));

    return { leading, undercut, valleySharePct, totalOwnListings, totalValleyListings };
}

// ── Avatar hash persistence (session only — never stores the raw ID) ─────────

export function getSavedAvatarHash() {
    const activeCharacterId = sessionStorage.getItem('active_character_id');
    if (activeCharacterId) {
        return localStorage.getItem(`${LEGACY_AVATAR_HASH_KEY}_${activeCharacterId}`) || null;
    }
    return localStorage.getItem(LEGACY_AVATAR_HASH_KEY) || null;
}

export function saveAvatarHash(hash) {
    const activeCharacterId = sessionStorage.getItem('active_character_id');
    if (hash) {
        if (activeCharacterId) {
            localStorage.setItem(`${LEGACY_AVATAR_HASH_KEY}_${activeCharacterId}`, hash);
        }
        localStorage.setItem(LEGACY_AVATAR_HASH_KEY, hash);
    } else {
        if (activeCharacterId) {
            localStorage.removeItem(`${LEGACY_AVATAR_HASH_KEY}_${activeCharacterId}`);
        }
        localStorage.removeItem(LEGACY_AVATAR_HASH_KEY);
    }
}

export function clearAvatarHash() {
    const activeCharacterId = sessionStorage.getItem('active_character_id');
    if (activeCharacterId) {
        localStorage.removeItem(`${LEGACY_AVATAR_HASH_KEY}_${activeCharacterId}`);
    }
    localStorage.removeItem(LEGACY_AVATAR_HASH_KEY);
}
