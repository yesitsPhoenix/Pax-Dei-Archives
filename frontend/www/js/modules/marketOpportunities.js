import { supabase } from '../supabaseClient.js';
import { currentCharacterId, getCurrentCharacter } from './characters.js';
import { fetchProvinceMarketData } from './addListingIntelligence.js';
import { getItemData, loadItemsData } from '../services/gamingToolsService.js';

const SETTINGS_KEY = 'pda.marketOpportunitySettings.v1';
const FEE_RATE = 0.05;
const OPPORTUNITIES_PAGE_SIZE = 25;
const DEFAULT_SETTINGS = {
    preset: 'balanced', historyDays: 180, minProfit: 10, minRoi: 75,
    minSales: 3, minVelocity: 1, maxDaysSinceSale: 60, maxPriceSpread: 60,
    maxPurchasePrice: null, excludedItems: [], starredItems: [], displayMode: 'simple'
};
const PRESETS = {
    broad: { historyDays: 180, minProfit: 5, minRoi: 50, minSales: 3, minVelocity: 0.5, maxDaysSinceSale: 120, maxPriceSpread: 100, maxPurchasePrice: null },
    balanced: { historyDays: 180, minProfit: 10, minRoi: 75, minSales: 3, minVelocity: 1, maxDaysSinceSale: 60, maxPriceSpread: 60, maxPurchasePrice: null },
    confident: { historyDays: 180, minProfit: 25, minRoi: 75, minSales: 6, minVelocity: 2, maxDaysSinceSale: 30, maxPriceSpread: 35, maxPurchasePrice: null }
};

let latestCandidates = [];
let latestProvinceData = null;
let opportunitySettings = loadSettings();

const fmt = (value, digits = 0) => Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: digits });
const escapeHtml = (value) => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
const bareItemId = (value) => String(value || '').slice(String(value || '').lastIndexOf('/') + 1);
const qualityKey = (itemId, mastercrafted, enchantmentTier) => `${bareItemId(itemId)}::${mastercrafted ? 1 : 0}::${Number(enchantmentTier) || 0}`;
const itemPreferenceKey = (row) => `${row.itemName}::${row.isMastercrafted ? 1 : 0}::${row.enchantmentTier || 0}`;
const listingRelation = (sale) => Array.isArray(sale.market_listings) ? sale.market_listings[0] : sale.market_listings;

function loadSettings() {
    try {
        const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
        return { ...DEFAULT_SETTINGS, ...saved };
    } catch {
        return { ...DEFAULT_SETTINGS };
    }
}

function saveSettings() {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(opportunitySettings)); } catch { /* optional persistence */ }
}

function weightedMedian(rows) {
    const values = rows.map((row) => {
        const quantity = Math.max(Number(row.quantity_sold) || 1, 1);
        const total = Number(row.total_sale_price) || 0;
        const soldAt = new Date(row.sale_date).getTime();
        if (!(total > 0) || !Number.isFinite(soldAt)) return null;
        const ageDays = Math.max(0, (Date.now() - soldAt) / 864e5);
        return { value: total / quantity, weight: Math.pow(0.5, ageDays / 21) };
    }).filter(Boolean).sort((a, b) => a.value - b.value);
    const totalWeight = values.reduce((sum, row) => sum + row.weight, 0);
    let cumulative = 0;
    for (const row of values) {
        cumulative += row.weight;
        if (cumulative >= totalWeight / 2) return row.value;
    }
    return null;
}

function percentile(sorted, ratio) {
    if (!sorted.length) return 0;
    return sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * ratio)))];
}

async function fetchOpportunitySales(historyDays) {
    if (!currentCharacterId) return [];
    const cutoff = new Date(Date.now() - historyDays * 864e5).toISOString();
    const { data, error } = await supabase.from('sales')
        .select('quantity_sold, total_sale_price, sale_date, market_listings!inner(item_id, is_mastercrafted, enchantment_tier, items(item_name, pax_dei_slug))')
        .eq('character_id', currentCharacterId).gte('sale_date', cutoff)
        .order('sale_date', { ascending: false }).limit(1000);
    if (error) throw error;
    return data || [];
}

