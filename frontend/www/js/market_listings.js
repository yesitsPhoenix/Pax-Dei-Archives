import { supabase } from './supabaseClient.js';
import { openImportModal } from './import_data.js';
import { isLoggedIn, logout, getUserProfile } from './utils.js';

const checkAdminAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
        window.location.href = 'index.html';
        return false;
    }

    const userId = session.user.id;
    
    const { data: adminUser, error } = await supabase
        .from('admin_users')
        .select('user_id')
        .eq('user_id', userId)
        .single();

    if (error && error.code !== 'PGRST116') {
        window.location.href = 'index.html';
        return false;
    }

    if (!adminUser) {
        window.location.href = 'index.html';
        return false;
    }
    
    return true;
};

document.getElementById('importDataBtn').addEventListener('click', openImportModal);

const listingResultsBody = document.getElementById('listingResultsBody');
const applyFiltersBtn = document.getElementById('applyFiltersBtn');
const clearFiltersBtn = document.getElementById('clearFiltersBtn');
const filterRegionInput = document.getElementById('filterRegion');
const filterProvinceInput = document.getElementById('filterProvince');
const filterHomeValleyInput = document.getElementById('filterHomeValley');
const filterCategoryInput = document.getElementById('filterCategory');
const filterItemNameInput = document.getElementById('filterItemName');
const paginationContainer = document.getElementById('paginationContainer');

let currentSortColumn = 'item_name';
let currentSortDirection = 'asc';
export let currentPage = 1;
const listingsPerPage = 15;

export const getCurrentFilters = () => ({
    region: filterRegionInput.value.trim(),
    province: filterProvinceInput.value.trim(),
    homeValley: filterHomeValleyInput.value.trim(),
    category: filterCategoryInput.value.trim(),
    itemName: filterItemNameInput.value.trim(),
});

export const populateFilters = async () => {
    const createOption = (value, text) => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = text;
        return option;
    };
    filterRegionInput.innerHTML = '<option value="">All Regions</option>';
    ['EU', 'NA', 'SAE'].forEach(r => filterRegionInput.appendChild(createOption(r, r)));
    filterProvinceInput.innerHTML = '<option value="">All Provinces</option>';
    ['Kerys', 'Ancien', 'Merrie', 'Inis Gallia'].forEach(p => filterProvinceInput.appendChild(createOption(p, p)));
    filterHomeValleyInput.innerHTML = '<option value="">All Valleys</option>';
    ["Aras","Ardbog","Ardennes","Armanhac","Astarac","Atigny","Aven","Bearm","Bronyr","Caster","Dolovan","Down","Dreger","Ewyas","Gael","Gravas","Javerdus","Jura","Langres","Lavedan","Libornes","Llydaw","Maremna","Morvan","Nene","Nones","Pladenn","Retz","Salias","Shire","Tolosa","Trecassis","Tremen","Tursan","Ulaid","Vanes","Vitry","Volvestre","Wiht","Yarborn"].forEach(v => filterHomeValleyInput.appendChild(createOption(v, v)));

    const { data: categories } = await supabase.from('item_categories').select('*').order('category_name', { ascending: true });
    filterCategoryInput.innerHTML = '<option value="">All Categories</option>';
    categories?.forEach(cat => filterCategoryInput.appendChild(createOption(cat.category_id, cat.category_name)));

    const { data: items } = await supabase.from('items').select('item_name, item_id').order('item_name', { ascending: true });
    filterItemNameInput.innerHTML = '<option value="">All Items</option>';
    items?.forEach(item => filterItemNameInput.appendChild(createOption(item.item_id, item.item_name)));
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
            case 'listing_date':
                valA = a.listing_date ? new Date(a.listing_date).getTime() : 0;
                valB = b.listing_date ? new Date(b.listing_date).getTime() : 0;
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

