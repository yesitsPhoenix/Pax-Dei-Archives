import { supabase } from '../supabaseClient.js';
import { currentCharacterId } from './characters.js';
import {
    fetchActiveListingsForListing,
    fetchItemSalesHistoryForListing
} from './addListingIntelligence.js';
import {
    COMPETITIVE_RISK_PROFILES,
    classifyCompetitiveGap,
    getCompetitiveBandDisplayRows,
    getCompetitiveCap,
    getCompetitiveRiskTolerance,
    getCompetitiveThresholds,
    setCompetitiveRiskTolerance
} from './pricingBands.js';
import {
    getMarketDataByItemName,
    getMarketDataByItemNameAndQuality,
    getMarketDataForSlug,
    getMarketDataForSlugByQuality,
    getSavedAvatarHash,
    getZoneListingsForItemByQuality
} from '../services/gamingToolsService.js';

const fmt = (value, digits = 0) => {
    const number = Number(value);
    if (!Number.isFinite(number)) return '--';
    return number.toLocaleString(undefined, { maximumFractionDigits: digits });
};

const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const WORKBENCH_TABLE_PAGE_SIZE = 8;
let activeListingsPage = 0;
let salesHistoryPage = 0;
let lastActiveListingsArgs = null;
let lastSalesHistoryArgs = null;
let currentPricingModel = null;

function renderTablePagination(kind, page, pageCount, totalRows) {
    if (pageCount <= 1) return `<div class="listing-data-pagination"><span>${fmt(totalRows)} row${totalRows === 1 ? '' : 's'}</span></div>`;
    return `
        <div class="listing-data-pagination">
            <button type="button" data-listing-table="${kind}" data-listing-page="${page - 1}" ${page === 0 ? 'disabled' : ''} aria-label="Previous page">
                <i class="fas fa-arrow-left"></i>
            </button>
            <span>Page ${page + 1} of ${pageCount} · ${fmt(totalRows)} rows</span>
            <button type="button" data-listing-table="${kind}" data-listing-page="${page + 1}" ${page === pageCount - 1 ? 'disabled' : ''} aria-label="Next page">
                <i class="fas fa-arrow-right"></i>
            </button>
        </div>
    `;
}

const relativeDate = (isoDate) => {
    if (!isoDate) return '--';
    const then = new Date(isoDate).getTime();
    if (!Number.isFinite(then)) return '--';
    const diffHours = Math.max(0, (Date.now() - then) / 36e5);
    if (diffHours < 1) return 'under 1h';
    if (diffHours < 24) return `${Math.round(diffHours)}h`;
    const days = Math.round(diffHours / 24);
    return `${days}d`;
};

const getInputs = () => ({
    itemName: document.getElementById('modal-item-name'),
    stacks: document.getElementById('modal-item-stacks'),
    count: document.getElementById('modal-item-count-per-stack'),
    price: document.getElementById('modal-item-price-per-stack'),
    stall: document.getElementById('modal-market-stall-location'),
    isMastercrafted: document.getElementById('modal-is-mastercrafted'),
    enchantmentTier: document.getElementById('modal-enchantment-tier')
});

const describeReferenceFloor = (referenceFloor, marketData) => {
    if (marketData) return 'Home Valley market reference for the selected stack size.';
    if (!referenceFloor) return 'No live or province floor';
    if (referenceFloor.source === 'province') {
        const sourceStack = referenceFloor.sourceQuantity && referenceFloor.sourceStackPrice
            ? ` Source listing: ${fmt(referenceFloor.sourceQuantity)} items for ${fmt(referenceFloor.sourceStackPrice)}g.`
            : '';
        return `Province market reference adjusted to this stack size.${sourceStack}`;
    }
    return referenceFloor.sourceLabel || 'Reference floor';
};

const getFormState = () => {
    const inputs = getInputs();
    const count = parseInt(inputs.count?.value, 10) || 1;
    const stacks = parseInt(inputs.stacks?.value, 10) || 0;
    const price = parseFloat(inputs.price?.value) || 0;
    const isMastercrafted = inputs.isMastercrafted?.value === 'true';
    const enchantmentTier = parseInt(inputs.enchantmentTier?.value || '0', 10) || 0;
    return { inputs, count, stacks, price, isMastercrafted, enchantmentTier };
};

const qualityLabel = (isMastercrafted, enchantmentTier) => {
    const pieces = [];
    if (isMastercrafted) pieces.push('Mastercrafted');
    if (enchantmentTier > 0) pieces.push(`Enchant ${['', 'I', 'II', 'III'][enchantmentTier] || enchantmentTier}`);
    return pieces.length ? pieces.join(' + ') : 'Standard';
};

const filterLedgerListingsByQuality = (listings, isMastercrafted, enchantmentTier) => {
    return (listings || []).filter((listing) => {
        const listingMastercrafted = !!listing.is_mastercrafted;
        const listingEnchantTier = parseInt(listing.enchantment_tier || '0', 10) || 0;
        return listingMastercrafted === isMastercrafted && listingEnchantTier === enchantmentTier;
    });
};

const listingSignature = (quantity, stackPrice) => {
    const q = Math.round(Number(quantity) || 0);
    const p = Math.round(Number(stackPrice) || 0);
    return `${q}|${p}`;
};

const weightedAverage = (rows, valueGetter, dateGetter, halfLifeDays = 14) => {
    let weightedSum = 0;
    let weightTotal = 0;
    rows.forEach((row) => {
        const value = Number(valueGetter(row));
        const date = new Date(dateGetter(row)).getTime();
        if (!Number.isFinite(value) || !Number.isFinite(date)) return;
        const ageDays = Math.max(0, (Date.now() - date) / 864e5);
        const weight = Math.pow(0.5, ageDays / halfLifeDays);
        weightedSum += value * weight;
        weightTotal += weight;
    });
    return weightTotal > 0 ? weightedSum / weightTotal : null;
};

const weightedMedian = (rows, valueGetter, dateGetter, halfLifeDays = 14) => {
    const weightedRows = rows.map((row) => {
        const value = Number(valueGetter(row));
        const date = new Date(dateGetter(row)).getTime();
        if (!Number.isFinite(value) || !Number.isFinite(date)) return null;
        const ageDays = Math.max(0, (Date.now() - date) / 864e5);
        return { value, weight: Math.pow(0.5, ageDays / halfLifeDays) };
    }).filter(Boolean).sort((a, b) => a.value - b.value);
    const totalWeight = weightedRows.reduce((sum, row) => sum + row.weight, 0);
    let cumulativeWeight = 0;
    for (const row of weightedRows) {
        cumulativeWeight += row.weight;
        if (cumulativeWeight >= totalWeight / 2) return row.value;
    }
    return null;
};

const filterSalesRowsByQuality = (sales, isMastercrafted, enchantmentTier) => (sales || []).filter((sale) => {
    const listing = Array.isArray(sale.market_listings) ? sale.market_listings[0] : sale.market_listings;
    return !!listing
        && !!listing.is_mastercrafted === isMastercrafted
        && (parseInt(listing.enchantment_tier || '0', 10) || 0) === enchantmentTier;
});

const buildHistoryDataFromSales = (sales) => {
    if (!sales?.length) return null;
    const perUnitValues = sales.map((sale) => {
        const quantity = Math.max(Number(sale.quantity_sold) || 1, 1);
        return (Number(sale.total_sale_price) || 0) / quantity;
    }).filter((value) => value > 0);
    if (!perUnitValues.length) return null;
    return {
        avgPerUnit: perUnitValues.reduce((sum, value) => sum + value, 0) / perUnitValues.length,
        maxPerUnit: Math.max(...perUnitValues),
        saleCount: sales.length
    };
};

const getNormalizedSaleStackValue = (sale, targetCount) => {
    const count = Math.max(Number(targetCount) || 0, 0);
    const quantity = Math.max(Number(sale?.quantity_sold) || 1, 1);
    const total = Number(sale?.total_sale_price) || 0;
    if (!(count > 0) || !(total > 0)) return total;
    return (total / quantity) * count;
};

const getMarketUndercutStep = (stackPrice) => {
    const value = Number(stackPrice) || 0;
    if (value >= 250) return 5;
    if (value >= 100) return 3;
    if (value >= 25) return 2;
    return 1;
};

