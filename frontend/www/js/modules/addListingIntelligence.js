import { getCompetitiveThresholds } from './pricingBands.js';
import { fetchZoneListings, loadItemsData } from '../services/gamingToolsService.js';

export async function fetchItemSalesHistoryForListing({ supabase, currentCharacterId, itemId }) {
    try {
        const { data, error } = await supabase
            .from('sales')
            .select('quantity_sold, sale_price_per_unit, total_sale_price, sale_date, market_listings!inner(item_id, is_mastercrafted, enchantment_tier)')
            .eq('market_listings.item_id', itemId)
            .eq('character_id', currentCharacterId)
            .order('sale_date', { ascending: false })
            .limit(100);

        if (error || !data || data.length === 0) return null;

        const totalUnits  = data.reduce((s, r) => s + (r.quantity_sold || 0), 0);
        const avgPerUnit  = data.reduce((s, r) => s + (r.sale_price_per_unit || 0), 0) / data.length;
        const avgPerStack = data.reduce((s, r) => s + (r.total_sale_price || 0), 0) / data.length;
        const maxPerUnit  = Math.max(...data.map(r => r.sale_price_per_unit || 0));
        const lastSold    = data[0].sale_date;
        const saleCount   = data.length;

        const grouped = {};
        for (const row of data) {
            const ml  = row.market_listings;
            const mc  = ml?.is_mastercrafted ? 1 : 0;
            const enc = ml?.enchantment_tier  || 0;
            const key = `mc${mc}enc${enc}`;
            if (!grouped[key]) grouped[key] = { rows: [], lastSold: null };
            grouped[key].rows.push(row);
            if (!grouped[key].lastSold || row.sale_date > grouped[key].lastSold) {
                grouped[key].lastSold = row.sale_date;
            }
        }

        const byQuality = {};
        for (const [key, group] of Object.entries(grouped)) {
            const rows = group.rows;
            byQuality[key] = {
                avgPerUnit:  rows.reduce((s, r) => s + (r.sale_price_per_unit || 0), 0) / rows.length,
                avgPerStack: rows.reduce((s, r) => s + (r.total_sale_price || 0), 0) / rows.length,
                maxPerUnit:  Math.max(...rows.map(r => r.sale_price_per_unit || 0)),
                saleCount:   rows.length,
                lastSold:    group.lastSold
            };
        }

        return { avgPerUnit, avgPerStack, maxPerUnit, totalUnits, saleCount, lastSold, byQuality };
    } catch {
        return null;
    }
}

export async function fetchActiveListingsForListing({ supabase, currentCharacterId, itemId }) {
    try {
        const { data, error } = await supabase
            .from('market_listings')
            .select('listing_id, quantity_listed, total_listed_price, listed_price_per_unit, listing_date, is_mastercrafted, enchantment_tier, market_stall_id')
            .eq('item_id', itemId)
            .eq('character_id', currentCharacterId)
            .eq('is_cancelled', false)
            .eq('is_fully_sold', false)
            .order('listed_price_per_unit', { ascending: true })
            .limit(100);

        if (error || !data) return [];
        return data;
    } catch {
        return [];
    }
}

function normalizeEnchantTier(value) {
    const parsed = parseInt(value || '0', 10);
    return Number.isFinite(parsed) ? parsed : 0;
}

function getQualityMultiplier(isMastercrafted, enchantmentTier) {
    const ENCHANT_PREMIUMS = [0, 0.10, 0.20, 0.30];
    const mcPremium   = isMastercrafted ? 0.15 : 0;
    const encPremium  = ENCHANT_PREMIUMS[enchantmentTier || 0] || 0;
    return (1 + mcPremium) * (1 + encPremium);
}

function getEstimatedQualityMarketData(md, qualityMult) {
    if (!md) return null;

    return {
        marketLow:     parseFloat((md.marketLow  * qualityMult).toFixed(2)),
        marketAvg:     parseFloat((md.marketAvg  * qualityMult).toFixed(2)),
        totalListings: null,
        isEstimated:   true
    };
}

export function buildAddListingSuggestion(md, qualityMd, hist, count, stacks, isMastercrafted, enchantmentTier, ownCount = 0) {
    const qualityMult = getQualityMultiplier(isMastercrafted, enchantmentTier);
    const isQuality   = isMastercrafted || ((enchantmentTier || 0) > 0);

    const effectiveMd = qualityMd || (isQuality ? getEstimatedQualityMarketData(md, qualityMult) : md);

    const qHistKey    = `mc${isMastercrafted ? 1 : 0}enc${enchantmentTier || 0}`;
    const qualityHist = hist?.byQuality?.[qHistKey] || null;
    const effectiveHist = qualityHist || (hist && isQuality ? {
        avgPerUnit:  parseFloat((hist.avgPerUnit  * qualityMult).toFixed(2)),
        avgPerStack: parseFloat((hist.avgPerStack * qualityMult).toFixed(2)),
        maxPerUnit:  parseFloat((hist.maxPerUnit  * qualityMult).toFixed(2)),
        saleCount:   hist.saleCount,
        lastSold:    hist.lastSold,
        isEstimated: true
    } : hist);

    const hasMarket = !!effectiveMd;
    const hasHist   = !!effectiveHist;
    const hasCount  = count > 0;
    const hasStacks = stacks > 0;
    const lowSupply = hasMarket && effectiveMd.totalListings !== null && effectiveMd.totalListings <= 3;
    const hasExternalCompetition = hasMarket && effectiveMd.totalListings !== null && effectiveMd.totalListings > ownCount;

    if (!hasMarket && !hasHist) return null;

    let suggestedPerStack = null;
    let insight      = '';
    let insightClass = 'text-gray-400';

    let qualityNote = null;
    if (isQuality) {
        if (qualityMd && qualityHist) {
            qualityNote = { type: 'exact', text: 'Using quality-specific market and sales data.' };
        } else if (qualityMd) {
            qualityNote = { type: 'partial', text: 'Quality-specific market data found; sales history is blended across all quality.' };
        } else if (qualityHist) {
            qualityNote = { type: 'partial', text: 'Quality-specific sales history found; market data is estimated.' };
        } else {
            const parts = [];
            if (isMastercrafted) parts.push('Mastercrafted +15%');
            if ((enchantmentTier || 0) > 0) {
                const labels = ['', 'I', 'II', 'III'];
                parts.push(`Enchant ${labels[enchantmentTier]} +${[0,10,20,30][enchantmentTier]}%`);
            }
            qualityNote = { type: 'estimated', text: `No quality-specific data found - estimated from base prices (${parts.join(', ')}).` };
        }
    }

    if (hasMarket && hasHist && hasCount) {
        const marketFloor = Math.round(effectiveMd.marketLow * count);
        const ratio       = effectiveMd.marketLow / effectiveHist.avgPerUnit;

        if (lowSupply) {
            const histBased   = Math.round(effectiveHist.avgPerUnit * count * 1.05);
            suggestedPerStack = Math.max(histBased, marketFloor);
            insight           = `Only ${effectiveMd.totalListings} listing${effectiveMd.totalListings !== 1 ? 's' : ''} in your zone - low competition, you have pricing power.`;
            insightClass      = 'text-emerald-400';
        } else if (ratio < 0.75) {
            suggestedPerStack = marketFloor;
            insight           = 'Market has dropped well below your historical avg - competitive pricing recommended.';
            insightClass      = 'text-rose-400';
        } else if (ratio < 0.95) {
            suggestedPerStack = marketFloor;
            insight           = 'Market is slightly below your avg - pricing near market low will move faster.';
            insightClass      = 'text-amber-400';
        } else if (ratio <= 1.1) {
            suggestedPerStack = Math.max(Math.round(effectiveHist.avgPerUnit * count), marketFloor);
            insight           = 'Market aligns with your historical avg - your usual price looks good.';
            insightClass      = 'text-emerald-400';
        } else {
            suggestedPerStack = Math.round(effectiveMd.marketLow * count * 1.05);
            insight           = 'Market low is above your historical avg - priced 5% above market floor.';
            insightClass      = 'text-emerald-400';
        }
    } else if (hasMarket && hasCount) {
        const marketFloor = Math.round(effectiveMd.marketLow * count);
        if (lowSupply) {
            suggestedPerStack = Math.round(effectiveMd.marketLow * count * 1.1);
            insight           = `Only ${effectiveMd.totalListings} listing${effectiveMd.totalListings !== 1 ? 's' : ''} - no competition, priced 10% above market low.`;
            insightClass      = 'text-emerald-400';
        } else if (hasExternalCompetition) {
            suggestedPerStack = marketFloor;
            insight           = 'No sales history yet - matching the current floor is the safest baseline.';
            insightClass      = 'text-amber-400';
        } else {
            suggestedPerStack = marketFloor;
            insight           = 'No sales history yet - market low used as baseline because the current live listings appear to be yours.';
            insightClass      = 'text-gray-400';
        }
    } else if (hasHist && hasCount) {
        const bestHistPerUnit = Math.max(effectiveHist.maxPerUnit || 0, effectiveHist.avgPerUnit || 0);
        suggestedPerStack = Math.round(bestHistPerUnit * count);
        insight           = 'No live market listings - anchoring to your best historical sale is the safest baseline.';
        insightClass      = 'text-emerald-400';
    }

    const totalRevenue = (suggestedPerStack !== null && hasStacks) ? suggestedPerStack * stacks : null;

    let impactNote = null;
    if (hasMarket && hasStacks && effectiveMd.totalListings !== null && effectiveMd.totalListings > 0) {
        const pct = Math.round((stacks / effectiveMd.totalListings) * 100);
        if (stacks >= effectiveMd.totalListings) {
            impactNote = { text: `You'd be adding ${stacks} stacks to ${effectiveMd.totalListings} existing - this doubles+ the supply in your zone.`, cls: 'text-amber-400', bubble: 'bg-amber-400' };
        } else if (pct >= 50) {
            impactNote = { text: `You'd be adding ${stacks} stacks to ${effectiveMd.totalListings} existing (~${pct}% of current supply).`, cls: 'text-amber-400', bubble: 'bg-amber-400' };
        } else if (pct >= 20) {
            impactNote = { text: `Adding ${stacks} stacks alongside ${effectiveMd.totalListings} existing (~${pct}% of supply).`, cls: 'text-gray-300', bubble: 'bg-gray-400' };
        }
    }

    return { suggestedPerStack, totalRevenue, insight, insightClass, impactNote, qualityNote };
}

