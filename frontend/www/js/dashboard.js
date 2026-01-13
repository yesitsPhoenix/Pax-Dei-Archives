/**
 * dashboard.js - Modified for State Manager Integration
 * 
 * WEEK 3: dashboard.html migration
 * 
 * This file now has dual code paths:
 * - OLD PATH: Multiple Supabase queries (fallback)
 * - NEW PATH: State manager (enabled via feature flags)
 * 
 * Test with: dashboard.html?features=dashboard.useStateManager,dashboard.enabled
 */

import { supabase } from './supabaseClient.js';
import { marketState } from './marketStateManager.js';
import { features, initFeatureFlags, shouldUseStateManager } from './featureFlags.js';

// Initialize feature flags
initFeatureFlags();

let currentNotificationCount = 0;
const DAYS_AGING = 15;
const DAYS_WARNING = 30;
const DAYS_CRITICAL = 45;

let allNotifications = [];
let currentPage = 1;
const NOTIFICATIONS_PER_PAGE = 8;

// ===== NEW: State Manager Version =====
async function fetchDashboardDataFromState(characterId = '') {
    console.log('[Dashboard] Using state manager, characterId:', characterId);
    console.time('[Dashboard] Fetch time');
    
    try {
        // If a specific character is selected, make sure we have their data
        if (characterId && characterId !== marketState.getActiveCharacterId()) {
            console.log('[Dashboard] Switching to character:', characterId);
            await marketState.setActiveCharacter(characterId);
        }
        
        // Get data for the character
        const stats = marketState.getDashboardStats(characterId || null);
        const character = characterId 
            ? marketState.getCharacters().find(c => c.character_id === characterId)
            : marketState.getActiveCharacter();
        const activityData = marketState.getActivityData(characterId || null);
        
        console.log('[Dashboard] Character:', character?.character_name);
        console.log('[Dashboard] Stats:', stats);
        console.log('[Dashboard] Activity Data:', activityData ? 'loaded' : 'null');
        
        if (!activityData) {
            console.warn('[Dashboard] No activity data available');
        }
        
        console.timeEnd('[Dashboard] Fetch time');
        
        // Populate all metrics from cached data
        populateDashboardMetricsFromCache(stats, character, activityData, characterId);
        populateRecentTransactionsFromCache(activityData);
        await populateNotificationsFromCache(activityData, characterId);
        
    } catch (error) {
        console.error('[Dashboard] Error fetching from state manager:', error);
        throw error;
    }
}

