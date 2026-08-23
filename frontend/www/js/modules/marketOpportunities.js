import { supabase } from '../supabaseClient.js';
import { currentCharacterId, getCurrentCharacter } from './characters.js';
import { fetchProvinceMarketData, fetchShardMarketData } from './addListingIntelligence.js';
import { getItemData, loadCompleteItemsData, loadItemsData } from '../services/gamingToolsService.js';

const SETTINGS_KEY = 'pda.marketOpportunitySettings.v1';
const COLUMN_WIDTHS_KEY = 'pda.marketOpportunityColumnWidths.v1';
const FEE_RATE = 0.05;
const OPPORTUNITIES_PAGE_SIZE = 25;
const VALLEY_GAPS_PAGE_SIZE = 15;
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
let latestMarketGaps = [];
let latestProvinceData = null;
let latestShardData = null;
let opportunitySettings = loadSettings();

const fmt = (value, digits = 0) => Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: digits });
const escapeHtml = (value) => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
const bareItemId = (value) => String(value || '').slice(String(value || '').lastIndexOf('/') + 1);
const fallbackItemName = (value) => bareItemId(value)
    .replace(/^(?:building_prop|bonusitems|item|resource)_+/i, '')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
const qualityKey = (itemId, mastercrafted, enchantmentTier) => `${bareItemId(itemId)}::${mastercrafted ? 1 : 0}::${Number(enchantmentTier) || 0}`;
const itemPreferenceKey = (row) => `${row.itemName}::${row.isMastercrafted ? 1 : 0}::${row.enchantmentTier || 0}`;
const listingRelation = (sale) => Array.isArray(sale.market_listings) ? sale.market_listings[0] : sale.market_listings;

function toGamingToolsEmbedUrl(itemId, fallbackUrl = '') {
    const bare = bareItemId(itemId);
    try {
        const fallback = new URL(fallbackUrl);
        if (fallback.hostname === 'paxdei.gaming.tools') {
            const parts = fallback.pathname.split('/').filter(Boolean);
            const sourceCategory = parts[0] || '';
            const fallbackId = parts.at(-1) || bare;
            if (sourceCategory === 'wearables') return `https://paxdei.gaming.tools/armor/${encodeURIComponent(fallbackId)}`;
            if (sourceCategory === 'wieldables') {
                const category = fallbackId.startsWith('wieldable_tool') ? 'tools'
                    : fallbackId.startsWith('wieldable_shield') ? 'shields' : 'weapons';
                return `https://paxdei.gaming.tools/${category}/${encodeURIComponent(fallbackId)}`;
            }
            const validCategories = new Set(['armor', 'weapons', 'tools', 'shields', 'consumables', 'gatherables', 'recipes', 'projectiles', 'props', 'materials', 'buildingpieces']);
            if (validCategories.has(sourceCategory) && fallbackId) return `https://paxdei.gaming.tools/${sourceCategory}/${encodeURIComponent(fallbackId)}`;
        }
    } catch { /* fall through to item-id inference */ }
    const prefix = bare.split('_')[0];
    const categories = {
        wearable: 'armor', wearables: 'armor', wieldable: 'weapons', wieldables: 'weapons',
        consumable: 'consumables', consumables: 'consumables', gatherable: 'gatherables', gatherables: 'gatherables',
        recipe: 'recipes', recipes: 'recipes', projectile: 'projectiles', projectiles: 'projectiles',
        building: 'props', props: 'props', material: 'materials', materials: 'materials', resource: 'gatherables'
    };
    if (bare.startsWith('wieldable_tool')) return `https://paxdei.gaming.tools/tools/${encodeURIComponent(bare)}`;
    if (bare.startsWith('wieldable_shield')) return `https://paxdei.gaming.tools/shields/${encodeURIComponent(bare)}`;
    if (categories[prefix]) return `https://paxdei.gaming.tools/${categories[prefix]}/${encodeURIComponent(bare)}`;
    return fallbackUrl || '#';
}

function itemLinkHtml(row) {
    const url = toGamingToolsEmbedUrl(row.itemId, row.itemUrl);
    const attributes = url === '#' ? 'data-no-tooltip aria-disabled="true"' : `href="${escapeHtml(row.itemUrl || url)}" data-tooltip-href="${escapeHtml(url)}" target="_blank" rel="noopener"`;
    return `<a ${attributes} class="market-opportunity-item-link">${escapeHtml(row.itemName)}</a>`;
}