function buildHistoryIndex(sales) {
    const groups = new Map();
    for (const sale of sales) {
        const listing = listingRelation(sale);
        const item = Array.isArray(listing?.items) ? listing.items[0] : listing?.items;
        const gamingItemId = bareItemId(item?.pax_dei_slug);
        if (!gamingItemId) continue;
        const key = qualityKey(gamingItemId, listing?.is_mastercrafted, listing?.enchantment_tier);
        if (!groups.has(key)) groups.set(key, { sales: [], itemName: item?.item_name || gamingItemId });
        groups.get(key).sales.push(sale);
    }
    const index = new Map();
    for (const [key, group] of groups) {
        const unitValue = weightedMedian(group.sales);
        if (!(unitValue > 0)) continue;
        const prices = group.sales.map((sale) => (Number(sale.total_sale_price) || 0) / Math.max(Number(sale.quantity_sold) || 1, 1))
            .filter((value) => value > 0).sort((a, b) => a - b);
        const newestSale = Math.max(...group.sales.map((sale) => new Date(sale.sale_date).getTime()).filter(Number.isFinite));
        const q1 = percentile(prices, 0.25);
        const q3 = percentile(prices, 0.75);
        index.set(key, {
            itemName: group.itemName, saleCount: group.sales.length, unitValue, newestSale,
            priceSpreadPct: unitValue > 0 ? ((q3 - q1) / unitValue) * 100 : 0
        });
    }
    return index;
}

function buildOpportunities(provinceData, historyIndex, historyDays) {
    const homeValley = String(provinceData?.homeValley || '').toLowerCase();
    return (provinceData?.listings || []).map((listing) => {
        if (String(listing._homeValley || '').toLowerCase() === homeValley) return null;
        const quantity = Math.max(Number(listing.quantity) || 1, 1);
        const acquisitionCost = Number(listing.price) || 0;
        if (!(acquisitionCost > 0)) return null;
        const history = historyIndex.get(qualityKey(listing.item_id, listing.mastercraft, listing.enchantment_level));
        if (!history) return null;
        const historicalValue = history.unitValue * quantity;
        const estimatedFee = Math.ceil(historicalValue * FEE_RATE);
        const estimatedProfit = historicalValue - estimatedFee - acquisitionCost;
        if (estimatedProfit <= 0) return null;
        const daysSinceSale = Math.max(0, Math.round((Date.now() - history.newestSale) / 864e5));
        return {
            itemName: history.itemName, iconPath: getItemData(listing.item_id, history.itemName)?.iconPath || null,
            valley: listing._homeValley || 'Unknown valley', quantity, acquisitionCost,
            unitCost: acquisitionCost / quantity, historicalUnitValue: history.unitValue, historicalValue,
            estimatedFee, estimatedProfit, margin: (estimatedProfit / acquisitionCost) * 100,
            saleCount: history.saleCount, newestSale: history.newestSale, daysSinceSale,
            velocity: history.saleCount / (historyDays / 30), priceSpreadPct: history.priceSpreadPct,
            isMastercrafted: !!listing.mastercraft, enchantmentTier: Number(listing.enchantment_level) || 0
        };
    }).filter(Boolean);
}

const qualityLabel = (row) => {
    const labels = [];
    if (row.isMastercrafted) labels.push('Mastercrafted');
    if (row.enchantmentTier) labels.push(`Enchant ${['', 'I', 'II', 'III'][row.enchantmentTier] || row.enchantmentTier}`);
    return labels.length ? labels.join(' + ') : 'Standard';
};