function populateDashboardMetricsFromCache(stats, character, activityData, characterId) {
    console.log('[Dashboard] Populating metrics from activity data');
    
    if (!activityData) {
        console.warn('[Dashboard] No activity data available');
        return;
    }
    
    // Active Holdings - from character data
    const holdingsEl = document.getElementById('activeHoldings');
    if (holdingsEl) {
        const characters = marketState.getCharacters();
        const totalGold = (characterId === '' || !character)
            ? characters.reduce((sum, c) => sum + (c.gold || 0), 0)  // All characters
            : character.gold;  // Specific character
        holdingsEl.textContent = `${formatNumberWithCommas(totalGold, 0)} Gold`;
    }
    
    // Active Listings Count - from stats or calculate
    const activeListingsEl = document.getElementById('activeListingsCount');
    if (activeListingsEl) {
        if (stats?.active_listings_count !== undefined) {
            activeListingsEl.textContent = formatNumberWithCommas(stats.active_listings_count);
        } else {
            // For "All Characters" mode, we need to query this
            // For now, show a placeholder
            activeListingsEl.textContent = '-';
        }
    }
    
    // Calculate time-based metrics from sales data
    if (activityData.sales && activityData.sales.length > 0) {
        const now = new Date();
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        
        console.log('[Dashboard] Filtering sales - total:', activityData.sales.length);
        
        // 24h Market Volume
        const sales24h = activityData.sales.filter(s => new Date(s.date) >= oneDayAgo);
        const volume24h = sales24h.reduce((sum, s) => sum + (s.total_amount || 0), 0);
        
        console.log('[Dashboard] 24h sales count:', sales24h.length, 'volume:', volume24h);
        
        const marketVolumeEl = document.getElementById('marketVolume');
        if (marketVolumeEl) {
            marketVolumeEl.textContent = `${formatNumberWithCommas(volume24h, 0)} Gold`;
            console.log('[Dashboard] Set market volume element to:', marketVolumeEl.textContent);
        } else {
            console.warn('[Dashboard] Market volume element not found');
        }
        
        // 7d Net Profit
        const sales7d = activityData.sales.filter(s => new Date(s.date) >= sevenDaysAgo);
        const profit7d = sales7d.reduce((sum, s) => sum + (s.total_amount || 0), 0);
        
        const netProfitEl = document.getElementById('netProfit');
        if (netProfitEl) {
            netProfitEl.textContent = `${formatNumberWithCommas(profit7d, 0)} Gold`;
        }
        
        // Calculate most profitable and most sold items
        const itemStats = {};
        
        activityData.sales.forEach(sale => {
            const itemName = sale.item_name || `Item #${sale.id}`;
            
            if (!itemStats[itemName]) {
                itemStats[itemName] = { profit: 0, quantity: 0 };
            }
            
            itemStats[itemName].profit += sale.total_amount || 0;
            itemStats[itemName].quantity += sale.quantity || 0;
        });
        
        let mostProfitable = { name: 'N/A', value: 0 };
        let mostSold = { name: 'N/A', count: 0 };
        
        for (const [name, data] of Object.entries(itemStats)) {
            if (data.profit > mostProfitable.value) {
                mostProfitable = { name, value: data.profit };
            }
            if (data.quantity > mostSold.count) {
                mostSold = { name, count: data.quantity };
            }
        }
        
        console.log('[Dashboard] Most profitable:', mostProfitable);
        console.log('[Dashboard] Most sold:', mostSold);
        
        // Most Profitable Item
        const profItemEl = document.getElementById('mostProfitableItem');
        const profValEl = document.getElementById('mostProfitableItemValue');
        if (profItemEl) profItemEl.textContent = mostProfitable.name;
        if (profValEl) profValEl.textContent = `+${formatNumberWithCommas(mostProfitable.value, 0)} Gold`;
        
        // Most Sold Item
        const soldItemEl = document.getElementById('mostSoldItem');
        const soldCountEl = document.getElementById('mostSoldItemCount');
        if (soldItemEl) soldItemEl.textContent = mostSold.name;
        if (soldCountEl) soldCountEl.textContent = `${formatNumberWithCommas(mostSold.count)} units sold`;
    }
    
    // Fees Paid - from listing_fees array
    const feesEl = document.getElementById('feesPaid');
    if (feesEl) {
        if (activityData.listing_fees && activityData.listing_fees.length > 0) {
            const totalFees = activityData.listing_fees.reduce(
                (sum, l) => sum + (l.fee || 0), 0
            );
            feesEl.textContent = formatNumberWithCommas(totalFees, 0);
        } else if (stats?.fees_paid !== undefined) {
            feesEl.textContent = formatNumberWithCommas(stats.fees_paid, 0);
        }
    }
    
    // PVE Gold Earned
    const pveEl = document.getElementById('pveGoldEarned');
    if (pveEl) {
        if (activityData.pve_transactions && activityData.pve_transactions.length > 0) {
            console.log('[Dashboard] Sample PVE transaction:', activityData.pve_transactions[0]);
            const totalPveGold = activityData.pve_transactions.reduce(
                (sum, t) => {
                    // Try different field names
                    const amount = t.gold_amount || t.amount || t.total_amount || 0;
                    return sum + amount;
                }, 0
            );
            console.log('[Dashboard] PVE transactions:', activityData.pve_transactions.length, 'total:', totalPveGold);
            
            // If calculated total is 0 but stats has a value, use stats
            if (totalPveGold === 0 && stats?.pve_gold_total) {
                console.log('[Dashboard] Using PVE from stats instead:', stats.pve_gold_total);
                pveEl.textContent = formatNumberWithCommas(stats.pve_gold_total, 0);
            } else {
                pveEl.textContent = formatNumberWithCommas(totalPveGold, 0);
            }
        } else if (stats?.pve_gold_total !== undefined) {
            console.log('[Dashboard] Using PVE from stats:', stats.pve_gold_total);
            pveEl.textContent = formatNumberWithCommas(stats.pve_gold_total, 0);
        } else {
            console.warn('[Dashboard] No PVE data available');
            pveEl.textContent = '0';
        }
    } else {
        console.warn('[Dashboard] PVE element not found');
    }
}

function populateRecentTransactionsFromCache(activityData) {
    const tableBody = document.getElementById('recentTransactionsBody');
    if (!tableBody) return;
    
    if (!activityData?.sales || activityData.sales.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5" class="text-center text-gray-400 py-4">No recent sales</td></tr>';
        return;
    }
    
    // Take first 9 sales (should already be sorted by date desc from RPC)
    const recentSales = activityData.sales.slice(0, 9);
    
    let html = '';
    recentSales.forEach(sale => {
        const itemName = sale.item_name || `Item #${sale.id}`;
        const quantity = sale.quantity || 0;
        const pricePerUnit = sale.price_per_unit || 0;
        const totalAmount = sale.total_amount || 0;
        
        // Calculate total listed price (price per unit * quantity)
        const totalListedPrice = pricePerUnit * quantity;
        
        const totalText = `+${formatNumberWithCommas(Math.abs(totalAmount), 0)}`;
        
        html += `
            <tr class="hover:bg-gray-700 transition duration-100">
                <td class="py-3 px-2 font-medium">${itemName}</td>
                <td class="py-3 px-2 text-right">${formatNumberWithCommas(quantity, 0)}</td>
                <td class="py-3 px-2 text-right">${formatNumberWithCommas(pricePerUnit, 2)}</td>
                <td class="py-3 px-2 text-right">${formatNumberWithCommas(totalListedPrice, 0)}</td>
                <td class="py-3 px-2 text-right text-green-500">${totalText}</td>
            </tr>
        `;
    });
    
    tableBody.innerHTML = html;
}