function enableColumnResizing(table, storageSuffix) {
    if (!table || table.dataset.columnsResizable === 'true') return;
    table.dataset.columnsResizable = 'true';
    const headers = [...table.querySelectorAll('thead th')];
    const key = `${COLUMN_WIDTHS_KEY}.${storageSuffix}`;
    let saved = [];
    try { saved = JSON.parse(localStorage.getItem(key) || '[]'); } catch { saved = []; }
    if (saved.length === headers.length) {
        table.classList.add('has-resized-columns');
        headers.forEach((header, index) => { if (saved[index] > 40) header.style.width = `${saved[index]}px`; });
    }
    headers.slice(0, -1).forEach((header) => {
        const handle = document.createElement('span');
        handle.className = 'market-column-resize-handle';
        handle.setAttribute('role', 'separator');
        handle.setAttribute('aria-orientation', 'vertical');
        handle.title = 'Drag to resize column · double-click to reset';
        header.appendChild(handle);
        handle.addEventListener('pointerdown', (event) => {
            event.preventDefault();
            const initial = headers.map((cell) => Math.round(cell.getBoundingClientRect().width));
            headers.forEach((cell, index) => { cell.style.width = `${initial[index]}px`; });
            table.classList.add('has-resized-columns');
            document.body.classList.add('market-column-resizing');
            const index = headers.indexOf(header);
            const startX = event.clientX;
            const startWidth = initial[index];
            const move = (moveEvent) => { header.style.width = `${Math.max(70, startWidth + moveEvent.clientX - startX)}px`; };
            const finish = () => {
                document.removeEventListener('pointermove', move);
                document.removeEventListener('pointerup', finish);
                document.body.classList.remove('market-column-resizing');
                try { localStorage.setItem(key, JSON.stringify(headers.map((cell) => Math.round(cell.getBoundingClientRect().width)))); } catch { /* optional persistence */ }
            };
            document.addEventListener('pointermove', move);
            document.addEventListener('pointerup', finish, { once: true });
        });
        handle.addEventListener('dblclick', (event) => {
            event.preventDefault();
            headers.forEach((cell) => { cell.style.width = ''; });
            table.classList.remove('has-resized-columns');
            try { localStorage.removeItem(key); } catch { /* optional persistence */ }
        });
    });
}

function classifyGapAnomaly(gapPct, afterFeeGap) {
    if (gapPct >= 1000 && afterFeeGap >= 500) return 'extreme';
    if (gapPct >= 250 && afterFeeGap >= 100) return 'large';
    return null;
}

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

function showSettingsSavedToast(modal) {
    modal.querySelector('[data-market-opportunity-toast]')?.remove();
    const toast = document.createElement('div');
    toast.className = 'market-opportunity-toast';
    toast.dataset.marketOpportunityToast = '';
    toast.setAttribute('role', 'status');
    toast.innerHTML = '<i class="fas fa-check-circle"></i><span>Opportunity settings saved</span>';
    modal.appendChild(toast);
    setTimeout(() => toast.classList.add('leaving'), 1800);
    setTimeout(() => toast.remove(), 2200);
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
    const pageSize = 1000;
    const sales = [];
    for (let offset = 0; offset < 10000; offset += pageSize) {
        const { data, error } = await supabase.from('sales')
            .select('quantity_sold, total_sale_price, sale_date, market_listings!inner(item_id, is_mastercrafted, enchantment_tier, items(item_name, pax_dei_slug))')
            .eq('character_id', currentCharacterId).gte('sale_date', cutoff)
            .order('sale_date', { ascending: false }).range(offset, offset + pageSize - 1);
        if (error) throw error;
        sales.push(...(data || []));
        if (!data || data.length < pageSize) break;
    }
    return sales;
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
        const item = getItemData(listing.item_id, history.itemName);
        return {
            itemId: listing.item_id, itemName: history.itemName, itemUrl: item?.url || null, iconPath: item?.iconPath || null,
            valley: listing._homeValley || 'Unknown valley', quantity, acquisitionCost,
            unitCost: acquisitionCost / quantity, historicalUnitValue: history.unitValue, historicalValue,
            estimatedFee, estimatedProfit, margin: (estimatedProfit / acquisitionCost) * 100,
            saleCount: history.saleCount, newestSale: history.newestSale, daysSinceSale,
            velocity: history.saleCount / (historyDays / 30), priceSpreadPct: history.priceSpreadPct,
            isMastercrafted: !!listing.mastercraft, enchantmentTier: Number(listing.enchantment_level) || 0
        };
    }).filter(Boolean);
}

