import { supabase } from '../supabaseClient.js';
import { currentCharacterId, getCurrentCharacter } from './characters.js';
import {
    fetchActiveListingsForListing,
    fetchItemSalesHistoryForListing,
    fetchProvinceMarketContext,
    getProvinceUnitFloor
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
    getItemIdByName,
    getItemNameForSlug,
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
    if (marketData) return `${fmt(marketData.marketLow, 2)}g/unit from Home Valley feed`;
    if (!referenceFloor) return 'No live or province floor';
    if (referenceFloor.source === 'province') {
        const sourceStack = referenceFloor.sourceQuantity && referenceFloor.sourceStackPrice
            ? `; source ${fmt(referenceFloor.sourceQuantity)} count at ${fmt(referenceFloor.sourceStackPrice)}g`
            : '';
        return `Province unit floor normalized to ${fmt(referenceFloor.count)} count${sourceStack}`;
    }
    return referenceFloor.sourceLabel || 'Reference floor';
};

const getFormState = () => {
    const inputs = getInputs();
    const count = parseInt(inputs.count?.value, 10) || 0;
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

const getNormalizedSaleStackValue = (sale, targetCount) => {
    const count = Math.max(Number(targetCount) || 0, 0);
    const quantity = Math.max(Number(sale?.quantity_sold) || 1, 1);
    const total = Number(sale?.total_sale_price) || 0;
    if (!(count > 0) || !(total > 0)) return total;
    return (total / quantity) * count;
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

const computeReferenceFloor = ({ selectedItem, marketData, provinceContext, formState }) => {
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

    const provinceUnitFloor = provinceContext
        ? getProvinceUnitFloor({
            listings: provinceContext.listings,
            itemId: provinceContext.itemId,
            count: formState.count,
            isMastercrafted: formState.isMastercrafted,
            enchantmentTier: formState.enchantmentTier
        })
        : null;

    if (!provinceUnitFloor) return null;

    return {
        itemId: selectedItem.item_id || null,
        itemName: selectedItem.item_name || '',
        count: formState.count,
        isMastercrafted: formState.isMastercrafted,
        enchantmentTier: formState.enchantmentTier,
        source: 'province',
        sourceLabel: 'Province unit floor',
        ...provinceUnitFloor
    };
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
        target.innerHTML = '<div class="listing-workbench-empty">Select an item to populate the decision summary.</div>';
        preview.innerHTML = '<span>Waiting for item</span><strong>--</strong>';
        rankTarget.innerHTML = '<span>Market position</span><strong>--</strong>';
        return;
    }

    const { count, stacks, price } = formState;
    const total = price > 0 && stacks > 0 ? price * stacks : 0;
    const fee = price > 0 && stacks > 0 ? Math.ceil(price * 0.05) * stacks : 0;
    const unit = price > 0 && count > 0 ? price / count : 0;
    const activePrices = activeListings.map((listing) => Number(listing.total_listed_price) || 0).filter(Boolean);
    const rank = price > 0
        ? activePrices.filter((listingPrice) => listingPrice < price).length + 1
        : null;

    preview.innerHTML = `<span>Expected gross</span><strong>${fmt(total)}g</strong><small>${fmt(fee)}g estimated fees</small>`;
    rankTarget.innerHTML = `<span>Market position</span><strong>${rank ? `#${rank}` : '--'}</strong><small>${unit ? `${fmt(unit, 2)}g per unit` : 'Enter price'}</small>`;

    const marketLowStack = referenceFloor?.value || (marketData && count > 0 ? marketData.marketLow * count : null);
    const historyAvgStack = historyData && count > 0 ? historyData.avgPerUnit * count : null;
    const lowestActive = activePrices.length ? Math.min(...activePrices) : null;

    target.innerHTML = `
        <div class="listing-workbench-metric">
            <span>Reference floor</span>
            <strong>${marketLowStack ? `${fmt(marketLowStack)}g` : '--'}</strong>
            <small>${describeReferenceFloor(referenceFloor, marketData)}</small>
        </div>
        <div class="listing-workbench-metric">
            <span>Your avg sale</span>
            <strong>${historyAvgStack ? `${fmt(historyAvgStack)}g` : '--'}</strong>
            <small>${historyData ? `${fmt(historyData.saleCount)} sales, best ${fmt((historyData.maxPerUnit || 0) * Math.max(count, 1))}g` : 'No sales history'}</small>
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
    const normalizedCount = Math.max(count, 1);
    const zoneListings = getZoneListingsForItemByQuality(
        selectedItem.pax_dei_slug,
        selectedItem.item_name,
        isMastercrafted,
        enchantmentTier
    );

    const rawStackPrices = zoneListings
        .map((listing) => Math.round(Number(listing.price) || 0))
        .filter((stackPrice) => stackPrice > 0)
        .sort((a, b) => a - b);
    const marketLowStack = marketData && count > 0
        ? marketData.marketLow * count
        : referenceFloor?.value || rawStackPrices[0] || null;
    const riskProfile = getCompetitiveRiskTolerance();
    const competitiveCap = marketLowStack
        ? getCompetitiveCap(Math.round(marketLowStack), riskProfile)
        : null;
    const depthCap = competitiveCap || (marketLowStack ? Math.round(marketLowStack * 1.3) : null);
    const stackPrices = rawStackPrices
        .filter((stackPrice) => !depthCap || stackPrice <= depthCap)
        .slice(0, 36);
    const ledgerPrices = activeListings
        .map((listing) => Number(listing.total_listed_price) || 0)
        .filter(Boolean);
    const ledgerLowStack = ledgerPrices.length ? Math.min(...ledgerPrices) : null;
    const weightedSaleStack = weightedAverage(salesRows, (sale) => getNormalizedSaleStackValue(sale, count), (sale) => sale.sale_date);
    const supplyAfter = (marketData?.totalListings || zoneListings.length || 0) + (stacks || 0);
    const buckets = new Map();
    stackPrices.forEach((stackPrice) => {
        buckets.set(stackPrice, (buckets.get(stackPrice) || 0) + 1);
    });
    const depthRows = Array.from(buckets, ([stackPrice, quantity]) => ({ stackPrice, quantity }))
        .sort((a, b) => a.stackPrice - b.stackPrice)
        .slice(0, 8);
    const maxDepth = Math.max(...depthRows.map((row) => row.quantity), 1);

    const recentSales = salesRows.slice(0, 6);
    const bestRecentStack = recentSales.length
        ? Math.max(...recentSales.map((sale) => Number(sale.total_sale_price) || 0))
        : null;
    const roundedFloor = marketLowStack ? Math.round(marketLowStack) : null;
    const thresholds = roundedFloor ? getCompetitiveThresholds(roundedFloor, riskProfile) : null;
    const floorLabel = referenceFloor?.source === 'province'
        ? 'Province Low'
        : referenceFloor?.source === 'home'
            ? 'Market Low'
            : ledgerLowStack
                ? 'Ledger Floor'
                : 'Archives Weighted';
    const floorDetail = referenceFloor
        ? describeReferenceFloor(referenceFloor, marketData)
        : ledgerLowStack
            ? 'Lowest matching active Ledger listing.'
            : 'No live floor; using Archives sales signal.';
    const weightedOption = weightedSaleStack ? Math.round(weightedSaleStack) : null;
    const competitiveOption = roundedFloor && thresholds ? getCompetitiveCap(roundedFloor, riskProfile) : null;
    const suggestedOption = roundedFloor && competitiveOption
        ? Math.min(Math.max(weightedOption || roundedFloor, roundedFloor), competitiveOption)
        : weightedOption;
    const priceOptions = [
        {
            label: floorLabel,
            value: roundedFloor || ledgerLowStack || weightedOption,
            detail: floorDetail
        },
        {
            label: 'Suggested Price',
            value: suggestedOption,
            detail: roundedFloor
                ? 'Sales-informed guidance constrained to the current competitive band.'
                : 'Archives weighted sales guidance because no live floor is available.'
        },
        {
            label: 'Competitive Price',
            value: competitiveOption,
            detail: thresholds ? `${thresholds.label}: +${fmt(thresholds.maxGapGold)}g / +${fmt(thresholds.maxGapPct)}%.` : 'Requires a reference floor.'
        },
        {
            label: 'Province Low',
            value: referenceFloor?.source === 'province' ? referenceFloor.value : null,
            detail: referenceFloor?.source === 'province'
                ? `Same item and quality, normalized to ${fmt(count)} count.`
                : 'Shown when province floor fills a missing Home Valley floor.'
        }
    ].filter((option, index, options) => {
        if (!(Number(option.value) > 0)) return false;
        return options.findIndex((candidate) => Math.round(Number(candidate.value) || 0) === Math.round(Number(option.value) || 0) && candidate.label === option.label) === index;
    });

    if (summaryTarget) {
        summaryTarget.innerHTML = `
        <div class="listing-strategy-grid">
            <div class="listing-strategy-tile">
                <span>Reference stack floor</span>
                <strong class="text-emerald-300">${marketLowStack ? `${fmt(marketLowStack)}g` : '--'}</strong>
                <small>${describeReferenceFloor(referenceFloor, marketData)}</small>
            </div>
            <div class="listing-strategy-tile">
                <span>Ledger floor</span>
                <strong>${ledgerLowStack ? `${fmt(ledgerLowStack)}g` : '--'}</strong>
                <small>${activeListings.length ? `${activeListings.length} active Ledger listings` : 'No matching Ledger listings'}</small>
            </div>
            <div class="listing-strategy-tile">
                <span>Archives weighted avg</span>
                <strong>${weightedSaleStack ? `${fmt(weightedSaleStack)}g` : '--'}</strong>
                <small>${salesRows.length ? `${fmt(salesRows.length)} Archives sales, normalized to ${fmt(normalizedCount)} count` : 'No Archives sales history'}</small>
            </div>
            <div class="listing-strategy-tile">
                <span>Supply after listing</span>
                <strong>${fmt(supplyAfter)}</strong>
                <small>${stacks > 0 ? `Adding ${fmt(stacks)} stack${stacks === 1 ? '' : 's'}` : 'Enter stack count'}</small>
            </div>
        </div>
        `;
    }

    target.innerHTML = `
        <p class="listing-workbench-section-label mt-3">Price Options</p>
        <div class="competitive-price-options">
            ${priceOptions.map((option) => `
                <div class="competitive-option-card">
                    <span>${escapeHtml(option.label)}</span>
                    <small>${escapeHtml(option.detail)}</small>
                    <strong>${fmt(option.value)}g</strong>
                    <button type="button" data-suggested-price="${Math.round(option.value)}">Use</button>
                </div>
            `).join('') || '<div class="listing-workbench-empty">Select an item and enter count to calculate price options.</div>'}
        </div>
        <div class="listing-pricing-visuals">
            <div class="listing-pricing-card">
                <div class="listing-pricing-card-header">
                    <h4>Market Depth By Stack Price</h4>
                    <span>${depthRows.length ? `${fmt(stackPrices.length)} competitive listings` : 'No feed depth'}</span>
                </div>
                <div class="listing-depth-list">
                    ${depthRows.length ? depthRows.map((row) => `
                        <div class="listing-depth-row">
                            <strong>${fmt(row.stackPrice)}g</strong>
                            <div class="listing-depth-bar"><span style="width:${Math.max(8, Math.round((row.quantity / maxDepth) * 100))}%"></span></div>
                            <span>${fmt(row.quantity)}</span>
                        </div>
                    `).join('') : '<div class="listing-workbench-empty">No market-feed depth for this item and quality.</div>'}
                </div>
            </div>

            <div class="listing-pricing-card">
                <div class="listing-pricing-card-header">
                    <h4>Recent Stack Sales</h4>
                    <span>${bestRecentStack ? `Best recent ${fmt(bestRecentStack)}g` : 'Ledger history'}</span>
                </div>
                <div class="listing-sales-context">
                    ${recentSales.length ? recentSales.map((sale) => `
                        <div class="listing-sales-context-row">
                            <span>${escapeHtml(relativeDate(sale.sale_date))} ago</span>
                            <span>${fmt(sale.quantity_sold)} count at ${fmt(sale.sale_price_per_unit, 2)}g/unit</span>
                            <strong>${fmt(sale.total_sale_price)}g</strong>
                        </div>
                    `).join('') : '<div class="listing-workbench-empty">No recent sales for this item yet.</div>'}
                </div>
            </div>
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

function renderCompetitivePricing({ selectedItem, marketData, referenceFloor, historyData, activeListings, salesRows, formState }) {
    const target = document.getElementById('workbench-competitive-pricing');
    if (!target) return;
    if (!selectedItem) {
        return renderEmpty(target, 'Select an item to inspect competitive pricing.');
    }

    const { count, price, stacks } = formState;
    const stackCount = Math.max(count, 1);
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
    const weightedStack = weightedAverage(salesRows, (sale) => getNormalizedSaleStackValue(sale, count), (sale) => sale.sale_date);
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
        <div class="competitive-explainer">
            <strong>Competitive pricing</strong> compares the current market floor against your recent sales momentum. Current tolerance is <strong>${escapeHtml(riskProfileConfig.label)}</strong>, which sets this band at ${thresholds ? `${fmt(thresholds.maxGapGold)}g / ${fmt(thresholds.maxGapPct)}% above floor` : 'the selected risk profile'}.
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
                <p>${stackFloor ? `The current reference floor is ${fmt(stackFloor)}g for a ${fmt(stackCount)} count stack. The competitive cap is ${cap ? `${fmt(cap)}g` : '--'}, based on the existing pricing band. ${escapeHtml(describeReferenceFloor(referenceFloor, marketData))}.` : 'No market floor is available for this item and quality yet.'}</p>
                <p>${weightedStack ? `Recent weighted sales point toward ${fmt(weightedStack)}g per stack, while the all-time average is ${historyData?.avgPerStack ? `${fmt(historyData.avgPerStack)}g` : '--'}.` : 'There is not enough sales history to calculate recent weighted momentum.'}</p>
            </div>
        </div>
    `;
}

function renderConfig({ selectedItem, marketData, referenceFloor, activeListings = [], salesRows = [], formState }) {
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
                ? 'Home Valley per-unit estimate'
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
                label: 'Top competitive price',
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
                <h4>Competitive Price Tolerance</h4>
                <p>Choose how much room Archives gives the competitive cap above the current stack floor. This uses live item summaries first, then Home Valley listing depth, then your Archives active listings or weighted sales when live data is missing. This setting only changes guidance and suggested buttons.</p>
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
                    <span>Competitive cap</span>
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
        .slice(0, 24);

    if (!rows.length) return renderEmpty(target, 'No active listings were found for this item and quality.');

    target.innerHTML = `
        <table class="listing-workbench-table">
            <thead>
                <tr>
                    <th>Source</th>
                    <th>Stack</th>
                    <th>Stack Price</th>
                    <th>Unit</th>
                    <th>Age</th>
                </tr>
            </thead>
            <tbody>
                ${rows.map((row) => `
                    <tr>
                        <td>${escapeHtml(row.source)}${row.source.includes('feed matched') ? ' <span class="listing-feed-pill">Feed</span>' : ''}</td>
                        <td>${fmt(row.quantity)}</td>
                        <td class="text-emerald-300 font-bold">${fmt(row.stackPrice)}g</td>
                        <td>${fmt(row.unitPrice, 2)}g</td>
                        <td>${escapeHtml(row.age)}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function renderSalesHistory({ selectedItem, historyData, salesRows }) {
    const target = document.getElementById('workbench-sales-history');
    if (!target) return;
    if (!selectedItem) return renderEmpty(target, 'Select an item to view sales history.');
    if (!salesRows.length) return renderEmpty(target, 'No sales history found for this item yet.');
    const recentRows = salesRows.filter((sale) => {
        const date = new Date(sale.sale_date).getTime();
        return Number.isFinite(date) && (Date.now() - date) / 864e5 <= 30;
    });
    const currentCount = Math.max(Number(document.getElementById('modal-item-count-per-stack')?.value) || 0, 0);
    const weightedStack = weightedAverage(salesRows, (sale) => getNormalizedSaleStackValue(sale, currentCount), (sale) => sale.sale_date);
    const weightedUnit = weightedAverage(salesRows, (sale) => sale.sale_price_per_unit, (sale) => sale.sale_date);
    const recentAvgStack = recentRows.length
        ? recentRows.reduce((sum, sale) => sum + (Number(getNormalizedSaleStackValue(sale, currentCount)) || 0), 0) / recentRows.length
        : null;
    const recentAvgUnit = recentRows.length
        ? recentRows.reduce((sum, sale) => sum + (Number(sale.sale_price_per_unit) || 0), 0) / recentRows.length
        : null;

    target.innerHTML = `
        <div class="listing-workbench-history-grid">
            <div class="listing-workbench-metric">
                <span>Weighted recent stack</span>
                <strong>${weightedStack ? `${fmt(weightedStack)}g` : '--'}</strong>
                <small>Normalized to current count, 14 day half-life</small>
            </div>
            <div class="listing-workbench-metric">
                <span>30 day stack avg</span>
                <strong>${recentAvgStack ? `${fmt(recentAvgStack)}g` : '--'}</strong>
                <small>${fmt(recentRows.length)} sales in the last 30 days, normalized</small>
            </div>
            <div class="listing-workbench-metric">
                <span>All-time stack avg</span>
                <strong>${historyData ? `${fmt(historyData.avgPerStack)}g` : '--'}</strong>
                <small>${historyData ? `${fmt(historyData.saleCount)} total recorded sales` : ''}</small>
            </div>
        </div>
        <div class="listing-workbench-note mt-3">
            Weighted averages respond faster to market movement. For this item, weighted unit is ${weightedUnit ? `${fmt(weightedUnit, 2)}g` : '--'}, 30 day unit is ${recentAvgUnit ? `${fmt(recentAvgUnit, 2)}g` : '--'}, and all-time unit is ${historyData?.avgPerUnit ? `${fmt(historyData.avgPerUnit, 2)}g` : '--'}.
        </div>
        <table class="listing-workbench-table mt-3">
            <thead>
                <tr>
                    <th>Sold</th>
                    <th>Stack</th>
                    <th>Stack Price</th>
                    <th>Unit Price</th>
                    <th>Quality</th>
                </tr>
            </thead>
            <tbody>
                ${salesRows.slice(0, 8).map((sale) => {
                    const listing = sale.market_listings || {};
                    return `
                        <tr>
                            <td>${escapeHtml(relativeDate(sale.sale_date))} ago</td>
                            <td>${fmt(sale.quantity_sold)}</td>
                            <td class="text-emerald-300 font-bold">${fmt(sale.total_sale_price)}g</td>
                            <td>${fmt(sale.sale_price_per_unit, 2)}g</td>
                            <td>${escapeHtml(qualityLabel(!!listing.is_mastercrafted, listing.enchantment_tier || 0))}</td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
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

    const [historyData, activeListings, salesRows, provinceContext] = await Promise.all([
        fetchItemSalesHistoryForListing({ supabase, currentCharacterId, itemId: selectedItem.item_id }),
        fetchActiveListingsForListing({ supabase, currentCharacterId, itemId: selectedItem.item_id }),
        fetchRecentSalesRows(selectedItem.item_id),
        fetchProvinceMarketContext({
            supabase,
            currentCharacterId,
            getCurrentCharacter,
            selectedItem,
            getItemNameForSlug,
            getItemIdByName
        }).catch((error) => {
            console.warn('[ListingWorkbench] province context unavailable:', error?.message || error);
            return null;
        })
    ]);
    const marketData = computeMarketData(selectedItem, formState.isMastercrafted, formState.enchantmentTier);
    const referenceFloor = computeReferenceFloor({ selectedItem, marketData, provinceContext, formState });

    const qualityActiveListings = filterLedgerListingsByQuality(
        activeListings,
        formState.isMastercrafted,
        formState.enchantmentTier
    );

    renderPricingSummary({ selectedItem, marketData, referenceFloor, historyData, activeListings: qualityActiveListings, formState });
    renderPricingVisuals({ selectedItem, marketData, referenceFloor, historyData, activeListings: qualityActiveListings, salesRows, formState });
    renderCompetitivePricing({ selectedItem, marketData, referenceFloor, historyData, activeListings: qualityActiveListings, salesRows, formState });
    renderConfig({ selectedItem, marketData, referenceFloor, activeListings: qualityActiveListings, salesRows, formState });
    attachWorkbenchPriceButtons(document.getElementById('guidedListingWorkbench') || document);
    renderActiveListings({ selectedItem, activeListings: qualityActiveListings, formState });
    renderSalesHistory({ selectedItem, historyData, salesRows });
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
        refreshWorkbench(selectedItem);
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