async function populateNotificationsFromCache(activityData, characterId) {
    // We need to fetch active listings separately since they're not in activityData
    try {
        const { data: { user } = {} } = await supabase.auth.getUser();
        if (!user) {
            allNotifications = [];
            currentPage = 1;
            renderNotificationsPage();
            return 0;
        }
        
        const now = new Date();
        const MS_PER_DAY = 24 * 60 * 60 * 1000;
        
        const agingDaysAgo = new Date(now.getTime() - DAYS_AGING * MS_PER_DAY).toISOString();
        
        // Fetch active listings for notifications
        let oldListingsQuery = supabase
            .from('market_listings')
            .select('item_id, listing_date, items(item_name)')
            .eq('user_id', user.id)
            .is('is_fully_sold', false)
            .is('is_cancelled', false)
            .lt('listing_date', agingDaysAgo);
            
        if (characterId !== '') {
            oldListingsQuery = oldListingsQuery.eq('character_id', characterId);
        }

        const { data: oldListings } = await oldListingsQuery;
        
        allNotifications = [];
        
        if (oldListings && oldListings.length > 0) {
            const warningDaysAgo = new Date(now.getTime() - DAYS_WARNING * MS_PER_DAY).toISOString();
            const criticalDaysAgo = new Date(now.getTime() - DAYS_CRITICAL * MS_PER_DAY).toISOString();
            
            oldListings.forEach(listing => {
                const listingDate = new Date(listing.listing_date);
                const itemName = listing.items?.item_name || `Item #${listing.item_id}`;
                
                let className, icon, text, severity;
                
                if (listing.listing_date < criticalDaysAgo) {
                    className = "text-sm text-red-400 p-2 border border-red-500 rounded-md bg-red-900/20";
                    icon = "fa-exclamation-triangle";
                    text = `CRITICAL: Listing for <strong>${itemName}</strong> is older than ${DAYS_CRITICAL} days.`;
                    severity = 3;
                } else if (listing.listing_date < warningDaysAgo) {
                    className = "text-sm text-amber-400 p-2 border border-amber-500 rounded-md bg-amber-900/20";
                    icon = "fa-clock";
                    text = `WARNING: Listing for <strong>${itemName}</strong> is older than ${DAYS_WARNING} days.`;
                    severity = 2;
                } else {
                    className = "text-sm text-green-400 p-2 border border-green-500 rounded-md bg-green-900/20";
                    icon = "fa-check-circle";
                    text = `NOTICE: Listing for <strong>${itemName}</strong> is older than ${DAYS_AGING} days.`;
                    severity = 1;
                }
                
                allNotifications.push({
                    className,
                    innerHTML: `<i class="fas ${icon} mr-1"></i> ${text}`,
                    date: listing.listing_date,
                    severity
                });
            });
            
            // Sort by severity (critical first) then date (oldest first)
            allNotifications.sort((a, b) => {
                if (a.severity !== b.severity) return b.severity - a.severity;
                return new Date(a.date) - new Date(b.date);
            });
        }
        
        currentPage = 1;
        renderNotificationsPage();
        
        return allNotifications.length;
    } catch (error) {
        console.error('[Dashboard] Error fetching notifications:', error);
        allNotifications = [];
        currentPage = 1;
        renderNotificationsPage();
        return 0;
    }
}

// ===== KEEP: Original Version =====

async function fetchPveGoldEarned() {
    const element = document.getElementById('pveGoldEarned');
    if (!element) return;

    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            element.textContent = "-";
            return;
        }

        const { data, error } = await supabase
            .from('pve_transactions')
            .select('gold_amount')
            .eq('user_id', user.id);

        if (error) throw error;

        const totalGold = data.reduce((sum, transaction) => sum + transaction.gold_amount, 0);

        element.textContent = formatNumberWithCommas(totalGold);
    } catch (error) {
        console.error("Error fetching PVE Gold Earned:", error);
        element.textContent = "Error";
    }
}

async function fetchFeesPaid() {
    const element = document.getElementById('feesPaid');
    if (!element) return;

    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            element.textContent = "-";
            return;
        }

        const { data, error } = await supabase
            .from('market_listings')
            .select('market_fee')
            .eq('user_id', user.id);
            
        if (error) throw error;

        const totalFees = data.reduce((sum, listing) => sum + listing.market_fee, 0);

        element.textContent = formatNumberWithCommas(totalFees);
    } catch (error) {
        console.error("Error fetching Fees Paid:", error);
        element.textContent = "Error";
    }
}