function buildValleyPriceGaps(provinceData, historyIndex = new Map()) {
    const groups = new Map();
    for (const listing of provinceData?.listings || []) {
        const quantity = Math.max(Number(listing.quantity) || 1, 1);
        const stackPrice = Number(listing.price) || 0;
        const province = listing._province || provinceData?.province || 'Unknown province';
        const valley = listing._homeValley || 'Unknown valley';
        if (!(stackPrice > 0)) continue;
        const key = qualityKey(listing.item_id, listing.mastercraft, listing.enchantment_level);
        if (!groups.has(key)) groups.set(key, new Map());
        const unitPrice = stackPrice / quantity;
        const locationKey = `${province}::${valley}`;
        const current = groups.get(key).get(locationKey);
        if (!current) {
            groups.get(key).set(locationKey, { listing, quantity, stackPrice, unitPrice, province, valley, listingCount: 1 });
        } else {
            current.listingCount += 1;
            if (unitPrice < current.unitPrice) {
                groups.get(key).set(locationKey, { listing, quantity, stackPrice, unitPrice, province, valley, listingCount: current.listingCount });
            }
        }
    }

    const gaps = [];
    for (const valleyFloors of groups.values()) {
        if (valleyFloors.size < 2) continue;
        const floors = [...valleyFloors.values()].sort((a, b) => a.unitPrice - b.unitPrice);
        const source = floors[0];
        const comparisonFloors = floors.slice(1);
        const destination = comparisonFloors[Math.floor((comparisonFloors.length - 1) / 2)];
        if (!(destination.unitPrice > source.unitPrice)) continue;
        const history = historyIndex.get(qualityKey(source.listing.item_id, source.listing.mastercraft, source.listing.enchantment_level)) || null;
        const historicalUnitValue = history?.unitValue || null;
        const evidenceLevel = !history ? 'none'
            : historicalUnitValue >= destination.unitPrice * 0.8 ? 'supports'
                : historicalUnitValue > source.unitPrice * 1.05 ? 'mixed' : 'contradicts';
        const supportedUnitValue = history ? Math.min(destination.unitPrice, historicalUnitValue) : destination.unitPrice;
        const comparisonValue = supportedUnitValue * source.quantity;
        const estimatedFee = Math.ceil(comparisonValue * FEE_RATE);
        const afterFeeGap = comparisonValue - estimatedFee - source.stackPrice;
        if (!(afterFeeGap > 0)) continue;
        const gapPct = ((destination.unitPrice - source.unitPrice) / source.unitPrice) * 100;
        const anomalyLevel = classifyGapAnomaly(gapPct, afterFeeGap);
        const stackMultiple = source.quantity / destination.quantity;
        const travelLevel = source.province !== provinceData?.homeProvince ? 'cross-province'
            : source.valley === provinceData?.homeValley ? 'home-valley' : 'same-province';
        let riskScore = 0;
        if (stackMultiple > 5) riskScore += 2;
        else if (stackMultiple > 2) riskScore += 1;
        if (destination.listingCount === 1) riskScore += 2;
        else if (destination.listingCount < 3) riskScore += 1;
        if (anomalyLevel === 'extreme') riskScore += 1;
        if (evidenceLevel === 'contradicts') riskScore += 2;
        else if (evidenceLevel === 'mixed') riskScore += 1;
        if (travelLevel === 'cross-province') riskScore += 1;
        const item = getItemData(source.listing.item_id);
        gaps.push({
            itemId: source.listing.item_id,
            itemName: item?.name || fallbackItemName(source.listing.item_id),
            itemUrl: item?.url || null,
            iconPath: item?.iconPath || null,
            isMastercrafted: !!source.listing.mastercraft,
            enchantmentTier: Number(source.listing.enchantment_level) || 0,
            sourceProvince: source.province,
            sourceValley: source.valley,
            sourceLocation: `${source.province} / ${source.valley}`,
            destinationProvince: destination.province,
            destinationValley: destination.valley,
            destinationQuantity: destination.quantity,
            destinationStackPrice: destination.stackPrice,
            quantity: source.quantity,
            sourceStackPrice: source.stackPrice,
            sourceUnitPrice: source.unitPrice,
            destinationUnitPrice: destination.unitPrice,
            supportedUnitValue,
            comparisonValue,
            estimatedFee,
            afterFeeGap,
            gapPct,
            anomalyLevel,
            stackMultiple,
            referenceCount: destination.listingCount,
            comparisonValleyCount: comparisonFloors.length,
            historicalUnitValue,
            historicalSaleCount: history?.saleCount || 0,
            historicalDaysSinceSale: history ? Math.max(0, Math.round((Date.now() - history.newestSale) / 864e5)) : null,
            evidenceLevel,
            travelLevel,
            riskLevel: riskScore >= 4 ? 'high' : riskScore >= 2 ? 'caution' : 'lower',
            valleyCount: valleyFloors.size
        });
    }
    return gaps.sort((a, b) => b.afterFeeGap - a.afterFeeGap || b.gapPct - a.gapPct);
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
                <td><div class="market-opportunity-item">${row.iconPath ? `<img src="${escapeHtml(row.iconPath)}" alt="" loading="lazy" onerror="this.style.display='none'">` : '<span class="market-opportunity-icon-fallback"><i class="fas fa-box"></i></span>'}<span><strong>${itemLinkHtml(row)}</strong><small>${escapeHtml(qualityLabel(row))}</small></span></div></td>
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
    enableColumnResizing(target.querySelector('.market-opportunities-table'), advanced ? 'listings-advanced' : 'listings-simple');
    paint();
}

