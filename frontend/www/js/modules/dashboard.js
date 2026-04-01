import { updateAlertBadgePosition } from '../sidebar.js';
import {
    getItemData,
    getZoneDataAge,
    getSavedAvatarHash,
    analyzeOwnListings,
    getMarketDataForSlugByQuality,
    getMarketDataByItemNameAndQuality
} from '../services/gamingToolsService.js';

/** Cached result of the last analyzeOwnListings() call — used to populate the modal. */
let _lastValleyAnalysis = null;

function normalizeEnchantmentTier(tier) {
    return Number.isInteger(tier) ? tier : (parseInt(tier, 10) || 0);
}

function getQualityLabel(isMastercrafted, enchantmentTier) {
    const tier = normalizeEnchantmentTier(enchantmentTier);
    const labels = [];
    if (isMastercrafted) labels.push('Mastercrafted');
    if (tier > 0) {
        const roman = ['', 'I', 'II', 'III'];
        labels.push(`Enchantment ${roman[tier] || tier}`);
    }
    return labels.length ? labels.join(' · ') : '';
}

function getVariantKey(itemId, isMastercrafted, enchantmentTier) {
    return `${itemId}::mc${isMastercrafted ? 1 : 0}::enc${normalizeEnchantmentTier(enchantmentTier)}`;
}

function renderValleyItemLabel(item) {
    const tier = normalizeEnchantmentTier(item.enchantmentTier);
    const roman = ['', 'I', 'II', 'III'];
    const crownBadge = item.isMastercrafted
        ? `<span class="listing-crown" title="Mastercrafted"><i class="fas fa-crown" style="color:#f59e0b;font-size:0.75em;margin-right:3px;"></i></span>`
        : '';
    const enchantBadge = tier > 0
        ? `<span class="listing-enchant-badge listing-enchant-tier-${tier}" title="Enchantment ${roman[tier] || tier}">${roman[tier] || tier}</span>`
        : '';

    return `
        <div class="font-medium inline-flex items-center">
            ${crownBadge}${item.itemName}${enchantBadge}
        </div>
        ${item.qualityLabel ? `<div class="text-xs text-gray-400 mt-0.5">${item.qualityLabel}</div>` : ''}`;
}

const grossSalesEl = document.getElementById('dashboard-gross-sales');
const feesPaidEl = document.getElementById('dashboard-fees-paid');
const netProfitEl = document.getElementById('dashboard-net-profit');
const activeListingsEl = document.getElementById('dashboard-active-listings');
const totalPurchasesEl = document.getElementById('dashboard-total-purchases');
const currentHoldingsEl = document.getElementById('dashboard-current-holdings');
const earnedPveGoldEl = document.getElementById('dashboard-earned-pve-gold');
const listedValueGoldEl = document.getElementById('dashboard-listed-value-gold');

// Ledger-specific elements
const ledgerMostProfitableItemEl = document.getElementById('ledger-most-profitable-item');
const ledgerMostProfitableValueEl = document.getElementById('ledger-most-profitable-value');
const ledgerMostSoldItemEl = document.getElementById('ledger-most-sold-item');
const ledgerMostSoldCountEl = document.getElementById('ledger-most-sold-count');
const ledgerAlertsCountEl = document.getElementById('ledger-alerts-count');
const ledgerAvgTimeOnMarketEl = document.getElementById('ledger-avg-time-on-market');
const ledgerTimeOnMarketUnitEl = document.getElementById('ledger-time-on-market-unit');
const ledgerHighestPerformingMarketStallEl = document.getElementById('ledger-highest-performing-market-stall');
const ledgerHighestPerformingMarketStallValueEl = document.getElementById('ledger-highest-performing-market-stall-value');

// PVE Dashboard Elements
const pveDungeonRunsEl = document.getElementById('dashboard-dungeon-runs');
const pvePoiClearsEl = document.getElementById('dashboard-poi-mob-encounters');
const pveGracePurchasesEl = document.getElementById('dashboard-grace-purchases');
const pveOtherEl = document.getElementById('dashboard-pve-other');

export const renderDashboard = async (dashboardStats, characterData, allActivityData = null) => {
    if (!grossSalesEl || !feesPaidEl || !netProfitEl || !activeListingsEl || !currentHoldingsEl || !earnedPveGoldEl) {
        console.error("Dashboard elements not found.");
        return;
    }
    
    const currentGoldHoldings = characterData ? characterData.gold : 0;
    const grossSales = dashboardStats.gross_sales || 0;
    const feesPaid = dashboardStats.fees_paid || 0;
    const activeListingsCount = dashboardStats.active_listings_count || 0;
    
    // Calculate listed value from active listings
    let listedValue = dashboardStats.active_listings_value || 0;
    if (!dashboardStats.active_listings_value) {
        listedValue = await calculateListedValue();
    }
    
    const netProfit = grossSales - feesPaid;
    const pveGoldTotal = dashboardStats.pve_gold_total || 0;
    
    // Calculate total purchases from activity data
    let totalPurchases = 0;
    if (allActivityData) {
        const purchaseData = allActivityData.filter(activity => activity.type === 'Purchase');
        totalPurchases = -Math.abs(purchaseData.reduce((sum, purchase) => sum + (purchase.total_amount || 0), 0));
    }

    const formatCurrency = (amount) => {
        const safeAmount = typeof amount === 'number' && !isNaN(amount) ? amount : 0;
        return safeAmount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    };

    grossSalesEl.innerHTML = `${formatCurrency(grossSales)} <i class="fa-solid fa-chart-line"></i>`;
    feesPaidEl.innerHTML = `${formatCurrency(feesPaid)} <i class="fa-solid fa-arrow-trend-down"></i>`;
    netProfitEl.innerHTML = `${formatCurrency(netProfit)} <i class="fas fa-coins"></i>`;
    activeListingsEl.innerHTML = `${activeListingsCount} <i class="fa-solid fa-list"></i>`;
    if (totalPurchasesEl) {
        totalPurchasesEl.textContent = formatCurrency(totalPurchases);
    }
    currentHoldingsEl.innerHTML = `${formatCurrency(currentGoldHoldings)} <i class="fa-solid fa-sack-dollar"></i>`;
    earnedPveGoldEl.innerHTML = `${formatCurrency(pveGoldTotal)} <i class="fa-solid fa-hand-holding-dollar"></i>`;
    
    // Listed Value - total value of active listings
    if (listedValueGoldEl) {
        listedValueGoldEl.innerHTML = `${formatCurrency(listedValue)} <i class="fa-solid fa-hand-holding-dollar"></i>`;
    }

    // Populate ledger-specific cards if elements exist
    if (ledgerMostProfitableItemEl && allActivityData) {
        calculateAndRenderMostProfitableAndSold(allActivityData, formatCurrency);
        calculateAndRenderAvgTimeOnMarket(allActivityData);
        calculateAndRenderBestMarketStall(allActivityData, formatCurrency);
    }
    
    // Populate PVE breakdown if elements exist
    if (allActivityData) {
        calculateAndRenderPVEBreakdown(allActivityData, formatCurrency);
    }
    
    // Populate listing alerts count (async)
    if (ledgerAlertsCountEl) {
        populateListingAlertsCount();
    }
};