function exclusionReasons(row, settings) {
    const reasons = [];
    if (row.estimatedProfit < settings.minProfit) reasons.push(`profit below ${fmt(settings.minProfit)}g`);
    if (row.margin < settings.minRoi) reasons.push(`return below ${fmt(settings.minRoi)}%`);
    if (row.saleCount < settings.minSales) reasons.push(`fewer than ${fmt(settings.minSales)} sales`);
    if (row.velocity < settings.minVelocity) reasons.push(`velocity below ${fmt(settings.minVelocity, 1)}/month`);
    if (row.daysSinceSale > settings.maxDaysSinceSale) reasons.push(`latest sale older than ${fmt(settings.maxDaysSinceSale)} days`);
    if (row.priceSpreadPct > settings.maxPriceSpread) reasons.push(`price spread above ${fmt(settings.maxPriceSpread)}%`);
    if (settings.maxPurchasePrice > 0 && row.acquisitionCost > settings.maxPurchasePrice) reasons.push(`purchase price above ${fmt(settings.maxPurchasePrice)}g`);
    if (settings.excludedItems.includes(itemPreferenceKey(row))) reasons.push('item excluded');
    return reasons;
}

function qualifiedCandidates() {
    return latestCandidates.filter((row) => exclusionReasons(row, opportunitySettings).length === 0);
}

function renderConfigurationState() {
    const setValue = (id, value) => { const input = document.getElementById(id); if (input) input.value = value ?? ''; };
    setValue('marketOpportunitiesHistoryWindow', opportunitySettings.historyDays);
    setValue('opportunityMinProfit', opportunitySettings.minProfit);
    setValue('opportunityMinRoi', opportunitySettings.minRoi);
    setValue('opportunityMinSales', opportunitySettings.minSales);
    setValue('opportunityMinVelocity', opportunitySettings.minVelocity);
    setValue('opportunityMaxDays', opportunitySettings.maxDaysSinceSale);
    setValue('opportunityMaxSpread', opportunitySettings.maxPriceSpread);
    setValue('opportunityMaxPurchase', opportunitySettings.maxPurchasePrice);
    document.querySelectorAll('[name="marketOpportunityDisplayMode"]').forEach((input) => {
        input.checked = input.value === opportunitySettings.displayMode;
    });
    document.querySelectorAll('[data-opportunity-preset]').forEach((button) => button.classList.toggle('active', button.dataset.opportunityPreset === opportunitySettings.preset));
    const preview = document.getElementById('marketOpportunityConfigPreview');
    if (preview) preview.innerHTML = `<strong>${fmt(qualifiedCandidates().length)}</strong> of ${fmt(latestCandidates.length)} raw candidates meet these thresholds.`;
    const excluded = document.getElementById('marketOpportunityExcludedItems');
    if (excluded) {
        excluded.innerHTML = opportunitySettings.excludedItems.length
            ? opportunitySettings.excludedItems.map((key) => `<button type="button" data-restore-opportunity="${escapeHtml(key)}"><i class="fas fa-rotate-left"></i> ${escapeHtml(key.split('::')[0])}</button>`).join('')
            : '<span>No manually excluded items.</span>';
        excluded.querySelectorAll('[data-restore-opportunity]').forEach((button) => button.addEventListener('click', () => {
            opportunitySettings.excludedItems = opportunitySettings.excludedItems.filter((key) => key !== button.dataset.restoreOpportunity);
            saveSettings(); renderCurrentResults(); renderConfigurationState();
        }));
    }
}