function renderValleyPriceGaps() {
    const target = document.getElementById('marketValleyGapsBody');
    if (!target) return;
    if (!latestShardData) {
        target.innerHTML = '<div class="market-opportunities-empty"><i class="fas fa-spinner fa-spin"></i><h4>Scanning province markets...</h4></div>';
        return;
    }
    const locations = (latestShardData.loadedLocations || []).slice()
        .sort((a, b) => a.province.localeCompare(b.province) || a.valley.localeCompare(b.valley));
    const homeValley = latestProvinceData?.homeValley || 'Home valley';
    const homeProvince = latestProvinceData?.province || 'Home province';
    const advanced = opportunitySettings.displayMode === 'advanced';
    target.innerHTML = `
        <div class="market-opportunities-toolbar market-valley-gaps-toolbar">
            <label><i class="fas fa-search"></i><input type="search" placeholder="Search items" autocomplete="off"></label>
            <select data-gap-filter="valley" aria-label="Filter by item location"><option value="">All locations</option>${locations.map((row) => { const location = `${row.province} / ${row.valley}`; return `<option value="${escapeHtml(location)}">${escapeHtml(location)}</option>`; }).join('')}</select>
            <select data-gap-filter="minimum" aria-label="Minimum live price gap"><option value="0">Any gap</option><option value="25">25%+ gap</option><option value="50">50%+ gap</option><option value="100">100%+ gap</option><option value="250">250%+ gap</option><option value="500">500%+ gap</option><option value="1000">1,000%+ gap</option><option value="2500">2,500%+ gap</option><option value="5000">5,000%+ gap</option></select>
            <select data-gap-filter="purchase" aria-label="Maximum purchase price"><option value="0">Any purchase price</option><option value="100">Up to 100g</option><option value="500">Up to 500g</option><option value="1000">Up to 1,000g</option><option value="2500">Up to 2,500g</option><option value="5000">Up to 5,000g</option><option value="10000">Up to 10,000g</option><option value="25000">Up to 25,000g</option><option value="50000">Up to 50,000g</option></select>
            <select data-gap-filter="sort" aria-label="Sort valley price gaps"><option value="net">Largest after-fee gap</option><option value="percent">Largest percentage gap</option><option value="price">Lowest purchase price</option><option value="item">Item name</option></select>
            <span></span>
        </div>
        <div class="market-gap-signal-filters" aria-label="Filter by opportunity signals">
            <span>Signals</span>
            <button type="button" data-gap-signal="stack">Large stack</button>
            <button type="button" data-gap-signal="reference">One reference</button>
            <span class="market-gap-filter-divider"></span>
            <button type="button" data-gap-signal="anomaly:large">Large gap</button>
            <button type="button" data-gap-signal="anomaly:extreme">Extreme gap</button>
            <span class="market-gap-filter-divider"></span>
            <button type="button" data-gap-signal="evidence:supports">Sales supported</button>
            <button type="button" data-gap-signal="evidence:mixed">Mixed evidence</button>
            <button type="button" data-gap-signal="evidence:none">No history</button>
            <span class="market-gap-filter-divider"></span>
            <button type="button" data-gap-signal="travel:home-valley">Home valley (${escapeHtml(homeValley)})</button>
            <button type="button" data-gap-signal="travel:same-province">Same province (${escapeHtml(homeProvince)})</button>
            <button type="button" data-gap-signal="travel:cross-province">Cross-province</button>
            <button type="button" class="market-gap-clear-signals" data-clear-gap-signals disabled>Clear</button>
        </div>
        <div class="market-gap-results-layout">
            <nav class="market-gap-risk-tabs" aria-label="Filter opportunities by risk">
                <button type="button" class="active all" data-gap-risk-tab="" aria-label="All opportunities"><i class="fas fa-list"></i><span class="market-risk-tooltip">All opportunities</span></button>
                <button type="button" class="lower" data-gap-risk-tab="lower" aria-label="Lower risk"><i class="fas fa-shield-halved"></i><span class="market-risk-tooltip">Lower risk</span></button>
                <button type="button" class="caution" data-gap-risk-tab="caution" aria-label="Caution"><i class="fas fa-triangle-exclamation"></i><span class="market-risk-tooltip">Caution</span></button>
                <button type="button" class="high" data-gap-risk-tab="high" aria-label="High risk"><i class="fas fa-fire"></i><span class="market-risk-tooltip">High risk</span></button>
            </nav>
            <div class="market-gap-table-shell">
                <div class="market-opportunities-table-wrap"><table class="market-opportunities-table valley-gaps ${advanced ? 'advanced' : 'simple'}"><thead><tr>
                    ${advanced
                        ? '<th>Item</th><th>Buy location</th><th>Listed stack</th><th>Live comparison</th><th>Sales evidence</th><th>Signals</th><th>After-fee gap</th>'
                        : '<th>Item</th><th>Buy this stack</th><th>Compared with</th><th>Evidence & travel</th><th>Potential gap</th><th>Risk</th>'}
                </tr></thead><tbody></tbody></table></div>
                <div class="market-opportunities-pagination"></div>
            </div>
        </div>`;
    const search = target.querySelector('input');
    const valleyFilter = target.querySelector('[data-gap-filter="valley"]');
    const minimumFilter = target.querySelector('[data-gap-filter="minimum"]');
    const purchaseFilter = target.querySelector('[data-gap-filter="purchase"]');
    const sort = target.querySelector('[data-gap-filter="sort"]');
    const rowsTarget = target.querySelector('tbody');
    const countTarget = target.querySelector('.market-opportunities-toolbar > span');
    const pagination = target.querySelector('.market-opportunities-pagination');
    const signalButtons = [...target.querySelectorAll('[data-gap-signal]')];
    const riskTabs = [...target.querySelectorAll('[data-gap-risk-tab]')];
    const clearSignals = target.querySelector('[data-clear-gap-signals]');
    const selectedSignals = new Set();
    let selectedRisk = '';
    let page = 0;
    const paint = () => {
        const query = search.value.trim().toLowerCase();
        const minimum = Number(minimumFilter.value) || 0;
        const maximumPurchase = Number(purchaseFilter.value) || 0;
        const selectedAnomalies = [...selectedSignals].filter((value) => value.startsWith('anomaly:')).map((value) => value.slice(8));
        const selectedEvidence = [...selectedSignals].filter((value) => value.startsWith('evidence:')).map((value) => value.slice(9));
        const selectedTravel = [...selectedSignals].filter((value) => value.startsWith('travel:')).map((value) => value.slice(7));
        const rows = latestMarketGaps.filter((row) => {
            return (!query || row.itemName.toLowerCase().includes(query))
                && (!valleyFilter.value || row.sourceLocation === valleyFilter.value)
                && row.gapPct >= minimum
                && (!(maximumPurchase > 0) || row.sourceStackPrice <= maximumPurchase)
                && row.afterFeeGap >= opportunitySettings.minProfit
                && ((row.afterFeeGap / row.sourceStackPrice) * 100) >= opportunitySettings.minRoi
                && (!(opportunitySettings.maxPurchasePrice > 0) || row.sourceStackPrice <= opportunitySettings.maxPurchasePrice)
                && (!selectedRisk || row.riskLevel === selectedRisk)
                && (!selectedSignals.has('stack') || row.stackMultiple > 2)
                && (!selectedSignals.has('reference') || row.referenceCount === 1)
                && (!selectedAnomalies.length || selectedAnomalies.includes(row.anomalyLevel))
                && (!selectedEvidence.length || selectedEvidence.includes(row.evidenceLevel))
                && (!selectedTravel.length || selectedTravel.includes(row.travelLevel));
        });
        rows.sort((a, b) => {
            if (sort.value === 'percent') return b.gapPct - a.gapPct || b.afterFeeGap - a.afterFeeGap;
            if (sort.value === 'price') return a.sourceStackPrice - b.sourceStackPrice || b.gapPct - a.gapPct;
            if (sort.value === 'item') return a.itemName.localeCompare(b.itemName) || a.sourceStackPrice - b.sourceStackPrice;
            return b.afterFeeGap - a.afterFeeGap || b.gapPct - a.gapPct;
        });
        const pageCount = Math.max(1, Math.ceil(rows.length / VALLEY_GAPS_PAGE_SIZE));
        page = Math.min(page, pageCount - 1);
        const visible = rows.slice(page * VALLEY_GAPS_PAGE_SIZE, (page + 1) * VALLEY_GAPS_PAGE_SIZE);
        rowsTarget.innerHTML = visible.length ? visible.map((row) => {
            const itemCell = `<td><div class="market-opportunity-item">${row.iconPath ? `<img src="${escapeHtml(row.iconPath)}" alt="" loading="lazy" onerror="this.style.display='none'">` : '<span class="market-opportunity-icon-fallback"><i class="fas fa-box"></i></span>'}<strong>${itemLinkHtml(row)}</strong>${qualityLabel(row) !== 'Standard' ? `<span class="market-gap-quality">${escapeHtml(qualityLabel(row))}</span>` : ''}</div></td>`;
            const riskLabel = row.riskLevel === 'high' ? 'High risk' : row.riskLevel === 'caution' ? 'Caution' : 'Lower risk';
            const evidenceLabel = row.evidenceLevel === 'supports' ? 'Supported by sales' : row.evidenceLevel === 'mixed' ? 'Partial sales support' : row.evidenceLevel === 'contradicts' ? 'Contradicted by sales' : 'No sales history';
            const evidenceClass = row.evidenceLevel === 'supports' ? 'supports' : row.evidenceLevel === 'mixed' ? 'mixed' : row.evidenceLevel === 'contradicts' ? 'contradicts' : 'none';
            const travelLabel = row.travelLevel === 'home-valley' ? `Home valley (${homeValley})`
                : row.travelLevel === 'same-province' ? `Same province (${homeProvince})` : 'Cross-province';
            const travelClass = row.travelLevel;
            const anomalySignal = row.anomalyLevel === 'extreme'
                ? '<span class="market-gap-signal anomaly">Extreme gap</span>'
                : row.anomalyLevel === 'large' ? '<span class="market-gap-signal anomaly">Large gap</span>' : '';
            if (!advanced) return `<tr>${itemCell}
                <td class="market-gap-deal-cell"><strong>${fmt(row.quantity)} for ${fmt(row.sourceStackPrice)}g <span class="market-gap-price-location">(${escapeHtml(row.sourceValley)})</span></strong></td>
                <td class="market-gap-deal-cell market-gap-compare-cell"><strong>${fmt(row.destinationQuantity)} for ${fmt(row.destinationStackPrice)}g <span class="market-gap-price-location">(${escapeHtml(row.destinationValley)})</span></strong></td>
                <td><div class="market-simple-pill-group"><span class="market-evidence-signal ${evidenceClass}">${evidenceLabel}</span><span class="market-travel-signal ${travelClass}">${travelLabel}</span></div></td>
                <td class="market-opportunity-table-profit">+${fmt(row.afterFeeGap)}g <span class="market-gap-percent">(${fmt(row.gapPct)}%)</span><span>${fmt(row.comparisonValue)}g potential sale · ${fmt(row.quantity)} units</span></td>
                <td class="market-gap-risk-cell"><div class="market-simple-pill-group"><span class="market-gap-signal ${row.riskLevel}">${riskLabel}</span>${anomalySignal}</div></td></tr>`;
            const supportingSignals = `${row.travelLevel === 'cross-province' ? '<span class="market-gap-signal neutral">Cross-province</span>' : row.travelLevel === 'home-valley' ? '<span class="market-gap-signal neutral">Home valley</span>' : '<span class="market-gap-signal neutral">Same province</span>'}${row.stackMultiple > 2 ? `<span class="market-gap-signal neutral">${fmt(row.stackMultiple, 1)}× stack</span>` : ''}${row.referenceCount === 1 ? '<span class="market-gap-signal neutral">1 reference</span>' : ''}${row.anomalyLevel === 'extreme' ? '<span class="market-gap-signal anomaly">Extreme gap</span>' : row.anomalyLevel === 'large' ? '<span class="market-gap-signal anomaly">Large gap</span>' : ''}`;
            return `<tr>${itemCell}
                <td><span class="market-opportunity-valley market-gap-cell-primary">${escapeHtml(row.sourceValley)}</span><span class="market-gap-cell-detail">${escapeHtml(row.sourceProvince)}</span></td>
                <td><strong class="market-gap-cell-primary">${fmt(row.quantity)} for ${fmt(row.sourceStackPrice)}g</strong><span class="market-gap-cell-detail">${fmt(row.sourceUnitPrice, 2)}g/unit</span></td>
                <td><span class="market-opportunity-valley market-gap-compare-location market-gap-cell-primary">${escapeHtml(row.destinationValley)} <span class="market-gap-primary-context">(${escapeHtml(row.destinationProvince)})</span></span><span class="market-gap-cell-detail">${fmt(row.destinationQuantity)} for ${fmt(row.destinationStackPrice)}g · ${fmt(row.destinationUnitPrice, 2)}g/unit</span></td>
                <td class="market-gap-evidence-cell"><span class="market-evidence-signal ${evidenceClass}">${evidenceLabel}</span><span class="market-gap-cell-detail">${row.historicalSaleCount ? `${fmt(row.historicalSaleCount)} sales · ${fmt(row.historicalUnitValue, 2)}g/unit · ${fmt(row.historicalDaysSinceSale)}d ago` : 'Live asking prices only'}</span></td>
                <td class="market-gap-signals-cell"><div class="market-gap-signals"><div><span class="market-gap-signal ${row.riskLevel}">${riskLabel}</span></div><div class="market-gap-signals-secondary">${supportingSignals || '<span class="market-gap-cell-detail">No added warnings</span>'}</div></div></td>
                <td class="market-opportunity-table-profit"><span class="market-gap-cell-primary">+${fmt(row.afterFeeGap)}g <span class="market-gap-percent">(${fmt(row.gapPct)}%)</span></span><span class="market-gap-cell-detail">${fmt(row.estimatedFee)}g fee · ${fmt(row.supportedUnitValue, 2)}g/unit basis</span></td></tr>`;
        }).join('') : `<tr><td colspan="${advanced ? 7 : 6}" class="market-opportunities-no-match">No opportunities match these filters.</td></tr>`;
        countTarget.textContent = `${fmt(rows.length)} result${rows.length === 1 ? '' : 's'}`;
        pagination.innerHTML = pageCount > 1 ? `<button type="button" data-gap-page="${page - 1}" ${page === 0 ? 'disabled' : ''}><i class="fas fa-arrow-left"></i></button><span>Page ${page + 1} of ${pageCount}</span><button type="button" data-gap-page="${page + 1}" ${page >= pageCount - 1 ? 'disabled' : ''}><i class="fas fa-arrow-right"></i></button>` : '';
        pagination.querySelectorAll('[data-gap-page]').forEach((button) => button.addEventListener('click', () => { page = Number(button.dataset.gapPage) || 0; paint(); }));
    };
    search.addEventListener('input', () => { page = 0; paint(); });
    [valleyFilter, minimumFilter, purchaseFilter, sort].forEach((control) => control.addEventListener('change', () => { page = 0; paint(); }));
    signalButtons.forEach((button) => button.addEventListener('click', () => {
        const signal = button.dataset.gapSignal;
        if (selectedSignals.has(signal)) selectedSignals.delete(signal);
        else selectedSignals.add(signal);
        button.classList.toggle('active', selectedSignals.has(signal));
        button.setAttribute('aria-pressed', selectedSignals.has(signal) ? 'true' : 'false');
        clearSignals.disabled = selectedSignals.size === 0 && !selectedRisk;
        page = 0;
        paint();
    }));
    riskTabs.forEach((button) => button.addEventListener('click', () => {
        selectedRisk = button.dataset.gapRiskTab || '';
        riskTabs.forEach((tab) => {
            const active = (tab.dataset.gapRiskTab || '') === selectedRisk;
            tab.classList.toggle('active', active);
            tab.setAttribute('aria-pressed', active ? 'true' : 'false');
        });
        clearSignals.disabled = selectedSignals.size === 0 && !selectedRisk;
        page = 0;
        paint();
    }));
    clearSignals.addEventListener('click', () => {
        selectedSignals.clear();
        selectedRisk = '';
        signalButtons.forEach((button) => { button.classList.remove('active'); button.setAttribute('aria-pressed', 'false'); });
        riskTabs.forEach((tab) => {
            const active = !tab.dataset.gapRiskTab;
            tab.classList.toggle('active', active);
            tab.setAttribute('aria-pressed', active ? 'true' : 'false');
        });
        clearSignals.disabled = true;
        page = 0;
        paint();
    });
    enableColumnResizing(target.querySelector('.market-opportunities-table'), advanced ? 'gaps-advanced' : 'gaps-simple');
    paint();
}