function formatNumberWithCommas(number, precision = null) {
    if (typeof number !== 'number') return number;
    
    let stringNumber;
    if (precision !== null) {
        const factor = Math.pow(10, precision);
        stringNumber = (Math.round(number * factor) / factor).toFixed(precision);
    } else {
        stringNumber = number.toString();
    }

    const parts = stringNumber.split('.');
    const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    const fractionalPart = parts.length > 1 ? '.' + parts[1] : '';
    
    return integerPart + fractionalPart;
}

async function getItemIdToNameMap() {
    const { data: itemsData, error } = await supabase
        .from('items')
        .select('item_id, item_name');

    if (error) {
        console.error("Error fetching items table for name map:", error);
        return {};
    }

    const map = {};
    itemsData.forEach(item => {
        map[item.item_id] = item.item_name;
    });
    return map;
}

async function fetchUserCharacters() {
    const { data: { user } = {} } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
        .from('characters')
        .select('character_id, character_name, gold')
        .eq('user_id', user.id)
        .order('character_name', { ascending: true });
    
    if (error) {
        console.error('Error fetching characters:', error);
        return [];
    }
    return data;
}

// ===== NEW: State Manager Version =====
async function populateCharacterFilterFromState() {
    const select = document.getElementById('character-filter-select');
    if (!select) return;
    
    const characters = marketState.getCharacters();
    const activeCharacterId = marketState.getActiveCharacterId();
    
    while (select.options.length > 0) {
        select.remove(0);
    }

    const allOption = document.createElement('option');
    allOption.value = '';
    allOption.textContent = 'All Characters';
    select.appendChild(allOption);

    characters.forEach(character => {
        const option = document.createElement('option');
        option.value = character.character_id;
        option.textContent = character.character_name;
        select.appendChild(option);
    });
    
    // Default to active character (first character) instead of "All"
    if (activeCharacterId) {
        select.value = activeCharacterId;
        console.log('[Dashboard] Defaulting to active character:', activeCharacterId);
    }

    select.removeEventListener('change', handleFilterChange);
    select.addEventListener('change', handleFilterChange);
}

// ===== KEEP: Original Version =====
async function populateCharacterFilter(characters) {
    const select = document.getElementById('character-filter-select');
    if (!select) return;

    while (select.options.length > 0) {
        select.remove(0);
    }

    const allOption = document.createElement('option');
    allOption.value = '';
    allOption.textContent = 'All Characters';
    select.appendChild(allOption);

    characters.forEach(character => {
        const option = document.createElement('option');
        option.value = character.character_id;
        option.textContent = character.character_name;
        select.appendChild(option);
    });

    select.removeEventListener('change', handleFilterChange);
    select.addEventListener('change', handleFilterChange);
}

function getFilterValues() {
    const characterSelect = document.getElementById('character-filter-select');
    const regionSelect = document.getElementById('region-filter-select'); 

    return {
        characterId: characterSelect ? characterSelect.value : '',
        region: regionSelect ? regionSelect.value : 'all'
    };
}

// ===== ROUTER: handleFilterChange =====
async function handleFilterChange() {
    const { characterId } = getFilterValues();
    
    if (shouldUseStateManager('dashboard')) {
        // State manager version - all data from cache
        await fetchDashboardDataFromState(characterId);
    } else {
        // Original version
        const itemIdToNameMap = await getItemIdToNameMap();
        fetchAndPopulateDashboardMetrics(itemIdToNameMap, characterId);
        fetchAndPopulateRecentTransactions(itemIdToNameMap, characterId);
        await fetchAndPopulateNotifications(itemIdToNameMap, characterId);
    }
}

// [Continue with all original functions...]
// (The rest of the original code stays the same for fallback)

