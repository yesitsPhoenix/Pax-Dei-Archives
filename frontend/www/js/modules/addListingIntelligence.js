import { getCompetitiveThresholds, classifyCompetitiveGap } from './pricingBands.js';

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

export function buildAddListingSuggestion(md, qualityMd, hist, count, stacks, isMastercrafted, enchantmentTier) {
    const ENCHANT_PREMIUMS = [0, 0.10, 0.20, 0.30];
    const mcPremium   = isMastercrafted ? 0.15 : 0;
    const encPremium  = ENCHANT_PREMIUMS[enchantmentTier || 0] || 0;
    const qualityMult = (1 + mcPremium) * (1 + encPremium);
    const isQuality   = isMastercrafted || ((enchantmentTier || 0) > 0);

    const effectiveMd = qualityMd || (md && isQuality ? {
        marketLow:     parseFloat((md.marketLow  * qualityMult).toFixed(2)),
        marketAvg:     parseFloat((md.marketAvg  * qualityMult).toFixed(2)),
        totalListings: null,
        isEstimated:   true
    } : md);

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
        if (lowSupply) {
            suggestedPerStack = Math.round(effectiveMd.marketLow * count * 1.1);
            insight           = `Only ${effectiveMd.totalListings} listing${effectiveMd.totalListings !== 1 ? 's' : ''} - no competition, priced 10% above market low.`;
            insightClass      = 'text-emerald-400';
        } else {
            suggestedPerStack = Math.round(effectiveMd.marketLow * count);
            insight           = 'No sales history yet - market low used as baseline.';
            insightClass      = 'text-gray-400';
        }
    } else if (hasHist && hasCount) {
        const bestHistPerUnit = Math.max(effectiveHist.maxPerUnit || 0, effectiveHist.avgPerUnit || 0);
        suggestedPerStack = Math.round(bestHistPerUnit * count * 1.10);
        insight           = 'No live market listings - you can set the price. Priced 10% above your best historical sale.';
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

function getRelativeTime(isoDate) {
    const diff = Date.now() - new Date(isoDate).getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return 'today';
    if (days === 1) return 'yesterday';
    if (days < 30) return `${days}d ago`;
    const months = Math.floor(days / 30);
    return months === 1 ? '1 month ago' : `${months} months ago`;
}

export function createAddListingIntelligenceController({
    supabase,
    getCurrentCharacterId,
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

        if (!md && !hist && !loading) {
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

        const displayMd = qualityMd || md;
        const supplyCount = displayMd?.totalListings ?? 0;
        const supplyTag = displayMd
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
                    ${qualityMd && md ? `
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

        const suggestion = buildAddListingSuggestion(md, qualityMd, hist, count, stacks, isMastercrafted, enchantmentTier);

        let competitiveCard = '';
        const stackMarketLow = (displayMd && hasCount) ? (displayMd.marketLow * count) : null;
        if (stackMarketLow !== null) {
            const roundedStackMarketLow = Math.round(stackMarketLow);
            const thresholds = getCompetitiveThresholds(roundedStackMarketLow);
            const competitiveCap = roundedStackMarketLow + thresholds.maxGapGold;
            const enteredGap = hasPrice ? price - roundedStackMarketLow : null;
            const enteredGapPct = (hasPrice && roundedStackMarketLow > 0) ? Math.round((enteredGap / roundedStackMarketLow) * 100) : null;
            const enteredStatus = hasPrice ? classifyCompetitiveGap(enteredGap, enteredGapPct, roundedStackMarketLow).status : null;
            const suggestionGap = suggestion?.suggestedPerStack !== null ? suggestion.suggestedPerStack - roundedStackMarketLow : null;
            const suggestionGapPct = (suggestion?.suggestedPerStack !== null && roundedStackMarketLow > 0)
                ? Math.round((suggestionGap / roundedStackMarketLow) * 100)
                : null;
            const suggestionStatus = suggestion?.suggestedPerStack !== null
                ? classifyCompetitiveGap(suggestionGap, suggestionGapPct, roundedStackMarketLow).status
                : null;

            const statusPill = !hasPrice
                ? `<span class="inline-flex items-center gap-1 rounded-full border border-slate-500/40 bg-slate-700/40 px-2 py-0.5 text-xs text-gray-300">Enter a price to compare</span>`
                : enteredStatus === 'leading'
                    ? `<span class="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-900/30 px-2 py-0.5 text-xs text-emerald-300"><i class="fas fa-trophy text-[10px]"></i> Leading</span>`
                    : enteredStatus === 'competitive'
                        ? `<span class="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-900/30 px-2 py-0.5 text-xs text-amber-300"><i class="fas fa-handshake text-[10px]"></i> Competitive</span>`
                        : `<span class="inline-flex items-center gap-1 rounded-full border border-rose-500/40 bg-rose-900/30 px-2 py-0.5 text-xs text-rose-300"><i class="fas fa-triangle-exclamation text-[10px]"></i> Undercut</span>`;

            const suggestionLine = suggestion?.suggestedPerStack !== null
                ? `<div class="flex justify-between gap-2 text-xs">
                        <span class="text-gray-300">Suggested status</span>
                        <span class="${suggestionStatus === 'leading' ? 'text-emerald-300' : suggestionStatus === 'competitive' ? 'text-amber-300' : 'text-rose-300'} font-semibold">${suggestionStatus === 'leading' ? 'Leading' : suggestionStatus === 'competitive' ? 'Competitive' : 'Undercut'}</span>
                   </div>`
                : '';

            competitiveCard = `
            <div class="mt-2 p-3 bg-cyan-900/15 border border-cyan-500/30 rounded-xl">
                <div class="flex items-center justify-between gap-2 mb-2 flex-wrap">
                    <div class="flex items-center gap-2">
                        <i class="fas fa-ruler-combined text-cyan-400 text-sm"></i>
                        <span class="text-cyan-300 font-semibold text-sm uppercase tracking-widest">Competitive Range</span>
                    </div>
                    <span class="text-gray-400 text-sm">${thresholds.label}</span>
                </div>
                <div class="grid md:grid-cols-2 gap-3">
                    <div class="space-y-1.5">
                        <div class="flex justify-between gap-2 text-sm">
                            <span class="text-gray-300">Market low/stack</span>
                            <span class="text-amber-300 font-bold">${fmt(roundedStackMarketLow)}g</span>
                        </div>
                        <div class="flex justify-between gap-2 text-sm">
                            <span class="text-gray-300">Competitive cap</span>
                            <span class="text-white">${fmt(competitiveCap)}g <span class="text-gray-500">(+${fmt(thresholds.maxGapGold)}g)</span></span>
                        </div>
                        <div class="flex justify-between gap-2 text-sm">
                            <span class="text-gray-300">Percent limit</span>
                            <span class="text-white">+${thresholds.maxGapPct}%</span>
                        </div>
                    </div>
                    <div class="space-y-1.5">
                        <div class="flex items-center justify-between gap-2">
                            <span class="text-gray-300 text-sm">Your entered price</span>
                            ${statusPill}
                        </div>
                        ${hasPrice ? `<div class="flex justify-between gap-2 text-sm">
                            <span class="text-gray-300">Gap vs low</span>
                            <span class="${enteredStatus === 'leading' ? 'text-emerald-300' : enteredStatus === 'competitive' ? 'text-amber-300' : 'text-rose-300'} font-semibold whitespace-nowrap">${enteredGap > 0 ? '+' : ''}${fmt(enteredGap)}g (${enteredGapPct > 0 ? '+' : ''}${enteredGapPct}%)</span>
                        </div>` : ''}
                        ${suggestionLine}
                    </div>
                </div>
            </div>`;
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

        let suggestionCard = '';
        if (suggestion) {
            const bubbleCls = suggestion.insightClass === 'text-rose-400' ? 'bg-rose-400'
                : suggestion.insightClass === 'text-amber-400' ? 'bg-amber-400'
                : suggestion.insightClass === 'text-emerald-400' ? 'bg-emerald-400'
                : 'bg-gray-400';
            suggestionCard = `
            <div class="mt-2 p-3 bg-yellow-900/20 border border-yellow-500/40 rounded-xl">
                <div class="flex items-center gap-2 mb-1.5">
                    <i class="fas fa-lightbulb text-yellow-400 text-sm"></i>
                    <span class="text-yellow-300 font-semibold text-sm uppercase tracking-widest">Suggested Price</span>
                </div>
                ${suggestion.suggestedPerStack !== null && hasCount
                    ? `<div class="flex flex-wrap items-baseline gap-2 mb-1">
                           <span class="text-yellow-300 font-bold text-2xl">${fmt(suggestion.suggestedPerStack)}g</span>
                           <span class="text-gray-400 text-sm">/ stack of ${count}</span>
                           <button id="modal-use-suggested-price-btn" type="button"
                               class="px-2.5 py-1 text-xs font-semibold bg-yellow-500/20 hover:bg-yellow-500/40 text-yellow-300 border border-yellow-500/40 rounded-lg transition-colors">
                               Use this price
                           </button>
                       </div>
                       ${hasStacks ? `<div class="text-gray-300 text-sm mb-1">${stacks} stack${stacks !== 1 ? 's' : ''} x ${fmt(suggestion.suggestedPerStack)}g = <span class="text-yellow-200 font-bold">${fmt(suggestion.suggestedPerStack * stacks)}g</span> total</div>` : ''}
                       <div class="flex items-center gap-1.5">
                           <span class="inline-block w-2 h-2 rounded-full flex-shrink-0 ${bubbleCls}"></span>
                           <span class="${suggestion.insightClass} text-sm">${suggestion.insight}</span>
                       </div>`
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
        if (!md && hist?.maxPerUnit && hasCount) {
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

        let livePriceRow = '';
        if (hasPrice && hasStacks) {
            const liveTotal = price * stacks;
            livePriceRow = `
            <div class="flex items-center gap-2 mt-2 pt-1.5 border-t border-slate-500/30">
                <i class="fas fa-calculator text-gray-500 text-xs"></i>
                <span class="text-gray-300 text-sm">At <span class="text-white font-semibold">${fmt(price)}g</span>/stack x ${stacks} = <span class="text-cyan-300 font-bold">${fmt(liveTotal)}g</span> total</span>
            </div>`;
        }

        hintEl.innerHTML = `
            ${qualityBanner}
            <div class="flex gap-3">${marketCol}<div class="w-px bg-slate-500/40 self-stretch flex-shrink-0"></div>${histCol}</div>
            ${competitiveCard}
            ${suggestionCard}
            ${impactRow}
            ${highPriceRow}
            ${livePriceRow}`;
        hintEl.classList.remove('hidden');

        const useBtn = hintEl.querySelector('#modal-use-suggested-price-btn');
        if (useBtn) {
            useBtn.addEventListener('click', () => {
                const priceInput = document.getElementById('modal-item-price-per-stack');
                if (priceInput && suggestion?.suggestedPerStack !== null) {
                    priceInput.value = suggestion.suggestedPerStack;
                    priceInput.dispatchEvent(new Event('input'));
                }
            });
        }

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
            state.ownCount = gtItemId ? getOwnListingCountForSlug(savedHash, gtItemId).ownCount : 0;
        } else {
            state.ownCount = 0;
        }

        const currentCharacterId = getCurrentCharacterId();
        if (currentCharacterId && selectedItem.item_id) {
            const requestId = state.historyRequestId + 1;
            state.historyRequestId = requestId;
            state.historyData = null;
            state.historyLoading = true;
            renderHint();
            const hist = await fetchItemSalesHistoryForListing({ supabase, currentCharacterId, itemId: selectedItem.item_id });
            if (requestId !== state.historyRequestId || state.selectedItem !== selectedItem) return;
            state.historyData = hist;
            state.historyLoading = false;
            renderHint();
        } else {
            state.historyRequestId += 1;
            state.historyData = null;
            state.historyLoading = false;
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