function getUndercutStep(stackPrice) {
    if (stackPrice >= 250) return 5;
    if (stackPrice >= 100) return 3;
    if (stackPrice >= 25) return 2;
    return 1;
}

function getMarketLowRecommendation(stackMarketLow, ownCount, totalListings, ownListingAtFloor = false) {
    const roundedLow = Math.round(stackMarketLow);
    const hasExternalCompetition = Number.isFinite(totalListings) && totalListings > ownCount && !ownListingAtFloor;

    if (!hasExternalCompetition) {
        return {
            value: roundedLow,
            description: 'Hold the current floor.',
            subtext: 'No outside listing to undercut right now.'
        };
    }

    const undercutStep = getUndercutStep(roundedLow);
    const value = Math.max(1, roundedLow - undercutStep);
    return {
        value,
        description: 'Slip just under the current floor.',
        subtext: `${undercutStep}g below the live market low of ${roundedLow}g.`
    };
}

function getMatchExistingRecommendation(activeListings, count) {
    if (!Array.isArray(activeListings) || !activeListings.length || !(count > 0)) return null;

    const sameStackListings = activeListings.filter((listing) => Number(listing.quantity_listed) === count);
    if (sameStackListings.length) {
        const lowestSameStack = sameStackListings.reduce((best, listing) => {
            const price = Number(listing.total_listed_price) || 0;
            if (!best || price < (Number(best.total_listed_price) || 0)) return listing;
            return best;
        }, null);
        const value = Math.round(Number(lowestSameStack?.total_listed_price) || 0);
        if (value > 0) {
            return {
                value,
                description: `Match your lowest active ${count}-count stack.`,
                subtext: `${sameStackListings.length} active matching stack${sameStackListings.length !== 1 ? 's' : ''} already listed.`
            };
        }
    }

    const lowestUnitListing = activeListings.reduce((best, listing) => {
        const unitPrice = Number(listing.listed_price_per_unit) || 0;
        if (!best || unitPrice < (Number(best.listed_price_per_unit) || 0)) return listing;
        return best;
    }, null);
    const unitPrice = Number(lowestUnitListing?.listed_price_per_unit) || 0;
    if (!(unitPrice > 0)) return null;

    const sourceQuantity = Number(lowestUnitListing.quantity_listed) || 1;
    const sourceStackPrice = Math.round(Number(lowestUnitListing.total_listed_price) || unitPrice * sourceQuantity);
    return {
        value: Math.max(1, Math.round(unitPrice * count)),
        description: 'Match your active per-unit floor.',
        subtext: `Based on your ${sourceQuantity}-count stack at ${sourceStackPrice}g.`
    };
}

function getCompetitivePriceRecommendation({ stackMarketLow, stackMarketAvg, suggestionValue, hasHistory }) {
    const roundedLow = Math.round(stackMarketLow);
    const thresholds = getCompetitiveThresholds(roundedLow);
    const bandCap = roundedLow + thresholds.maxGapGold;

    return {
        value: bandCap,
        description: hasHistory
            ? 'Top end of the competitive band.'
            : 'Highest price inside the competitive band.',
        subtext: `${thresholds.label} band: +${thresholds.maxGapGold}g / +${thresholds.maxGapPct}%`
    };
}

function getHistoryOnlyPriceRecommendations(hist, count) {
    if (!hist || !(count > 0)) return null;

    const historyAvgPerStack = Number.isFinite(hist.avgPerUnit)
        ? Math.round(hist.avgPerUnit * count)
        : null;
    const bestHistoryPerUnit = Math.max(hist.maxPerUnit || 0, hist.avgPerUnit || 0);
    const suggestedPerStack = bestHistoryPerUnit > 0
        ? Math.round(bestHistoryPerUnit * count)
        : null;
    const marketLowPerStack = suggestedPerStack !== null
        ? Math.max(1, suggestedPerStack - getUndercutStep(suggestedPerStack))
        : historyAvgPerStack;
    const higherAskPerStack = suggestedPerStack !== null
        ? Math.max(suggestedPerStack + getUndercutStep(suggestedPerStack), Math.round(suggestedPerStack * 1.1))
        : null;

    return {
        marketLowPerStack,
        historyAvgPerStack,
        suggestedPerStack,
        higherAskPerStack
    };
}