function calculateAndRenderMostProfitableAndSold(allActivityData, formatCurrency) {
    const salesData = allActivityData.filter(activity => activity.type === 'Sale');
    
    if (salesData.length === 0) {
        if (ledgerMostProfitableItemEl) ledgerMostProfitableItemEl.textContent = 'No sales yet';
        if (ledgerMostProfitableValueEl) ledgerMostProfitableValueEl.textContent = '-';
        if (ledgerMostSoldItemEl) ledgerMostSoldItemEl.textContent = 'No sales yet';
        if (ledgerMostSoldCountEl) ledgerMostSoldCountEl.textContent = '-';
        return;
    }

    const itemStats = {};
    
    salesData.forEach(sale => {
        const itemName = sale.item_name || 'Unknown Item';
        
        if (!itemStats[itemName]) {
            itemStats[itemName] = { profit: 0, quantity: 0 };
        }
        
        itemStats[itemName].profit += sale.total_amount || 0;
        itemStats[itemName].quantity += sale.quantity || 0;
    });
    
    let mostProfitable = { name: 'N/A', value: 0 };
    let mostSold = { name: 'N/A', count: 0 };
    
    for (const [name, stats] of Object.entries(itemStats)) {
        if (stats.profit > mostProfitable.value) {
            mostProfitable = { name, value: stats.profit };
        }
        if (stats.quantity > mostSold.count) {
            mostSold = { name, count: stats.quantity };
        }
    }
    
    if (ledgerMostProfitableItemEl) {
        ledgerMostProfitableItemEl.textContent = mostProfitable.name;
    }
    if (ledgerMostProfitableValueEl) {
        ledgerMostProfitableValueEl.textContent = `+${formatCurrency(mostProfitable.value)} Gold`;
    }
    if (ledgerMostSoldItemEl) {
        ledgerMostSoldItemEl.textContent = mostSold.name;
    }
    if (ledgerMostSoldCountEl) {
        ledgerMostSoldCountEl.textContent = `${formatCurrency(mostSold.count)} units sold`;
    }
}

