/**
 * market_listings.js - Modified for State Manager Integration
 * 
 * WEEK 2: listings.html migration
 * 
 * This file now has dual code paths:
 * - OLD PATH: Direct Supabase queries (fallback)
 * - NEW PATH: State manager (enabled via feature flags)
 * 
 * Test with: listings.html?features=listings.useStateManager,listings.enabled
 */

import { supabase } from './supabaseClient.js';
import { marketState } from './marketStateManager.js';
import { features, initFeatureFlags, shouldUseStateManager } from './featureFlags.js';
import { openImportModal } from './import_data.js';
import { isLoggedIn, logout, getUserProfile } from './utils.js';

// Initialize feature flags
initFeatureFlags();

const REGION_SHARD_MAP = {
    'EU': ['Arcadia', 'Demeter', 'Tyr', 'Fenrir'],
    'NA': ['Sif', 'Selene'],
    'SEA': ['Balder']
};

const getAllShards = () => Object.values(REGION_SHARD_MAP).flat();

const getRegionsForShard = (shard) => {
    for (const region in REGION_SHARD_MAP) {
        if (REGION_SHARD_MAP[region].includes(shard)) {
            return region;
        }
    }
    return null;
};

const showAccessDeniedModal = () => {
    const modal = document.getElementById('accessDeniedModal');
    const countdownElement = document.getElementById('redirectCountdown');
    let countdown = 5;

    modal.classList.remove('hidden');

    countdownElement.textContent = `Redirecting to Market Trends in ${countdown} seconds...`;

    const interval = setInterval(() => {
        countdown -= 1;
        countdownElement.textContent = `Redirecting to Market Trends in ${countdown} seconds...`;
        if (countdown <= 0) {
            clearInterval(interval);
            window.location.href = 'trends.html';
        }
    }, 1000);
};

const checkAdminAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
        showAccessDeniedModal();
        return false;
    }

    const userId = session.user.id;
    
    const { data: permissions, error } = await supabase
        .from('listings_permissions')
        .select('permitted')
        .eq('user_id', userId)
        .eq('permitted', true) 
        .single();

    if (error && error.code !== 'PGRST116') {
        showAccessDeniedModal();
        return false;
    }

    if (!permissions) {
        showAccessDeniedModal();
        return false;
    }
    
    return true;
};

const listingResultsBody = document.getElementById('listingResultsBody');
const applyFiltersBtn = document.getElementById('applyFiltersBtn');
const clearFiltersBtn = document.getElementById('clearFiltersBtn');
const filterRegionInput = document.getElementById('filterRegion');
const filterShardInput = document.getElementById('filterShard');
const filterProvinceInput = document.getElementById('filterProvince');
const filterHomeValleyInput = document.getElementById('filterHomeValley');
const filterCategoryInput = document.getElementById('filterCategory');
const filterItemNameInput = document.getElementById('filterItemName');
const paginationContainer = document.getElementById('paginationContainer');
const totalListingsCount = document.getElementById('totalListingsCount');
const lowestPriceUnit = document.getElementById('lowestPriceUnit');
const highestPriceUnit = document.getElementById('highestPriceUnit');
const lowestTotalPrice = document.getElementById('lowestTotalPrice');
const highestTotalPrice = document.getElementById('highestTotalPrice');

let currentSortColumn = 'item_name';
let currentSortDirection = 'asc';
export let currentPage = 1;
const listingsPerPage = 20;

export const getCurrentFilters = () => ({
    region: filterRegionInput.value.trim(),
    shard: filterShardInput.value.trim(),
    province: filterProvinceInput.value.trim(),
    homeValley: filterHomeValleyInput.value.trim(),
    category: filterCategoryInput.value.trim(),
    itemName: filterItemNameInput.value.trim(),
});

const createOption = (value, text) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = text;
    return option;
};