function renderRows(target, rows) {
    const advanced = opportunitySettings.displayMode === 'advanced';
    target.innerHTML = `
        <div class="market-opportunities-toolbar">
            <label><i class="fas fa-search"></i><input id="marketOpportunitiesSearch" type="search" placeholder="Search item or valley" autocomplete="off"></label>
            <select id="marketOpportunitiesSort" aria-label="Sort market opportunities">
                <option value="profit">Highest profit</option><option value="margin">Highest margin</option>
                <option value="velocity">Fastest selling</option><option value="price">Lowest purchase price</option><option value="item">Item name</option>
            </select><span id="marketOpportunitiesVisibleCount"></span>
        </div>
        <div class="market-opportunities-table-wrap"><table class="market-opportunities-table ${advanced ? 'advanced' : 'simple'}"><thead><tr>
            <th></th><th>Item</th><th>Valley</th><th>Actual Listing</th><th>${advanced ? 'Historical Value' : 'Typical Value'}</th><th>Evidence</th>${advanced ? '<th>Fee</th>' : ''}<th>Est. Profit</th><th>Margin</th><th></th>
        </tr></thead><tbody id="marketOpportunitiesRows"></tbody></table></div>
        <div id="marketOpportunitiesPagination" class="market-opportunities-pagination"></div>`;
    const search = target.querySelector('#marketOpportunitiesSearch');
    const sort = target.querySelector('#marketOpportunitiesSort');
    const rowsTarget = target.querySelector('#marketOpportunitiesRows');
    const countTarget = target.querySelector('#marketOpportunitiesVisibleCount');
    const pagination = target.querySelector('#marketOpportunitiesPagination');
    let page = 0;
    const paint = () => {
        const query = search.value.trim().toLowerCase();
        const filtered = rows.filter((row) => !query || row.itemName.toLowerCase().includes(query) || String(row.valley).toLowerCase().includes(query));
        const sorted = filtered.slice().sort((a, b) => {
            const aStar = opportunitySettings.starredItems.includes(itemPreferenceKey(a)) ? 1 : 0;
            const bStar = opportunitySettings.starredItems.includes(itemPreferenceKey(b)) ? 1 : 0;
            if (aStar !== bStar) return bStar - aStar;
            if (sort.value === 'margin') return b.margin - a.margin;
            if (sort.value === 'velocity') return b.velocity - a.velocity;
            if (sort.value === 'price') return a.acquisitionCost - b.acquisitionCost;
            if (sort.value === 'item') return a.itemName.localeCompare(b.itemName) || a.acquisitionCost - b.acquisitionCost;
            return b.estimatedProfit - a.estimatedProfit || b.margin - a.margin;
        });
        const pageCount = Math.max(1, Math.ceil(sorted.length / OPPORTUNITIES_PAGE_SIZE));
        page = Math.min(page, pageCount - 1);
        const visible = sorted.slice(page * OPPORTUNITIES_PAGE_SIZE, (page + 1) * OPPORTUNITIES_PAGE_SIZE);
        rowsTarget.innerHTML = visible.length ? visible.map((row) => {
            const prefKey = itemPreferenceKey(row);
            const starred = opportunitySettings.starredItems.includes(prefKey);
            return `<tr>
                <td><button type="button" class="market-opportunity-star${starred ? ' active' : ''}" data-star-opportunity="${escapeHtml(prefKey)}" title="${starred ? 'Remove favorite' : 'Favorite item'}"><i class="${starred ? 'fas' : 'far'} fa-star"></i></button></td>
                <td><div class="market-opportunity-item">${row.iconPath ? `<img src="${escapeHtml(row.iconPath)}" alt="" loading="lazy" onerror="this.style.display='none'">` : '<span class="market-opportunity-icon-fallback"><i class="fas fa-box"></i></span>'}<span><strong>${escapeHtml(row.itemName)}</strong><small>${escapeHtml(qualityLabel(row))}</small></span></div></td>
                <td><span class="market-opportunity-valley">${escapeHtml(row.valley)}</span></td>
                <td><strong>${fmt(row.quantity)} units for ${fmt(row.acquisitionCost)}g</strong>${advanced ? `<small>1 stack &middot; ${fmt(row.unitCost, 2)}g/unit</small>` : ''}</td>
                <td><strong>${fmt(row.historicalValue)}g</strong>${advanced ? `<small>${fmt(row.historicalUnitValue, 2)}g/unit</small>` : ''}</td>
                <td><strong>${advanced ? `${fmt(row.saleCount)} sales &middot; ${fmt(row.velocity, 1)}/mo` : `${fmt(row.saleCount)} past sales`}</strong>${advanced ? `<small>newest ${fmt(row.daysSinceSale)}d ago &middot; ${fmt(row.priceSpreadPct)}% spread</small>` : ''}</td>
                ${advanced ? `<td>${fmt(row.estimatedFee)}g</td>` : ''}<td class="market-opportunity-table-profit">+${fmt(row.estimatedProfit)}g${advanced ? '<small>per listing</small>' : ''}</td><td><strong>${fmt(row.margin)}%</strong></td>
                <td><button type="button" class="market-opportunity-exclude" data-exclude-opportunity="${escapeHtml(prefKey)}" title="Exclude this item"><i class="fas fa-eye-slash"></i></button></td>
            </tr>`;
        }).join('') : `<tr><td colspan="${advanced ? 10 : 9}" class="market-opportunities-no-match">No opportunities match this search.</td></tr>`;
        countTarget.textContent = `${fmt(sorted.length)} listing${sorted.length === 1 ? '' : 's'}`;
        pagination.innerHTML = pageCount > 1 ? `<button type="button" data-opportunity-page="${page - 1}" ${page === 0 ? 'disabled' : ''}><i class="fas fa-arrow-left"></i></button><span>Page ${page + 1} of ${pageCount}</span><button type="button" data-opportunity-page="${page + 1}" ${page >= pageCount - 1 ? 'disabled' : ''}><i class="fas fa-arrow-right"></i></button>` : '';
        pagination.querySelectorAll('[data-opportunity-page]').forEach((button) => button.addEventListener('click', () => { page = Number(button.dataset.opportunityPage) || 0; paint(); }));
        rowsTarget.querySelectorAll('[data-star-opportunity]').forEach((button) => button.addEventListener('click', () => {
            const key = button.dataset.starOpportunity;
            opportunitySettings.starredItems = opportunitySettings.starredItems.includes(key) ? opportunitySettings.starredItems.filter((item) => item !== key) : [...opportunitySettings.starredItems, key];
            saveSettings(); paint();
        }));
        rowsTarget.querySelectorAll('[data-exclude-opportunity]').forEach((button) => button.addEventListener('click', () => {
            const key = button.dataset.excludeOpportunity;
            if (!opportunitySettings.excludedItems.includes(key)) opportunitySettings.excludedItems.push(key);
            saveSettings(); renderCurrentResults(); renderConfigurationState();
        }));
    };
    search.addEventListener('input', () => { page = 0; paint(); });
    sort.addEventListener('change', () => { page = 0; paint(); });
    paint();
}