async function fetchAndPopulateDashboardMetrics(itemIdToNameMap, characterId = '') {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        let charactersQuery = supabase
            .from('characters')
            .select('gold')
            .eq('user_id', user.id);

        if (characterId !== '') {
            charactersQuery = charactersQuery.eq('character_id', characterId);
        }

        const { data: charactersData } = await charactersQuery;

        let totalAccountGold = 0;
        if (charactersData) {
            totalAccountGold = charactersData.reduce((sum, char) => sum + char.gold, 0);
        }
        const holdingsEl = document.getElementById('activeHoldings');
        if (holdingsEl) holdingsEl.textContent = `${formatNumberWithCommas(totalAccountGold, 0)} Gold`;

        let listingsQuery = supabase
            .from('market_listings')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .is('is_fully_sold', false)
            .is('is_cancelled', false);

        if (characterId !== '') {
            listingsQuery = listingsQuery.eq('character_id', characterId);
        }

        const { count: activeListingsCount, error: listingsError } = await listingsQuery;

        if (!listingsError) {
            const el = document.getElementById('activeListingsCount');
            if (el) el.textContent = formatNumberWithCommas(activeListingsCount);
        }

        const now = new Date();
        const oneDayAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000)).toISOString();
        const twoDaysAgo = new Date(now.getTime() - (48 * 60 * 60 * 1000)).toISOString();
        const sevenDaysAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000)).toISOString();
        const fourteenDaysAgo = new Date(now.getTime() - (14 * 24 * 60 * 60 * 1000)).toISOString();

        let salesQuery = supabase
            .from('sales')
            .select('total_sale_price, quantity_sold, sale_date, listing_id')
            .eq('user_id', user.id)
            .gte('sale_date', fourteenDaysAgo);
        
        if (characterId !== '') {
            salesQuery = salesQuery.eq('character_id', characterId);
        }

        const { data: salesData } = await salesQuery;

        if (salesData) {
            const volume24h = salesData
                .filter(t => t.sale_date >= oneDayAgo)
                .reduce((sum, t) => sum + t.total_sale_price, 0);
            
            const volumePrev24h = salesData
                .filter(t => t.sale_date >= twoDaysAgo && t.sale_date < oneDayAgo)
                .reduce((sum, t) => sum + t.total_sale_price, 0);

            let volumeChange = 0;
            if (volumePrev24h > 0) {
                volumeChange = (volume24h - volumePrev24h) / volumePrev24h;
            }

            const marketVolumeElement = document.getElementById('marketVolume');
            if (marketVolumeElement) {
                marketVolumeElement.textContent = `${formatNumberWithCommas(volume24h, 0)} Gold`;
            }

            const volChangeEl = document.getElementById('marketVolumeChange');
            if (volChangeEl) {
                const volIconClass = volumeChange >= 0 ? 'fa-caret-up text-green-500' : 'fa-caret-down text-red-500';
                const volChangeText = `${volumeChange >= 0 ? '+' : ''}${(volumeChange * 100).toFixed(1)}% vs. Last Day`;
                volChangeEl.innerHTML = `<i class="fas mr-1 ${volIconClass}"></i> ${volChangeText}`;
                volChangeEl.className = `text-sm flex items-center ${volumeChange >= 0 ? 'text-green-500' : 'text-red-500'}`;
            }

            const profit7d = salesData
                .filter(t => t.sale_date >= sevenDaysAgo)
                .reduce((sum, t) => sum + t.total_sale_price, 0);

            const profitPrev7d = salesData
                .filter(t => t.sale_date >= fourteenDaysAgo && t.sale_date < sevenDaysAgo)
                .reduce((sum, t) => sum + t.total_sale_price, 0);

            let profitChange = 0;
            if (profitPrev7d !== 0) {
                profitChange = (profit7d - profitPrev7d) / Math.abs(profitPrev7d);
            }

            const netProfitElement = document.getElementById('netProfit');
            if (netProfitElement) {
                netProfitElement.textContent = `${formatNumberWithCommas(profit7d, 0)} Gold`;
            }

            const profitChangeEl = document.getElementById('netProfitChange');
            if (profitChangeEl) {
                const profitIconClass = profitChange >= 0 ? 'fa-caret-up text-green-500' : 'fa-caret-down text-red-500';
                const profitChangeText = `${profitChange >= 0 ? '+' : ''}${(profitChange * 100).toFixed(1)}% vs. Last Week`;
                profitChangeEl.innerHTML = `<i class="fas mr-1 ${profitIconClass}"></i> ${profitChangeText}`;
                profitChangeEl.className = `text-sm flex items-center ${profitChange >= 0 ? 'text-green-500' : 'text-red-500'}`;
            }
        }

        let allSalesQuery = supabase
            .from('sales')
            .select('listing_id, total_sale_price, quantity_sold')
            .eq('user_id', user.id);
            
        if (characterId !== '') {
            allSalesQuery = allSalesQuery.eq('character_id', characterId);
        }

        const { data: allSales } = await allSalesQuery;

        if (allSales && allSales.length > 0) {
            const listingIds = [...new Set(allSales.map(s => s.listing_id))];
            
            const { data: listingsDetails } = await supabase
                .from('market_listings')
                .select('listing_id, item_id')
                .in('listing_id', listingIds);

            const listingToItemMap = {};
            if (listingsDetails) {
                listingsDetails.forEach(l => {
                    listingToItemMap[l.listing_id] = l.item_id;
                });
            }

            const itemStats = {};

            allSales.forEach(sale => {
                const itemId = listingToItemMap[sale.listing_id];
                if (!itemId) return; 

                const key = itemIdToNameMap[itemId] || `Item #${itemId}`;

                if (!itemStats[key]) {
                    itemStats[key] = { profit: 0, quantity: 0 };
                }
                itemStats[key].profit += sale.total_sale_price;
                itemStats[key].quantity += sale.quantity_sold;
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

            const profItemEl = document.getElementById('mostProfitableItem');
            const profValEl = document.getElementById('mostProfitableItemValue');
            if (profItemEl) profItemEl.textContent = mostProfitable.name;
            if (profValEl) profValEl.textContent = `+${formatNumberWithCommas(mostProfitable.value, 0)} Gold`;
            
            const soldItemEl = document.getElementById('mostSoldItem');
            const soldCountEl = document.getElementById('mostSoldItemCount');
            if (soldItemEl) soldItemEl.textContent = mostSold.name;
            if (soldCountEl) soldCountEl.textContent = `${formatNumberWithCommas(mostSold.count)} units sold`;
        }

    } catch (error) {
        console.error(error);
    }
}