const updateShardOptions = (selectedRegion, initialLoad = false) => {
    const currentShard = filterShardInput.value;
    filterShardInput.innerHTML = '<option value="">All Shards</option>';

    const shardsToShow = selectedRegion 
        ? REGION_SHARD_MAP[selectedRegion] || []
        : getAllShards();

    shardsToShow.forEach(s => filterShardInput.appendChild(createOption(s, s)));

    if (shardsToShow.includes(currentShard)) {
        filterShardInput.value = currentShard;
    } else if (!initialLoad && selectedRegion) {
        filterShardInput.value = '';
    }
};

const updateRegionOptions = (selectedShard, initialLoad = false) => {
    const currentRegion = filterRegionInput.value;
    filterRegionInput.innerHTML = '<option value="">All Regions</option>';

    const regionToShow = selectedShard 
        ? [getRegionsForShard(selectedShard)]
        : Object.keys(REGION_SHARD_MAP);

    regionToShow.filter(r => r !== null).forEach(r => filterRegionInput.appendChild(createOption(r, r)));

    if (regionToShow.includes(currentRegion)) {
        filterRegionInput.value = currentRegion;
    } else if (!initialLoad && selectedShard) {
        filterRegionInput.value = '';
    }
};

// ===== NEW: State Manager Version =====
async function populateFiltersFromState() {
    //console.log('[Listings] Using state manager for filters');
    
    // Get cached data (instant - no database queries!)
    const items = marketState.getAllItems();
    const categories = marketState.getItemCategories();
    
    // Populate region/shard/province/valley (same as before)
    updateRegionOptions('', true);
    updateShardOptions('', true);
    
    filterProvinceInput.innerHTML = '<option value="">All Provinces</option>';
    ['Kerys', 'Ancien', 'Merrie', 'Inis Gallia'].forEach(p => 
        filterProvinceInput.appendChild(createOption(p, p))
    );
    
    filterHomeValleyInput.innerHTML = '<option value="">All Valleys</option>';
    ["Aras","Ardbog","Ardennes","Armanhac","Astarac","Atigny","Aven","Bearm","Bronyr","Caster",
     "Dolovan","Down","Dreger","Ewyas","Gael","Gravas","Javerdus","Jura","Langres","Lavedan",
     "Libornes","Llydaw","Maremna","Morvan","Nene","Nones","Pladenn","Retz","Salias","Shire",
     "Tolosa","Trecassis","Tremen","Tursan","Ulaid","Vanes","Vitry","Volvestre","Wiht","Yarborn"]
        .forEach(v => filterHomeValleyInput.appendChild(createOption(v, v)));
    
    // Populate categories from cache
    filterCategoryInput.innerHTML = '<option value="">All Categories</option>';
    categories
        .sort((a, b) => a.category_name.localeCompare(b.category_name))
        .forEach(cat => 
            filterCategoryInput.appendChild(createOption(cat.category_id, cat.category_name))
        );
    
    // Populate items from cache
    filterItemNameInput.innerHTML = '<option value="">All Items</option>';
    items
        .sort((a, b) => a.item_name.localeCompare(b.item_name))
        .forEach(item => 
            filterItemNameInput.appendChild(createOption(item.item_id, item.item_name))
        );
    
    //console.log(`[Listings] ✓ Populated filters: ${items.length} items, ${categories.length} categories`);
}

