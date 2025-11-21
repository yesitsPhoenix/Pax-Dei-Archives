let currentNotificationCount = 0;
const DAYS_AGING = 15;
const DAYS_WARNING = 30;
const DAYS_CRITICAL = 45;

let allNotifications = [];
let currentPage = 1;
const NOTIFICATIONS_PER_PAGE = 8;

import { supabase } from './supabaseClient.js';


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

async function handleFilterChange() {
    const { characterId, region } = getFilterValues();
    
    const itemIdToNameMap = await getItemIdToNameMap();

    fetchAndPopulateDashboardMetrics(itemIdToNameMap, characterId);
    fetchAndPopulateRecentTransactions(itemIdToNameMap, characterId);
    await fetchAndPopulateNotifications(itemIdToNameMap, characterId);
}

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

async function initDashboard() {
    initSidebar();
    fetchPveGoldEarned();
    fetchFeesPaid();
    
    const characters = await fetchUserCharacters();
    populateCharacterFilter(characters);
    
    const itemIdToNameMap = await getItemIdToNameMap();
    handleFilterChange();
    
    setupPaginationListeners();
    
}

document.addEventListener('DOMContentLoaded', initDashboard);