export const renderListings = (listings) => {
    if (!listings?.length) {
        listingResultsBody.innerHTML = '<tr><td colspan="6" class="px-3 py-4 whitespace-nowrap text-sm text-gray-400 text-center">No active listings found for the current filters.</td></tr>';
        return;
    }
    listingResultsBody.innerHTML = listings.map(listing => {
        const itemName = listing.items?.item_name || `Unknown Item (ID: ${listing.item_id})`;
        const categoryName = listing.items?.item_categories?.category_name || 'N/A';
        const isResolved = listing.is_fully_sold && listing.is_cancelled;
        const pricePerUnit = isResolved ? 'N/A' : parseFloat(listing.listed_price_per_unit).toFixed(2);
        const totalPrice = isResolved ? 'N/A' : listing.total_listed_price;
        const quantity = listing.quantity_listed;
        const dateListed = formatDate(listing.listing_date);
        const rowClass = isResolved ? 'hover:bg-gray-700/50 bg-yellow-900/10' : 'hover:bg-gray-700';
        return `
            <tr class="${rowClass}">
                <td class="px-3 py-2 whitespace-nowrap text-sm font-medium text-white">${itemName}</td>
                <td class="px-3 py-2 whitespace-nowrap text-sm text-gray-300 text-center">${categoryName}</td>
                <td class="px-3 py-2 whitespace-nowrap text-sm text-gray-300 text-center">${quantity}</td>
                <td class="px-3 py-2 whitespace-nowrap text-sm text-green-400 text-center">${pricePerUnit}</td>
                <td class="px-3 py-2 whitespace-nowrap text-sm text-green-400 text-center">${totalPrice}</td>
                <td class="px-3 py-2 whitespace-nowrap text-sm text-gray-300 text-center">${dateListed}</td>
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

export const fetchActiveListings = async (page, filters = {}) => {
    listingResultsBody.style.opacity = '0.5';
    listingResultsBody.style.pointerEvents = 'none';

    const from = (page - 1) * listingsPerPage;
    const to = from + listingsPerPage - 1;

    const selectClause = `
        listing_id, item_id, quantity_listed, listed_price_per_unit, total_listed_price,
        listing_date, is_fully_sold, is_cancelled,
        items ( item_name, category_id, item_categories:category_id ( category_name ) ),
        market_stalls ( region, province, home_valley )
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
            listingResultsBody.innerHTML = `<tr><td colspan="6" class="text-red-400 text-center py-4">Error: ${error.message}</td></tr>`;
            return;
        }

        allRows = allRows || [];

        let filtered = allRows;

        if (filters.region) filtered = filtered.filter(l => l.market_stalls?.region === filters.region);
        if (filters.province) filtered = filtered.filter(l => l.market_stalls?.province === filters.province);
        if (filters.homeValley) filtered = filtered.filter(l => l.market_stalls?.home_valley === filters.homeValley);
        if (filters.itemName) filtered = filtered.filter(l => l.item_id === parseInt(filters.itemName));
        if (filters.category) filtered = filtered.filter(l => l.items?.category_id === parseInt(filters.category));

        const alphabeticallySorted = filtered.sort((a, b) =>
            (a.items?.item_name?.toLowerCase() || '').localeCompare(b.items?.item_name?.toLowerCase() || '')
        );

        const finalSorted = sortListings(alphabeticallySorted, currentSortColumn, currentSortDirection);

        const pageSlice = finalSorted.slice(from, to + 1);

        renderListings(pageSlice);
        renderPagination(finalSorted.length, page);
    } catch (err) {
        console.error('fetchActiveListings error:', err);
        listingResultsBody.innerHTML = `<tr><td colspan="6" class="text-red-400 text-center py-4">Error loading listings.</td></tr>`;
    } finally {
        listingResultsBody.style.opacity = '1';
        listingResultsBody.style.pointerEvents = 'auto';
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

const clearFilters = () => {
    [filterRegionInput, filterProvinceInput, filterHomeValleyInput, filterCategoryInput, filterItemNameInput].forEach(i => i.value = '');
    currentPage = 1;
    fetchActiveListings(currentPage, {});
};

document.addEventListener('DOMContentLoaded', async () => {
    const isAdmin = await checkAdminAuth();
    
    if (isAdmin) {
        const traderLoginContainer = document.getElementById('traderLoginContainer');
        
        await populateFilters();
        applyFiltersBtn.addEventListener('click', applyFilters);
        clearFiltersBtn.addEventListener('click', clearFilters);
        attachSortingHandlers();
        fetchActiveListings(currentPage);
    }
});