const computeMarketData = (selectedItem, isMastercrafted, enchantmentTier) => {
    if (!selectedItem) return null;
    if (isMastercrafted || enchantmentTier > 0) {
        if (selectedItem.pax_dei_slug) {
            const bySlug = getMarketDataForSlugByQuality(selectedItem.pax_dei_slug, isMastercrafted, enchantmentTier);
            if (bySlug) return bySlug;
        }
        return getMarketDataByItemNameAndQuality(selectedItem.item_name, isMastercrafted, enchantmentTier);
    }
    if (selectedItem.pax_dei_slug) {
        const bySlug = getMarketDataForSlug(selectedItem.pax_dei_slug);
        if (bySlug) return bySlug;
    }
    return getMarketDataByItemName(selectedItem.item_name);
};

const computeReferenceFloor = ({ selectedItem, marketData, formState }) => {
    if (!selectedItem || !formState?.count) return null;

    if (marketData) {
        return {
            itemId: selectedItem.item_id || null,
            itemName: selectedItem.item_name || '',
            count: formState.count,
            isMastercrafted: formState.isMastercrafted,
            enchantmentTier: formState.enchantmentTier,
            source: 'home',
            sourceLabel: 'Home Valley live floor',
            value: Math.round(marketData.marketLow * formState.count),
            unitPrice: marketData.marketLow,
            totalListings: marketData.totalListings ?? null,
            valleyCount: 1
        };
    }

    return null;
};

const getSelectedItemFromInput = () => {
    const input = document.getElementById('modal-item-name');
    const itemId = input?.dataset.selectedItemId;
    if (!input || !itemId) return null;
    return {
        item_id: itemId,
        item_name: input.value,
        category_id: input.dataset.selectedItemCategory || '',
        pax_dei_slug: input.dataset.selectedPaxDeiSlug || ''
    };
};

async function fetchRecentSalesRows(itemId) {
    if (!currentCharacterId || !itemId) return [];
    const { data, error } = await supabase
        .from('sales')
        .select('quantity_sold, sale_price_per_unit, total_sale_price, sale_date, market_listings!inner(item_id, is_mastercrafted, enchantment_tier)')
        .eq('market_listings.item_id', itemId)
        .eq('character_id', currentCharacterId)
        .order('sale_date', { ascending: false })
        .limit(12);
    if (error) {
        console.warn('[ListingWorkbench] recent sales unavailable:', error.message);
        return [];
    }
    return data || [];
}

function renderEmpty(target, message) {
    if (!target) return;
    target.innerHTML = `<div class="listing-workbench-empty">${escapeHtml(message)}</div>`;
}

function renderPricingSummary({ selectedItem, marketData, referenceFloor, historyData, activeListings, formState }) {
    const target = document.getElementById('workbench-pricing-summary');
    const preview = document.getElementById('workbench-final-preview');
    const rankTarget = document.getElementById('workbench-rank-preview');
    if (!target || !preview || !rankTarget) return;

    if (!selectedItem) {
        currentPricingModel = null;
        target.innerHTML = '<div class="listing-workbench-empty">Select an item to populate the decision summary.</div>';
        preview.innerHTML = '<span>Waiting for item</span><strong>--</strong>';
        rankTarget.innerHTML = '<span>Market position</span><strong>--</strong>';
        return;
    }

    const { count, stacks, price } = formState;
    const total = price > 0 && stacks > 0 ? price * stacks : 0;
    const fee = price > 0 && stacks > 0 ? Math.ceil(price * 0.05) * stacks : 0;
    const activePrices = count > 0
        ? activeListings.map((listing) => {
            const listingPrice = Number(listing.total_listed_price) || 0;
            const listingQuantity = Math.max(Number(listing.quantity_listed) || 1, 1);
            return listingPrice > 0 ? (listingPrice / listingQuantity) * count : 0;
        }).filter(Boolean)
        : [];
    const rank = price > 0 && count > 0
        ? activePrices.filter((listingPrice) => listingPrice < price).length + 1
        : null;

    preview.innerHTML = `<span>Expected gross</span><strong>${fmt(total)}g</strong><small>${fmt(fee)}g estimated fees</small>`;
    rankTarget.innerHTML = `<span>Market position</span><strong>${rank ? `#${rank}` : '--'}</strong><small>${price > 0 && count > 0 ? `${fmt(price)}g per stack` : 'Enter stack size and price'}</small>`;

    const marketLowStack = referenceFloor?.value || (marketData && count > 0 ? marketData.marketLow * count : null);
    const pricingReferenceStack = currentPricingModel?.referencePrice || marketLowStack;
    const historyAvgStack = historyData && count > 0 ? historyData.avgPerUnit * count : null;
    const lowestActive = activePrices.length ? Math.min(...activePrices) : null;

    target.innerHTML = `
        <div class="listing-workbench-metric">
            <span>Pricing reference</span>
            <strong>${pricingReferenceStack ? `${fmt(pricingReferenceStack)}g` : '--'}</strong>
            <small>${currentPricingModel?.excludedLocalOutlier
                ? `${fmt(marketLowStack)}g local floor excluded as an outlier`
                : currentPricingModel?.evidenceType === 'sales'
                    ? 'Quality-matched recent sales reference'
                    : describeReferenceFloor(referenceFloor, marketData)}</small>
        </div>
        <div class="listing-workbench-metric">
            <span>Your avg sale</span>
            <strong>${historyAvgStack ? `${fmt(historyAvgStack)}g` : '--'}</strong>
            <small>${historyData && count > 0 ? `${fmt(historyData.saleCount)} sales, best ${fmt((historyData.maxPerUnit || 0) * count)}g` : count > 0 ? 'No sales history' : 'Enter items per stack'}</small>
        </div>
        <div class="listing-workbench-metric">
            <span>Ledger floor</span>
            <strong>${lowestActive ? `${fmt(lowestActive)}g` : '--'}</strong>
            <small>${activeListings.length ? `${activeListings.length} active Ledger listings` : 'No active Ledger listings'}</small>
        </div>
    `;
}