async function fetchAndPopulateRecentTransactions(itemIdToNameMap, characterId = '') {
    const tableBody = document.getElementById('recentTransactionsBody');
    if (!tableBody) return;
    tableBody.innerHTML = '';

    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        let recentSalesQuery = supabase
            .from('sales')
            .select(`
                sale_id, 
                quantity_sold, 
                total_sale_price, 
                sale_date,
                listing_id
            `) 
            .eq('user_id', user.id)
            .order('sale_date', { ascending: false })
            .limit(9);
            
        if (characterId !== '') {
            recentSalesQuery = recentSalesQuery.eq('character_id', characterId);
        }

        const { data: recentSales, error } = await recentSalesQuery;

        if (error) throw error;

        if (recentSales.length > 0) {
            const listingIds = recentSales.map(s => s.listing_id);
            const { data: listings } = await supabase
                .from('market_listings')
                .select('listing_id, item_id, quantity_listed, total_listed_price, listed_price_per_unit')
                .in('listing_id', listingIds);
            
            const listingMap = {};
            if (listings) {
                listings.forEach(l => listingMap[l.listing_id] = {
                    itemId: l.item_id,
                    stackSize: l.quantity_listed > 0 ? l.quantity_listed : 1,
                    originalStackPrice: l.total_listed_price,
                    pricePerUnit: l.listed_price_per_unit
                });
            }

            let html = '';
            recentSales.forEach(sale => {
                const listingData = listingMap[sale.listing_id];
                const itemId = listingData?.itemId || '?';
                const itemName = itemIdToNameMap[itemId] || `Item #${itemId}`;
                
                const originalStackPrice = listingData?.originalStackPrice || 0; 
                const originalPricePerUnit = listingData?.pricePerUnit || 0;

                const totalText = `+${formatNumberWithCommas(Math.abs(sale.total_sale_price), 0)}`;
                const totalClass = 'text-green-500';

                html += `
                    <tr class="hover:bg-gray-700 transition duration-100">
                        <td class="py-3 px-2 font-medium">${itemName}</td>
                        <td class="py-3 px-2 text-right">${formatNumberWithCommas(sale.quantity_sold, 0)}</td>
                        <td class="py-3 px-2 text-right">${formatNumberWithCommas(originalPricePerUnit, 2)}</td>
                        <td class="py-3 px-2 text-right">${formatNumberWithCommas(originalStackPrice, 0)}</td>
                        <td class="py-3 px-2 text-right ${totalClass}">${totalText}</td>
                    </tr>
                `;
            });
            tableBody.innerHTML = html;
        }

    } catch (error) {
        console.error(error);
    }
}

export function updateSidebarAlerts() {
    const alertBadge = document.getElementById('sidebarAlertBadge');
    const sidebar = document.getElementById('sidebar');

    const COUNT_CLASSES = ['px-2', 'py-0.5', 'text-xs', 'bg-amber-400', 'text-gray-900', 'rounded-full'];
    const DOT_CLASSES = ['w-3', 'h-3', 'p-0', 'bg-red-500', 'rounded-full', 'top-1', 'right-1'];
    
    const ALL_DYNAMIC_CLASSES = [...new Set([...COUNT_CLASSES, ...DOT_CLASSES])];

    if (alertBadge) {
        if (currentNotificationCount > 0) {
            alertBadge.classList.remove('hidden');
            
            alertBadge.classList.remove(...ALL_DYNAMIC_CLASSES);

            if (sidebar && sidebar.classList.contains('collapsed')) {
                alertBadge.textContent = '';
                alertBadge.classList.add(...DOT_CLASSES);
            } else {
                alertBadge.textContent = currentNotificationCount;
                alertBadge.classList.add(...COUNT_CLASSES);
            }
        } else {
            alertBadge.classList.add('hidden');
            alertBadge.classList.remove(...ALL_DYNAMIC_CLASSES);
        }
    }
}