function isOwnListingAtMarketLow(ownListings, marketLowPerUnit) {
    if (!Array.isArray(ownListings) || !ownListings.length || !Number.isFinite(marketLowPerUnit)) return false;

    return ownListings.some((listing) => {
        const quantity = listing.quantity || 1;
        const ownPerUnit = listing.price / quantity;
        return Math.abs(ownPerUnit - marketLowPerUnit) < 0.0001;
    });
}

function getPriceOptionTheme(type) {
    if (type === 'match-existing') {
        return {
            card: 'border-emerald-500/45 bg-emerald-950/28 shadow-[inset_0_1px_0_rgba(52,211,153,0.14)]',
            badge: 'border-emerald-400/50 bg-emerald-500/20 text-emerald-200',
            price: 'text-emerald-300',
            button: 'bg-emerald-500/20 hover:bg-emerald-500/35 text-emerald-200 border-emerald-400/45',
            meta: 'text-emerald-200'
        };
    }

    if (type === 'market-low') {
        return {
            card: 'border-orange-500/45 bg-orange-950/30 shadow-[inset_0_1px_0_rgba(251,146,60,0.14)]',
            badge: 'border-orange-400/50 bg-orange-500/20 text-orange-200',
            price: 'text-orange-300',
            button: 'bg-orange-500/20 hover:bg-orange-500/35 text-orange-200 border-orange-400/45',
            meta: 'text-orange-200'
        };
    }

    if (type === 'competitive') {
        return {
            card: 'border-cyan-500/45 bg-cyan-950/28 shadow-[inset_0_1px_0_rgba(34,211,238,0.14)]',
            badge: 'border-cyan-400/50 bg-cyan-500/20 text-cyan-200',
            price: 'text-cyan-300',
            button: 'bg-cyan-500/20 hover:bg-cyan-500/35 text-cyan-200 border-cyan-400/45',
            meta: 'text-cyan-200'
        };
    }

    return {
        card: 'border-fuchsia-500/45 bg-fuchsia-950/28 shadow-[inset_0_1px_0_rgba(217,70,239,0.14)]',
        badge: 'border-fuchsia-400/50 bg-fuchsia-500/20 text-fuchsia-200',
        price: 'text-fuchsia-300',
        button: 'bg-fuchsia-500/20 hover:bg-fuchsia-500/35 text-fuchsia-200 border-fuchsia-400/45',
        meta: 'text-fuchsia-200'
    };
}

function renderSuggestedPriceOptionRow(option, stacks, fmt, scopeLabel) {
    const theme = getPriceOptionTheme(option.type);
    const total = stacks > 0 ? option.value * stacks : null;

    return `
        <div class="grid h-[110px] grid-cols-[minmax(0,1fr)_88px_54px] items-center gap-2 rounded-lg border px-3 py-2.5 ${theme.card}">
            <div class="min-w-0">
                <div class="flex items-center gap-2 min-w-0">
                    <span class="text-white text-sm font-semibold leading-tight">${option.label}</span>
                    <span class="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${theme.badge}">${option.badge}</span>
                </div>
                <div class="text-gray-300 text-sm leading-5 mt-1 overflow-hidden" style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">${option.description}</div>
                <!-- Hidden for now: detailed price rationale felt too noisy in the compact modal layout.
                <div class="flex flex-wrap gap-x-2 gap-y-0.5 text-xs mt-1">
                    ${option.subtext ? `<span class="text-gray-400 leading-5">${option.subtext}</span>` : ''}
                    ${total !== null ? `<span class="${theme.meta} font-semibold">${stacks}x ${fmt(total)}g total</span>` : ''}
                </div>
                -->
            </div>
            <div class="text-right">
                <div class="${theme.price} font-bold text-2xl leading-none">${fmt(option.value)}g</div>
                <div class="text-gray-400 text-xs mt-0.5">per stack</div>
            </div>
            <button type="button" data-suggested-price="${option.value}"
                class="justify-self-end px-2 py-1 text-xs font-semibold border rounded-lg transition-colors ${theme.button}">
                Use
            </button>
        </div>`;
}

function getRelativeTime(isoDate) {
    const diff = Date.now() - new Date(isoDate).getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return 'today';
    if (days === 1) return 'yesterday';
    if (days < 30) return `${days}d ago`;
    const months = Math.floor(days / 30);
    return months === 1 ? '1 month ago' : `${months} months ago`;
}

const provinceMarketCache = new Map();

function toBareItemId(slug) {
    if (!slug) return null;
    const slash = slug.lastIndexOf('/');
    return slash !== -1 ? slug.slice(slash + 1) : slug;
}

function namesMatch(a, b) {
    return !!a && !!b && a.toLowerCase().trim() === b.toLowerCase().trim();
}

function findItemIdInItemsData(itemsData, itemName) {
    if (!itemsData || !itemName) return null;
    const normalized = itemName.toLowerCase().trim();
    for (const [itemId, item] of Object.entries(itemsData)) {
        if (namesMatch(item?.name, normalized)) return itemId;
    }
    return null;
}

async function resolveSelectedGamingToolsItemId(selectedItem, getItemNameForSlug, getItemIdByName) {
    const itemsData = await loadItemsData();

    if (selectedItem?.pax_dei_slug) {
        const bareSlug = toBareItemId(selectedItem.pax_dei_slug);
        const slugName = getItemNameForSlug(selectedItem.pax_dei_slug) || itemsData?.[bareSlug]?.name;
        if (!slugName || namesMatch(slugName, selectedItem.item_name)) {
            return bareSlug;
        }
    }

    return getItemIdByName(selectedItem?.item_name)
        || findItemIdInItemsData(itemsData, selectedItem?.item_name);
}

async function fetchProvinceValleys({ supabase, character }) {
    const province = character?.province;
    const shard = character?.shard;
    if (!supabase || !province || !shard) return [];

    const { data, error } = await supabase
        .from('regions')
        .select('home_valley')
        .eq('shard', shard)
        .eq('province', province)
        .order('home_valley', { ascending: true });

    if (error) {
        console.warn('[Trader] Province valley lookup failed:', error.message);
    }

    const valleys = (data || [])
        .map(row => row.home_valley)
        .filter(Boolean);

    if (character.home_valley && !valleys.includes(character.home_valley)) {
        valleys.push(character.home_valley);
    }

    return [...new Set(valleys)];
}

async function fetchProvinceMarketContext({
    supabase,
    currentCharacterId,
    getCurrentCharacter,
    selectedItem,
    getItemNameForSlug,
    getItemIdByName
}) {
    if (!currentCharacterId || !selectedItem) return null;

    const character = getCurrentCharacter
        ? await getCurrentCharacter(true)
        : null;

    if (!character?.shard || !character?.province) return null;

    const itemId = await resolveSelectedGamingToolsItemId(selectedItem, getItemNameForSlug, getItemIdByName);
    if (!itemId) return null;

    const cacheKey = `${character.shard}::${character.province}`;
    const cached = provinceMarketCache.get(cacheKey);
    const now = Date.now();
    let provinceData = cached && now - cached.ts < 45 * 60 * 1000 ? cached : null;

    if (!provinceData) {
        const valleys = await fetchProvinceValleys({ supabase, character });
        const results = await Promise.allSettled(
            valleys.map(async (valley) => {
                const listings = await fetchZoneListings(character.shard, character.province, valley);
                return {
                    valley,
                    listings: (listings || []).map(listing => ({
                        ...listing,
                        _homeValley: valley
                    }))
                };
            })
        );

        const loadedValleys = [];
        const listings = [];
        for (const result of results) {
            if (result.status !== 'fulfilled') continue;
            loadedValleys.push(result.value.valley);
            listings.push(...result.value.listings);
        }

        provinceData = {
            ts: now,
            province: character.province,
            homeValley: character.home_valley || null,
            valleys,
            loadedValleys,
            listings
        };
        provinceMarketCache.set(cacheKey, provinceData);
    }

    return {
        ...provinceData,
        itemId
    };
}