// ===== KEEP: Original Version =====
async function populateFiltersOriginal() {
    updateRegionOptions('', true);
    updateShardOptions('', true);

    filterProvinceInput.innerHTML = '<option value="">All Provinces</option>';
    ['Kerys', 'Ancien', 'Merrie', 'Inis Gallia'].forEach(p => 
        filterProvinceInput.appendChild(createOption(p, p))
    );
    
    filterHomeValleyInput.innerHTML = '<option value="">All Valleys</option>';
    ["Aras","Ardbog","Ardennes","Armanhac","Astarac","Atigny","Aven","Bearm","Bronyr","Caster",
     "Dolovan","Down","Dreger","Ewyas","Gael","Gravas","Javerdus","Jura","Langres","Lavedan",
     "Libornes","Llydaw","Maremna","Morvan","Nene","Nones","Pladenn","Retz","Salias","Shire",
     "Tolosa","Trecassis","Tremen","Tursan","Ulaid","Vanes","Vitry","Volvestre","Wiht","Yarborn"]
        .forEach(v => filterHomeValleyInput.appendChild(createOption(v, v)));

    const { data: categories } = await supabase
        .from('item_categories')
        .select('*')
        .order('category_name', { ascending: true });
    
    filterCategoryInput.innerHTML = '<option value="">All Categories</option>';
    categories?.forEach(cat => 
        filterCategoryInput.appendChild(createOption(cat.category_id, cat.category_name))
    );

    const { data: items } = await supabase
        .from('items')
        .select('item_name, item_id')
        .order('item_name', { ascending: true });
    
    filterItemNameInput.innerHTML = '<option value="">All Items</option>';
    items?.forEach(item => 
        filterItemNameInput.appendChild(createOption(item.item_id, item.item_name))
    );
}

// ===== ROUTER: Choose which version to use =====
export const populateFilters = async () => {
    if (shouldUseStateManager('listings')) {
        return await populateFiltersFromState();
    } else {
        return await populateFiltersOriginal();
    }
};

const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const hh = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
};

export const sortListings = (listings, column, direction) => {
    const dir = direction === 'asc' ? 1 : -1;
    return listings.sort((a, b) => {
        let valA, valB;
        switch (column) {
            case 'item_name':
                valA = a.items?.item_name?.toLowerCase() || '';
                valB = b.items?.item_name?.toLowerCase() || '';
                break;
            case 'category_name':
                valA = a.items?.item_categories?.category_name?.toLowerCase() || '';
                valB = b.items?.item_categories?.category_name?.toLowerCase() || '';
                break;
            case 'quantity_listed':
                valA = Number(a.quantity_listed || 0);
                valB = Number(b.quantity_listed || 0);
                break;
            case 'listed_price_per_unit':
                valA = Number(a.listed_price_per_unit || 0);
                valB = Number(b.listed_price_per_unit || 0);
                break;
            case 'total_listed_price':
                valA = Number(a.total_listed_price || 0);
                valB = Number(b.total_listed_price || 0);
                break;
            case 'home_valley':
                valA = a.market_stalls?.home_valley?.toLowerCase() || '';
                valB = b.market_stalls?.home_valley?.toLowerCase() || '';
                break;
            case 'listing_date':
                valA = a.listing_date ? new Date(a.listing_date).getTime() : 0;
                valB = b.listing_date ? new Date(b.listing_date).getTime() : 0;
                break;
            case 'listing_id':
                valA = Number(a.listing_id || 0);
                valB = Number(b.listing_id || 0);
                break;
            default:
                valA = '';
                valB = '';
        }
        if (valA < valB) return -1 * dir;
        if (valA > valB) return 1 * dir;
        return 0;
    });
};

const renderMarketSummary = (listings, totalCount = null) => {
    // Use provided totalCount if available, otherwise use listings.length
    totalListingsCount.textContent = totalCount !== null ? totalCount : listings.length;

    const activeListings = listings.filter(l => !(l.is_fully_sold || l.is_cancelled));
    
    const activeUnitPrices = activeListings
        .map(l => parseFloat(l.listed_price_per_unit))
        .filter(price => !isNaN(price));

    if (activeUnitPrices.length > 0) {
        const minUnitPrice = Math.min(...activeUnitPrices).toFixed(2);
        const maxUnitPrice = Math.max(...activeUnitPrices).toFixed(2);
        lowestPriceUnit.textContent = `${minUnitPrice}`;
        highestPriceUnit.textContent = `${maxUnitPrice}`;
    } else {
        lowestPriceUnit.textContent = 'N/A';
        highestPriceUnit.textContent = 'N/A';
    }

    const activeTotalPrices = activeListings
        .map(l => parseFloat(l.total_listed_price))
        .filter(price => !isNaN(price));

    if (activeTotalPrices.length > 0) {
        const minTotalPrice = Math.min(...activeTotalPrices).toFixed(2);
        const maxTotalPrice = Math.max(...activeTotalPrices).toFixed(2);
        lowestTotalPrice.textContent = `${minTotalPrice}`;
        highestTotalPrice.textContent = `${maxTotalPrice}`;
    } else {
        lowestTotalPrice.textContent = 'N/A';
        highestTotalPrice.textContent = 'N/A';
    }
};