function renderPricingVisuals({ selectedItem, marketData, referenceFloor, historyData, activeListings, salesRows, formState }) {
    const target = document.getElementById('workbench-pricing-visuals');
    const summaryTarget = document.getElementById('workbench-overview-summary');
    const placeholder = document.getElementById('modal-market-hint-placeholder');
    if (!target) return;

    if (!selectedItem) {
        target.innerHTML = '';
        if (summaryTarget) summaryTarget.innerHTML = '';
        placeholder?.classList.remove('hidden');
        return;
    }
    placeholder?.classList.add('hidden');

    const { count, stacks, price, isMastercrafted, enchantmentTier } = formState;
    const hasCount = count > 0;
    const normalizedCount = hasCount ? count : null;
    const zoneListings = getZoneListingsForItemByQuality(
        selectedItem.pax_dei_slug,
        selectedItem.item_name,
        isMastercrafted,
        enchantmentTier
    );

    const rawStackPrices = hasCount ? zoneListings
        .map((listing) => {
            const listingPrice = Number(listing.price) || 0;
            const listingQuantity = Math.max(Number(listing.quantity) || 1, 1);
            return Math.round((listingPrice / listingQuantity) * normalizedCount);
        })
        .filter((stackPrice) => stackPrice > 0)
        .sort((a, b) => a - b) : [];
    const marketLowStack = marketData && hasCount
        ? marketData.marketLow * count
        : hasCount
            ? referenceFloor?.value || rawStackPrices[0] || null
            : null;
    const riskProfile = getCompetitiveRiskTolerance();
    const ledgerPrices = hasCount ? activeListings
        .map((listing) => {
            const listingPrice = Number(listing.total_listed_price) || 0;
            const listingQuantity = Math.max(Number(listing.quantity_listed) || 1, 1);
            return listingPrice > 0 ? (listingPrice / listingQuantity) * normalizedCount : 0;
        })
        .filter(Boolean)
        : [];
    const ledgerLowStack = ledgerPrices.length ? Math.min(...ledgerPrices) : null;
    const weightedSaleStack = hasCount
        ? weightedMedian(salesRows, (sale) => getNormalizedSaleStackValue(sale, count), (sale) => sale.sale_date)
        : null;
    const supplyAfter = (marketData?.totalListings || zoneListings.length || 0) + (stacks || 0);
    const depthBuckets = new Map();
    rawStackPrices.forEach((stackPrice) => {
        depthBuckets.set(stackPrice, (depthBuckets.get(stackPrice) || 0) + 1);
    });
    const depthRows = Array.from(depthBuckets, ([stackPrice, quantity]) => ({ stackPrice, quantity }))
        .sort((a, b) => a.stackPrice - b.stackPrice);
    const rawRoundedFloor = marketLowStack ? Math.round(marketLowStack) : null;
    const recentThirtyDaySales = salesRows.filter((sale) => {
        const soldAt = new Date(sale.sale_date).getTime();
        return Number.isFinite(soldAt) && Date.now() - soldAt <= 30 * 864e5;
    });
    const weightedOption = weightedSaleStack ? Math.round(weightedSaleStack) : null;
    const isLocalFloorOutlier = !!(
        rawRoundedFloor
        && weightedOption
        && recentThirtyDaySales.length >= 3
        && rawRoundedFloor < weightedOption * 0.6
    );
    const roundedFloor = isLocalFloorOutlier ? null : rawRoundedFloor;
    const thresholds = roundedFloor ? getCompetitiveThresholds(roundedFloor, riskProfile) : null;
    const distinctMarketPrices = depthRows.map((row) => row.stackPrice);
    const hasMarketRange = distinctMarketPrices.length > 1;
    const floorDepth = depthRows.find((row) => row.stackPrice === roundedFloor)?.quantity || 0;
    const nextMarketTier = roundedFloor
        ? depthRows.find((row) => row.stackPrice > roundedFloor)
        : null;
    const staticCompetitiveOption = roundedFloor && thresholds
        ? getCompetitiveCap(roundedFloor, riskProfile)
        : null;
    const visibleMarketSupply = rawStackPrices.length;
    const nextTierShare = nextMarketTier && visibleMarketSupply > 0
        ? nextMarketTier.quantity / visibleMarketSupply
        : 0;
    const supportedNextTier = nextMarketTier
        && nextMarketTier.quantity >= 2
        && nextTierShare >= 0.25
        && nextMarketTier.quantity >= Math.ceil(floorDepth * 0.5)
        && nextMarketTier.stackPrice > staticCompetitiveOption;
    const wallCeiling = supportedNextTier
        ? Math.max(roundedFloor, nextMarketTier.stackPrice - getMarketUndercutStep(nextMarketTier.stackPrice))
        : null;
    const floorDetail = depthRows.length === 1
        ? `Only one visible market price (${fmt(depthRows[0].quantity)} stack${depthRows[0].quantity === 1 ? '' : 's'}); no live range is established.`
        : referenceFloor
        ? describeReferenceFloor(referenceFloor, marketData)
        : marketData && roundedFloor
            ? 'Home Valley market reference for the selected stack size.'
        : ledgerLowStack
            ? 'Lowest matching active Ledger listing.'
            : 'No live market floor is available for this item and quality.';
    const displayFloorLabel = 'Market Reference';
    const floorListingCount = roundedFloor
        ? rawStackPrices.filter((stackPrice) => stackPrice === roundedFloor).length
        : 0;
    const profileConfig = COMPETITIVE_RISK_PROFILES[riskProfile] || COMPETITIVE_RISK_PROFILES.balanced;
    const wallCeilingPositions = { guarded: 0.45, balanced: 0.75, flexible: 1 };
    const wallSuggestedPositions = { guarded: 0.5, balanced: 0.65, flexible: 0.85 };
    let competitiveOption = staticCompetitiveOption;
    let suggestedOption = null;
    let referencePrice = roundedFloor;
    let evidenceType = roundedFloor ? 'market' : weightedOption ? 'sales' : 'none';
    const ownLowestStack = ledgerLowStack ? Math.round(ledgerLowStack) : null;

    if (roundedFloor && wallCeiling) {
        const opportunityWidth = wallCeiling - roundedFloor;
        competitiveOption = Math.round(roundedFloor + (opportunityWidth * wallCeilingPositions[riskProfile]));
        suggestedOption = Math.round(roundedFloor + ((competitiveOption - roundedFloor) * wallSuggestedPositions[riskProfile]));
    } else if (roundedFloor && competitiveOption) {
        suggestedOption = Math.round(roundedFloor + ((competitiveOption - roundedFloor) * profileConfig.suggestedPosition));
    } else if (weightedOption) {
        referencePrice = weightedOption;
        const salesCeiling = getCompetitiveCap(weightedOption, riskProfile);
        competitiveOption = salesCeiling;
        suggestedOption = Math.round(
            weightedOption + ((salesCeiling - weightedOption) * profileConfig.suggestedPosition)
        );
    } else if (ownLowestStack) {
        referencePrice = ownLowestStack;
        evidenceType = 'own-listing';
        suggestedOption = ownLowestStack;
        competitiveOption = getCompetitiveCap(ownLowestStack, riskProfile);
    }

    const momentumStrength = recentThirtyDaySales.length >= 6
        ? 0.2
        : recentThirtyDaySales.length >= 3
            ? 0.12
            : recentThirtyDaySales.length >= 1
                ? 0.05
                : 0;
    if (evidenceType === 'market' && suggestedOption && competitiveOption && momentumStrength > 0) {
        suggestedOption = Math.min(
            competitiveOption,
            suggestedOption + Math.max(1, Math.round((competitiveOption - (referencePrice || suggestedOption)) * momentumStrength))
        );
    }
    const isFloodedAtFloor = floorListingCount >= 10
        && visibleMarketSupply > 0
        && floorListingCount / visibleMarketSupply >= 0.4
        && (!(weightedOption > 0) || weightedOption <= roundedFloor)
        && !supportedNextTier;
    if (isFloodedAtFloor) suggestedOption = roundedFloor;

    const protectingOwnListing = ownLowestStack && suggestedOption && suggestedOption < ownLowestStack;
    if (protectingOwnListing) {
        suggestedOption = ownLowestStack;
        competitiveOption = Math.max(competitiveOption || ownLowestStack, ownLowestStack);
    }

    if (suggestedOption && competitiveOption) {
        const pricingSpan = Math.max(0, competitiveOption - (referencePrice || suggestedOption));
        const recommendationGap = Math.max(1, Math.round(pricingSpan * 0.1));
        if (suggestedOption >= competitiveOption) {
            if (ownLowestStack && ownLowestStack >= competitiveOption - recommendationGap) {
                suggestedOption = ownLowestStack;
                competitiveOption = ownLowestStack + recommendationGap;
            } else {
                suggestedOption = Math.max(
                    referencePrice || 1,
                    competitiveOption - recommendationGap
                );
            }
        }
    }

    currentPricingModel = {
        itemId: selectedItem.item_id,
        profile: riskProfile,
        floor: roundedFloor,
        referencePrice,
        evidenceType,
        suggested: suggestedOption,
        ceiling: competitiveOption,
        supportedWall: supportedNextTier ? nextMarketTier.stackPrice : null,
        wallCeiling,
        ownLowest: ownLowestStack,
        protectingOwnListing: !!protectingOwnListing,
        recentSalesCount: recentThirtyDaySales.length,
        weightedSales: weightedOption,
        flooded: isFloodedAtFloor,
        excludedLocalOutlier: isLocalFloorOutlier,
        noEvidence: evidenceType === 'none'
    };
    const primaryOptions = [
        {
            label: evidenceType === 'sales' ? 'Recent Sales Reference' : displayFloorLabel,
            value: evidenceType === 'sales' ? weightedOption : (roundedFloor || ledgerLowStack),
            detail: isLocalFloorOutlier
                ? `${fmt(rawRoundedFloor)}g local floor excluded as an outlier against ${fmt(recentThirtyDaySales.length)} recent matching sales.`
                : evidenceType === 'sales'
                    ? `Recency-weighted median from ${fmt(recentThirtyDaySales.length)} matching sales.`
                    : floorDetail,
            tone: 'floor',
            icon: 'fa-layer-group'
        },
        {
            label: 'Suggested Price',
            value: suggestedOption,
            detail: roundedFloor
                ? supportedNextTier
                    ? `A supported ${fmt(nextMarketTier.stackPrice)}g price wall creates room above the current floor.`
                : suggestedOption === roundedFloor && floorListingCount >= 10
                    ? 'Heavy supply at the floor favors matching the current market low.'
                    : 'Strategy-based recommendation, adjusted by market depth and recent sales.'
                : weightedOption
                    ? 'Recent Archives sales provide guidance while no live floor is available.'
                    : 'Requires live market or recent sales evidence.',
            tone: 'suggested',
            icon: 'fa-wand-magic-sparkles'
        },
        {
            label: 'Competitive Ceiling',
            value: competitiveOption,
            detail: supportedNextTier
                ? `${COMPETITIVE_RISK_PROFILES[riskProfile].label} ceiling below the supported ${fmt(nextMarketTier.stackPrice)}g wall.`
                : thresholds
                    ? `${thresholds.label}: up to +${fmt(thresholds.maxGapGold)}g / +${fmt(thresholds.maxGapPct)}%.`
                    : weightedOption
                        ? `${COMPETITIVE_RISK_PROFILES[riskProfile].label} ceiling above the recent-sales reference.`
                        : 'Requires a pricing reference.',
            tone: 'competitive',
            icon: 'fa-chart-line'
        }
    ];
    const comparisonRows = [
        { label: evidenceType === 'sales' ? 'Recent Sales Reference' : displayFloorLabel, value: evidenceType === 'sales' ? weightedOption : (roundedFloor || ledgerLowStack), tone: 'floor', color: '#38bdf8' },
        { label: 'Suggested', value: suggestedOption, tone: 'suggested', color: '#34d399' },
        { label: 'Competitive ceiling', value: competitiveOption, tone: 'competitive', color: '#fbbf24' },
        { label: 'Visible market high', value: hasMarketRange ? Math.max(...rawStackPrices) : null, tone: 'market-high', color: '#94a3b8' }
    ].filter((row) => Number(row.value) > 0);
    const comparisonValues = [
        ...comparisonRows.map((row) => Number(row.value) || 0),
        ...(price > 0 ? [price] : [])
    ];
    const comparisonMin = comparisonRows.length
        ? Math.min(...comparisonValues)
        : 0;
    const comparisonMax = Math.max(...comparisonValues, 1);
    const comparisonSpan = Math.max(comparisonMax - comparisonMin, 1);
    comparisonRows.forEach((row) => {
        row.position = 5 + (((Number(row.value) - comparisonMin) / comparisonSpan) * 90);
        row.edgeClass = row.position <= 12
            ? 'edge-start'
            : row.position >= 88
                ? 'edge-end'
                : '';
    });
    const selectedPricePosition = price > 0
        ? 5 + (((price - comparisonMin) / comparisonSpan) * 90)
        : null;

    if (summaryTarget) {
        summaryTarget.innerHTML = `
        <div class="listing-overview-heading">
            <div>
                <p class="listing-workbench-section-label">Pricing decision</p>
                <h3>Choose how you want to enter the market</h3>
            </div>
        </div>
        <div class="listing-overview-primary">
            ${primaryOptions.map((option) => `
                <article class="listing-overview-price-card listing-overview-price-card-${option.tone}">
                    <div class="listing-overview-price-card-heading">
                        <div class="listing-overview-price-icon"><i class="fas ${option.icon}"></i></div>
                        <span>${escapeHtml(option.label)}</span>
                    </div>
                    <strong>${Number(option.value) > 0 ? `${fmt(option.value)}g` : '--'}</strong>
                    <small>${escapeHtml(option.detail)}</small>
                    ${Number(option.value) > 0
                        ? `<button type="button" data-suggested-price="${Math.round(option.value)}">Use ${fmt(option.value)}g</button>`
                        : '<button type="button" disabled>Unavailable</button>'}
                </article>
            `).join('')}
        </div>
        `;
    }

    target.innerHTML = `
        <div class="listing-overview-context listing-overview-context-condensed">
            <section class="listing-overview-visuals listing-market-landscape">
                <div class="listing-overview-market-depth-header">
                    <div>
                        <h4>Market Pricing Landscape</h4>
                        <p>Signals show the unified pricing range. Enter a price to compare your listing.</p>
                    </div>
                </div>
                ${comparisonRows.length ? `
                    <div class="listing-market-landscape-chart"
                         role="img"
                        aria-label="Market depth and price signals from ${fmt(comparisonMin)}g to ${fmt(comparisonMax)}g">
                        <div class="listing-market-landscape-track"></div>
                        <output class="listing-market-slider-output ${price > 0 ? 'is-visible' : ''}"
                                style="--point-position:${selectedPricePosition?.toFixed(2) || 5}%"
                                data-workbench-slider-output>
                            Your price <strong>${price > 0 ? `${fmt(price)}g` : ''}</strong>
                        </output>
                        ${comparisonRows.map((row) => `
                            <span class="listing-market-signal listing-market-signal-${row.tone} ${row.edgeClass}"
                                  style="--point-position:${row.position.toFixed(2)}%; --signal-color:${row.color};"
                                  title="${escapeHtml(row.label)}: ${fmt(row.value)}g"
                                aria-label="${escapeHtml(row.label)}: ${fmt(row.value)}g">
                                <span class="listing-market-signal-dot"></span>
                                <span class="listing-market-signal-label">
                                    ${escapeHtml(row.label)}
                                    <strong>${fmt(row.value)}g</strong>
                                </span>
                            </span>
                        `).join('')}
                        <span class="listing-market-axis-start">${fmt(comparisonMin)}g</span>
                        <span class="listing-market-axis-end">${fmt(comparisonMax)}g</span>
                    </div>
                    <div class="listing-market-depth-table-wrap">
                        <table class="listing-market-depth-table">
                            <thead>
                                <tr><th>Price</th><th>Visible stacks</th><th>Market share</th><th>Signal</th></tr>
                            </thead>
                            <tbody>
                                ${depthRows.map((row) => {
                                    const signals = comparisonRows
                                        .filter((signal) => signal.value === row.stackPrice)
                                        .map((signal) => signal.label)
                                        .join(', ');
                                    return `<tr>
                                        <td>${fmt(row.stackPrice)}g</td>
                                        <td>${fmt(row.quantity)}</td>
                                        <td>${visibleMarketSupply ? fmt((row.quantity / visibleMarketSupply) * 100) : 0}%</td>
                                        <td>${escapeHtml(signals || (supportedNextTier && row.stackPrice === nextMarketTier.stackPrice ? 'Supported wall' : 'Market listing'))}</td>
                                    </tr>`;
                                }).join('')}
                                ${comparisonRows.filter((signal) => !depthRows.some((row) => row.stackPrice === signal.value)).map((signal) => `
                                    <tr class="is-signal">
                                        <td>${fmt(signal.value)}g</td><td>—</td><td>—</td><td>${escapeHtml(signal.label)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                ` : `<div class="listing-workbench-empty">${hasCount
                    ? 'No pricing signals are available for this item and quality.'
                    : 'Enter items per stack to build the market pricing landscape.'}</div>`}
            </section>
        </div>
    `;
}

function attachWorkbenchPriceButtons(root = document) {
    root.querySelectorAll('[data-suggested-price]').forEach((button) => {
        if (button.dataset.workbenchPriceWired === 'true') return;
        button.dataset.workbenchPriceWired = 'true';
        button.addEventListener('click', () => {
            const priceInput = document.getElementById('modal-item-price-per-stack');
            const value = parseInt(button.getAttribute('data-suggested-price'), 10);
            if (priceInput && Number.isFinite(value)) {
                priceInput.value = value;
                priceInput.dispatchEvent(new Event('input'));
            }
        });
    });
}

function renderCompetitivePricing({ selectedItem, formState }) {
    const target = document.getElementById('workbench-competitive-pricing');
    if (!target) return;
    if (!selectedItem || !currentPricingModel) {
        return renderEmpty(target, 'Select an item to calculate unified pricing guidance.');
    }

    const model = currentPricingModel;
    const profileLabel = COMPETITIVE_RISK_PROFILES[model.profile]?.label || model.profile;
    const referenceValue = model.floor || model.referencePrice;
    const evidenceDescription = model.supportedWall
        ? `${fmt(model.supportedWall)}g is supported by visible listing depth and helps define the upper opportunity.`
        : model.evidenceType === 'own-listing'
            ? `Your active ${fmt(model.ownLowest)}g listing is the protected reference; guidance will not undercut it automatically.`
            : model.noEvidence
                ? 'No live market price, active listing, or sales history is available, so no price is recommended.'
                : 'No supported price wall is visible, so guidance uses the strongest available market or sales reference.';
    target.innerHTML = `
        <div class="workbench-unified-pricing">
            <div class="competitive-section-heading">
                <div>
                    <p class="listing-workbench-section-label">Unified recommendation</p>
                    <h3>Current strategy output</h3>
                </div>
            </div>
            <div class="workbench-unified-pricing-grid">
                <article><span>Pricing reference</span><strong>${model.referencePrice ? `${fmt(model.referencePrice)}g` : 'Unavailable'}</strong></article>
                <article><span>Suggested price</span><strong>${model.suggested ? `${fmt(model.suggested)}g` : 'Unavailable'}</strong></article>
                <article><span>Competitive ceiling</span><strong>${model.ceiling ? `${fmt(model.ceiling)}g` : 'Unavailable'}</strong></article>
            </div>
            <div class="workbench-strategy-explainer">
                <article>
                    <span>How this strategy behaves</span>
                    <h4>${escapeHtml(profileLabel)} applies one unified evidence model</h4>
                    <p>${escapeHtml(evidenceDescription)}</p>
                </article>
                <article>
                    <span>Worked output</span>
                    <h4>${referenceValue ? `${fmt(referenceValue)}g reference → ${model.suggested ? `${fmt(model.suggested)}g suggested` : 'no suggestion'} → ${model.ceiling ? `${fmt(model.ceiling)}g ceiling` : 'no ceiling'}` : 'No supported pricing path yet'}</h4>
                    <p>The tolerance changes both Suggested Price and Competitive Ceiling while preserving your active price.</p>
                </article>
                <article>
                    <span>30-day sales momentum</span>
                    <h4>${model.recentSalesCount ? `${fmt(model.recentSalesCount)} recent sale${model.recentSalesCount === 1 ? '' : 's'}` : 'No recent sales'}</h4>
                    <p>${model.recentSalesCount ? `Recent demand can support a measured increase${model.weightedSales ? ` from the ${fmt(model.weightedSales)}g weighted baseline` : ''}.` : 'The model does not add a demand premium without recent sales.'}</p>
                </article>
                <article>
                    <span>Active-listing protection</span>
                    <h4>${model.ownLowest ? `${fmt(model.ownLowest)}g protected` : 'No matching active listing'}</h4>
                    <p>${model.ownLowest ? 'Suggestions will match or exceed your lowest active listing unless you deliberately enter a lower price.' : 'No existing listing needs undercut protection.'}</p>
                </article>
            </div>
        </div>
    `;
}

function renderCompetitivePricingLegacy({ selectedItem, marketData, referenceFloor, historyData, activeListings, salesRows, formState }) {
    const target = document.getElementById('workbench-competitive-pricing');
    if (!target) return;
    if (!selectedItem) {
        return renderEmpty(target, 'Select an item to inspect competitive pricing.');
    }

    const { count, price, stacks } = formState;
    const stackCount = count > 0 ? count : null;
    const riskProfile = getCompetitiveRiskTolerance();
    const riskProfileConfig = COMPETITIVE_RISK_PROFILES[riskProfile] || COMPETITIVE_RISK_PROFILES.balanced;
    const stackFloor = marketData && count > 0
        ? Math.round(marketData.marketLow * count)
        : referenceFloor?.value || null;
    const thresholds = stackFloor ? getCompetitiveThresholds(stackFloor, riskProfile) : null;
    const cap = thresholds ? getCompetitiveCap(stackFloor, riskProfile) : null;
    const enteredGap = price > 0 && stackFloor ? price - stackFloor : null;
    const enteredGapPct = enteredGap !== null && stackFloor > 0 ? Math.round((enteredGap / stackFloor) * 100) : null;
    const enteredStatus = enteredGap !== null
        ? classifyCompetitiveGap(enteredGap, enteredGapPct, stackFloor, 'leading', riskProfile).status
        : null;
    const weightedStack = count > 0
        ? weightedAverage(salesRows, (sale) => getNormalizedSaleStackValue(sale, count), (sale) => sale.sale_date)
        : null;
    const recentRows = salesRows.filter((sale) => {
        const date = new Date(sale.sale_date).getTime();
        return Number.isFinite(date) && (Date.now() - date) / 864e5 <= 30;
    });
    const recentAvgStack = recentRows.length
        ? recentRows.reduce((sum, sale) => sum + (Number(getNormalizedSaleStackValue(sale, count)) || 0), 0) / recentRows.length
        : null;
    const ledgerFloor = activeListings.length
        ? Math.min(...activeListings.map((listing) => Number(listing.total_listed_price) || Infinity))
        : null;
    const weightedOption = weightedStack ? Math.round(weightedStack) : null;
    const recentOption = recentAvgStack ? Math.round(recentAvgStack) : null;
    const capOption = cap || null;
    const floorOption = stackFloor || ledgerFloor || null;
    const options = [
        {
            label: 'Floor Hold',
            value: floorOption,
            detail: 'Match the lowest useful floor without chasing below it.'
        },
        {
            label: 'Weighted Avg',
            value: weightedOption,
            detail: `Recent sales weighted and normalized to ${fmt(stackCount)} count.`
        },
        {
            label: 'Recent 30 Day',
            value: recentOption,
            detail: 'Uses the last 30 days only when available.'
        },
        {
            label: 'Competitive Cap',
            value: capOption,
            detail: 'Top of the current competitive band.'
        }
    ].filter((option) => Number.isFinite(option.value) && option.value > 0);

    target.innerHTML = `
        <div class="competitive-section-heading">
            <div>
                <span>Recommendations</span>
                <h3>Competitive pricing</h3>
            </div>
            <p>${escapeHtml(riskProfileConfig.label)} profile${thresholds ? ` · +${fmt(thresholds.maxGapGold)}g / ${fmt(thresholds.maxGapPct)}% band` : ''}</p>
        </div>
        <div class="competitive-price-options">
            ${options.map((option) => `
                <div class="competitive-option-card">
                    <span>${escapeHtml(option.label)}</span>
                    <small>${escapeHtml(option.detail)}</small>
                    <strong>${fmt(option.value)}g</strong>
                    <button type="button" data-suggested-price="${Math.round(option.value)}">Use</button>
                </div>
            `).join('') || '<div class="listing-workbench-empty">Enter stack count and select an item to calculate competitive options.</div>'}
        </div>
        <div class="listing-pricing-card mt-3">
            <div class="listing-pricing-card-header">
                <h4>Price Read</h4>
                <span>${qualityLabel(formState.isMastercrafted, formState.enchantmentTier)}</span>
            </div>
            <div class="competitive-read">
                <p>${stackFloor ? `Floor ${fmt(stackFloor)}g · Competitive cap ${cap ? `${fmt(cap)}g` : '--'} · ${fmt(stackCount)} count stack.` : 'No market floor is available for this item and quality yet.'}</p>
                <p>${weightedStack ? `Recent weighted sales: ${fmt(weightedStack)}g. All-time average: ${historyData?.avgPerStack ? `${fmt(historyData.avgPerStack)}g` : '--'}.` : 'Not enough sales history for weighted guidance.'}</p>
            </div>
        </div>
    `;
}

function renderConfig({ selectedItem }) {
    const target = document.getElementById('workbench-config');
    if (!target) return;
    const currentProfile = getCompetitiveRiskTolerance();

    target.innerHTML = `
        <div class="workbench-strategy-selector">
            <div class="workbench-strategy-heading">
                <div>
                    <span>Pricing tolerance</span>
                    <h3>Choose your pricing strategy</h3>
                </div>
            </div>
            <div class="workbench-risk-toggle" role="radiogroup" aria-label="Pricing strategy">
                ${Object.entries(COMPETITIVE_RISK_PROFILES).map(([key, profile]) => `
                    <button type="button"
                            class="workbench-risk-option ${key === currentProfile ? 'active' : ''}"
                            role="radio"
                            aria-checked="${key === currentProfile ? 'true' : 'false'}"
                            data-risk-profile="${escapeHtml(key)}">
                        <strong>${escapeHtml(profile.label)}</strong>
                        <span>${escapeHtml(profile.description)}</span>
                        <span class="workbench-risk-check" aria-hidden="true">✓</span>
                    </button>
                `).join('')}
            </div>
        </div>
    `;
}

function renderConfigLegacyCompact({ selectedItem, marketData, referenceFloor, formState }) {
    const target = document.getElementById('workbench-config');
    if (!target) return;

    const currentProfile = getCompetitiveRiskTolerance();
    const hasCount = Number(formState.count) > 0;
    const stackFloor = marketData && formState.count > 0
        ? Math.round(marketData.marketLow * formState.count)
        : referenceFloor?.value || null;
    const thresholds = stackFloor ? getCompetitiveThresholds(stackFloor, currentProfile) : null;
    const staticCompetitiveCap = stackFloor ? getCompetitiveCap(stackFloor, currentProfile) : null;
    const zoneListings = selectedItem && hasCount ? getZoneListingsForItemByQuality(
        selectedItem.pax_dei_slug,
        selectedItem.item_name,
        formState.isMastercrafted,
        formState.enchantmentTier
    ) : [];
    const strategyDepth = new Map();
    zoneListings.forEach((listing) => {
        const listingPrice = Number(listing.price) || 0;
        const listingQuantity = Math.max(Number(listing.quantity) || 1, 1);
        const normalizedPrice = Math.round((listingPrice / listingQuantity) * formState.count);
        if (normalizedPrice > 0) {
            strategyDepth.set(normalizedPrice, (strategyDepth.get(normalizedPrice) || 0) + 1);
        }
    });
    const strategyDepthRows = Array.from(strategyDepth, ([price, quantity]) => ({ price, quantity }))
        .sort((a, b) => a.price - b.price);
    const strategyFloorDepth = strategyDepth.get(stackFloor) || 0;
    const strategyNextTier = strategyDepthRows.find((row) => row.price > stackFloor);
    const strategyOpportunity = strategyNextTier
        && strategyNextTier.quantity >= Math.max(2, Math.ceil(strategyFloorDepth * 0.75))
        && strategyNextTier.price > staticCompetitiveCap;
    const competitiveCap = strategyOpportunity
        ? strategyNextTier.price - getMarketUndercutStep(strategyNextTier.price)
        : staticCompetitiveCap;

    target.innerHTML = `
        <div class="workbench-strategy-selector">
            <div class="workbench-strategy-heading">
                <div>
                    <span>Competitive tolerance</span>
                    <h3>Choose your pricing strategy</h3>
                </div>
                <p>Controls how far recommendations may move above the current floor.</p>
            </div>
            <div class="workbench-risk-toggle" role="radiogroup" aria-label="Competitive price risk tolerance">
                ${Object.entries(COMPETITIVE_RISK_PROFILES).map(([key, profile]) => `
                    <button type="button"
                            class="workbench-risk-option ${key === currentProfile ? 'active' : ''}"
                            role="radio"
                            aria-checked="${key === currentProfile ? 'true' : 'false'}"
                            data-risk-profile="${escapeHtml(key)}">
                        <strong>${escapeHtml(profile.label)}</strong>
                        <span>${escapeHtml(profile.description)}</span>
                    </button>
                `).join('')}
            </div>
            ${!selectedItem ? `
                <div class="workbench-strategy-status workbench-strategy-status-guidance">
                    Select an item to calculate competitive pricing.
                </div>
            ` : !hasCount ? `
                <div class="workbench-strategy-status workbench-strategy-status-guidance">
                    Enter the number of items per stack to calculate its market floor and competitive range.
                </div>
            ` : !stackFloor ? `
                <div class="workbench-strategy-status workbench-strategy-status-guidance">
                    No live market floor is available for this item and quality. Sales-based recommendations remain available below.
                </div>
            ` : `
                <div class="workbench-strategy-status">
                    <span><strong>${escapeHtml(COMPETITIVE_RISK_PROFILES[currentProfile]?.label || currentProfile)}</strong> strategy</span>
                    <span>Floor <strong>${fmt(stackFloor)}g</strong></span>
                    ${strategyOpportunity ? `<span>Supported wall <strong>${fmt(strategyNextTier.price)}g</strong></span>` : ''}
                    <span>Competitive range <strong>${fmt(stackFloor)}–${fmt(competitiveCap)}g</strong></span>
                </div>
            `}
        </div>
    `;
}

function renderConfigLegacyDetailed({ selectedItem, marketData, referenceFloor, activeListings = [], salesRows = [], formState }) {
    const target = document.getElementById('workbench-config');
    if (!target) return;

    const currentProfile = getCompetitiveRiskTolerance();
    const zoneListings = selectedItem ? getZoneListingsForItemByQuality(
        selectedItem.pax_dei_slug,
        selectedItem.item_name,
        formState.isMastercrafted,
        formState.enchantmentTier
    ) : [];
    const exactStackPrices = zoneListings
        .filter((listing) => Math.max(Number(listing.quantity) || 1, 1) === formState.count)
        .map((listing) => Math.round(Number(listing.price) || 0))
        .filter((price) => price > 0)
        .sort((a, b) => a - b);
    const anyStackPrices = zoneListings
        .map((listing) => {
            const quantity = Math.max(Number(listing.quantity) || 1, 1);
            const price = Number(listing.price) || 0;
            return formState.count > 0 ? Math.round((price / quantity) * formState.count) : 0;
        })
        .filter((price) => price > 0)
        .sort((a, b) => a - b);
    const ledgerExactPrices = activeListings
        .filter((listing) => Math.max(Number(listing.quantity_listed) || 1, 1) === formState.count)
        .map((listing) => Math.round(Number(listing.total_listed_price) || 0))
        .filter((price) => price > 0)
        .sort((a, b) => a - b);
    const ledgerAnyPrices = activeListings
        .map((listing) => {
            const quantity = Math.max(Number(listing.quantity_listed) || 1, 1);
            const price = Number(listing.total_listed_price) || 0;
            return formState.count > 0 ? Math.round((price / quantity) * formState.count) : 0;
        })
        .filter((price) => price > 0)
        .sort((a, b) => a - b);
    const weightedSalesFloor = weightedAverage(salesRows, (sale) => {
        const quantity = Math.max(Number(sale.quantity_sold) || 1, 1);
        const total = Number(sale.total_sale_price) || 0;
        return formState.count > 0 ? (total / quantity) * formState.count : 0;
    }, (sale) => sale.sale_date);
    const stackFloor = marketData && formState.count > 0
        ? Math.round(marketData.marketLow * formState.count)
        : referenceFloor?.value
            || exactStackPrices[0]
            || anyStackPrices[0]
            || ledgerExactPrices[0]
            || ledgerAnyPrices[0]
            || (weightedSalesFloor ? Math.round(weightedSalesFloor) : null);
    const stackFloorSource = marketData
        ? 'Live item summary'
        : referenceFloor
            ? describeReferenceFloor(referenceFloor, marketData)
            : exactStackPrices.length
            ? 'Home Valley exact stack feed'
            : anyStackPrices.length
                ? 'Home Valley adjusted stack estimate'
                : ledgerExactPrices.length
                    ? 'Archives exact stack listing'
                    : ledgerAnyPrices.length
                        ? 'Archives active listing estimate'
                        : weightedSalesFloor
                            ? 'Archives weighted sales estimate'
                            : 'No live or Archives floor';
    const thresholds = stackFloor ? getCompetitiveThresholds(stackFloor, currentProfile) : null;
    const competitiveCap = stackFloor ? getCompetitiveCap(stackFloor, currentProfile) : null;
    const selectedGap = stackFloor && formState.price > 0 ? formState.price - stackFloor : null;
    const selectedGapPct = selectedGap !== null && stackFloor > 0
        ? Math.round((selectedGap / stackFloor) * 100)
        : null;
    const selectedStatus = selectedGap !== null
        ? classifyCompetitiveGap(selectedGap, selectedGapPct, stackFloor, 'leading', currentProfile).status
        : null;
    const statusLabels = {
        leading: 'Below market',
        competitive: 'Competitive',
        undercut: 'Above market'
    };
    const statusClasses = {
        leading: 'text-blue-300',
        competitive: 'text-emerald-300',
        undercut: 'text-rose-300'
    };
    const dynamicExamples = stackFloor && competitiveCap
        ? [
            stackFloor > 1
                ? {
                    label: 'Below market',
                    price: stackFloor - 1,
                    status: classifyCompetitiveGap(-1, Math.round((-1 / stackFloor) * 100), stackFloor, 'leading', currentProfile).status
                }
                : null,
            {
                label: 'Competitive ceiling',
                price: competitiveCap,
                status: classifyCompetitiveGap(
                    competitiveCap - stackFloor,
                    Math.round(((competitiveCap - stackFloor) / stackFloor) * 100),
                    stackFloor,
                    'leading',
                    currentProfile
                ).status
            },
            {
                label: 'First above-market price',
                price: competitiveCap + 1,
                status: classifyCompetitiveGap(
                    competitiveCap + 1 - stackFloor,
                    Math.round(((competitiveCap + 1 - stackFloor) / stackFloor) * 100),
                    stackFloor,
                    'leading',
                    currentProfile
                ).status
            }
        ].filter(Boolean)
        : [];

    target.innerHTML = `
        <div class="workbench-config-shell">
            <div class="workbench-config-copy">
                <span>Pricing model</span>
                <h4>Pricing Strategy</h4>
                <p>Choose where the suggested price sits between the current market low and competitive ceiling. Recent sales can nudge the recommendation upward, while concentrated supply at the floor can pull it back.</p>
            </div>
            <div class="workbench-risk-toggle" role="radiogroup" aria-label="Competitive price risk tolerance">
                ${Object.entries(COMPETITIVE_RISK_PROFILES).map(([key, profile]) => `
                    <button type="button"
                            class="workbench-risk-option ${key === currentProfile ? 'active' : ''}"
                            role="radio"
                            aria-checked="${key === currentProfile ? 'true' : 'false'}"
                            data-risk-profile="${escapeHtml(key)}">
                        <strong>${escapeHtml(profile.label)}</strong>
                        <span>${escapeHtml(profile.description)}</span>
                    </button>
                `).join('')}
            </div>
            <div class="workbench-config-read">
                <div>
                    <span>Current item</span>
                    <strong>${selectedItem ? escapeHtml(selectedItem.item_name) : 'Select an item'}</strong>
                </div>
                <div>
                    <span>Stack floor</span>
                    <strong>${stackFloor ? `${fmt(stackFloor)}g` : '--'}</strong>
                    <small>${escapeHtml(stackFloorSource)}</small>
                </div>
                <div>
                    <span>Allowed band</span>
                    <strong>${thresholds ? `+${fmt(thresholds.maxGapGold)}g / ${fmt(thresholds.maxGapPct)}%` : '--'}</strong>
                </div>
                <div>
                    <span>Competitive ceiling</span>
                    <strong>${competitiveCap ? `${fmt(competitiveCap)}g` : '--'}</strong>
                    <small>${competitiveCap && stackFloor ? `Effective +${fmt(competitiveCap - stackFloor)}g; the lower of the gold and percentage limits wins.` : ''}</small>
                </div>
            </div>
            <div class="pricing-judgment-grid">
                <div class="pricing-judgment-card">
                    <span>How pricing is judged</span>
                    <h4>Both limits must pass</h4>
                    <p>Archives first resolves the best stack-size-aware floor for the selected item and quality. A price is competitive only when both its gold gap and percentage gap remain inside the selected tolerance.</p>
                    <ul>
                        ${getCompetitiveBandDisplayRows().map(row => `<li>${escapeHtml(row)}</li>`).join('')}
                    </ul>
                </div>
                <div class="pricing-judgment-card">
                    <span>Current selection</span>
                    <h4>${selectedItem ? `${escapeHtml(selectedItem.item_name)} · ${fmt(formState.count || 0)} count` : 'Select an item and stack size'}</h4>
                    ${selectedStatus
                        ? `<p>Your ${fmt(formState.price)}g price is <strong class="${statusClasses[selectedStatus]}">${statusLabels[selectedStatus]}</strong> against a ${fmt(stackFloor)}g floor: ${selectedGap > 0 ? '+' : ''}${fmt(selectedGap)}g (${selectedGapPct > 0 ? '+' : ''}${fmt(selectedGapPct)}%).</p>`
                        : '<p>Enter a price to see the exact classification, gap, and active tolerance applied to this listing.</p>'}
                    <p class="mt-2">Quality: <strong>${escapeHtml(qualityLabel(formState.isMastercrafted, formState.enchantmentTier))}</strong>. Profile: <strong>${escapeHtml(COMPETITIVE_RISK_PROFILES[currentProfile]?.label || currentProfile)}</strong>.</p>
                </div>
            </div>
            <div class="pricing-dynamic-examples">
                ${dynamicExamples.map(example => `
                    <div>
                        <span>${escapeHtml(example.label)}</span>
                        <strong>${fmt(example.price)}g</strong>
                        <small class="${statusClasses[example.status]}">${statusLabels[example.status]}</small>
                    </div>
                `).join('') || '<div class="listing-workbench-empty">Select an item and stack size to generate live examples from its current floor.</div>'}
            </div>
        </div>
    `;
}

function renderActiveListings({ selectedItem, activeListings, formState }) {
    lastActiveListingsArgs = { selectedItem, activeListings, formState };
    const target = document.getElementById('workbench-active-listings');
    if (!target) return;
    if (!selectedItem) return renderEmpty(target, 'Select an item to compare active listings.');

    const zoneListings = getZoneListingsForItemByQuality(
        selectedItem.pax_dei_slug,
        selectedItem.item_name,
        formState.isMastercrafted,
        formState.enchantmentTier
    );
    const avatarHash = getSavedAvatarHash();
    const ledgerFeedCounts = new Map();
    zoneListings.forEach((listing) => {
        if (avatarHash && listing.avatar_hash !== avatarHash) return;
        const sig = listingSignature(listing.quantity || 1, Number(listing.price) || 0);
        ledgerFeedCounts.set(sig, (ledgerFeedCounts.get(sig) || 0) + 1);
    });

    const ledgerRows = activeListings.map((listing) => {
        const quantity = Number(listing.quantity_listed) || 0;
        const stackPrice = Number(listing.total_listed_price) || 0;
        const sig = listingSignature(quantity, stackPrice);
        const feedCount = ledgerFeedCounts.get(sig) || 0;
        if (feedCount > 0) ledgerFeedCounts.set(sig, feedCount - 1);
        return {
            source: feedCount > 0 ? 'Your Ledger - feed matched' : 'Your Ledger',
            quantity,
            stackPrice,
            unitPrice: Number(listing.listed_price_per_unit) || 0,
            age: relativeDate(listing.listing_date),
            isLedger: true
        };
    });

    const duplicateCounts = new Map();
    ledgerRows.forEach((row) => {
        const sig = listingSignature(row.quantity, row.stackPrice);
        duplicateCounts.set(sig, (duplicateCounts.get(sig) || 0) + 1);
    });

    const externalRows = zoneListings
        .slice()
        .sort((a, b) => (a.price / Math.max(a.quantity || 1, 1)) - (b.price / Math.max(b.quantity || 1, 1)))
        .filter((listing) => {
            const sig = listingSignature(listing.quantity || 1, Number(listing.price) || 0);
            const duplicateCount = duplicateCounts.get(sig) || 0;
            if (duplicateCount > 0) {
                duplicateCounts.set(sig, duplicateCount - 1);
                return false;
            }
            return true;
        })
        .slice(0, 18)
        .map((listing) => ({
            source: listing.avatar_hash && listing.avatar_hash === avatarHash ? 'You - market feed' : 'Market feed',
            quantity: listing.quantity || 1,
            stackPrice: Number(listing.price) || 0,
            unitPrice: (Number(listing.price) || 0) / Math.max(Number(listing.quantity) || 1, 1),
            age: '--',
            isLedger: false
        }));

    const rows = [...ledgerRows, ...externalRows]
        .sort((a, b) => a.unitPrice - b.unitPrice)
        .slice(0, 30);

    if (!rows.length) return renderEmpty(target, 'No active listings were found for this item and quality.');
    const pageCount = Math.ceil(rows.length / WORKBENCH_TABLE_PAGE_SIZE);
    activeListingsPage = Math.min(activeListingsPage, pageCount - 1);
    const visibleRows = rows.slice(
        activeListingsPage * WORKBENCH_TABLE_PAGE_SIZE,
        activeListingsPage * WORKBENCH_TABLE_PAGE_SIZE + WORKBENCH_TABLE_PAGE_SIZE
    );

    target.innerHTML = `
        <div class="listing-data-table-scroll">
            <table class="listing-workbench-table">
                <thead>
                    <tr>
                        <th>Source</th>
                        <th>Stack</th>
                        <th>Stack Price</th>
                        <th>Age</th>
                    </tr>
                </thead>
                <tbody>
                    ${visibleRows.map((row) => `
                        <tr>
                            <td>${escapeHtml(row.source)}${row.source.includes('feed matched') ? ' <span class="listing-feed-pill">Feed</span>' : ''}</td>
                            <td>${fmt(row.quantity)}</td>
                            <td class="text-emerald-300 font-bold">${fmt(row.stackPrice)}g</td>
                            <td>${escapeHtml(row.age)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        ${renderTablePagination('active', activeListingsPage, pageCount, rows.length)}
    `;
}

function renderSalesHistory({ selectedItem, historyData, salesRows }) {
    lastSalesHistoryArgs = { selectedItem, historyData, salesRows };
    const target = document.getElementById('workbench-sales-history');
    if (!target) return;
    if (!selectedItem) return renderEmpty(target, 'Select an item to view sales history.');
    if (!salesRows.length) return renderEmpty(target, 'No sales history found for this item yet.');
    const pageCount = Math.ceil(salesRows.length / WORKBENCH_TABLE_PAGE_SIZE);
    salesHistoryPage = Math.min(salesHistoryPage, pageCount - 1);
    const visibleRows = salesRows.slice(
        salesHistoryPage * WORKBENCH_TABLE_PAGE_SIZE,
        salesHistoryPage * WORKBENCH_TABLE_PAGE_SIZE + WORKBENCH_TABLE_PAGE_SIZE
    );

    target.innerHTML = `
        <div class="listing-data-table-scroll">
            <table class="listing-workbench-table">
                <thead>
                    <tr>
                        <th>Sold</th>
                        <th>Stack</th>
                        <th>Stack Price</th>
                        <th>Quality</th>
                    </tr>
                </thead>
                <tbody>
                    ${visibleRows.map((sale) => {
                        const listing = Array.isArray(sale.market_listings) ? sale.market_listings[0] : (sale.market_listings || {});
                        return `
                            <tr>
                                <td>${escapeHtml(relativeDate(sale.sale_date))} ago</td>
                                <td>${fmt(sale.quantity_sold)}</td>
                                <td class="text-emerald-300 font-bold">${fmt(sale.total_sale_price)}g</td>
                                <td>${escapeHtml(qualityLabel(!!listing.is_mastercrafted, listing.enchantment_tier || 0))}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
        ${renderTablePagination('sales', salesHistoryPage, pageCount, salesRows.length)}
    `;
}

async function refreshWorkbench(selectedItem) {
    const formState = getFormState();
    const loadingEls = [
        document.getElementById('workbench-active-listings'),
        document.getElementById('workbench-sales-history')
    ].filter(Boolean);

    if (!selectedItem) {
        renderPricingSummary({ selectedItem: null, marketData: null, referenceFloor: null, historyData: null, activeListings: [], formState });
        renderPricingVisuals({ selectedItem: null, marketData: null, referenceFloor: null, historyData: null, activeListings: [], salesRows: [], formState });
        renderCompetitivePricing({ selectedItem: null, marketData: null, referenceFloor: null, historyData: null, activeListings: [], salesRows: [], formState });
        renderConfig({ selectedItem: null, marketData: null, referenceFloor: null, activeListings: [], salesRows: [], formState });
        loadingEls.forEach((el) => renderEmpty(el, 'Select an item to populate this tab.'));
        return;
    }

    loadingEls.forEach((el) => {
        el.innerHTML = '<div class="listing-workbench-empty">Loading real listing data...</div>';
    });

    const [historyData, activeListings, salesRows] = await Promise.all([
        fetchItemSalesHistoryForListing({ supabase, currentCharacterId, itemId: selectedItem.item_id }),
        fetchActiveListingsForListing({ supabase, currentCharacterId, itemId: selectedItem.item_id }),
        fetchRecentSalesRows(selectedItem.item_id)
    ]);
    const marketData = computeMarketData(selectedItem, formState.isMastercrafted, formState.enchantmentTier);
    const referenceFloor = computeReferenceFloor({ selectedItem, marketData, formState });
    const qualitySalesRows = filterSalesRowsByQuality(salesRows, formState.isMastercrafted, formState.enchantmentTier);
    const qualityHistoryData = buildHistoryDataFromSales(qualitySalesRows);

    const qualityActiveListings = filterLedgerListingsByQuality(
        activeListings,
        formState.isMastercrafted,
        formState.enchantmentTier
    );

    renderPricingVisuals({ selectedItem, marketData, referenceFloor, historyData: qualityHistoryData, activeListings: qualityActiveListings, salesRows: qualitySalesRows, formState });
    renderPricingSummary({ selectedItem, marketData, referenceFloor, historyData: qualityHistoryData, activeListings: qualityActiveListings, formState });
    renderCompetitivePricing({ selectedItem, marketData, referenceFloor, historyData: qualityHistoryData, activeListings: qualityActiveListings, salesRows: qualitySalesRows, formState });
    renderConfig({ selectedItem, marketData, referenceFloor, activeListings: qualityActiveListings, salesRows: qualitySalesRows, formState });
    attachWorkbenchPriceButtons(document.getElementById('guidedListingWorkbench') || document);
    renderActiveListings({ selectedItem, activeListings: qualityActiveListings, formState });
    renderSalesHistory({ selectedItem, historyData: qualityHistoryData, salesRows: qualitySalesRows });
}

export function initializeGuidedListingWorkbench() {
    const root = document.getElementById('guidedListingWorkbench');
    if (!root) return;
    const modal = document.getElementById('addListingModal');

    let selectedItem = getSelectedItemFromInput();
    let debounceTimer = null;
    const scheduleRefresh = () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            selectedItem = selectedItem || getSelectedItemFromInput();
            refreshWorkbench(selectedItem);
        }, 120);
    };

    document.querySelectorAll('.listing-workbench-tab').forEach((button) => {
        button.addEventListener('click', () => {
            const tab = button.dataset.workbenchTab;
            document.querySelectorAll('.listing-workbench-tab').forEach((btn) => {
                btn.classList.toggle('active', btn === button);
            });
            document.querySelectorAll('[data-workbench-panel]').forEach((panel) => {
                panel.classList.toggle('hidden', panel.dataset.workbenchPanel !== tab);
            });
        });
    });

    document.addEventListener('pda:item-selected', (event) => {
        if (event.detail?.inputId !== 'modal-item-name') return;
        selectedItem = event.detail.item;
        const priceInput = document.getElementById('modal-item-price-per-stack');
        if (priceInput) priceInput.value = '';
        activeListingsPage = 0;
        salesHistoryPage = 0;
        refreshWorkbench(selectedItem);
    });

    root.addEventListener('click', (event) => {
        const pageButton = event.target.closest('[data-listing-table][data-listing-page]');
        if (!pageButton || pageButton.disabled) return;
        const page = Math.max(0, Number(pageButton.dataset.listingPage) || 0);
        if (pageButton.dataset.listingTable === 'active' && lastActiveListingsArgs) {
            activeListingsPage = page;
            renderActiveListings(lastActiveListingsArgs);
        }
        if (pageButton.dataset.listingTable === 'sales' && lastSalesHistoryArgs) {
            salesHistoryPage = page;
            renderSalesHistory(lastSalesHistoryArgs);
        }
    });

    ['modal-item-stacks', 'modal-item-count-per-stack', 'modal-item-price-per-stack', 'modal-market-stall-location'].forEach((id) => {
        document.getElementById(id)?.addEventListener('input', scheduleRefresh);
        document.getElementById(id)?.addEventListener('change', scheduleRefresh);
    });
    document.getElementById('modal-mastercrafted-btn')?.addEventListener('click', scheduleRefresh);
    document.querySelectorAll('.modal-enchant-btn').forEach((button) => {
        button.addEventListener('click', scheduleRefresh);
    });
    document.getElementById('workbench-config')?.addEventListener('click', (event) => {
        const button = event.target.closest('[data-risk-profile]');
        if (!button) return;
        setCompetitiveRiskTolerance(button.dataset.riskProfile);
        scheduleRefresh();
    });
    window.addEventListener('pda:competitive-risk-changed', scheduleRefresh);

    let wasModalOpen = false;
    const syncFocusMode = () => {
        const isModalOpen = !!modal && !modal.classList.contains('hidden');
        document.body.classList.toggle('listing-focus-mode', isModalOpen);
        if (isModalOpen && !wasModalOpen) {
            scheduleRefresh();
        }
        wasModalOpen = isModalOpen;
    };

    if (modal) {
        syncFocusMode();
        new MutationObserver(syncFocusMode).observe(modal, {
            attributes: true,
            attributeFilter: ['class']
        });
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && !modal.classList.contains('hidden')) {
                modal.classList.add('hidden');
            }
        });
    }

    refreshWorkbench(selectedItem);
}

document.addEventListener('DOMContentLoaded', initializeGuidedListingWorkbench);