function buildMarketDataFromListings(listings, itemId, isMastercrafted = null, enchantmentTier = null) {
    if (!Array.isArray(listings) || !itemId) return null;
    const prices = [];
    const valleys = new Set();

    for (const listing of listings) {
        if (listing.item_id !== itemId) continue;
        if (isMastercrafted !== null && (listing.mastercraft ? 1 : 0) !== (isMastercrafted ? 1 : 0)) continue;
        if (enchantmentTier !== null && (listing.enchantment_level || 0) !== (enchantmentTier || 0)) continue;

        const quantity = Math.max(Number(listing.quantity) || 1, 1);
        const price = Number(listing.price);
        if (!(price > 0)) continue;
        prices.push(price / quantity);
        if (listing._homeValley) valleys.add(listing._homeValley);
    }

    if (!prices.length) return null;
    const sorted = prices.slice().sort((a, b) => a - b);
    const sum = sorted.reduce((total, price) => total + price, 0);
    return {
        marketLow: sorted[0],
        marketAvg: parseFloat((sum / sorted.length).toFixed(2)),
        totalListings: sorted.length,
        valleyCount: valleys.size
    };
}

export function createAddListingIntelligenceController({
    supabase,
    getCurrentCharacterId,
    getCurrentCharacter,
    getSavedAvatarHash,
    getMarketDataForSlug,
    getMarketDataByItemName,
    getMarketDataForSlugByQuality,
    getMarketDataByItemNameAndQuality,
    getItemNameForSlug,
    getOwnListingCountForSlug,
    getItemIdByName
}) {
    const state = {
        marketData: null,
        ownCount: 0,
        ownListings: [],
        activeListings: [],
        activeListingsLoading: false,
        provinceContext: null,
        provinceLoading: false,
        historyData: null,
        historyLoading: false,
        selectedItem: null,
        historyRequestId: 0
    };

    function renderHint() {
        const hintEl = document.getElementById('modal-market-price-hint');
        const placeholder = document.getElementById('modal-market-hint-placeholder');
        if (!hintEl) return;

        const md = state.marketData;
        const hist = state.historyData;
        const loading = state.historyLoading;
        const activeLoading = state.activeListingsLoading;
        const provinceLoading = state.provinceLoading;
        const provinceContext = state.provinceContext;
        const hasActiveListings = Array.isArray(state.activeListings) && state.activeListings.length > 0;

        if (!md && !hist && !loading && !activeLoading && !provinceLoading && !provinceContext && !hasActiveListings) {
            if (!state.selectedItem) {
                hintEl.innerHTML = '';
                hintEl.classList.add('hidden');
                if (placeholder) placeholder.classList.remove('hidden');
            } else {
                if (placeholder) placeholder.classList.add('hidden');
                hintEl.innerHTML = `<div class="flex items-center gap-2 p-2">
                    <i class="fas fa-info-circle text-gray-500 text-sm"></i>
                    <span class="text-gray-400 text-sm italic">No market or sales data found for this item yet.</span>
                </div>`;
                hintEl.classList.remove('hidden');
            }
            return;
        }
        if (placeholder) placeholder.classList.add('hidden');

        const isMastercrafted = document.getElementById('modal-is-mastercrafted')?.value === 'true';
        const enchantmentTier = parseInt(document.getElementById('modal-enchantment-tier')?.value || '0', 10) || 0;
        const isQuality = isMastercrafted || enchantmentTier > 0;

        let qualityMd = null;
        if (isQuality && state.selectedItem) {
            if (state.selectedItem.pax_dei_slug) {
                const slugName = getItemNameForSlug(state.selectedItem.pax_dei_slug);
                const slugValid = slugName && slugName.toLowerCase().trim() === state.selectedItem.item_name.toLowerCase().trim();
                if (slugValid) qualityMd = getMarketDataForSlugByQuality(state.selectedItem.pax_dei_slug, isMastercrafted, enchantmentTier);
            }
            if (!qualityMd) qualityMd = getMarketDataByItemNameAndQuality(state.selectedItem.item_name, isMastercrafted, enchantmentTier);
        }

        const count = parseInt(document.getElementById('modal-item-count-per-stack')?.value, 10);
        const stacks = parseInt(document.getElementById('modal-item-stacks')?.value, 10);
        const price = parseFloat(document.getElementById('modal-item-price-per-stack')?.value);
        const hasCount = count > 0;
        const hasStacks = stacks > 0;
        const hasPrice = price > 0;
        const fmt = (v) => v.toLocaleString(undefined, { maximumFractionDigits: 2 });

        const qualityMult = getQualityMultiplier(isMastercrafted, enchantmentTier);
        const displayMd = qualityMd || (isQuality ? getEstimatedQualityMarketData(md, qualityMult) : md);
        const provinceAllQualityMd = provinceContext
            ? buildMarketDataFromListings(provinceContext.listings, provinceContext.itemId)
            : null;
        const provinceQualityMd = provinceContext
            ? buildMarketDataFromListings(provinceContext.listings, provinceContext.itemId, isMastercrafted, enchantmentTier)
            : null;
        const provinceEstimatedMd = isQuality && provinceAllQualityMd
            ? {
                ...getEstimatedQualityMarketData(provinceAllQualityMd, qualityMult),
                totalListings: provinceAllQualityMd.totalListings,
                valleyCount: provinceAllQualityMd.valleyCount
            }
            : null;
        const provinceDisplayMd = provinceQualityMd || provinceEstimatedMd || provinceAllQualityMd;
        const supplyCount = displayMd?.totalListings;
        const supplyTag = displayMd && supplyCount !== null && supplyCount !== undefined
            ? supplyCount <= 3
                ? `<span class="ml-1 text-xs font-semibold text-emerald-300 bg-emerald-900/50 border border-emerald-500/40 rounded px-1.5 py-0.5">Low supply</span>`
                : supplyCount > 20
                    ? `<span class="ml-1 text-xs font-semibold text-rose-300 bg-rose-900/50 border border-rose-500/40 rounded px-1.5 py-0.5">High supply</span>`
                    : ''
            : '';
        const qBadge = isQuality && qualityMd
            ? `<span class="ml-1 text-xs font-semibold text-purple-300 bg-purple-900/40 border border-purple-500/40 rounded px-1.5 py-0.5">Quality match</span>`
            : isQuality && md
                ? `<span class="ml-1 text-xs font-semibold text-amber-300 bg-amber-900/30 border border-amber-500/30 rounded px-1.5 py-0.5">Est. x quality</span>`
                : '';
        const activeListingsForQuality = (state.activeListings || []).filter((listing) => {
            return !!listing.is_mastercrafted === isMastercrafted
                && normalizeEnchantTier(listing.enchantment_tier) === enchantmentTier;
        });

        let marketCol;
        if (displayMd) {
            marketCol = `
            <div class="flex-1 min-w-0">
                <div class="flex items-center gap-1 mb-2 flex-wrap">
                    <i class="fas fa-globe text-blue-400 text-sm"></i>
                    <span class="text-blue-300 text-sm font-semibold uppercase tracking-wide">Live Market</span>
                    ${supplyTag}${qBadge}
                </div>
                <div class="space-y-1">
                    <div class="flex justify-between gap-2">
                        <span class="text-gray-300 text-sm">Low/unit</span>
                        <span class="text-amber-400 font-bold text-sm">${fmt(displayMd.marketLow)}g</span>
                    </div>
                    <div class="flex justify-between gap-2">
                        <span class="text-gray-300 text-sm">Avg/unit</span>
                        <span class="text-white text-sm">${fmt(displayMd.marketAvg)}g</span>
                    </div>
                    ${hasCount ? `
                    <div class="border-t border-slate-500/40 pt-1 mt-1">
                        <div class="flex justify-between gap-2">
                            <span class="text-gray-300 text-sm">Low/stack <span class="text-gray-500 text-xs">(${count})</span></span>
                            <span class="text-amber-400 font-bold text-sm">${fmt(displayMd.marketLow * count)}g</span>
                        </div>
                        <div class="flex justify-between gap-2 mt-0.5">
                            <span class="text-gray-300 text-sm">Avg/stack</span>
                            <span class="text-white text-sm">${fmt(displayMd.marketAvg * count)}g</span>
                        </div>
                    </div>` : `<div class="text-gray-500 text-xs italic mt-1">Enter count for stack prices</div>`}
                    ${isQuality && md ? `
                    <div class="mt-1 pt-1 border-t border-slate-500/30 text-gray-500 text-sm">
                        All quality: ${md.totalListings} listing${md.totalListings !== 1 ? 's' : ''} &middot; Low ${fmt(md.marketLow)}g
                    </div>` : ''}
                    <div class="text-gray-500 text-sm mt-0.5">
                        ${displayMd.totalListings !== null
                            ? `${displayMd.totalListings} listing${displayMd.totalListings !== 1 ? 's' : ''} in your zone`
                            : 'Estimated from all-quality listings'}${state.ownCount > 0 ? ` <span class="text-emerald-400">(${state.ownCount} yours)</span>` : ''}
                    </div>
                </div>
            </div>`;
        } else {
            marketCol = `
            <div class="flex-1 min-w-0">
                <div class="flex items-center gap-1.5 mb-2">
                    <i class="fas fa-globe text-gray-500 text-sm"></i>
                    <span class="text-gray-400 text-sm font-semibold uppercase tracking-wide">Live Market</span>
                </div>
                <div class="text-gray-500 text-sm italic">No market data in your zone</div>
            </div>`;
        }

        let histCol;
        if (loading) {
            histCol = `
            <div class="flex-1 min-w-0">
                <div class="flex items-center gap-1.5 mb-2">
                    <i class="fas fa-chart-bar text-purple-400 text-sm"></i>
                    <span class="text-purple-300 text-sm font-semibold uppercase tracking-wide">Your Sales</span>
                </div>
                <div class="text-gray-400 text-sm italic"><i class="fas fa-spinner fa-spin mr-1"></i>Loading...</div>
            </div>`;
        } else if (hist) {
            const qHistKey = `mc${isMastercrafted ? 1 : 0}enc${enchantmentTier}`;
            const qualityHist = hist.byQuality?.[qHistKey] || null;
            const hasQBreakdown = isQuality && qualityHist && qualityHist.saleCount < hist.saleCount;
            histCol = `
            <div class="flex-1 min-w-0">
                <div class="flex items-center gap-1 mb-2 flex-wrap">
                    <i class="fas fa-chart-bar text-purple-400 text-sm"></i>
                    <span class="text-purple-300 text-sm font-semibold uppercase tracking-wide">Your Sales</span>
                    ${hasQBreakdown ? `<span class="text-xs font-semibold text-gray-400 bg-slate-700 border border-slate-500 rounded px-1.5 py-0.5">All quality</span>` : ''}
                </div>
                <div class="space-y-1">
                    <div class="flex justify-between gap-2">
                        <span class="text-gray-300 text-sm">Avg/unit</span>
                        <span class="text-purple-300 font-bold text-sm">${fmt(hist.avgPerUnit)}g</span>
                    </div>
                    <div class="flex justify-between gap-2">
                        <span class="text-gray-300 text-sm">Avg/stack</span>
                        <span class="text-white text-sm">${fmt(hist.avgPerStack)}g</span>
                    </div>
                    ${hasCount ? `
                    <div class="border-t border-slate-500/40 pt-1 mt-1">
                        <div class="flex justify-between gap-2">
                            <span class="text-gray-300 text-sm">Hist/stack <span class="text-gray-500 text-xs">(${count})</span></span>
                            <span class="text-purple-300 font-bold text-sm">${fmt(hist.avgPerUnit * count)}g</span>
                        </div>
                    </div>` : ''}
                    ${hasQBreakdown ? `
                    <div class="mt-1.5 pt-1.5 border-t border-purple-500/30 bg-purple-900/10 rounded p-1.5">
                        <div class="text-purple-300 text-sm font-semibold mb-1 flex items-center gap-1">
                            <i class="fas fa-filter text-xs"></i> Same quality (${qualityHist.saleCount} sale${qualityHist.saleCount !== 1 ? 's' : ''})
                        </div>
                        <div class="flex justify-between gap-2">
                            <span class="text-gray-300 text-sm">Avg/unit</span>
                            <span class="text-purple-200 font-semibold text-sm">${fmt(qualityHist.avgPerUnit)}g</span>
                        </div>
                        ${hasCount ? `<div class="flex justify-between gap-2 mt-0.5">
                            <span class="text-gray-300 text-sm">Avg/stack (${count})</span>
                            <span class="text-purple-200 font-semibold text-sm">${fmt(qualityHist.avgPerUnit * count)}g</span>
                        </div>` : ''}
                        <div class="text-gray-500 text-sm mt-0.5">Last sold ${getRelativeTime(qualityHist.lastSold)}</div>
                    </div>` : ''}
                    <div class="text-gray-500 text-sm mt-1">${hist.saleCount} sale${hist.saleCount !== 1 ? 's' : ''} &middot; last ${getRelativeTime(hist.lastSold)}</div>
                </div>
            </div>`;
        } else {
            histCol = `
            <div class="flex-1 min-w-0">
                <div class="flex items-center gap-1.5 mb-2">
                    <i class="fas fa-chart-bar text-gray-500 text-sm"></i>
                    <span class="text-gray-400 text-sm font-semibold uppercase tracking-wide">Your Sales</span>
                </div>
                <div class="text-gray-500 text-sm italic">No sales recorded for this item</div>
            </div>`;
        }

        let activeCol;
        if (activeLoading) {
            activeCol = `
            <div class="flex-1 min-w-0">
                <div class="flex items-center gap-1.5 mb-2">
                    <i class="fas fa-store text-emerald-400 text-sm"></i>
                    <span class="text-emerald-300 text-sm font-semibold uppercase tracking-wide">Active Listings</span>
                </div>
                <div class="text-gray-400 text-sm italic"><i class="fas fa-spinner fa-spin mr-1"></i>Loading...</div>
            </div>`;
        } else if (activeListingsForQuality.length) {
            const sameStackCount = hasCount
                ? activeListingsForQuality.filter((listing) => Number(listing.quantity_listed) === count).length
                : 0;
            const sortedActiveListings = [...activeListingsForQuality].sort((a, b) => {
                const aStack = Number(a.total_listed_price) || 0;
                const bStack = Number(b.total_listed_price) || 0;
                return aStack - bStack;
            });
            const lowestListing = sortedActiveListings[0];
            const lowestStack = Math.round(Number(lowestListing?.total_listed_price) || 0);
            const lowestUnit = Number(lowestListing?.listed_price_per_unit) || 0;
            const visibleListings = sortedActiveListings.slice(0, 3);
            activeCol = `
            <div class="flex-1 min-w-0">
                <div class="flex items-center gap-1 mb-2 flex-wrap">
                    <i class="fas fa-store text-emerald-400 text-sm"></i>
                    <span class="text-emerald-300 text-sm font-semibold uppercase tracking-wide">Active Listings</span>
                    ${sameStackCount > 0 ? `<span class="text-xs font-semibold text-emerald-300 bg-emerald-900/40 border border-emerald-500/40 rounded px-1.5 py-0.5">${sameStackCount} same stack</span>` : ''}
                </div>
                <div class="space-y-1">
                    <div class="flex justify-between gap-2">
                        <span class="text-gray-300 text-sm">Lowest active</span>
                        <span class="text-emerald-300 font-bold text-sm">${fmt(lowestStack)}g</span>
                    </div>
                    <div class="flex justify-between gap-2">
                        <span class="text-gray-300 text-sm">Lowest/unit</span>
                        <span class="text-white text-sm">${fmt(lowestUnit)}g</span>
                    </div>
                    <div class="border-t border-slate-500/40 pt-1 mt-1 space-y-1">
                        ${visibleListings.map((listing) => {
                            const quantity = Number(listing.quantity_listed) || 0;
                            const stackPrice = Math.round(Number(listing.total_listed_price) || 0);
                            return `<div class="flex justify-between gap-2 text-sm">
                                <span class="text-gray-300 truncate">${quantity} count</span>
                                <span class="text-emerald-200 font-semibold whitespace-nowrap">${fmt(stackPrice)}g</span>
                            </div>`;
                        }).join('')}
                    </div>
                    <div class="text-gray-500 text-sm mt-1">${activeListingsForQuality.length} unsold listing${activeListingsForQuality.length !== 1 ? 's' : ''} in your Ledger</div>
                </div>
            </div>`;
        } else {
            activeCol = `
            <div class="flex-1 min-w-0">
                <div class="flex items-center gap-1.5 mb-2">
                    <i class="fas fa-store text-gray-500 text-sm"></i>
                    <span class="text-gray-400 text-sm font-semibold uppercase tracking-wide">Active Listings</span>
                </div>
                <div class="text-gray-500 text-sm italic">No active Ledger listings for this quality</div>
            </div>`;
        }

        const suggestion = buildAddListingSuggestion(md, qualityMd, hist, count, stacks, isMastercrafted, enchantmentTier, state.ownCount);

        const stackMarketLow = (displayMd && hasCount) ? (displayMd.marketLow * count) : null;
        const provincePriceOptions = [];
        if (provinceContext && provinceDisplayMd) {
            const provinceStackLow = hasCount ? provinceDisplayMd.marketLow * count : null;
            const provinceStackAvg = hasCount ? provinceDisplayMd.marketAvg * count : null;
            if (provinceStackLow !== null) {
                const provinceLowRecommendation = getMarketLowRecommendation(
                    provinceStackLow,
                    0,
                    provinceDisplayMd.totalListings,
                    false
                );
                provincePriceOptions.push({
                    type: 'market-low',
                    label: 'Province Low',
                    badge: 'Travel',
                    value: provinceLowRecommendation.value,
                    description: 'Match the broader province floor.',
                    subtext: provinceLowRecommendation.subtext.replace('live market', 'province-wide market')
                });

                const provinceCompetitiveRecommendation = getCompetitivePriceRecommendation({
                    stackMarketLow: provinceStackLow,
                    stackMarketAvg: provinceStackAvg,
                    suggestionValue: provinceLowRecommendation.value,
                    hasHistory: !!hist
                });
                provincePriceOptions.push({
                    type: 'competitive',
                    label: 'Province Competitive',
                    badge: 'Broader',
                    value: provinceCompetitiveRecommendation.value,
                    description: 'Top end of the province band.',
                    subtext: provinceCompetitiveRecommendation.subtext
                });
            }
            if (provinceStackAvg !== null && Math.round(provinceStackAvg) > 0) {
                provincePriceOptions.push({
                    type: 'suggested',
                    label: 'Province Avg',
                    badge: 'Reference',
                    value: Math.round(provinceStackAvg),
                    description: 'Average province-wide stack price.',
                    subtext: `${provinceDisplayMd.totalListings} listing${provinceDisplayMd.totalListings !== 1 ? 's' : ''} across ${provinceDisplayMd.valleyCount || provinceContext.loadedValleys.length} valley${(provinceDisplayMd.valleyCount || provinceContext.loadedValleys.length) !== 1 ? 's' : ''}.`
                });
            }
        }

        let qualityBanner = '';
        if (suggestion?.qualityNote) {
            const q = suggestion.qualityNote;
            const bannerCls = q.type === 'exact'
                ? 'bg-purple-900/20 border-purple-500/40 text-purple-300'
                : q.type === 'partial'
                    ? 'bg-blue-900/20 border-blue-500/40 text-blue-300'
                    : 'bg-amber-900/20 border-amber-500/40 text-amber-300';
            const icon = q.type === 'exact' ? 'fa-check-circle' : q.type === 'partial' ? 'fa-info-circle' : 'fa-triangle-exclamation';
            qualityBanner = `<div class="mb-2 px-2.5 py-1.5 border rounded-lg ${bannerCls} text-xs flex items-center gap-2">
                <i class="fas ${icon} flex-shrink-0"></i><span>${q.text}</span></div>`;
        }

        const hasHistoryOnlyCardSet = !displayMd && !!hist && hasCount;
        let suggestionCard = '';
        if (suggestion || (hasCount && activeListingsForQuality.length) || provincePriceOptions.length) {
            const pricingInsight = suggestion?.insight || 'You already have active listings for this item - matching your current price keeps the market stall consistent.';
            const pricingInsightClass = suggestion?.insightClass || 'text-emerald-400';
            const bubbleCls = pricingInsightClass === 'text-rose-400' ? 'bg-rose-400'
                : pricingInsightClass === 'text-amber-400' ? 'bg-amber-400'
                : pricingInsightClass === 'text-emerald-400' ? 'bg-emerald-400'
                : pricingInsightClass === 'text-fuchsia-300' ? 'bg-fuchsia-400'
                : 'bg-gray-400';
            const suggestionOptions = [];
            const historyOnlyRecommendations = !displayMd && hist && hasCount
                ? getHistoryOnlyPriceRecommendations(hist, count)
                : null;
            const matchExistingRecommendation = hasCount
                ? getMatchExistingRecommendation(activeListingsForQuality, count)
                : null;

            if (matchExistingRecommendation) {
                suggestionOptions.push({
                    type: 'match-existing',
                    label: 'Match Existing',
                    badge: 'Consistent',
                    value: matchExistingRecommendation.value,
                    description: matchExistingRecommendation.description,
                    subtext: matchExistingRecommendation.subtext
                });
            } else if (stackMarketLow !== null) {
                const marketLowRecommendation = getMarketLowRecommendation(
                    stackMarketLow,
                    state.ownCount,
                    displayMd?.totalListings,
                    isOwnListingAtMarketLow(state.ownListings, displayMd?.marketLow)
                );
                suggestionOptions.push({
                    type: 'market-low',
                    label: 'Market Low',
                    badge: 'Fastest',
                    value: marketLowRecommendation.value,
                    description: marketLowRecommendation.description,
                    subtext: marketLowRecommendation.subtext
                });
            }

            if (suggestion && suggestion.suggestedPerStack !== null && hasCount) {
                suggestionOptions.push({
                    type: 'suggested',
                    label: 'Suggested Price',
                    badge: 'Recommended',
                    value: suggestion.suggestedPerStack,
                    description: displayMd
                        ? 'Balanced market and sales signal.'
                        : 'Anchored to your sales history.',
                    subtext: suggestion.insight
                });
            }

            if (stackMarketLow !== null) {
                const competitiveRecommendation = getCompetitivePriceRecommendation({
                    stackMarketLow,
                    stackMarketAvg: displayMd?.marketAvg && hasCount ? displayMd.marketAvg * count : null,
                    suggestionValue: suggestion.suggestedPerStack,
                    hasHistory: !!hist
                });
                suggestionOptions.push({
                    type: 'competitive',
                    label: 'Competitive Price',
                    badge: 'Stretch',
                    value: competitiveRecommendation.value,
                    description: competitiveRecommendation.description,
                    subtext: competitiveRecommendation.subtext
                });
            } else if (historyOnlyRecommendations) {
                if (historyOnlyRecommendations.marketLowPerStack !== null) {
                    suggestionOptions.unshift({
                        type: 'market-low',
                        label: 'Market Low',
                        badge: 'Fastest',
                        value: historyOnlyRecommendations.marketLowPerStack,
                        description: 'Fast-move floor from sales history.',
                        subtext: `Anchored from your best historical price of ${fmt(suggestion.suggestedPerStack)}g.`
                    });
                }

                if (
                    historyOnlyRecommendations.higherAskPerStack !== null
                    && historyOnlyRecommendations.higherAskPerStack > suggestion.suggestedPerStack
                ) {
                    suggestionOptions.push({
                        type: 'competitive',
                        label: 'Higher Ask',
                        badge: 'Stretch',
                        value: historyOnlyRecommendations.higherAskPerStack,
                        description: 'Higher ask from sales history.',
                        subtext: `About 10% above your best historical anchor of ${fmt(suggestion.suggestedPerStack)}g.`
                    });
                }
            }

            const homeScopeSummary = displayMd
                ? `${displayMd.totalListings !== null ? `${displayMd.totalListings} listing${displayMd.totalListings !== 1 ? 's' : ''}` : 'Estimated'} · Low ${fmt(displayMd.marketLow)}g/unit${hasCount ? ` · ${fmt(displayMd.marketLow * count)}g stack` : ''}`
                : hist
                    ? `${hist.saleCount} sale${hist.saleCount !== 1 ? 's' : ''} · no live local listings`
                    : 'No local market data';
            const provinceScopeSummary = provinceLoading
                ? '<i class="fas fa-spinner fa-spin mr-1"></i>Checking province...'
                : provinceDisplayMd
                    ? `${provinceDisplayMd.totalListings} listing${provinceDisplayMd.totalListings !== 1 ? 's' : ''} · ${provinceDisplayMd.valleyCount || provinceContext?.loadedValleys?.length || 0} valley${(provinceDisplayMd.valleyCount || provinceContext?.loadedValleys?.length || 0) !== 1 ? 's' : ''} · Low ${fmt(provinceDisplayMd.marketLow)}g/unit${hasCount ? ` · ${fmt(provinceDisplayMd.marketLow * count)}g stack` : ''}`
                    : provinceContext
                        ? 'No province-wide market data for this item'
                        : 'Province data unavailable';

            suggestionCard = `
            <div class="mt-3">
                <div class="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
                    <div class="flex items-center gap-2">
                    <i class="fas fa-lightbulb text-gray-300 text-sm"></i>
                        <span class="text-gray-100 font-semibold text-sm uppercase tracking-widest">Price Options</span>
                    </div>
                    <span class="text-gray-400 text-xs">Grouped by market scope</span>
                </div>
                ${(suggestionOptions.length > 0 || provincePriceOptions.length > 0)
                    ? `<div class="grid lg:grid-cols-2 gap-3">
                           <div class="min-w-0 rounded-xl border border-blue-400/25 bg-slate-950/15 p-2.5">
                               <div class="mb-2 border-b border-blue-400/20 pb-1.5">
                                   <div class="flex items-center gap-2">
                                       <span class="text-blue-300 text-xs font-semibold uppercase tracking-widest">Home Valley Prices</span>
                                       <span class="text-gray-500 text-xs">Local benchmark</span>
                                   </div>
                                   <div class="text-gray-400 text-xs mt-0.5">${homeScopeSummary}</div>
                               </div>
                               ${suggestionOptions.length > 0
                                   ? `<div class="space-y-1">${suggestionOptions.map(option => renderSuggestedPriceOptionRow(option, stacks, fmt, 'Home valley')).join('')}</div>`
                                   : `<div class="rounded-lg border border-slate-600/40 bg-slate-900/35 px-3 py-2 text-gray-500 text-sm italic">No home valley price options yet.</div>`}
                           </div>
                           <div class="min-w-0 rounded-xl border border-indigo-400/25 bg-slate-950/15 p-2.5">
                               <div class="mb-2 border-b border-indigo-400/20 pb-1.5">
                                   <div class="flex items-center gap-2">
                                       <span class="text-indigo-300 text-xs font-semibold uppercase tracking-widest">Province-Wide Prices</span>
                                       <span class="text-gray-500 text-xs">Travel-aware</span>
                                   </div>
                                   <div class="text-gray-400 text-xs mt-0.5">${provinceScopeSummary}</div>
                               </div>
                               ${provincePriceOptions.length > 0
                                   ? `<div class="space-y-1">${provincePriceOptions.map(option => renderSuggestedPriceOptionRow(option, stacks, fmt, 'Province-wide')).join('')}</div>`
                                   : `<div class="rounded-lg border border-slate-600/40 bg-slate-900/35 px-3 py-2 text-gray-500 text-sm italic">${provinceLoading ? 'Loading province-wide price options...' : 'No province-wide price options yet.'}</div>`}
                           </div>
                       </div>
                       <!-- Hidden for now: this repeats rationale already implied by the selected options.
                       ${suggestion ? `<div class="flex items-center gap-1.5 mt-2">
                           <span class="inline-block w-2 h-2 rounded-full flex-shrink-0 ${bubbleCls}"></span>
                           <span class="${pricingInsightClass} text-sm">${pricingInsight}</span>
                       </div>` : ''}
                       -->`
                    : `<span class="text-gray-400 text-sm italic">Enter stack count to see suggestion</span>`
                }
            </div>`;
        }

        let impactRow = '';
        if (suggestion?.impactNote) {
            impactRow = `
            <div class="flex items-center gap-1.5 mt-1.5">
                <span class="inline-block w-2 h-2 rounded-full flex-shrink-0 ${suggestion.impactNote.bubble}"></span>
                <span class="${suggestion.impactNote.cls} text-sm">${suggestion.impactNote.text}</span>
            </div>`;
        }

        let highPriceRow = '';
        if (!hasHistoryOnlyCardSet && !displayMd && hist?.maxPerUnit && hasCount) {
            const highPerStack = Math.round(hist.maxPerUnit * count);
            const highTotal = hasStacks ? highPerStack * stacks : null;
            highPriceRow = `
            <div class="flex flex-wrap items-center gap-x-2 gap-y-1 mt-2 pt-1.5 border-t border-slate-500/30">
                <span class="text-white text-sm font-semibold flex items-center gap-1">
                    <i class="fas fa-arrow-trend-up text-emerald-400"></i> High price option:
                </span>
                <span class="text-emerald-300 font-bold text-sm">${fmt(highPerStack)}g</span>
                <span class="text-gray-400 text-sm">/stack (${count})</span>
                <button id="modal-use-high-price-btn" type="button"
                    class="px-2 py-0.5 text-xs font-semibold bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-300 border border-emerald-500/40 rounded transition-colors">Use</button>
                ${highTotal !== null ? `<span class="text-gray-400 text-sm">-> <span class="text-emerald-200 font-bold">${fmt(highTotal)}g</span> total</span>` : ''}
            </div>
            <div class="flex items-center gap-1.5 mt-0.5">
                <span class="inline-block w-2 h-2 rounded-full flex-shrink-0 bg-emerald-400"></span>
                <span class="text-emerald-400 text-sm">Your highest ever sale - no live market to undercut.</span>
            </div>`;
        }

        hintEl.innerHTML = `
            ${qualityBanner}
            <div class="flex flex-col lg:flex-row gap-3">
                ${marketCol}
                <div class="hidden lg:block w-px bg-slate-500/40 self-stretch flex-shrink-0"></div>
                ${histCol}
                <div class="hidden lg:block w-px bg-slate-500/40 self-stretch flex-shrink-0"></div>
                ${activeCol}
            </div>
            ${suggestionCard}
            ${impactRow}
            ${highPriceRow}`;
        hintEl.classList.remove('hidden');

        hintEl.querySelectorAll('[data-suggested-price]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const priceInput = document.getElementById('modal-item-price-per-stack');
                const targetPrice = parseInt(btn.getAttribute('data-suggested-price'), 10);
                if (priceInput && Number.isFinite(targetPrice)) {
                    priceInput.value = targetPrice;
                    priceInput.dispatchEvent(new Event('input'));
                }
            });
        });

        const useHighBtn = hintEl.querySelector('#modal-use-high-price-btn');
        if (useHighBtn) {
            useHighBtn.addEventListener('click', () => {
                const priceInput = document.getElementById('modal-item-price-per-stack');
                const cnt = parseInt(document.getElementById('modal-item-count-per-stack')?.value, 10);
                if (priceInput && state.historyData?.maxPerUnit && cnt > 0) {
                    priceInput.value = Math.round(state.historyData.maxPerUnit * cnt);
                    priceInput.dispatchEvent(new Event('input'));
                }
            });
        }
    }

    async function handleItemSelected(selectedItem) {
        state.selectedItem = selectedItem;

        let marketData = null;
        if (selectedItem.pax_dei_slug) {
            const slugData = getMarketDataForSlug(selectedItem.pax_dei_slug);
            if (slugData) {
                const slugName = getItemNameForSlug(selectedItem.pax_dei_slug);
                const nameMatches = slugName && slugName.toLowerCase().trim() === selectedItem.item_name.toLowerCase().trim();
                if (nameMatches) {
                    marketData = slugData;
                } else {
                    console.warn(`[Trader] pax_dei_slug mismatch for "${selectedItem.item_name}": slug "${selectedItem.pax_dei_slug}" resolves to "${slugName}" - falling back to name lookup.`);
                }
            }
        }
        if (!marketData) marketData = getMarketDataByItemName(selectedItem.item_name);
        state.marketData = marketData || null;

        const savedHash = getSavedAvatarHash();
        if (savedHash) {
            let gtItemId = null;
            if (selectedItem.pax_dei_slug) {
                const slugName = getItemNameForSlug(selectedItem.pax_dei_slug);
                const slugValid = slugName && slugName.toLowerCase().trim() === selectedItem.item_name.toLowerCase().trim();
                if (slugValid) gtItemId = selectedItem.pax_dei_slug;
            }
            if (!gtItemId) gtItemId = getItemIdByName(selectedItem.item_name);
            const ownListingData = gtItemId ? getOwnListingCountForSlug(savedHash, gtItemId) : { ownCount: 0, ownListings: [] };
            state.ownCount = ownListingData.ownCount;
            state.ownListings = ownListingData.ownListings || [];
        } else {
            state.ownCount = 0;
            state.ownListings = [];
        }

        const currentCharacterId = getCurrentCharacterId();
        if (currentCharacterId && selectedItem.item_id) {
            const requestId = state.historyRequestId + 1;
            state.historyRequestId = requestId;
            state.historyData = null;
            state.activeListings = [];
            state.provinceContext = null;
            state.historyLoading = true;
            state.activeListingsLoading = true;
            state.provinceLoading = true;
            renderHint();
            const [hist, activeListings, provinceContext] = await Promise.all([
                fetchItemSalesHistoryForListing({ supabase, currentCharacterId, itemId: selectedItem.item_id }),
                fetchActiveListingsForListing({ supabase, currentCharacterId, itemId: selectedItem.item_id }),
                fetchProvinceMarketContext({
                    supabase,
                    currentCharacterId,
                    getCurrentCharacter,
                    selectedItem,
                    getItemNameForSlug,
                    getItemIdByName
                }).catch((err) => {
                    console.warn('[Trader] Province-wide market context unavailable:', err?.message || err);
                    return null;
                })
            ]);
            if (requestId !== state.historyRequestId || state.selectedItem !== selectedItem) return;
            state.historyData = hist;
            state.activeListings = activeListings;
            state.provinceContext = provinceContext;
            state.historyLoading = false;
            state.activeListingsLoading = false;
            state.provinceLoading = false;
            renderHint();
        } else {
            state.historyRequestId += 1;
            state.historyData = null;
            state.activeListings = [];
            state.provinceContext = null;
            state.historyLoading = false;
            state.activeListingsLoading = false;
            state.provinceLoading = false;
            renderHint();
        }
    }

    function attachInputListeners() {
        document.getElementById('modal-item-count-per-stack')?.addEventListener('input', renderHint);
        document.getElementById('modal-item-stacks')?.addEventListener('input', renderHint);
        document.getElementById('modal-item-price-per-stack')?.addEventListener('input', renderHint);
        document.getElementById('modal-mastercrafted-btn')?.addEventListener('click', () => setTimeout(renderHint, 10));
        document.querySelectorAll('.modal-enchant-btn').forEach(b => b.addEventListener('click', () => setTimeout(renderHint, 10)));
    }

    return {
        handleItemSelected,
        renderHint,
        attachInputListeners
    };
}