export const renderListings = (listings) => {
    if (!listings?.length) {
        listingResultsBody.innerHTML = '<tr><td colspan="8" class="px-3 py-4 whitespace-nowrap text-sm text-gray-400 text-center">No active listings found for the current filters.</td></tr>';
        return;
    }
    listingResultsBody.innerHTML = listings.map(listing => {
        const itemName = listing.items?.item_name || `Unknown Item (ID: ${listing.item_id})`;
        const categoryName = listing.items?.item_categories?.category_name || 'N/A';
        const isResolved = listing.is_fully_sold && listing.is_cancelled;
        const pricePerUnit = isResolved ? 'N/A' : parseFloat(listing.listed_price_per_unit).toFixed(2);
        const totalPrice = isResolved ? 'N/A' : parseFloat(listing.total_listed_price).toFixed(2);
        const quantity = listing.quantity_listed;
        const dateListed = formatDate(listing.listing_date);
        const homeValley = listing.market_stalls?.home_valley || 'N/A';
        const regionProvince = (listing.market_stalls?.region && listing.market_stalls?.province) 
                                ? `${listing.market_stalls.region}/${listing.market_stalls.province}` : 'N/A';
        const listingId = listing.listing_id;
        const rowClass = isResolved ? 'hover:bg-gray-700/50 bg-yellow-900/10' : 'hover:bg-gray-700';

        return `
            <tr class="${rowClass}">
                <td class="px-3 py-2 whitespace-nowrap text-sm font-medium text-white">
                    ${itemName}
                </td>
                <td class="px-3 py-2 whitespace-nowrap text-sm text-gray-300 text-center">${categoryName}</td>
                <td class="px-3 py-2 whitespace-nowrap text-sm text-gray-300 text-center">${quantity}</td>
                <td class="px-3 py-2 whitespace-nowrap text-sm text-green-400 text-center">${pricePerUnit}</td>
                <td class="px-3 py-2 whitespace-nowrap text-sm text-green-400 text-center">${totalPrice}</td>
                <td class="px-3 py-2 whitespace-nowrap text-sm text-gray-300 text-center">${dateListed}</td>
                <td class="px-3 py-2 whitespace-nowrap text-sm text-gray-300 text-center hidden">${listingId}</td>
            </tr>`;
    }).join('');
};

const renderPagination = (totalCount, currentPage) => {
    const totalPages = Math.ceil(totalCount / listingsPerPage);
    paginationContainer.innerHTML = '';
    if (totalPages <= 1) return;
    const makeBtn = (label, page, disabled) => {
        const btn = document.createElement('button');
        btn.textContent = label;
        btn.className = `px-3 py-1 rounded-lg text-sm ${disabled ? 'bg-gray-700 text-gray-500' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`;
        btn.disabled = disabled;
        if (!disabled) btn.addEventListener('click', () => goToPage(page));
        return btn;
    };
    paginationContainer.append(makeBtn('First', 1, currentPage === 1));
    paginationContainer.append(makeBtn('Prev', currentPage - 1, currentPage === 1));
    const info = document.createElement('span');
    info.className = 'text-white text-sm px-2';
    info.textContent = `Page ${currentPage} / ${totalPages}`;
    paginationContainer.append(info);
    paginationContainer.append(makeBtn('Next', currentPage + 1, currentPage === totalPages));
    paginationContainer.append(makeBtn('Last', totalPages, currentPage === totalPages));
};