function renderNotificationsPage() {
    const list = document.getElementById('notificationsList');
    const pageInfoEl = document.getElementById('pageInfo');
    const prevPageBtn = document.getElementById('prevPageBtn');
    const nextPageBtn = document.getElementById('nextPageBtn');

    if (!list) return;
    list.innerHTML = '';

    const totalNotifications = allNotifications.length;
    const totalPages = Math.ceil(totalNotifications / NOTIFICATIONS_PER_PAGE);

    if (currentPage < 1) currentPage = 1;
    if (currentPage > totalPages && totalPages > 0) currentPage = totalPages;
    if (totalPages === 0) currentPage = 0;

    const start = (currentPage - 1) * NOTIFICATIONS_PER_PAGE;
    const end = currentPage * NOTIFICATIONS_PER_PAGE;
    const notificationsToRender = allNotifications.slice(start, end);

    if (totalNotifications === 0) {
        const li = document.createElement('li');
        li.className = "text-sm text-gray-400 p-2";
        li.textContent = "No new notifications.";
        list.appendChild(li);
    } else {
        notificationsToRender.forEach(note => {
            const li = document.createElement('li');
            li.className = note.className;
            li.innerHTML = note.innerHTML;
            list.appendChild(li);
        });
    }

    if (pageInfoEl) pageInfoEl.textContent = `Page ${currentPage || 0} of ${totalPages}`;
    if (prevPageBtn) prevPageBtn.disabled = currentPage <= 1;
    if (nextPageBtn) nextPageBtn.disabled = currentPage >= totalPages;

    currentNotificationCount = totalNotifications;
    updateSidebarAlerts();
}

async function fetchAndPopulateNotifications(itemIdToNameMap, characterId = '') {
    try {
        const { data: { user } = {} } = await supabase.auth.getUser();
        if (!user) return 0;

        const now = new Date();
        const MS_PER_DAY = 24 * 60 * 60 * 1000;
        
        const agingDaysAgo = new Date(now.getTime() - DAYS_AGING * MS_PER_DAY).toISOString();
        const warningDaysAgo = new Date(now.getTime() - DAYS_WARNING * MS_PER_DAY).toISOString();
        const criticalDaysAgo = new Date(now.getTime() - DAYS_CRITICAL * MS_PER_DAY).toISOString();

        let oldListingsQuery = supabase
            .from('market_listings')
            .select('item_id, listing_date')
            .eq('user_id', user.id)
            .is('is_fully_sold', false)
            .is('is_cancelled', false)
            .lt('listing_date', agingDaysAgo);
            
        if (characterId !== '') {
            oldListingsQuery = oldListingsQuery.eq('character_id', characterId);
        }

        const { data: oldListings } = await oldListingsQuery;
        
        allNotifications = [];

        if (oldListings && oldListings.length > 0) {
            
            const criticalListings = oldListings.filter(l => l.listing_date < criticalDaysAgo);
            
            const warningListings = oldListings.filter(l => l.listing_date >= criticalDaysAgo && l.listing_date < warningDaysAgo);
            
            const agingListings = oldListings.filter(l => l.listing_date >= warningDaysAgo); 

            criticalListings.forEach(listing => {
                const itemName = itemIdToNameMap[listing.item_id] || `Item #${listing.item_id}`;
                allNotifications.push({
                    className: "text-sm text-red-400 p-2 border border-red-500 rounded-md bg-red-900/20",
                    innerHTML: `<i class="fas fa-exclamation-triangle mr-1"></i> CRITICAL: Listing for <strong>${itemName}</strong> is older than ${DAYS_CRITICAL} days.`,
                    date: listing.listing_date
                });
            });

            warningListings.forEach(listing => {
                const itemName = itemIdToNameMap[listing.item_id] || `Item #${listing.item_id}`;
                allNotifications.push({
                    className: "text-sm text-amber-400 p-2 border border-amber-500 rounded-md bg-amber-900/20",
                    innerHTML: `<i class="fas fa-clock mr-1"></i> WARNING: Listing for <strong>${itemName}</strong> is older than ${DAYS_WARNING} days.`,
                    date: listing.listing_date
                });
            });
            
            agingListings.forEach(listing => {
                const itemName = itemIdToNameMap[listing.item_id] || `Item #${listing.item_id}`;
                allNotifications.push({
                    className: "text-sm text-green-400 p-2 border border-green-500 rounded-md bg-green-900/20",
                    innerHTML: `<i class="fas fa-check-circle mr-1"></i> NOTICE: Listing for <strong>${itemName}</strong> is older than ${DAYS_AGING} days.`,
                    date: listing.listing_date
                });
            });
            
            allNotifications.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        } 
        
        currentPage = 1;
        renderNotificationsPage();
        
        return allNotifications.length;

    } catch (error) {
        console.error(error);
        return 0;
    }
}