function calculateAndRenderAvgTimeOnMarket(allActivityData) {
    const salesData = allActivityData.filter(activity => activity.type === 'Sale');
    
    if (salesData.length === 0) {
        if (ledgerAvgTimeOnMarketEl) ledgerAvgTimeOnMarketEl.textContent = '-';
        if (ledgerTimeOnMarketUnitEl) ledgerTimeOnMarketUnitEl.textContent = 'No sales data';
        return;
    }

    let totalTimeMs = 0;
    let countWithDates = 0;
    
    salesData.forEach(sale => {
        if (sale.listing_date && sale.date) {
            const listingDate = new Date(sale.listing_date);
            const saleDate = new Date(sale.date);
            const timeOnMarket = saleDate - listingDate;
            if (timeOnMarket > 0) {
                totalTimeMs += timeOnMarket;
                countWithDates++;
            }
        }
    });
    
    if (countWithDates === 0) {
        if (ledgerAvgTimeOnMarketEl) ledgerAvgTimeOnMarketEl.textContent = '-';
        if (ledgerTimeOnMarketUnitEl) ledgerTimeOnMarketUnitEl.textContent = 'No listing dates available';
        return;
    }
    
    const avgTimeMs = totalTimeMs / countWithDates;
    const avgDays = Math.floor(avgTimeMs / (1000 * 60 * 60 * 24));
    const avgHours = Math.floor((avgTimeMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (ledgerAvgTimeOnMarketEl && ledgerTimeOnMarketUnitEl) {
        if (avgDays > 0) {
            ledgerAvgTimeOnMarketEl.textContent = avgDays;
            ledgerTimeOnMarketUnitEl.textContent = avgDays === 1 ? 'day' : 'days';
        } else if (avgHours > 0) {
            ledgerAvgTimeOnMarketEl.textContent = avgHours;
            ledgerTimeOnMarketUnitEl.textContent = avgHours === 1 ? 'hour' : 'hours';
        } else {
            ledgerAvgTimeOnMarketEl.textContent = '<1';
            ledgerTimeOnMarketUnitEl.textContent = 'hour';
        }
    }
}

function calculateAndRenderBestMarketStall(allActivityData, formatCurrency) {
    const salesData = allActivityData.filter(activity => activity.type === 'Sale');
    
    if (salesData.length === 0) {
        if (ledgerHighestPerformingMarketStallEl) ledgerHighestPerformingMarketStallEl.textContent = '-';
        if (ledgerHighestPerformingMarketStallValueEl) ledgerHighestPerformingMarketStallValueEl.textContent = 'No sales yet';
        return;
    }

    const stallEarnings = {};
    
    salesData.forEach(sale => {
        const stallName = sale.market_stall_name || sale.stall_name || sale.stallName || 'Unknown Stall';
        
        if (!stallEarnings[stallName]) {
            stallEarnings[stallName] = 0;
        }
        
        stallEarnings[stallName] += sale.total_amount || 0;
    });
    
    let bestStall = { name: 'N/A', earnings: 0 };
    
    for (const [name, earnings] of Object.entries(stallEarnings)) {
        if (earnings > bestStall.earnings) {
            bestStall = { name, earnings };
        }
    }
    
    if (ledgerHighestPerformingMarketStallEl) {
        ledgerHighestPerformingMarketStallEl.textContent = bestStall.name;
    }
    if (ledgerHighestPerformingMarketStallValueEl) {
        ledgerHighestPerformingMarketStallValueEl.textContent = `${formatCurrency(bestStall.earnings)} Gold earned`;
    }
}

function calculateAndRenderPVEBreakdown(allActivityData, formatCurrency) {
    const pveData = allActivityData.filter(activity => activity.type === 'PVE Gold');
    
    let dungeonRuns = 0;
    let poiClears = 0;
    let gracePurchases = 0;
    let other = 0;
    
    pveData.forEach(transaction => {
        const description = (transaction.item_name || '').toLowerCase().trim();
        const amount = transaction.total_amount || 0;
        
        if (description.includes('dungeon')) {
            dungeonRuns += amount;
        } else if (description.includes('poi')) {
            poiClears += amount;
        } else if (description.includes('world_encounter') || description.includes('world encounter')) {
            poiClears += amount;
        } else if (description.includes('grace')) {
            gracePurchases += amount;
        } else {
            // Everything else goes to "Other" including:
            // - chest_withdrawal / chest withdrawal
            // - chest_deposit / chest deposit
            // - other
            // - any unrecognized transaction types
            other += amount;
        }
    });
    
    if (pveDungeonRunsEl) {
        pveDungeonRunsEl.innerHTML = `${formatCurrency(dungeonRuns)} <i class="fas fa-dungeon"></i>`;
    }
    if (pvePoiClearsEl) {
        pvePoiClearsEl.innerHTML = `${formatCurrency(poiClears)} <i class="fas fa-map-location-dot"></i>`;
    }
    if (pveGracePurchasesEl) {
        pveGracePurchasesEl.innerHTML = `${formatCurrency(gracePurchases)} <i class="fas fa-cart-shopping"></i>`;
    }
    if (pveOtherEl) {
        pveOtherEl.innerHTML = `${formatCurrency(other)} <i class="fas fa-dice"></i>`;
    }
}

async function populateListingAlertsCount() {
    try {
        const { supabase } = await import('../supabaseClient.js');
        const { currentCharacterId } = await import('./characters.js');
        
        if (!currentCharacterId) {
            if (ledgerAlertsCountEl) ledgerAlertsCountEl.textContent = '0';
            updateSidebarAlertBadge(0);
            return;
        }
        
        const now = new Date();
        const DAYS_AGING = 15;
        const MS_PER_DAY = 24 * 60 * 60 * 1000;
        const agingDaysAgo = new Date(now.getTime() - DAYS_AGING * MS_PER_DAY).toISOString();
        
        const { data: oldListings, error } = await supabase
            .from('market_listings')
            .select('listing_id')
            .eq('character_id', currentCharacterId)
            .is('is_fully_sold', false)
            .is('is_cancelled', false)
            .lt('listing_date', agingDaysAgo);
        
        if (error) {
            console.error('[Dashboard] Error fetching listing alerts:', error);
            if (ledgerAlertsCountEl) ledgerAlertsCountEl.textContent = 'Error';
            updateSidebarAlertBadge(0);
            return;
        }
        
        const count = oldListings?.length || 0;
        
        if (ledgerAlertsCountEl) {
            ledgerAlertsCountEl.textContent = count;
        }
        updateSidebarAlertBadge(count);
    } catch (error) {
        console.error('[Dashboard] Error in populateListingAlertsCount:', error);
        if (ledgerAlertsCountEl) ledgerAlertsCountEl.textContent = 'Error';
        updateSidebarAlertBadge(0);
    }
}

async function calculateListedValue() {
    try {
        const { supabase } = await import('../supabaseClient.js');
        const { currentCharacterId } = await import('./characters.js');
        
        if (!currentCharacterId) return 0;
        
        const { data, error } = await supabase
            .from('market_listings')
            .select('total_listed_price')
            .eq('character_id', currentCharacterId)
            .is('is_fully_sold', false)
            .is('is_cancelled', false);
        
        if (error) {
            console.error('Error calculating listed value:', error);
            return 0;
        }
        
        return data?.reduce((sum, listing) => sum + (listing.total_listed_price || 0), 0) || 0;
    } catch (error) {
        console.error('Error in calculateListedValue:', error);
        return 0;
    }
}

function updateSidebarAlertBadge(count) {
    const alertBadge = document.getElementById('sidebarAlertBadge');
    
    if (!alertBadge) return;
    
    if (count > 0) {
        alertBadge.classList.remove('hidden');
        alertBadge.textContent = count;
        updateAlertBadgePosition();
    } else {
        alertBadge.classList.add('hidden');
    }
}

/**
 * Renders the Market Pulse section with live gaming.tools zone data.
 *
 * @param {object|null} zoneSummary     - from gamingToolsService.buildZoneSummary()
 * @param {object|null} ownSummary      - from gamingToolsService.summarizeOwnListings()
 * @param {object|null} character       - character object with shard/province/home_valley
 * @param {boolean}     loading         - show loading state
 * @param {string|null} errorMsg        - show error message instead
 */
export function renderMarketPulse(zoneSummary, ownSummary, character, loading = false, errorMsg = null) {
    const section = document.getElementById('market-pulse-section');
    if (!section) return;

    const zoneLabel = character
        ? `${character.shard ?? '—'} · ${character.province ?? '—'} · ${character.home_valley ?? '—'}`
        : 'No character selected';

    const pulseCards = document.getElementById('market-pulse-cards');
    const pulseStatus = document.getElementById('market-pulse-status');
    const ownListingsSummaryEl = document.getElementById('market-pulse-own-listings');
    const zoneNameEl = document.getElementById('market-pulse-zone-name');

    if (zoneNameEl) zoneNameEl.textContent = zoneLabel;

    if (loading) {
        if (pulseStatus) {
            pulseStatus.innerHTML = '<span class="text-gray-400 text-sm"><i class="fas fa-spinner fa-spin mr-2"></i>Loading market data…</span>';
            pulseStatus.classList.remove('hidden');
        }
        if (pulseCards) pulseCards.classList.add('opacity-50', 'pointer-events-none');
        return;
    }

    if (pulseStatus) pulseStatus.classList.add('hidden');
    if (pulseCards) pulseCards.classList.remove('opacity-50', 'pointer-events-none');

    if (errorMsg) {
        if (pulseStatus) {
            pulseStatus.innerHTML = `<span class="text-amber-400 text-sm"><i class="fas fa-exclamation-triangle mr-2"></i>${errorMsg}</span>`;
            pulseStatus.classList.remove('hidden');
        }
        return;
    }

    if (!zoneSummary) return;

    const fmt = (n) => typeof n === 'number' ? n.toLocaleString() : '—';
    const fmtGold = (n) => typeof n === 'number' ? n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : '—';

    const totalEl = document.getElementById('pulse-total-listings');
    const sellersEl = document.getElementById('pulse-unique-sellers');
    const itemsEl = document.getElementById('pulse-unique-items');
    const topItemEl = document.getElementById('pulse-top-item');

    if (totalEl) totalEl.textContent = fmt(zoneSummary.totalListings);
    if (sellersEl) sellersEl.textContent = fmt(zoneSummary.uniqueSellers);
    if (itemsEl) itemsEl.textContent = fmt(zoneSummary.uniqueItems);
    if (topItemEl) {
        if (zoneSummary.topItemSlug) {
            const topItemData = getItemData(zoneSummary.topItemSlug);
            const displayName = topItemData?.name || zoneSummary.topItemSlug.replace(/_/g, ' ');
            const topItemUrl = topItemData?.url || `https://paxdei.gaming.tools/${zoneSummary.topItemSlug}`;
            topItemEl.innerHTML = `<a href="${topItemUrl}" target="_blank" class="text-blue-400 hover:underline truncate block max-w-[180px]" title="${displayName}">${displayName}</a> <span class="text-gray-400">(${fmt(zoneSummary.topItemCount)})</span>`;
        } else {
            topItemEl.textContent = '—';
        }
    }

    // ── Staleness label ──────────────────────────────────────────────────────
    const ageEl = document.getElementById('market-pulse-age');
    if (ageEl) {
        const age = getZoneDataAge();
        ageEl.textContent = age !== null
            ? `Data refreshed ${age === 0 ? 'just now' : `${age}m ago`} · updates hourly`
            : '';
        ageEl.className = 'text-gray-300 text-xs mb-3';
    }

    // ── Own listings panel ───────────────────────────────────────────────────
    const ownPanel = document.getElementById('market-pulse-own-listings');
    if (!ownPanel) return;

    const hasHash = !!getSavedAvatarHash();

    if (!hasHash) {
        // Subtle prompt — only show if avatar ID card is visible
        const avatarCard = document.getElementById('avatar-id-card');
        if (avatarCard && !avatarCard.classList.contains('hidden')) {
            ownPanel.innerHTML = `
                <div class="flex items-center gap-2 text-gray-300 text-xs italic">
                    <i class="fas fa-circle-info text-gray-400"></i>
                    Enter your Avatar ID above to see your home valley presence here.
                </div>`;
            ownPanel.classList.remove('hidden');
        } else {
            ownPanel.classList.add('hidden');
        }
        return;
    }

    // Render chips from Supabase data (async — updates panel once data arrives)
    ownPanel.innerHTML = `
        <div class="flex flex-wrap items-center gap-2">
            <span class="flex items-center gap-1.5 mr-1">
                <i class="fas fa-store text-emerald-400 text-sm"></i>
                <span class="text-emerald-300 font-semibold text-sm">Your home valley presence</span>
            </span>
            <span class="text-gray-400 text-xs italic"><i class="fas fa-spinner fa-spin mr-1"></i>Loading…</span>
            <button id="valley-presence-details-btn"
                class="valley-details-btn ml-auto inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-amber-100 rounded-full transition-colors">
                <i class="fas fa-magnifying-glass text-xs"></i> View Details
            </button>
        </div>`;
    ownPanel.classList.remove('hidden');
    document.getElementById('valley-presence-details-btn')
        ?.addEventListener('click', openValleyPresenceModal);

    // Fetch real counts from Supabase and update chips
    buildValleyAnalysisFromSupabase().then(analysis => {
        if (!analysis) return;
        _lastValleyAnalysis = analysis;
        const { leading, undercut, valleySharePct } = analysis;

        const leadingChip = leading.length > 0
            ? `<span class="inline-flex items-center gap-1.5 bg-emerald-900/40 border border-emerald-500/40 rounded-full px-3 py-1 text-sm">
                   <i class="fas fa-trophy text-emerald-400 text-xs"></i>
                   <span class="text-white font-semibold">Leading on</span>
                   <span class="text-emerald-300 font-bold">${leading.length}</span>
                   <span class="text-white">${leading.length === 1 ? 'item' : 'items'}</span>
               </span>`
            : '';

        const undercutChip = undercut.length > 0
            ? `<span class="inline-flex items-center gap-1.5 bg-rose-900/40 border border-rose-500/40 rounded-full px-3 py-1 text-sm">
                   <i class="fas fa-triangle-exclamation text-rose-400 text-xs"></i>
                   <span class="text-white font-semibold">Undercut on</span>
                   <span class="text-rose-300 font-bold">${undercut.length}</span>
                   <span class="text-white">${undercut.length === 1 ? 'item' : 'items'}</span>
               </span>`
            : `<span class="inline-flex items-center gap-1.5 bg-slate-700/40 border border-slate-500/40 rounded-full px-3 py-1 text-sm">
                   <i class="fas fa-check text-gray-400 text-xs"></i>
                   <span class="text-white">Not undercut</span>
               </span>`;

        const shareChip = `<span class="inline-flex items-center gap-1.5 bg-blue-900/40 border border-blue-500/40 rounded-full px-3 py-1 text-sm">
                   <i class="fas fa-chart-pie text-blue-400 text-xs"></i>
                   <span class="text-white font-semibold">Valley share:</span>
                   <span class="text-blue-300 font-bold">${valleySharePct}%</span>
               </span>`;

        // Only update if panel is still showing (character hasn't changed)
        if (ownPanel.isConnected) {
            ownPanel.innerHTML = `
                <div class="flex flex-wrap items-center gap-2">
                    <span class="flex items-center gap-1.5 mr-1">
                        <i class="fas fa-store text-emerald-400 text-sm"></i>
                        <span class="text-emerald-300 font-semibold text-sm">Your home valley presence</span>
                    </span>
                    ${leadingChip}${undercutChip}${shareChip}
                    <button id="valley-presence-details-btn"
                        class="valley-details-btn ml-auto inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-amber-100 rounded-full transition-colors">
                        <i class="fas fa-magnifying-glass text-xs"></i> View Details
                    </button>
                </div>`;
            document.getElementById('valley-presence-details-btn')
                ?.addEventListener('click', openValleyPresenceModal);
        }
    }).catch(err => console.error('[ValleyPresence] Chip update failed:', err));
}

/**
 * Fetches the player's active Supabase listings, compares against gaming.tools
 * market data, and returns a structured analysis. Shared by both the ledger
 * page chips and the valley presence modal.
 *
 * @returns {Promise<{leading, undercut, valleySharePct, totalOwnListings, totalValleyListings}|null>}
 */
async function buildValleyAnalysisFromSupabase() {
    try {
        const { supabase }           = await import('../supabaseClient.js');
        const { currentCharacterId } = await import('./characters.js');
        if (!currentCharacterId) return null;

        const { data: rawListings, error: fetchErr } = await supabase
            .from('market_listings')
            .select('item_id, listed_price_per_unit, quantity_listed, is_mastercrafted, enchantment_tier, items(item_name, pax_dei_slug)')
            .eq('character_id', currentCharacterId)
            .eq('is_cancelled', false)
            .eq('is_fully_sold', false);

        if (fetchErr) throw fetchErr;
        if (!rawListings || rawListings.length === 0) return null;

        // Build map: itemName → { minPrice, count }
        const ownByVariant = {};
        for (const listing of rawListings) {
            const itemId = listing.item_id;
            const itemName = listing.items?.item_name;
            if (!itemId || !itemName) continue;

            const isMastercrafted = !!listing.is_mastercrafted;
            const enchantmentTier = normalizeEnchantmentTier(listing.enchantment_tier);
            const variantKey = getVariantKey(itemId, isMastercrafted, enchantmentTier);

            if (!ownByVariant[variantKey]) {
                ownByVariant[variantKey] = {
                    itemId,
                    itemName,
                    paxDeiSlug: listing.items?.pax_dei_slug || null,
                    isMastercrafted,
                    enchantmentTier,
                    qualityLabel: getQualityLabel(isMastercrafted, enchantmentTier),
                    minPrice: Infinity,
                    count: 0
                };
            }

            ownByVariant[variantKey].count++;
            if (listing.listed_price_per_unit < ownByVariant[variantKey].minPrice) {
                ownByVariant[variantKey].minPrice = listing.listed_price_per_unit;
            }
        }

        const leading  = [];
        const undercut = [];
        let totalOwnListings = 0;

        for (const own of Object.values(ownByVariant)) {
            totalOwnListings += own.count;

            let mktData = null;
            if (own.paxDeiSlug) {
                mktData = getMarketDataForSlugByQuality(own.paxDeiSlug, own.isMastercrafted, own.enchantmentTier);
            }
            if (!mktData) {
                mktData = getMarketDataByItemNameAndQuality(own.itemName, own.isMastercrafted, own.enchantmentTier);
            }

            const marketLow  = mktData?.marketLow ?? null;
            const totalCount = mktData?.totalListings ?? own.count;
            const summaryRow = {
                itemId: own.itemId,
                itemName: own.itemName,
                paxDeiSlug: own.paxDeiSlug,
                isMastercrafted: own.isMastercrafted,
                enchantmentTier: own.enchantmentTier,
                qualityLabel: own.qualityLabel,
                yourLow: own.minPrice,
                yourCount: own.count,
                totalCount
            };

            if (marketLow === null) {
                leading.push({ ...summaryRow, marketLow: own.minPrice, noGtData: true });
                continue;
            }
            if (own.minPrice <= marketLow + 0.001) {
                leading.push({ ...summaryRow, marketLow });
            } else {
                const gap    = own.minPrice - marketLow;
                const gapPct = Math.round((gap / marketLow) * 100);
                undercut.push({ ...summaryRow, marketLow, gap, gapPct });
            }
        }

        undercut.sort((a, b) => b.gap - a.gap);
        leading.sort((a, b) =>
            a.itemName.localeCompare(b.itemName) ||
            a.qualityLabel.localeCompare(b.qualityLabel)
        );

        // Valley share uses gaming.tools avatar-hash data (best available for total count)
        const gtAnalysis          = getSavedAvatarHash() ? analyzeOwnListings(getSavedAvatarHash()) : null;
        const valleySharePct      = gtAnalysis?.valleySharePct      ?? 0;
        const totalValleyListings = gtAnalysis?.totalValleyListings ?? 0;

        return { leading, undercut, valleySharePct, totalOwnListings, totalValleyListings };
    } catch (err) {
        console.error('[ValleyPresence] buildValleyAnalysisFromSupabase error:', err);
        return null;
    }
}

/**
 * Populates and opens the Valley Presence details modal.
 * Fetches YOUR listings from Supabase (always current), then compares
 * against gaming.tools market data for Market Low / total counts.
 */
export async function openValleyPresenceModal() {
    const modal = document.getElementById('valleyPresenceModal');
    const body  = document.getElementById('valleyPresenceModalBody');
    if (!modal || !body) return;

    modal.classList.remove('hidden');
    body.innerHTML = '<p class="text-gray-400 text-sm flex items-center gap-2"><i class="fas fa-spinner fa-spin"></i> Loading your listings…</p>';

    const analysis = await buildValleyAnalysisFromSupabase();
    if (!analysis) {
        body.innerHTML = '<p class="text-gray-400 text-sm">No active listings found for this character.</p>';
        return;
    }
    _lastValleyAnalysis = analysis;

    const { leading, undercut, valleySharePct, totalOwnListings, totalValleyListings } = _lastValleyAnalysis;
    const fmt  = (n) => typeof n === 'number' ? n.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—';
    const fmtG = (n) => `${fmt(n)}g`;

    const undercutRows = undercut.map(item => `
        <tr class="border-b border-slate-700/60 hover:bg-slate-700/30">
            <td class="py-2.5 px-3 text-white text-sm">
                ${renderValleyItemLabel(item)}
            </td>
            <td class="py-2.5 px-3 text-rose-300 text-sm text-right font-semibold">${fmtG(item.yourLow)}</td>
            <td class="py-2.5 px-3 text-emerald-300 text-sm text-right">${fmtG(item.marketLow)}</td>
            <td class="py-2.5 px-3 text-amber-300 text-sm text-right">+${fmtG(item.gap)} <span class="text-gray-400 text-xs">(+${item.gapPct}%)</span></td>
            <td class="py-2.5 px-3 text-gray-300 text-sm text-right">${item.yourCount} / ${item.totalCount}</td>
            <td class="py-2.5 px-3 text-right">
                <button class="valley-edit-btn inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-full border border-blue-400/40 transition-colors"
                    data-item-name="${item.itemName.replace(/"/g, '&quot;')}"
                    data-item-id="${item.itemId}"
                    data-is-mastercrafted="${item.isMastercrafted ? 'true' : 'false'}"
                    data-enchantment-tier="${item.enchantmentTier}">
                    <i class="fas fa-pen text-xs"></i> Edit
                </button>
            </td>
        </tr>`).join('');

    const leadingRows = leading.map(item => `
        <tr class="border-b border-slate-700/60 hover:bg-slate-700/30">
            <td class="py-2.5 px-3 text-white text-sm">
                ${renderValleyItemLabel(item)}
            </td>
            <td class="py-2.5 px-3 text-emerald-300 text-sm text-right font-semibold">${fmtG(item.yourLow)}</td>
            <td class="py-2.5 px-3 text-emerald-300 text-sm text-right">${fmtG(item.marketLow)}</td>
            <td class="py-2.5 px-3 text-emerald-400 text-sm text-right font-semibold">Lowest price</td>
            <td class="py-2.5 px-3 text-gray-300 text-sm text-right">${item.yourCount} / ${item.totalCount}</td>
        </tr>`).join('');

    const tableHeader = `
        <thead>
            <tr class="border-b border-slate-600">
                <th class="py-2 px-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Item</th>
                <th class="py-2 px-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide">Your Low</th>
                <th class="py-2 px-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide">Market Low</th>
                <th class="py-2 px-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide">Gap</th>
                <th class="py-2 px-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide">Your / Total</th>
                <th class="py-2 px-3"></th>
            </tr>
        </thead>`;

    const leadingTableHeader = `
        <thead>
            <tr class="border-b border-slate-600">
                <th class="py-2 px-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">Item</th>
                <th class="py-2 px-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide">Your Low</th>
                <th class="py-2 px-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide">Market Low</th>
                <th class="py-2 px-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide">Gap</th>
                <th class="py-2 px-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide">Your / Total</th>
            </tr>
        </thead>`;

    body.innerHTML = `
        <!-- Summary chips -->
        <div class="flex flex-wrap gap-2 mb-5">
            <span class="inline-flex items-center gap-1.5 bg-blue-900/40 border border-blue-500/40 rounded-full px-3 py-1 text-sm">
                <i class="fas fa-chart-pie text-blue-400 text-xs"></i>
                <span class="text-white">Valley share:</span>
                <span class="text-blue-300 font-bold">${valleySharePct}%</span>
                <span class="text-gray-400 text-xs">(${totalOwnListings} of ${totalValleyListings})</span>
            </span>
            <span class="inline-flex items-center gap-1.5 bg-emerald-900/40 border border-emerald-500/40 rounded-full px-3 py-1 text-sm">
                <i class="fas fa-trophy text-emerald-400 text-xs"></i>
                <span class="text-white">Leading on <span class="font-bold text-emerald-300">${leading.length}</span> item${leading.length !== 1 ? 's' : ''}</span>
            </span>
            <span class="inline-flex items-center gap-1.5 bg-rose-900/40 border border-rose-500/40 rounded-full px-3 py-1 text-sm">
                <i class="fas fa-triangle-exclamation text-rose-400 text-xs"></i>
                <span class="text-white">Undercut on <span class="font-bold text-rose-300">${undercut.length}</span> item${undercut.length !== 1 ? 's' : ''}</span>
            </span>
        </div>

        ${undercut.length > 0 ? `
        <!-- Undercut section -->
        <div class="mb-5">
            <h4 class="flex items-center gap-2 text-rose-300 text-sm font-bold uppercase tracking-wide mb-2">
                <i class="fas fa-triangle-exclamation text-rose-400"></i> Being Undercut
                <span class="text-gray-400 text-xs font-normal normal-case ml-1">— sorted by largest gap first</span>
            </h4>
            <div class="overflow-x-auto rounded-lg border border-slate-700/60">
                <table class="w-full text-left">${tableHeader}<tbody>${undercutRows}</tbody></table>
            </div>
        </div>` : ''}

        ${leading.length > 0 ? `
        <!-- Leading section -->
        <div>
            <h4 class="flex items-center gap-2 text-emerald-300 text-sm font-bold uppercase tracking-wide mb-2">
                <i class="fas fa-trophy text-emerald-400"></i> Leading the Market
            </h4>
            <div class="overflow-x-auto rounded-lg border border-slate-700/60">
                <table class="w-full text-left">${leadingTableHeader}<tbody>${leadingRows}</tbody></table>
            </div>
        </div>` : ''}

        <p class="text-gray-400 text-xs mt-4 italic">Prices are per unit. Data reflects gaming.tools' last hourly sync — your Archives records may differ.</p>`;

    modal.classList.remove('hidden');

    // Wire edit buttons — open the valley bulk edit modal
    body.querySelectorAll('.valley-edit-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const itemName  = btn.dataset.itemName;
            const itemId = parseInt(btn.dataset.itemId || '', 10);
            const isMastercrafted = btn.dataset.isMastercrafted === 'true';
            const enchantmentTier = normalizeEnchantmentTier(btn.dataset.enchantmentTier);
            showValleyItemEditModal(itemName, itemId, isMastercrafted, enchantmentTier);
        });
    });
}