// ===== NEW: State Manager Version =====
async function fetchActiveListingsFromState(page, filters = {}) {
    //console.log(`[Listings] Using state manager (page ${page})`);
    //console.time('[Listings] Fetch time');
    
    listingResultsBody.style.opacity = '0.5';
    listingResultsBody.style.pointerEvents = 'none';

    try {
        // Single call to state manager (handles caching internally)
        const result = await marketState.getPublicListings(filters, page);
        const { listings, pagination } = result;
        
        //console.log(`[Listings] ✓ Got ${listings.length} listings from state manager`);
        //console.timeEnd('[Listings] Fetch time');
        
        // Render summary cards with total count
        renderMarketSummary(listings, pagination.totalCount);
        
        // Sort listings
        const sorted = sortListings([...listings], currentSortColumn, currentSortDirection);
        
        // Render listings
        renderListings(sorted);
        
        // Render pagination
        renderPagination(pagination.totalCount, pagination.currentPage);
        
    } catch (error) {
        console.error('[Listings] Error fetching from state manager:', error);
        listingResultsBody.innerHTML = `<tr><td colspan="8" class="text-red-400 text-center py-4">Error: ${error.message}</td></tr>`;
        renderMarketSummary([]);
    } finally {
        listingResultsBody.style.opacity = '1';
        listingResultsBody.style.pointerEvents = 'auto';
    }
}

// ===== KEEP: Original Version =====
async function fetchActiveListingsOriginal(page, filters = {}) {
    listingResultsBody.style.opacity = '0.5';
    listingResultsBody.style.pointerEvents = 'none';

    const from = (page - 1) * listingsPerPage;
    const to = from + listingsPerPage - 1;

    const selectClause = `
        listing_id, item_id, quantity_listed, listed_price_per_unit, total_listed_price,
        listing_date, is_fully_sold, is_cancelled,
        items ( item_name, category_id, item_categories:category_id ( category_name ) ),
        market_stalls ( region, province, home_valley ),
        characters ( shard )
    `;

    try {
        const MAX_FETCH = 5000;

        let query = supabase
            .from('market_listings')
            .select(selectClause)
            .eq('is_fully_sold', false)
            .eq('is_cancelled', false)
            .limit(MAX_FETCH);

        let { data: allRows, error } = await query;

        if (error) {
            listingResultsBody.innerHTML = `<tr><td colspan="8" class="text-red-400 text-center py-4">Error: ${error.message}</td></tr>`;
            renderMarketSummary([]);
            return;
        }

        allRows = allRows || [];

        let filtered = allRows;

        if (filters.region) filtered = filtered.filter(l => l.market_stalls?.region === filters.region);
        if (filters.shard) filtered = filtered.filter(l => l.characters?.shard === filters.shard);
        if (filters.province) filtered = filtered.filter(l => l.market_stalls?.province === filters.province);
        if (filters.homeValley) filtered = filtered.filter(l => l.market_stalls?.home_valley === filters.homeValley);
        if (filters.itemName) filtered = filtered.filter(l => l.item_id === parseInt(filters.itemName));
        if (filters.category) filtered = filtered.filter(l => l.items?.category_id === parseInt(filters.category));
        
        renderMarketSummary(filtered);

        const alphabeticallySorted = filtered.sort((a, b) =>
            (a.items?.item_name?.toLowerCase() || '').localeCompare(b.items?.item_name?.toLowerCase() || '')
        );

        const finalSorted = sortListings(alphabeticallySorted, currentSortColumn, currentSortDirection);

        const pageSlice = finalSorted.slice(from, to + 1);

        renderListings(pageSlice);
        renderPagination(filtered.length, page);
    } catch (err) {
        console.error('fetchActiveListings error:', err);
        listingResultsBody.innerHTML = `<tr><td colspan="8" class="text-red-400 text-center py-4">Error loading listings.</td></tr>`;
        renderMarketSummary([]);
    } finally {
        listingResultsBody.style.opacity = '1';
        listingResultsBody.style.pointerEvents = 'auto';
    }
}

// ===== ROUTER: Choose which version to use =====
export const fetchActiveListings = async (page, filters = {}) => {
    if (shouldUseStateManager('listings')) {
        return await fetchActiveListingsFromState(page, filters);
    } else {
        return await fetchActiveListingsOriginal(page, filters);
    }
};