function renderCurrentResults() {
    const body = document.getElementById('marketOpportunitiesBody');
    const summary = document.getElementById('marketOpportunitiesSummary');
    if (!body) return;
    const qualified = qualifiedCandidates();
    if (!qualified.length) {
        body.innerHTML = `<div class="market-opportunities-empty"><i class="fas fa-sliders"></i><h4>No listings meet your thresholds</h4><p>${fmt(latestCandidates.length)} raw candidate${latestCandidates.length === 1 ? '' : 's'} were reviewed. Open Configuration to broaden the return, demand, or confidence requirements.</p></div>`;
    } else renderRows(body, qualified);
    if (summary && latestProvinceData) summary.textContent = `${qualified.length} of ${latestCandidates.length} candidates qualify across ${latestProvinceData.loadedValleys?.length || 0} valleys`;
    renderConfigurationState();
}

async function loadOpportunities() {
    const body = document.getElementById('marketOpportunitiesBody');
    const summary = document.getElementById('marketOpportunitiesSummary');
    if (!body) return;
    body.innerHTML = '<div class="market-opportunities-empty"><i class="fas fa-spinner fa-spin"></i><h4>Scanning province markets...</h4></div>';
    if (summary) summary.textContent = 'Comparing actual remote listings with your matching sales history';
    try {
        const [sales, provinceData] = await Promise.all([
            fetchOpportunitySales(opportunitySettings.historyDays),
            fetchProvinceMarketData({ supabase, currentCharacterId, getCurrentCharacter }), loadItemsData()
        ]);
        if (!provinceData) throw new Error('Select a character with a shard, province, and home valley first.');
        latestProvinceData = provinceData;
        latestCandidates = buildOpportunities(provinceData, buildHistoryIndex(sales), opportunitySettings.historyDays);
        renderCurrentResults();
    } catch (error) {
        body.innerHTML = `<div class="market-opportunities-empty market-opportunities-error"><i class="fas fa-triangle-exclamation"></i><h4>Market scan unavailable</h4><p>${escapeHtml(error?.message || 'Unable to load market data.')}</p></div>`;
        if (summary) summary.textContent = 'The scan could not be completed';
    }
}