/**
 * Opens a bulk-edit modal for all active listings of a given item from the valley presence context.
 * Fetches all matching listings, lets the user set one new price, and applies it to all of them.
 *
 * @param {string} itemName - Display name of the item to edit
 */
async function showValleyItemEditModal(itemName, itemId = null, isMastercrafted = false, enchantmentTier = 0) {
    const editModal = document.getElementById('valleyItemEditModal');
    if (!editModal) return;

    const titleEl    = document.getElementById('valleyItemEditTitle');
    const subtitleEl = document.getElementById('valleyItemEditSubtitle');
    const priceInput = document.getElementById('valleyItemEditPrice');
    const feeInfoEl  = document.getElementById('valleyItemEditFeeInfo');
    const errorEl    = document.getElementById('valleyItemEditError');
    const saveBtn    = document.getElementById('valleyItemEditSaveBtn');
    const cancelBtn  = document.getElementById('valleyItemEditCancelBtn');
    const closeBtn   = document.getElementById('valleyItemEditModalClose');

    // Reset state
    if (errorEl)    errorEl.classList.add('hidden');
    if (saveBtn)  { saveBtn.disabled = false; saveBtn.textContent = 'Save All Listings'; }

    const { supabase }           = await import('../supabaseClient.js');
    const { currentCharacterId } = await import('./characters.js');

    if (!currentCharacterId) {
        if (errorEl) { errorEl.textContent = 'No character selected.'; errorEl.classList.remove('hidden'); }
        return;
    }

    const normalizedEnchantTier = normalizeEnchantmentTier(enchantmentTier);
    const resolvedItemId = Number.isInteger(itemId) ? itemId : parseInt(itemId, 10);
    if (!resolvedItemId) {
        console.warn('[ValleyEdit] Missing item_id for:', itemName);
        return;
    }

    // Fetch only the exact quality variant represented by the valley row
    let listingsQuery = supabase
        .from('market_listings')
        .select('listing_id, quantity_listed, total_listed_price, market_fee')
        .eq('character_id', currentCharacterId)
        .eq('item_id', resolvedItemId)
        .eq('is_mastercrafted', !!isMastercrafted)
        .eq('is_cancelled', false)
        .eq('is_fully_sold', false)
        .order('listed_price_per_unit', { ascending: false });

    listingsQuery = normalizedEnchantTier > 0
        ? listingsQuery.eq('enchantment_tier', normalizedEnchantTier)
        : listingsQuery.is('enchantment_tier', null);

    const { data: listings, error: listErr } = await listingsQuery;

    if (listErr || !listings || listings.length === 0) {
        console.warn('[ValleyEdit] No active listings found for variant:', itemName, isMastercrafted, normalizedEnchantTier);
        return;
    }

    // Pre-fill price from current average
    const avgPrice = Math.round(listings.reduce((s, l) => s + l.total_listed_price, 0) / listings.length);
    const qualityLabel = getQualityLabel(!!isMastercrafted, normalizedEnchantTier);
    if (titleEl)    titleEl.textContent    = `Edit: ${itemName}`;
    if (subtitleEl) subtitleEl.textContent = `${qualityLabel} · ${listings.length} active listing${listings.length !== 1 ? 's' : ''} will be updated with the new price.`;
    if (priceInput) { priceInput.value = avgPrice; }
    if (subtitleEl && !qualityLabel) {
        subtitleEl.textContent = `${listings.length} active listing${listings.length !== 1 ? 's' : ''} will be updated with the new price.`;
    }

    // Live fee estimate
    const updateFeeInfo = () => {
        const price = parseFloat(priceInput?.value);
        if (feeInfoEl && !isNaN(price) && price > 0) {
            const feePerListing = Math.ceil(price * 0.05);
            feeInfoEl.textContent = `Est. fee per listing: ${feePerListing}g  ·  ${listings.length} listing${listings.length !== 1 ? 's' : ''} = ${feePerListing * listings.length}g total (only charged if price increases)`;
        } else if (feeInfoEl) {
            feeInfoEl.textContent = '';
        }
    };
    priceInput?.addEventListener('input', updateFeeInfo);
    updateFeeInfo();

    editModal.classList.remove('hidden');
    priceInput?.focus();
    priceInput?.select();

    // ── Close helpers ─────────────────────────────────────────────────────
    const closeEditModal = () => {
        editModal.classList.add('hidden');
        priceInput?.removeEventListener('input', updateFeeInfo);
    };

    const closeAndReopenValley = () => {
        closeEditModal();
        openValleyPresenceModal();
    };

    if (closeBtn)  closeBtn.onclick  = closeEditModal;
    if (cancelBtn) cancelBtn.onclick = closeEditModal;
    editModal.onclick = (e) => { if (e.target === editModal) closeEditModal(); };

    // ── Save handler ──────────────────────────────────────────────────────
    if (saveBtn) {
        saveBtn.onclick = async () => {
            const newTotalPrice = parseFloat(priceInput?.value);
            if (isNaN(newTotalPrice) || newTotalPrice <= 0) {
                if (errorEl) { errorEl.textContent = 'Please enter a valid price greater than 0.'; errorEl.classList.remove('hidden'); }
                return;
            }
            if (errorEl) errorEl.classList.add('hidden');
            saveBtn.disabled   = true;
            saveBtn.textContent = 'Saving...';

            try {
                // Calculate total additional fees (only charged when price increases)
                let totalAdditionalFees = 0;
                const ops = listings.map(listing => {
                    const priceIncrease = newTotalPrice - listing.total_listed_price;
                    let newFee = listing.market_fee;
                    let additionalFee = 0;
                    if (priceIncrease > 0) {
                        newFee = Math.max(Math.ceil(newTotalPrice * 0.05), listing.market_fee);
                        additionalFee = newFee - listing.market_fee;
                        totalAdditionalFees += additionalFee;
                    }
                    return {
                        listingId:    listing.listing_id,
                        quantity:     listing.quantity_listed,
                        newTotalPrice,
                        newPricePerUnit: newTotalPrice / listing.quantity_listed,
                        newFee
                    };
                });

                // Check gold if fees are due
                if (totalAdditionalFees > 0) {
                    const { data: charData } = await supabase
                        .from('characters')
                        .select('gold')
                        .eq('character_id', currentCharacterId)
                        .single();

                    const currentGold = charData?.gold || 0;
                    if (currentGold < totalAdditionalFees) {
                        if (errorEl) {
                            errorEl.textContent = `Not enough gold! Need ${totalAdditionalFees.toLocaleString()}g for fees but only have ${currentGold.toLocaleString()}g.`;
                            errorEl.classList.remove('hidden');
                        }
                        saveBtn.disabled    = false;
                        saveBtn.textContent = 'Save All Listings';
                        return;
                    }
                }

                // Apply updates in parallel
                const results = await Promise.all(ops.map(op =>
                    supabase
                        .from('market_listings')
                        .update({
                            total_listed_price:   op.newTotalPrice,
                            listed_price_per_unit: op.newPricePerUnit,
                            market_fee:           op.newFee
                        })
                        .eq('listing_id',   op.listingId)
                        .eq('character_id', currentCharacterId)
                ));

                const failed = results.filter(r => r.error);
                if (failed.length > 0) {
                    if (errorEl) { errorEl.textContent = `${failed.length} update(s) failed: ${failed[0].error.message}`; errorEl.classList.remove('hidden'); }
                    saveBtn.disabled    = false;
                    saveBtn.textContent = 'Save All Listings';
                    return;
                }

                // Deduct additional fees from character gold
                if (totalAdditionalFees > 0) {
                    const { data: charData } = await supabase
                        .from('characters')
                        .select('gold')
                        .eq('character_id', currentCharacterId)
                        .single();
                    if (charData) {
                        await supabase
                            .from('characters')
                            .update({ gold: (charData.gold || 0) - totalAdditionalFees })
                            .eq('character_id', currentCharacterId);
                    }
                }

                // Re-open valley modal — it now fetches fresh Supabase data directly
                closeAndReopenValley();

            } catch (e) {
                console.error('[ValleyEdit] Unexpected error during save:', e);
                if (errorEl) { errorEl.textContent = 'An unexpected error occurred. Check the console.'; errorEl.classList.remove('hidden'); }
                saveBtn.disabled    = false;
                saveBtn.textContent = 'Save All Listings';
            }
        };
    }
}