const attachSortingHandlers = () => {
    const headers = document.querySelectorAll(".sortable-header");
    headers.forEach(header => {
        header.addEventListener("click", () => {
            const sortKey = header.dataset.sortKey;
            const isSameColumn = currentSortColumn === sortKey;
            const icon = header.querySelector("i");
            currentSortDirection = isSameColumn && currentSortDirection === "asc" ? "desc" : "asc";
            currentSortColumn = sortKey;
            headers.forEach(h => {
                const i = h.querySelector("i");
                i.className = "fas fa-sort";
            });
            icon.className = currentSortDirection === "asc" ? "fas fa-sort-up" : "fas fa-sort-down";
            fetchActiveListings(currentPage, getCurrentFilters());
        });
    });
};

const goToPage = (page) => {
    currentPage = page;
    fetchActiveListings(currentPage, getCurrentFilters());
};

const applyFilters = () => {
    currentPage = 1;
    fetchActiveListings(currentPage, getCurrentFilters());
};

const handleRegionFilterChange = () => {
    const selectedRegion = filterRegionInput.value;
    updateShardOptions(selectedRegion); 
    currentPage = 1;
    fetchActiveListings(currentPage, getCurrentFilters());
};

const handleShardFilterChange = () => {
    const selectedShard = filterShardInput.value;
    updateRegionOptions(selectedShard);
    currentPage = 1;
    fetchActiveListings(currentPage, getCurrentFilters());
};

const clearFilters = () => {
    [filterRegionInput, filterShardInput, filterProvinceInput, filterHomeValleyInput, filterCategoryInput, filterItemNameInput].forEach(i => i.value = '');
    updateRegionOptions('', true);
    updateShardOptions('', true);
    currentPage = 1;
    fetchActiveListings(currentPage, {});
};

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', async () => {
    const isAdmin = await checkAdminAuth();
    
    if (isAdmin) {
        // Check if we should use state manager
        if (shouldUseStateManager('listings')) {
            //console.log('[Listings] 🚀 State manager enabled!');
            
            try {
                // Initialize state manager (skip character data - not needed for listings)
                //console.time('[Listings] State manager init');
                await marketState.initialize({ skipCharacterData: true });
                //console.timeEnd('[Listings] State manager init');
                
                //console.log('[Listings] Cache stats:', marketState.getCacheStats());
                
                // Use state manager path
                await populateFilters();
                
                // Event listeners
                applyFiltersBtn.addEventListener('click', applyFilters);
                clearFiltersBtn.addEventListener('click', clearFilters);
                filterRegionInput.addEventListener('change', handleRegionFilterChange);
                filterShardInput.addEventListener('change', handleShardFilterChange);
                
                attachSortingHandlers();
                
                // Initial load
                await fetchActiveListings(currentPage);
                
            } catch (error) {
                console.error('[Listings] State manager failed, falling back to original code:', error);
                
                // Automatic fallback to original code
                features.pages.listings.useStateManager = false;
                
                // Use original initialization
                await populateFiltersOriginal();
                applyFiltersBtn.addEventListener('click', applyFilters);
                clearFiltersBtn.addEventListener('click', clearFilters);
                filterRegionInput.addEventListener('change', handleRegionFilterChange);
                filterShardInput.addEventListener('change', handleShardFilterChange);
                attachSortingHandlers();
                await fetchActiveListingsOriginal(currentPage);
            }
        } else {
            //console.log('[Listings] Using original code path (state manager disabled)');
            
            // Original initialization
            await populateFilters();
            
            applyFiltersBtn.addEventListener('click', applyFilters);
            clearFiltersBtn.addEventListener('click', clearFilters);
            
            filterRegionInput.addEventListener('change', handleRegionFilterChange);
            filterShardInput.addEventListener('change', handleShardFilterChange);
            
            attachSortingHandlers();
            fetchActiveListings(currentPage);
        }
    }
});