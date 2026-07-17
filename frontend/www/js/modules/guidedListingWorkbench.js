import { supabase } from '../supabaseClient.js';
import { currentCharacterId } from './characters.js';
import {
    fetchActiveListingsForListing,
    fetchItemSalesHistoryForListing
} from './addListingIntelligence.js';
import {
    classifyCompetitiveGap,
    getCompetitiveThresholds
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

function renderPricingSummary({ selectedItem, marketData, historyData, activeListings, formState }) {
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

    const marketLowStack = marketData && count > 0 ? marketData.marketLow * count : null;
    const historyAvgStack = historyData && count > 0 ? historyData.avgPerUnit * count : null;
    const lowestActive = activePrices.length ? Math.min(...activePrices) : null;

    target.innerHTML = `
        <div class="listing-workbench-metric">
            <span>Live floor</span>
            <strong>${marketLowStack ? `${fmt(marketLowStack)}g` : '--'}</strong>
            <small>${marketData ? `${fmt(marketData.marketLow, 2)}g/unit, ${fmt(marketData.totalListings)} listings` : 'No live market data'}</small>
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

function renderPricingVisuals({ selectedItem, marketData, historyData, activeListings, salesRows, formState }) {
    const target = document.getElementById('workbench-pricing-visuals');
    const summaryTarget = document.getElementById('workbench-overview-summary');
    if (!target) return;

    if (!selectedItem) {
        target.innerHTML = '';
        if (summaryTarget) summaryTarget.innerHTML = '';
        return;
    }

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
    const marketLowStack = marketData && count > 0 ? marketData.marketLow * count : rawStackPrices[0] || null;
    const competitiveCap = marketLowStack
        ? Math.round(marketLowStack) + getCompetitiveThresholds(Math.round(marketLowStack)).maxGapGold
        : null;
    const depthCap = competitiveCap || (marketLowStack ? Math.round(marketLowStack * 1.3) : null);
    const stackPrices = rawStackPrices
        .filter((stackPrice) => !depthCap || stackPrice <= depthCap)
        .slice(0, 36);
    const ledgerPrices = activeListings
        .map((listing) => Number(listing.total_listed_price) || 0)
        .filter(Boolean);
    const ledgerLowStack = ledgerPrices.length ? Math.min(...ledgerPrices) : null;
    const weightedSaleStack = weightedAverage(salesRows, (sale) => sale.total_sale_price, (sale) => sale.sale_date);
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

    if (summaryTarget) {
        summaryTarget.innerHTML = `
        <div class="listing-strategy-grid">
            <div class="listing-strategy-tile">
                <span>Live stack floor</span>
                <strong class="text-emerald-300">${marketLowStack ? `${fmt(marketLowStack)}g` : '--'}</strong>
                <small>${marketData ? `${fmt(marketData.marketLow, 2)}g/unit from market feed` : 'No live feed floor'}</small>
            </div>
            <div class="listing-strategy-tile">
                <span>Ledger floor</span>
                <strong>${ledgerLowStack ? `${fmt(ledgerLowStack)}g` : '--'}</strong>
                <small>${activeListings.length ? `${activeListings.length} active Ledger listings` : 'No matching Ledger listings'}</small>
            </div>
            <div class="listing-strategy-tile">
                <span>Archives weighted avg</span>
                <strong>${weightedSaleStack ? `${fmt(weightedSaleStack)}g` : '--'}</strong>
                <small>${salesRows.length ? `${fmt(salesRows.length)} Archives sales, recent weighted` : 'No Archives sales history'}</small>
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

function renderCompetitivePricing({ selectedItem, marketData, historyData, activeListings, salesRows, formState }) {
    const target = document.getElementById('workbench-competitive-pricing');
    if (!target) return;
    if (!selectedItem) {
        return renderEmpty(target, 'Select an item to inspect competitive pricing.');
    }

    const { count, price, stacks } = formState;
    const stackCount = Math.max(count, 1);
    const stackFloor = marketData && count > 0 ? Math.round(marketData.marketLow * count) : null;
    const thresholds = stackFloor ? getCompetitiveThresholds(stackFloor) : null;
    const cap = thresholds ? stackFloor + thresholds.maxGapGold : null;
    const enteredGap = price > 0 && stackFloor ? price - stackFloor : null;
    const enteredGapPct = enteredGap !== null && stackFloor > 0 ? Math.round((enteredGap / stackFloor) * 100) : null;
    const enteredStatus = enteredGap !== null
        ? classifyCompetitiveGap(enteredGap, enteredGapPct, stackFloor).status
        : null;
    const weightedStack = weightedAverage(salesRows, (sale) => sale.total_sale_price, (sale) => sale.sale_date);
    const recentRows = salesRows.filter((sale) => {
        const date = new Date(sale.sale_date).getTime();
        return Number.isFinite(date) && (Date.now() - date) / 864e5 <= 30;
    });
    const recentAvgStack = recentRows.length
        ? recentRows.reduce((sum, sale) => sum + (Number(sale.total_sale_price) || 0), 0) / recentRows.length
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
            detail: 'Recent sales carry more weight than older sales.'
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
            <strong>Competitive pricing</strong> compares the current market floor against your recent sales momentum. The weighted average favors newer sales, so it should react faster when the market moves than the all-time average.
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
                <p>${stackFloor ? `The current market floor is ${fmt(stackFloor)}g for a ${fmt(stackCount)} count stack. The competitive cap is ${cap ? `${fmt(cap)}g` : '--'}, based on the existing pricing band.` : 'No market floor is available for this item and quality yet.'}</p>
                <p>${weightedStack ? `Recent weighted sales point toward ${fmt(weightedStack)}g per stack, while the all-time average is ${historyData?.avgPerStack ? `${fmt(historyData.avgPerStack)}g` : '--'}.` : 'There is not enough sales history to calculate recent weighted momentum.'}</p>
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
    const weightedStack = weightedAverage(salesRows, (sale) => sale.total_sale_price, (sale) => sale.sale_date);
    const weightedUnit = weightedAverage(salesRows, (sale) => sale.sale_price_per_unit, (sale) => sale.sale_date);
    const recentAvgStack = recentRows.length
        ? recentRows.reduce((sum, sale) => sum + (Number(sale.total_sale_price) || 0), 0) / recentRows.length
        : null;
    const recentAvgUnit = recentRows.length
        ? recentRows.reduce((sum, sale) => sum + (Number(sale.sale_price_per_unit) || 0), 0) / recentRows.length
        : null;

    target.innerHTML = `
        <div class="listing-workbench-history-grid">
            <div class="listing-workbench-metric">
                <span>Weighted recent stack</span>
                <strong>${weightedStack ? `${fmt(weightedStack)}g` : '--'}</strong>
                <small>Recent sales count more, 14 day half-life</small>
            </div>
            <div class="listing-workbench-metric">
                <span>30 day stack avg</span>
                <strong>${recentAvgStack ? `${fmt(recentAvgStack)}g` : '--'}</strong>
                <small>${fmt(recentRows.length)} sales in the last 30 days</small>
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
        renderPricingSummary({ selectedItem: null, marketData: null, historyData: null, activeListings: [], formState });
        renderPricingVisuals({ selectedItem: null, marketData: null, historyData: null, activeListings: [], salesRows: [], formState });
        renderCompetitivePricing({ selectedItem: null, marketData: null, historyData: null, activeListings: [], salesRows: [], formState });
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

    const qualityActiveListings = filterLedgerListingsByQuality(
        activeListings,
        formState.isMastercrafted,
        formState.enchantmentTier
    );

    renderPricingSummary({ selectedItem, marketData, historyData, activeListings: qualityActiveListings, formState });
    renderPricingVisuals({ selectedItem, marketData, historyData, activeListings: qualityActiveListings, salesRows, formState });
    renderCompetitivePricing({ selectedItem, marketData, historyData, activeListings: qualityActiveListings, salesRows, formState });
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