function renderCurrentResults() {
    const body = document.getElementById('marketOpportunitiesBody');
    if (!body) return;
    const qualified = qualifiedCandidates();
    if (!qualified.length) {
        body.innerHTML = `<div class="market-opportunities-empty"><i class="fas fa-sliders"></i><h4>No listings meet your thresholds</h4><p>${fmt(latestCandidates.length)} raw candidate${latestCandidates.length === 1 ? '' : 's'} were reviewed. Open Configuration to broaden the return, demand, or confidence requirements.</p></div>`;
    } else renderRows(body, qualified);
    renderConfigurationState();
}

async function loadOpportunities() {
    const body = document.getElementById('marketOpportunitiesBody');
    if (!body) return;
    body.innerHTML = '<div class="market-opportunities-empty"><i class="fas fa-spinner fa-spin"></i><h4>Scanning province markets...</h4></div>';
    try {
        const [sales, provinceData, shardData] = await Promise.all([
            fetchOpportunitySales(opportunitySettings.historyDays),
            fetchProvinceMarketData({ supabase, currentCharacterId, getCurrentCharacter }),
            fetchShardMarketData({ supabase, currentCharacterId, getCurrentCharacter }),
            loadItemsData(),
            loadCompleteItemsData()
        ]);
        if (!provinceData || !shardData) throw new Error('Select a character with a shard, province, and home valley first.');
        latestProvinceData = provinceData;
        latestShardData = shardData;
        const historyIndex = buildHistoryIndex(sales);
        latestCandidates = buildOpportunities(provinceData, historyIndex, opportunitySettings.historyDays);
        latestMarketGaps = buildValleyPriceGaps({ ...shardData, homeProvince: provinceData.province, homeValley: provinceData.homeValley }, historyIndex);
        renderCurrentResults();
        renderValleyPriceGaps();
    } catch (error) {
        body.innerHTML = `<div class="market-opportunities-empty market-opportunities-error"><i class="fas fa-triangle-exclamation"></i><h4>Market scan unavailable</h4><p>${escapeHtml(error?.message || 'Unable to load market data.')}</p></div>`;
    }
}

