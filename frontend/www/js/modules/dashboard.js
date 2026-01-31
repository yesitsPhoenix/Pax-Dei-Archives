import { updateAlertBadgePosition } from '../sidebar.js';

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
        totalPurchasesEl.innerHTML = `${formatCurrency(totalPurchases)} <i class="fa-solid fa-shopping-cart"></i>`;
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