function readConfiguration() {
    const number = (id, fallback) => { const value = Number(document.getElementById(id)?.value); return Number.isFinite(value) ? value : fallback; };
    return {
        ...opportunitySettings, preset: 'custom',
        displayMode: document.querySelector('[name="marketOpportunityDisplayMode"]:checked')?.value || 'simple',
        historyDays: number('marketOpportunitiesHistoryWindow', 180), minProfit: number('opportunityMinProfit', 10),
        minRoi: number('opportunityMinRoi', 75), minSales: number('opportunityMinSales', 3),
        minVelocity: number('opportunityMinVelocity', 1), maxDaysSinceSale: number('opportunityMaxDays', 60),
        maxPriceSpread: number('opportunityMaxSpread', 60),
        maxPurchasePrice: document.getElementById('opportunityMaxPurchase')?.value ? number('opportunityMaxPurchase', null) : null
    };
}

export function initializeMarketOpportunities() {
    const modal = document.getElementById('marketOpportunitiesModal');
    const openButton = document.getElementById('marketOpportunitiesSidebarBtn');
    if (!modal || !openButton) return;
    const close = () => modal.classList.add('hidden');
    const positionBelowHeader = () => {
        const header = document.querySelector('.header-area') || document.querySelector('header');
        modal.style.setProperty('--market-opportunities-top-offset', `${Math.round((header ? Math.max(0, header.getBoundingClientRect().bottom) : 86) + 16)}px`);
    };
    const selectTab = (tabName) => {
        modal.querySelectorAll('[data-market-opportunity-tab]').forEach((button) => button.classList.toggle('active', button.dataset.marketOpportunityTab === tabName));
        modal.querySelectorAll('[data-market-opportunity-panel]').forEach((panel) => panel.classList.toggle('hidden', panel.dataset.marketOpportunityPanel !== tabName));
        if (tabName === 'configuration') renderConfigurationState();
    };
    openButton.addEventListener('click', (event) => { event.preventDefault(); positionBelowHeader(); modal.classList.remove('hidden'); selectTab('listings'); renderConfigurationState(); loadOpportunities(); });
    modal.querySelectorAll('[data-close-market-opportunities]').forEach((button) => button.addEventListener('click', close));
    modal.querySelectorAll('[data-market-opportunity-tab]').forEach((button) => button.addEventListener('click', () => selectTab(button.dataset.marketOpportunityTab)));
    modal.querySelectorAll('[data-opportunity-preset]').forEach((button) => button.addEventListener('click', () => {
        const preset = button.dataset.opportunityPreset;
        const previousHistoryDays = opportunitySettings.historyDays;
        opportunitySettings = { ...opportunitySettings, ...PRESETS[preset], preset };
        saveSettings(); renderConfigurationState(); renderCurrentResults();
        if (previousHistoryDays !== opportunitySettings.historyDays) loadOpportunities();
    }));
    const configForm = document.getElementById('marketOpportunityConfigForm');
    configForm?.addEventListener('submit', (event) => {
        event.preventDefault();
        const previousDays = opportunitySettings.historyDays;
        opportunitySettings = readConfiguration(); saveSettings(); renderConfigurationState();
        if (previousDays !== opportunitySettings.historyDays) loadOpportunities(); else renderCurrentResults();
    });
    configForm?.addEventListener('input', () => {
        const previewSettings = readConfiguration();
        const preview = document.getElementById('marketOpportunityConfigPreview');
        if (preview) {
            const count = latestCandidates.filter((row) => exclusionReasons(row, previewSettings).length === 0).length;
            preview.innerHTML = `<strong>${fmt(count)}</strong> of ${fmt(latestCandidates.length)} raw candidates would meet these thresholds.`;
        }
    });
    modal.addEventListener('click', (event) => { if (event.target === modal) close(); });
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !modal.classList.contains('hidden')) close(); });
    document.addEventListener('characterChanged', () => { latestCandidates = []; latestProvinceData = null; if (!modal.classList.contains('hidden')) loadOpportunities(); });
    window.addEventListener('resize', () => { if (!modal.classList.contains('hidden')) positionBelowHeader(); });
}

document.addEventListener('DOMContentLoaded', initializeMarketOpportunities);