function readConfiguration() {
    const number = (id, fallback) => { const value = Number(document.getElementById(id)?.value); return Number.isFinite(value) ? value : fallback; };
    return {
        ...opportunitySettings, preset: 'custom',
        displayMode: document.querySelector('[name="marketOpportunityDisplayMode"]:checked')?.value || 'simple',
        historyDays: number('marketOpportunitiesHistoryWindow', 180), minProfit: number('opportunityMinProfit', 10),
        minRoi: number('opportunityMinRoi', 75), minSales: number('opportunityMinSales', 3),
        minVelocity: number('opportunityMinVelocity', 1), maxDaysSinceSale: Math.min(365, Math.max(1, number('opportunityMaxDays', 60))),
        maxPriceSpread: number('opportunityMaxSpread', 60),
        maxPurchasePrice: document.getElementById('opportunityMaxPurchase')?.value ? number('opportunityMaxPurchase', null) : null
    };
}

export function initializeMarketOpportunities() {
    const modal = document.getElementById('marketOpportunitiesModal') || document.getElementById('marketOpportunitiesPage');
    const openButton = document.getElementById('marketOpportunitiesSidebarBtn');
    const standalonePage = modal?.id === 'marketOpportunitiesPage';
    if (!modal || (!openButton && !standalonePage)) return;
    if (modal.dataset.marketOpportunitiesInitialized === 'true') return;
    modal.dataset.marketOpportunitiesInitialized = 'true';
    const close = () => {
        modal.classList.add('hidden');
        document.body.classList.remove('market-opportunities-modal-open');
    };
    const positionBelowHeader = () => {
        const header = document.querySelector('.header-area') || document.querySelector('header');
        modal.style.setProperty('--market-opportunities-top-offset', `${Math.round((header ? Math.max(0, header.getBoundingClientRect().bottom) : 86) + 16)}px`);
    };
    const selectTab = (tabName) => {
        modal.querySelectorAll('[data-market-opportunity-tab]').forEach((button) => button.classList.toggle('active', button.dataset.marketOpportunityTab === tabName));
        modal.querySelectorAll('[data-market-opportunity-panel]').forEach((panel) => panel.classList.toggle('hidden', panel.dataset.marketOpportunityPanel !== tabName));
        if (tabName === 'configuration') renderConfigurationState();
        if (tabName === 'gaps') renderValleyPriceGaps();
    };
    openButton?.addEventListener('click', (event) => {
        event.preventDefault();
        positionBelowHeader();
        modal.classList.remove('hidden');
        document.body.classList.add('market-opportunities-modal-open');
        selectTab('gaps');
        renderConfigurationState();
        loadOpportunities();
    });
    if (!standalonePage) modal.querySelectorAll('[data-close-market-opportunities]').forEach((button) => button.addEventListener('click', close));
    modal.querySelectorAll('[data-market-opportunity-tab]').forEach((button) => button.addEventListener('click', (event) => {
        event.preventDefault();
        selectTab(button.dataset.marketOpportunityTab);
    }));
    modal.querySelectorAll('[name="marketOpportunityDisplayMode"]').forEach((input) => input.addEventListener('change', () => {
        if (!input.checked) return;
        opportunitySettings = { ...opportunitySettings, displayMode: input.value === 'advanced' ? 'advanced' : 'simple' };
        saveSettings();
        renderCurrentResults();
        renderValleyPriceGaps();
        showSettingsSavedToast(modal);
    }));
    modal.querySelectorAll('[data-opportunity-preset]').forEach((button) => button.addEventListener('click', () => {
        const preset = button.dataset.opportunityPreset;
        const previousHistoryDays = opportunitySettings.historyDays;
        opportunitySettings = { ...opportunitySettings, ...PRESETS[preset], preset };
        saveSettings(); renderConfigurationState(); renderCurrentResults();
        showSettingsSavedToast(modal);
        if (previousHistoryDays !== opportunitySettings.historyDays) loadOpportunities();
    }));
    const configForm = document.getElementById('marketOpportunityConfigForm');
    let autosaveTimer = null;
    configForm?.addEventListener('submit', (event) => {
        event.preventDefault();
    });
    configForm?.addEventListener('input', (event) => {
        if (event.target?.name === 'marketOpportunityDisplayMode') return;
        clearTimeout(autosaveTimer);
        autosaveTimer = setTimeout(() => {
            const previousDays = opportunitySettings.historyDays;
            opportunitySettings = readConfiguration();
            saveSettings();
            if (previousDays !== opportunitySettings.historyDays) loadOpportunities();
            else { renderCurrentResults(); renderValleyPriceGaps(); }
            showSettingsSavedToast(modal);
        }, 600);
    });
    if (!standalonePage) {
        modal.addEventListener('click', (event) => { if (event.target === modal) close(); });
        document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !modal.classList.contains('hidden')) close(); });
    }
    document.addEventListener('characterChanged', () => { latestCandidates = []; latestMarketGaps = []; latestProvinceData = null; latestShardData = null; if (!modal.classList.contains('hidden')) loadOpportunities(); });
    window.addEventListener('resize', () => { if (!modal.classList.contains('hidden')) positionBelowHeader(); });
    if (standalonePage) {
        modal.classList.remove('hidden');
        selectTab('gaps');
        renderConfigurationState();
        loadOpportunities();
    }
}

document.addEventListener('DOMContentLoaded', initializeMarketOpportunities);