function handlePagination(direction) {
    const totalPages = Math.ceil(allNotifications.length / NOTIFICATIONS_PER_PAGE);
    
    if (direction === 'next' && currentPage < totalPages) {
        currentPage++;
    } else if (direction === 'prev' && currentPage > 1) {
        currentPage--;
    }
    renderNotificationsPage();
}

export function initSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
        sidebar.classList.add('collapsed');

        updateSidebarAlerts();

        sidebar.addEventListener('mouseenter', () => {
            sidebar.classList.remove('collapsed');
            updateSidebarAlerts();
        });

        sidebar.addEventListener('mouseleave', () => {
            sidebar.classList.add('collapsed');
            updateSidebarAlerts();
        });
    }
}

function setupPaginationListeners() {
    const prevPageBtn = document.getElementById('prevPageBtn');
    const nextPageBtn = document.getElementById('nextPageBtn');

    if (prevPageBtn) {
        prevPageBtn.addEventListener('click', () => handlePagination('prev'));
    }
    if (nextPageBtn) {
        nextPageBtn.addEventListener('click', () => handlePagination('next'));
    }
}

// ===== INITIALIZATION =====
async function initDashboard() {
    initSidebar();
    setupPaginationListeners();
    
    if (shouldUseStateManager('dashboard')) {
        console.log('[Dashboard] 🚀 State manager enabled!');
        
        // Show loading indicator
        showLoadingIndicator();
        
        try {
            // Initialize state manager WITH character data
            console.time('[Dashboard] State manager init');
            await marketState.initialize(); // Don't skip character data!
            console.timeEnd('[Dashboard] State manager init');
            
            // Load ALL characters' data for dashboard
            console.time('[Dashboard] Load all characters');
            await marketState.loadAllCharactersData();
            console.timeEnd('[Dashboard] Load all characters');
            
            console.log('[Dashboard] Cache stats:', marketState.getCacheStats());
            
            // Populate character dropdown from cache
            await populateCharacterFilterFromState();
            
            // Load initial dashboard data for ACTIVE character (not "All")
            const activeCharacterId = marketState.getActiveCharacterId();
            await fetchDashboardDataFromState(activeCharacterId);
            
            // Hide loading indicator
            hideLoadingIndicator();
            
        } catch (error) {
            console.error('[Dashboard] ❌ State manager failed, falling back:', error);
            
            // Hide loading indicator
            hideLoadingIndicator();
            
            // Automatic fallback
            features.pages.dashboard.useStateManager = false;
            
            // Use original initialization
            fetchPveGoldEarned();
            fetchFeesPaid();
            
            const characters = await fetchUserCharacters();
            populateCharacterFilter(characters);
            
            const itemIdToNameMap = await getItemIdToNameMap();
            handleFilterChange();
        }
    } else {
        console.log('[Dashboard] Using original code path');
        
        fetchPveGoldEarned();
        fetchFeesPaid();
        
        const characters = await fetchUserCharacters();
        populateCharacterFilter(characters);
        
        const itemIdToNameMap = await getItemIdToNameMap();
        handleFilterChange();
    }
}

// Loading indicator functions
function showLoadingIndicator() {
    // Create loading overlay if it doesn't exist
    let overlay = document.getElementById('dashboardLoadingOverlay');
    
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'dashboardLoadingOverlay';
        overlay.className = 'fixed inset-0 bg-gray-900/80 backdrop-blur-sm z-50 flex items-center justify-center';
        overlay.innerHTML = `
            <div class="bg-gray-800 rounded-lg p-8 shadow-2xl border border-amber-600/30 max-w-md">
                <div class="flex flex-col items-center space-y-4">
                    <div class="relative">
                        <div class="w-16 h-16 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                        <div class="absolute inset-0 flex items-center justify-center">
                            <i class="fas fa-chart-line text-amber-400 text-2xl"></i>
                        </div>
                    </div>
                    <div class="text-center">
                        <h3 class="text-xl font-semibold text-amber-400 mb-2">Loading Dashboard</h3>
                        <p class="text-gray-300 text-sm" id="loadingStatusText">Pulling dashboard stats...</p>
                    </div>
                    <div class="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                        <div class="bg-gradient-to-r from-amber-600 to-yellow-500 h-full rounded-full animate-pulse" style="width: 100%"></div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
    } else {
        overlay.classList.remove('hidden');
    }
    
    // Prevent scrolling while loading
    document.body.style.overflow = 'hidden';
}

function hideLoadingIndicator() {
    const overlay = document.getElementById('dashboardLoadingOverlay');
    if (overlay) {
        overlay.classList.add('hidden');
    }
    
    // Re-enable scrolling
    document.body.style.overflow = '';
}

function updateLoadingStatus(message) {
    const statusText = document.getElementById('loadingStatusText');
    if (statusText) {
        statusText.textContent = message;
    }
}

document.addEventListener('DOMContentLoaded', initDashboard);