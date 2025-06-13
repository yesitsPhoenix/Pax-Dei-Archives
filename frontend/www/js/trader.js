// frontend/www/js/trader.js

import { supabase } from './supabaseClient.js';

const traderLoginContainer = document.getElementById('traderLoginContainer');
const traderDiscordLoginButton = document.getElementById('traderDiscordLoginButton');
const traderLoginError = document.getElementById('traderLoginError');
const traderDashboardAndForms = document.getElementById('traderDashboardAndForms');

const addListingForm = document.getElementById('add-listing-form');
const listingsBody = document.getElementById('listings-body');
const listingsTable = document.getElementById('listings-table');
const loader = document.getElementById('loader');
const itemCategorySelect = document.getElementById('item-category');

const salesLoader = document.getElementById('sales-loader');
const salesBody = document.getElementById('sales-body');
const salesTable = document.getElementById('sales-table');
const grossSalesChartCanvas = document.getElementById('grossSalesChart');

const grossSalesEl = document.getElementById('dashboard-gross-sales');
const feesPaidEl = document.getElementById('dashboard-fees-paid');
const netProfitEl = document.getElementById('dashboard-net-profit');
const activeListingsEl = document.getElementById('dashboard-active-listings');

const filterListingItemNameInput = document.getElementById('filter-listing-item-name');
const filterListingCategorySelect = document.getElementById('filter-listing-category');
const filterListingStatusSelect = document.getElementById('filter-listing-status');
const listingsPaginationContainer = document.getElementById('listings-pagination');

const salesPaginationContainer = document.getElementById('sales-pagination');
const downloadSalesCsvButton = document.getElementById('download-sales-csv');

let currentUserId = null;
let grossSalesChartInstance;

const LISTINGS_PER_PAGE = 10;
let currentListingsPage = 1;
const SALES_PER_PAGE = 10;
let currentSalesPage = 1;

let listingsFilter = {
    itemName: '',
    categoryId: '',
    status: 'active'
};

const customModalHtml = `
    <div id="customModal" class="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 hidden">
        <div class="bg-white p-6 rounded-lg shadow-xl w-96 max-w-full font-inter">
            <h3 id="modalTitle" class="text-xl font-bold mb-4 text-gray-800"></h3>
            <p id="modalMessage" class="mb-6 text-gray-700"></p>
            <div id="modalButtons" class="flex justify-end space-x-3"></div>
        </div>
    </div>
`;
document.body.insertAdjacentHTML('beforeend', customModalHtml);

const editListingModalHtml = `
    <div id="editListingModal" class="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 hidden">
        <div class="bg-white p-6 rounded-lg shadow-xl w-full max-w-md mx-4 sm:mx-auto font-inter">
            <h3 class="text-2xl font-bold mb-6 text-gray-800">Edit Listing</h3>
            <form id="editListingForm">
                <div class="mb-4">
                    <label for="edit-item-name" class="block text-gray-700 text-sm font-bold mb-2">Item Name:</label>
                    <input type="text" id="edit-item-name" class="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline bg-gray-100" readonly>
                </div>
                <div class="mb-4">
                    <label for="edit-item-category-display" class="block text-gray-700 text-sm font-bold mb-2">Item Category:</label>
                    <input type="text" id="edit-item-category-display" class="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline bg-gray-100" readonly>
                </div>
                <div class="mb-4">
                    <label for="edit-quantity-listed" class="block text-gray-700 text-sm font-bold mb-2">Quantity Listed:</label>
                    <input type="number" id="edit-quantity-listed" class="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" required>
                </div>
                <div class="mb-4">
                    <label for="edit-price-per-unit" class="block text-gray-700 text-sm font-bold mb-2">Price Per Unit:</label>
                    <input type="number" step="0.01" id="edit-price-per-unit" class="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" required>
                </div>
                <div class="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-0">
                    <button type="submit" class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-full focus:outline-none focus:shadow-outline transition duration-150 ease-in-out transform hover:scale-105 w-full sm:w-auto">Save Changes</button>
                    <button type="button" id="closeEditModal" class="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-full focus:outline-none focus:shadow-outline transition duration-150 ease-in-out transform hover:scale-105 w-full sm:w-auto">Cancel</button>
                </div>
            </form>
        </div>
    </div>
`;
document.body.insertAdjacentHTML('beforeend', editListingModalHtml);

const showCustomModal = (title, message, buttons) => {
    return new Promise(resolve => {
        const modal = document.getElementById('customModal');
        const modalTitle = document.getElementById('modalTitle');
        const modalMessage = document.getElementById('modalMessage');
        const modalButtons = document.getElementById('modalButtons');

        if (!modal || !modalTitle || !modalMessage || !modalButtons) {
            console.error("Modal elements not found. Cannot show custom modal.");
            resolve(false);
            return;
        }

        modalTitle.textContent = title;
        modalMessage.textContent = message;
        modalButtons.innerHTML = '';

        buttons.forEach(buttonConfig => {
            const button = document.createElement('button');
            button.textContent = buttonConfig.text;
            button.className = buttonConfig.className || 'px-4 py-2 rounded-full font-bold transition duration-150 ease-in-out transform hover:scale-105';

            if (buttonConfig.type === 'confirm') {
                button.classList.add('bg-blue-500', 'text-white', 'hover:bg-blue-700');
            } else if (buttonConfig.type === 'cancel') {
                button.classList.add('bg-gray-500', 'text-white', 'hover:bg-gray-700');
            } else {
                button.classList.add('bg-blue-500', 'text-white', 'hover:bg-blue-700');
            }

            button.onclick = () => {
                modal.classList.add('hidden');
                resolve(buttonConfig.value);
            };
            modalButtons.appendChild(button);
        });

        modal.classList.remove('hidden');
    });
};

let currentEditingListingId = null;

const showEditListingModal = async (listingId) => {
    currentEditingListingId = listingId;
    const { data: listing, error } = await supabase
        .from('market_listings')
        .select(`*, items(item_name, item_categories(category_name))`)
        .eq('listing_id', listingId)
        .eq('user_id', currentUserId)
        .single();

    if (error || !listing) {
        console.error('Error fetching listing for edit:', error?.message || 'Listing not found or not authorized.');
        await showCustomModal('Error', 'Could not load listing details for editing. You may not own this listing.', [{ text: 'OK', value: true }]);
        return;
    }

    const editItemNameEl = document.getElementById('edit-item-name');
    const editItemCategoryDisplayEl = document.getElementById('edit-item-category-display');
    const editQuantityListedEl = document.getElementById('edit-quantity-listed');
    const editPricePerUnitEl = document.getElementById('edit-price-per-unit');
    const editListingModalEl = document.getElementById('editListingModal');

    if (editItemNameEl) editItemNameEl.value = listing.items.item_name;
    if (editItemCategoryDisplayEl) editItemCategoryDisplayEl.value = listing.items.item_categories?.category_name || 'N/A';
    if (editQuantityListedEl) editQuantityListedEl.value = listing.quantity_listed;
    if (editPricePerUnitEl) editPricePerUnitEl.value = listing.listed_price_per_unit;

    if (editListingModalEl) editListingModalEl.classList.remove('hidden');
};

const handleEditListingSave = async (e) => {
    e.preventDefault();
    if (!currentEditingListingId) return;

    const quantity_listed = parseInt(document.getElementById('edit-quantity-listed').value, 10);
    const listed_price_per_unit = parseFloat(document.getElementById('edit-price-per-unit').value);

    if (isNaN(quantity_listed) || quantity_listed <= 0 || isNaN(listed_price_per_unit) || listed_price_per_unit <= 0) {
        await showCustomModal('Validation Error', 'Quantity and price must be positive numbers.', [{ text: 'OK', value: true }]);
        return;
    }

    const total_listed_price = quantity_listed * listed_price_per_unit;

    const { error } = await supabase
        .from('market_listings')
        .update({
            quantity_listed: quantity_listed,
            listed_price_per_unit: listed_price_per_unit,
            total_listed_price: total_listed_price
        })
        .eq('listing_id', currentEditingListingId)
        .eq('user_id', currentUserId);

    if (error) {
        console.error('Error updating listing:', error.message);
        await showCustomModal('Error', 'Failed to update listing: ' + error.message, [{ text: 'OK', value: true }]);
    } else {
        document.getElementById('editListingModal').classList.add('hidden');
        await showCustomModal('Success', 'Listing updated successfully!', [{ text: 'OK', value: true }]);
        await loadTraderPageData();
    }
};

const handleCancelListing = async (listingId) => {
    if (!currentUserId) {
        await showCustomModal('Error', 'You must be logged in to cancel a listing.', [{ text: 'OK', value: true }]);
        return;
    }

    const { data: listing, error: fetchError } = await supabase
        .from('market_listings')
        .select('user_id')
        .eq('listing_id', listingId)
        .eq('user_id', currentUserId)
        .single();

    if (fetchError || !listing || listing.user_id !== currentUserId) {
        console.error('Error fetching listing or not authorized to cancel:', fetchError?.message || 'User not authorized.');
        await showCustomModal('Error', 'Could not cancel listing. You may not own this listing or it does not exist.', [{ text: 'OK', value: true }]);
        return;
    }

    if (await showCustomModal('Confirmation', 'Are you sure you want to cancel this listing? This action will mark it as cancelled but fees are non-refundable.', [{ text: 'Yes', value: true, type: 'confirm' }, { text: 'No', value: false, type: 'cancel' }])) {
        const { error } = await supabase
            .from('market_listings')
            .update({ is_fully_sold: false, is_cancelled: true })
            .eq('listing_id', listingId)
            .eq('user_id', currentUserId);

        if (error) {
            console.error('Error cancelling listing:', error.message);
            await showCustomModal('Error', 'Failed to cancel listing: ' + error.message, [{ text: 'OK', value: true }]);
        } else {
            await showCustomModal('Success', 'Listing cancelled successfully!', [{ text: 'OK', value: true }]);
            await loadTraderPageData();
        }
    }
};

const fetchAndPopulateCategories = async () => {
    if (!itemCategorySelect || !filterListingCategorySelect) {
        console.warn("Category select elements not found.");
        return;
    }

    const { data, error } = await supabase
        .from('item_categories')
        .select('category_id, category_name')
        .order('category_name', { ascending: true });

    if (error) {
        console.error('Error fetching categories:', error.message);
        return;
    }

    itemCategorySelect.innerHTML = '<option value="">Select a category</option>';
    data.forEach(category => {
        const option = document.createElement('option');
        option.value = category.category_id;
        option.textContent = category.category_name;
        itemCategorySelect.appendChild(option);
    });

    filterListingCategorySelect.innerHTML = '<option value="">All Categories</option>';
    data.forEach(category => {
        const option = document.createElement('option');
        option.value = category.category_id;
        option.textContent = category.category_name;
        filterListingCategorySelect.appendChild(option);
    });
    filterListingCategorySelect.value = listingsFilter.categoryId;
};

const getOrCreateItemId = async (itemName, categoryId) => {
    const { data: items, error: selectError } = await supabase
        .from('items')
        .select('item_id')
        .eq('item_name', itemName)
        .eq('user_id', currentUserId)
        .limit(1);

    let item = items && items.length > 0 ? items[0] : null;

    if (item) return item.item_id;

    if (!currentUserId) {
        console.error('User ID not available for creating new item.');
        await showCustomModal('Error', 'User ID not found. Please log in again.', [{ text: 'OK', value: true }]);
        return null;
    }

    const { data: newItem, error: insertError } = await supabase
        .from('items')
        .insert({
            item_name: itemName,
            category_id: categoryId,
            user_id: currentUserId
        })
        .select('item_id')
        .single();

    if (insertError) {
        console.error('Error creating item:', insertError.message);
        await showCustomModal('Error', 'Failed to create new item record: ' + insertError.message, [{ text: 'OK', value: true }]);
        return null;
    }
    return newItem.item_id;
};

const loadTraderPageData = async () => {
    console.log("loadTraderPageData: Initiating data fetch.");
    if (loader) loader.style.display = 'block';
    if (salesLoader) salesLoader.style.display = 'block';
    if (listingsTable) listingsTable.style.display = 'none';
    if (salesTable) salesTable.style.display = 'none';

    console.log("loadTraderPageData: Fetching all listings for dashboard.");
    const { data: allListingsForDashboard, error: allListingsError } = await supabase
        .from('market_listings')
        .select(`
            listing_id,
            quantity_listed,
            listed_price_per_unit,
            total_listed_price,
            market_fee,
            listing_date,
            is_fully_sold,
            is_cancelled
        `)
        .eq('user_id', currentUserId)
        .order('listing_date', { ascending: false });

    if (allListingsError) {
        console.error('Error fetching all listings for dashboard:', allListingsError.message);
        if (allListingsError.code !== 'PGRST116') {
             await showCustomModal('Error', 'Could not fetch all market data for dashboard. Please try logging in again.', [{ text: 'OK', value: true }]);
        }
    } else {
        console.log("loadTraderPageData: All listings for dashboard fetched successfully.");
    }

    console.log("loadTraderPageData: Fetching filtered/paginated listings for table.");
    let listingsTableQuery = supabase
        .from('market_listings')
        .select(`
            listing_id,
            quantity_listed,
            listed_price_per_unit,
            total_listed_price,
            market_fee,
            listing_date,
            is_fully_sold,
            is_cancelled,
            items (item_name, item_categories(category_name), user_id)
        `, { count: 'exact' })
        .eq('user_id', currentUserId);

    if (listingsFilter.itemName) {
        listingsTableQuery = listingsTableQuery.ilike('items.item_name', `%${listingsFilter.itemName}%`);
    }
    if (listingsFilter.categoryId) {
        listingsTableQuery = listingsTableQuery.eq('items.category_id', listingsFilter.categoryId);
    }
    if (listingsFilter.status === 'active') {
        listingsTableQuery = listingsTableQuery.eq('is_fully_sold', false).eq('is_cancelled', false);
    } else if (listingsFilter.status === 'sold') {
        listingsTableQuery = listingsTableQuery.eq('is_fully_sold', true);
    } else if (listingsFilter.status === 'cancelled') {
        listingsTableQuery = listingsTableQuery.eq('is_cancelled', true);
    }

    const listingsOffset = (currentListingsPage - 1) * LISTINGS_PER_PAGE;
    listingsTableQuery = listingsTableQuery.range(listingsOffset, listingsOffset + LISTINGS_PER_PAGE - 1);

    const { data: listingsForTable, error: listingsTableError, count: totalListingsCount } = await listingsTableQuery
        .order('listing_date', { ascending: false });

    if (listingsTableError) {
        console.error('Error fetching listings for table:', listingsTableError.message);
        if (listingsTableError.code !== 'PGRST116') {
             await showCustomModal('Error', 'Could not fetch your market listings. Please try logging in again.', [{ text: 'OK', value: true }]);
        }
        if (loader) loader.style.display = 'none';
        return;
    } else {
        console.log("loadTraderPageData: Filtered/paginated listings for table fetched successfully.");
    }

    console.log("loadTraderPageData: Fetching sales data.");
    let salesQuery = supabase
        .from('sales')
        .select(`
            sale_id,
            quantity_sold,
            sale_price_per_unit,
            total_sale_price,
            sale_date,
            market_listings (listing_id, items(item_name, item_categories(category_name), user_id))
        `, { count: 'exact' })
        .eq('user_id', currentUserId);

    const salesOffset = (currentSalesPage - 1) * SALES_PER_PAGE;
    salesQuery = salesQuery.range(salesOffset, salesOffset + SALES_PER_PAGE - 1);

    const { data: sales, error: salesError, count: totalSalesCount } = await salesQuery
        .order('sale_date', { ascending: false });

    if (salesError) {
        console.error('Error fetching sales:', salesError.message);
        if (salesError.code !== 'PGRST116') {
            await showCustomModal('Error', 'Could not fetch your sales data. Please try logging in again.', [{ text: 'OK', value: true }]);
        }
        if (salesLoader) salesLoader.style.display = 'none';
        return;
    } else {
        console.log("loadTraderPageData: Sales data fetched successfully.");
    }

    console.log("loadTraderPageData: Rendering UI elements.");
    renderDashboard(allListingsForDashboard || []);

    renderListingsTable(listingsForTable || []);
    renderListingsPagination(totalListingsCount);

    renderSalesTable(sales || []);
    renderSalesPagination(totalSalesCount);

    if (loader) loader.style.display = 'none';
    if (salesLoader) salesLoader.style.display = 'none';
    if (listingsTable) listingsTable.style.display = 'table';
    if (salesTable) salesTable.style.display = 'table';
    console.log("loadTraderPageData: UI rendering complete.");
};

const renderDashboard = (allListings) => {
    if (!grossSalesEl || !feesPaidEl || !netProfitEl || !activeListingsEl) {
        console.error("renderDashboard: One or more dashboard elements not found. Skipping stats render.");
        return;
    }

    const soldListings = allListings.filter(l => l.is_fully_sold);
    const feesPaid = allListings.reduce((sum, l) => sum + l.market_fee, 0);

    const grossSales = soldListings.reduce((sum, l) => sum + l.total_listed_price, 0);
    const netProfit = grossSales - feesPaid;
    const activeListings = allListings.filter(l => !l.is_fully_sold && !l.is_cancelled);

    grossSalesEl.innerHTML = `${grossSales.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} <i class="fas fa-coins"></i>`;
    feesPaidEl.innerHTML = `${feesPaid.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} <i class="fas fa-coins"></i>`;
    netProfitEl.innerHTML = `${netProfit.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} <i class="fas fa-coins"></i>`;

    activeListingsEl.textContent = activeListings.length;
    console.log("renderDashboard: Dashboard elements updated.");
};

const renderListingsTable = (listings) => {
    if (!listingsBody) {
        console.error("renderListingsTable: Listings table body element not found. Skipping table render.");
        return;
    }
    listingsBody.innerHTML = '';
    if (listings.length === 0) {
        listingsBody.innerHTML = '<tr><td colspan="8" class="text-center">No listings found for the current filters.</td></tr>';
        return;
    }

    listings.forEach(listing => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="py-3 px-6 text-left">${listing.items?.item_name || 'N/A'}</td>
            <td class="py-3 px-6 text-left">${listing.items?.item_categories?.category_name || 'N/A'}</td>
            <td class="py-3 px-6 text-left">${listing.quantity_listed?.toLocaleString() || 'N/A'}</td>
            <td class="py-3 px-6 text-left">${listing.listed_price_per_unit?.toFixed(2) || 'N/A'}</td>
            <td class="py-3 px-6 text-left">${listing.total_listed_price?.toLocaleString() || 'N/A'}</td>
            <td class="py-3 px-6 text-left">${listing.market_fee?.toLocaleString() || 'N/A'}</td>
            <td class="py-3 px-6 text-left">${listing.listing_date ? new Date(listing.listing_date).toLocaleDateString() : 'N/A'}</td>
            <td class="py-3 px-6 text-left">
                <div class="flex gap-2 whitespace-nowrap">
                    <button class="sold-btn bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-3 rounded-full shadow-md transition duration-150 ease-in-out transform hover:scale-105" data-id="${listing.listing_id}">Sold</button>
                    <button class="edit-btn bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-3 rounded-full shadow-md transition duration-150 ease-in-out transform hover:scale-105" data-id="${listing.listing_id}">Edit</button>
                    <button class="cancel-btn bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-3 rounded-full shadow-md transition duration-150 ease-in-out transform hover:scale-105" data-id="${listing.listing_id}">Cancel</button>
                </div>
            </td>
        `;
        listingsBody.appendChild(row);
    });
    console.log("renderListingsTable: Listings table rendered.");
};

const renderListingsPagination = (totalCount) => {
    if (!listingsPaginationContainer) {
        console.warn("renderListingsPagination: Pagination container not found.");
        return;
    }

    const totalPages = Math.ceil(totalCount / LISTINGS_PER_PAGE);
    listingsPaginationContainer.innerHTML = '';

    if (totalPages <= 1) {
        console.log("renderListingsPagination: Only one page, no pagination needed.");
        return;
    }

    console.log(`renderListingsPagination: Total pages: ${totalPages}, current page: ${currentListingsPage}`);

    const prevButton = document.createElement('button');
    prevButton.textContent = 'Previous';
    prevButton.className = `px-4 py-2 rounded-full font-bold transition duration-150 ease-in-out ${currentListingsPage === 1 ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-700 text-white'}`;
    prevButton.disabled = currentListingsPage === 1;
    prevButton.addEventListener('click', () => {
        if (currentListingsPage > 1) {
            currentListingsPage--;
            loadTraderPageData();
        }
    });
    listingsPaginationContainer.appendChild(prevButton);

    for (let i = 1; i <= totalPages; i++) {
        const pageButton = document.createElement('button');
        pageButton.textContent = i;
        pageButton.className = `px-4 py-2 rounded-full font-bold transition duration-150 ease-in-out ${i === currentListingsPage ? 'bg-yellow-500 text-gray-900' : 'bg-gray-600 hover:bg-gray-500 text-white'}`;
        pageButton.addEventListener('click', () => {
            currentListingsPage = i;
            loadTraderPageData();
        });
        listingsPaginationContainer.appendChild(pageButton);
    }

    const nextButton = document.createElement('button');
    nextButton.textContent = 'Next';
    nextButton.className = `px-4 py-2 rounded-full font-bold transition duration-150 ease-in-out ${currentListingsPage === totalPages ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-700 text-white'}`;
    nextButton.disabled = currentListingsPage === totalPages;
    nextButton.addEventListener('click', () => {
        if (currentListingsPage < totalPages) {
            currentListingsPage++;
            loadTraderPageData();
        }
    });
    listingsPaginationContainer.appendChild(nextButton);
};

const renderSalesTable = (sales) => {
    if (!salesBody || !salesTable) {
        console.error("renderSalesTable: Sales table elements not found. Skipping table render.");
        return;
    }
    salesBody.innerHTML = '';
    if (sales.length === 0) {
        salesBody.innerHTML = '<tr><td colspan="6" class="text-center py-4">No sales recorded yet.</td></tr>';
        return;
    }
    sales.forEach(sale => {
        const row = document.createElement('tr');
        row.className = 'border-b border-gray-200 hover:bg-gray-100';
        row.innerHTML = `
            <td class="py-3 px-6 text-left whitespace-nowrap">${sale.market_listings?.items?.item_name || 'N/A'}</td>
            <td class="py-3 px-6 text-left">${sale.market_listings?.items?.item_categories?.category_name || 'N/A'}</td>
            <td class="py-3 px-6 text-left">${sale.quantity_sold?.toLocaleString() || 'N/A'}</td>
            <td class="py-3 px-6 text-left">${sale.sale_price_per_unit?.toFixed(2) || 'N/A'}</td>
            <td class="py-3 px-6 text-left">${sale.total_sale_price?.toLocaleString() || 'N/A'}</td>
            <td class="py-3 px-6 text-left">${sale.sale_date ? new Date(sale.sale_date).toLocaleDateString() : 'N/A'}</td>
        `;
        salesBody.appendChild(row);
    });
    salesTable.style.display = 'table';
    console.log("renderSalesTable: Sales table rendered.");
};

const renderSalesPagination = (totalCount) => {
    if (!salesPaginationContainer) {
        console.warn("renderSalesPagination: Sales pagination container not found.");
        return;
    }

    const totalPages = Math.ceil(totalCount / SALES_PER_PAGE);
    salesPaginationContainer.innerHTML = '';

    if (totalPages <= 1) {
        console.log("renderSalesPagination: Only one page, no pagination needed.");
        return;
    }

    console.log(`renderSalesPagination: Total pages: ${totalPages}, current page: ${currentSalesPage}`);

    const prevButton = document.createElement('button');
    prevButton.textContent = 'Previous';
    prevButton.className = `px-4 py-2 rounded-full font-bold transition duration-150 ease-in-out ${currentSalesPage === 1 ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-700 text-white'}`;
    prevButton.disabled = currentSalesPage === 1;
    prevButton.addEventListener('click', () => {
        if (currentSalesPage > 1) {
            currentSalesPage--;
            loadTraderPageData();
        }
    });
    salesPaginationContainer.appendChild(prevButton);

    for (let i = 1; i <= totalPages; i++) {
        const pageButton = document.createElement('button');
        pageButton.textContent = i;
        pageButton.className = `px-4 py-2 rounded-full font-bold transition duration-150 ease-in-out ${i === currentSalesPage ? 'bg-yellow-500 text-gray-900' : 'bg-gray-600 hover:bg-gray-500 text-white'}`;
        pageButton.addEventListener('click', () => {
            currentSalesPage = i;
            loadTraderPageData();
        });
        salesPaginationContainer.appendChild(pageButton);
    }

    const nextButton = document.createElement('button');
    nextButton.textContent = 'Next';
    nextButton.className = `px-4 py-2 rounded-full font-bold transition duration-150 ease-in-out ${currentSalesPage === totalPages ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-700 text-white'}`;
    nextButton.disabled = currentSalesPage === totalPages;
    nextButton.addEventListener('click', () => {
        if (currentSalesPage < totalPages) {
            currentSalesPage++;
            loadTraderPageData();
        }
    });
    salesPaginationContainer.appendChild(nextButton);
};

const renderGrossSalesChart = (sales) => {
    if (!grossSalesChartCanvas) {
        console.warn("renderGrossSalesChart: Gross sales chart canvas not found. Skipping chart render.");
        return;
    }

    const salesByDate = sales.reduce((acc, sale) => {
        const date = new Date(sale.sale_date).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });
        acc[date] = (acc[date] || 0) + sale.total_sale_price;
        return acc;
    }, {});

    const sortedDates = Object.keys(salesByDate).sort((a, b) => new Date(a) - new Date(b));
    const chartData = sortedDates.map(date => salesByDate[date]);

    if (grossSalesChartInstance) {
        grossSalesChartInstance.destroy();
    }

    if (typeof Chart === 'undefined') {
        console.error("renderGrossSalesChart: Chart.js is not loaded. Please ensure the Chart.js script is included in your HTML.");
        return;
    }

    grossSalesChartInstance = new Chart(grossSalesChartCanvas, {
        type: 'line',
        data: {
            labels: sortedDates,
            datasets: [{
                label: 'Gross Sales',
                data: chartData,
                borderColor: '#4A90E2',
                backgroundColor: 'rgba(74, 144, 226, 0.2)',
                fill: true,
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        color: '#FFFFFF'
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `Gross Sales: ${context.raw.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} Coins`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Date',
                        color: '#FFFFFF'
                    },
                    ticks: {
                        color: '#FFFFFF'
                    },
                    grid: {
                        display: false
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Sales (Coins)',
                        color: '#FFFFFF'
                    },
                    beginAtZero: true,
                    ticks: {
                        color: '#FFFFFF',
                        callback: function(value) {
                            return value.toLocaleString();
                        }
                    }
                }
            }
        }
    });
    console.log("renderGrossSalesChart: Chart rendered.");
};

const showLoader = (isLoading) => {
    if (loader) loader.style.display = isLoading ? 'block' : 'none';
    if (listingsTable) listingsTable.style.display = isLoading ? 'none' : 'table';
};

const handleAddListing = async (e) => {
    e.preventDefault();

    const button = addListingForm ? addListingForm.querySelector('button[type="submit"]') : null;
    if (button) {
        button.disabled = true;
        button.textContent = 'Adding...';
    }

    if (!currentUserId) {
        console.error('handleAddListing: User not authenticated or user ID not available for adding listing.');
        await showCustomModal('Error', 'You must be logged in to add a listing. User ID not found.', [{ text: 'OK', value: true }]);
        if (button) {
            button.disabled = false;
            button.textContent = 'Add Listing';
        }
        return;
    }

    const itemNameInput = document.getElementById('item-name');
    const itemStacksInput = document.getElementById('item-stacks');
    const itemCountPerStackInput = document.getElementById('item-count-per-stack');
    const itemPricePerStackInput = document.getElementById('item-price-per-stack');

    if (!itemNameInput || !itemCategorySelect || !itemStacksInput || !itemCountPerStackInput || !itemPricePerStackInput) {
        console.error("handleAddListing: One or more form input elements are missing.");
        await showCustomModal('Error', 'Missing form elements. Cannot add listing.', [{ text: 'OK', value: true }]);
        if (button) {
            button.disabled = false;
            button.textContent = 'Add Listing';
        }
        return;
    }

    const itemName = itemNameInput.value;
    const selectedCategoryId = itemCategorySelect.value;
    if (!selectedCategoryId) {
        await showCustomModal('Error', 'Please select an item category.', [{ text: 'OK', value: true }]);
        if (button) {
            button.disabled = false;
            button.textContent = 'Add Listing';
        }
        return;
    }

    const stacks = parseInt(itemStacksInput.value, 10);
    const countPerStack = parseInt(itemCountPerStackInput.value, 10);
    const pricePerStack = parseFloat(itemPricePerStackInput.value);

    if (isNaN(stacks) || stacks <= 0 || isNaN(countPerStack) || countPerStack <= 0 || isNaN(pricePerStack) || pricePerStack <= 0) {
        await showCustomModal('Validation Error', 'Stacks, count, and price must be positive numbers.', [{ text: 'OK', value: true }]);
        if (button) {
            button.disabled = false;
            button.textContent = 'Add Listing';
        }
        return;
    }

    const itemId = await getOrCreateItemId(itemName, selectedCategoryId);
    if (!itemId) {
        if (button) {
            button.disabled = false;
            button.textContent = 'Add Listing';
        }
        return;
    }

    let allListingsSuccessful = true;
    for (let i = 0; i < stacks; i++) {
        const quantity_listed = countPerStack;
        const total_listed_price = pricePerStack;
        const listed_price_per_unit = total_listed_price / quantity_listed;

        const market_fee_for_this_stack = Math.ceil(pricePerStack * 0.05);

        const { error } = await supabase.from('market_listings').insert({
            item_id: itemId,
            quantity_listed,
            listed_price_per_unit,
            total_listed_price,
            market_fee: market_fee_for_this_stack,
            listing_date: new Date().toISOString(),
            is_fully_sold: false,
            is_cancelled: false,
            user_id: currentUserId
        });

        if (error) {
            console.error('handleAddListing: Error adding stack listing:', error.message);
            allListingsSuccessful = false;
            break;
        }
    }

    if (allListingsSuccessful) {
        if (addListingForm) addListingForm.reset();
        currentListingsPage = 1;
        listingsFilter.status = 'active';
        if (filterListingItemNameInput) filterListingItemNameInput.value = '';
        if (filterListingCategorySelect) filterListingCategorySelect.value = '';
        if (filterListingStatusSelect) filterListingStatusSelect.value = 'active';

        await loadTraderPageData();
        await showCustomModal('Success', `Listing${stacks > 1 ? 's' : ''} added successfully!`, [{ text: 'OK', value: true }]);
    } else {
        await showCustomModal('Error', 'Failed to add all listings. Check console for details.', [{ text: 'OK', value: true }]);
    }

    if (button) {
        button.disabled = false;
        button.textContent = 'Add Listing';
    }
};

const handleTableClick = async (e) => {
    const listingId = e.target.dataset.id;
    if (!listingId) return;

    if (e.target.classList.contains('sold-btn')) {
        const button = e.target;
        button.disabled = true;

        if (!currentUserId) {
            await showCustomModal('Error', 'You must be logged in to mark a listing as sold.', [{ text: 'OK', value: true }]);
            button.disabled = false;
            return;
        }

        if (await showCustomModal('Confirmation', 'Are you sure you want to mark this item as sold?', [{ text: 'Yes', value: true, type: 'confirm' }, { text: 'No', value: false, type: 'cancel' }])) {
            const { data: listing, error: fetchError } = await supabase
                .from('market_listings')
                .select('*, user_id')
                .eq('listing_id', listingId)
                .eq('user_id', currentUserId)
                .single();

            if (fetchError || !listing || listing.user_id !== currentUserId) {
                console.error('handleTableClick (sold-btn): Error fetching listing to sell or not authorized:', fetchError?.message || 'User not authorized.');
                await showCustomModal('Error', 'Could not find listing details or you do not own this listing to complete sale.', [{ text: 'OK', value: true }]);
                button.disabled = false;
                return;
            }

            const { error: saleError } = await supabase.from('sales').insert({
                listing_id: listing.listing_id,
                quantity_sold: listing.quantity_listed,
                sale_price_per_unit: listing.listed_price_per_unit,
                total_sale_price: listing.total_listed_price,
                sale_date: new Date().toISOString(),
                user_id: listing.user_id
            });

            if (saleError) {
                console.error('handleTableClick (sold-btn): Error creating sale record:', saleError.message);
                await showCustomModal('Error', 'Failed to create the sale record: ' + saleError.message, [{ text: 'OK', value: true }]);
                button.disabled = false;
                return;
            }

            const { error: updateError } = await supabase
                .from('market_listings')
                .update({ is_fully_sold: true })
                .eq('listing_id', listingId)
                .eq('user_id', currentUserId);

            if (updateError) {
                console.error('handleTableClick (sold-btn): Error updating listing status:', updateError.message);
                await showCustomModal('Error', 'Sale was recorded, but the listing status could not be updated.', [{ text: 'OK', value: true }]);
            } else {
                await showCustomModal('Success', 'Listing marked as sold successfully!', [{ text: 'OK', value: true }]);
            }

            await loadTraderPageData();
        } else {
            button.disabled = false;
        }
    } else if (e.target.classList.contains('edit-btn')) {
        showEditListingModal(listingId);
    }
    else if (e.target.classList.contains('cancel-btn')) {
        handleCancelListing(listingId);
    }
};

const downloadSalesHistoryCSV = async () => {
    if (!currentUserId) {
        await showCustomModal('Error', 'You must be logged in to download sales history.', [{ text: 'OK', value: true }]);
        return;
    }

    const { data: allSales, error } = await supabase
        .from('sales')
        .select(`
            sale_id,
            quantity_sold,
            sale_price_per_unit,
            total_sale_price,
            sale_date,
            market_listings (listing_id, items(item_name, item_categories(category_name), user_id))
        `)
        .eq('user_id', currentUserId)
        .order('sale_date', { ascending: false });

    if (error) {
        console.error('downloadSalesHistoryCSV: Error fetching all sales for CSV:', error.message);
        await showCustomModal('Error', 'Failed to fetch sales data for download: ' + error.message, [{ text: 'OK', value: true }]);
        return;
    }

    if (!allSales || allSales.length === 0) {
        await showCustomModal('Info', 'No sales history to download.', [{ text: 'OK', value: true }]);
        return;
    }

    const headers = [
        "Sale ID",
        "Item Name",
        "Category",
        "Quantity Sold",
        "Price Per Unit",
        "Total Sale Price",
        "Sale Date"
    ];
    let csvContent = headers.join(",") + "\n";

    allSales.forEach(sale => {
        const item_name = sale.market_listings?.items?.item_name || 'N/A';
        const category_name = sale.market_listings?.items?.item_categories?.category_name || 'N/A';
        const quantity_sold = sale.quantity_sold;
        const sale_price_per_unit = sale.sale_price_per_unit;
        const total_sale_price = sale.total_sale_price;
        const sale_date = new Date(sale.sale_date).toLocaleDateString();

        const row = [
            `"${sale.sale_id}"`,
            `"${item_name}"`,
            `"${category_name}"`,
            quantity_sold,
            sale_price_per_unit,
            total_sale_price,
            `"${sale_date}"`
        ].join(",");
        csvContent += row + "\n";
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', 'sales_history.csv');
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    } else {
        await showCustomModal('Error', 'Your browser does not support downloading files directly.', [{ text: 'OK', value: true }]);
    }
};

document.getElementById('closeEditModal')?.addEventListener('click', () => {
    document.getElementById('editListingModal')?.classList.add('hidden');
});

document.getElementById('editListingModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'editListingModal') {
        document.getElementById('editListingModal')?.classList.add('hidden');
    }
});

document.getElementById('editListingForm')?.addEventListener('submit', handleEditListingSave);

if (addListingForm) addListingForm.addEventListener('submit', handleAddListing);
if (listingsBody) listingsBody.addEventListener('click', handleTableClick);

if (traderDiscordLoginButton) {
    traderDiscordLoginButton.addEventListener('click', async () => {
        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'discord',
                options: {
                    redirectTo: window.location.origin + window.location.pathname
                }
            });
            if (error) {
                console.error('Discord login error:', error);
                if (traderLoginError) {
                    traderLoginError.textContent = 'Login failed: ' + error.message;
                    traderLoginError.style.display = 'block';
                }
            }
        } catch (e) {
            console.error('Login initiation failed:', e);
            if (traderLoginError) {
                traderLoginError.textContent = 'An unexpected error occurred during login initiation.';
                traderLoginError.style.display = 'block';
            }
        }
    });
}

if (filterListingItemNameInput) {
    filterListingItemNameInput.addEventListener('input', () => {
        listingsFilter.itemName = filterListingItemNameInput.value;
        currentListingsPage = 1;
        loadTraderPageData();
    });
}

if (filterListingCategorySelect) {
    filterListingCategorySelect.addEventListener('change', () => {
        listingsFilter.categoryId = filterListingCategorySelect.value;
        currentListingsPage = 1;
        loadTraderPageData();
    });
}

if (filterListingStatusSelect) {
    filterListingStatusSelect.addEventListener('change', () => {
        listingsFilter.status = filterListingStatusSelect.value;
        currentListingsPage = 1;
        loadTraderPageData();
    });
}

if (downloadSalesCsvButton) {
    downloadSalesCsvButton.addEventListener('click', downloadSalesHistoryCSV);
}

const updateUIForAuthStatus = async (authenticated) => {
    console.log(`updateUIForAuthStatus: Called with authenticated = ${authenticated}`);
    if (authenticated) {
        console.log("updateUIForAuthStatus: User is authenticated. Showing dashboard and forms.");
        if (traderLoginContainer) traderLoginContainer.style.display = 'none';
        if (traderDashboardAndForms) traderDashboardAndForms.style.display = 'block';
        if (addListingForm) {
            const submitButton = addListingForm.querySelector('button[type="submit"]');
            if (submitButton) submitButton.disabled = false;
        }
        
        try {
            console.log("updateUIForAuthStatus: Calling fetchAndPopulateCategories...");
            await fetchAndPopulateCategories(); 
            console.log("updateUIForAuthStatus: Calling loadTraderPageData...");
            await loadTraderPageData();
            console.log("updateUIForAuthStatus: Initial data load for authenticated user complete.");
        } catch (error) {
            console.error("updateUIForAuthStatus: Error during initial data load after authentication:", error);
            await showCustomModal('Error', 'Failed to load dashboard data. Please try again or refresh the page.', [{ text: 'OK', value: true }]);
        }

    } else {
        console.log("updateUIForAuthStatus: User is NOT authenticated. Showing login container.");
        if (traderLoginContainer) traderLoginContainer.style.display = 'block';
        if (traderDashboardAndForms) traderDashboardAndForms.style.display = 'none';
        if (loader) loader.style.display = 'none';
        if (salesLoader) salesLoader.style.display = 'none';
        if (listingsBody) listingsBody.innerHTML = '<tr><td colspan="8" class="text-center">Please log in to view and add listings.</td></tr>';
        if (salesBody) salesBody.innerHTML = '<tr><td colspan="6" class="text-center py-4">Please log in to view sales history.</td></tr>';
        if (salesTable) salesTable.style.display = 'table';
        if (addListingForm) {
            const submitButton = addListingForm.querySelector('button[type="submit"]');
            if (submitButton) submitButton.disabled = true;
        }
        if (traderLoginError) {
            traderLoginError.style.display = 'none';
            traderLoginError.textContent = '';
        }
        if (listingsPaginationContainer) listingsPaginationContainer.innerHTML = '';
        if (salesPaginationContainer) salesPaginationContainer.innerHTML = '';
        if (filterListingItemNameInput) filterListingItemNameInput.value = '';
        if (filterListingCategorySelect) filterListingCategorySelect.innerHTML = '<option value="">All Categories</option>';
        if (filterListingStatusSelect) filterListingStatusSelect.value = 'active';
    }
}

supabase.auth.onAuthStateChange(async (event, session) => {
    console.log(`onAuthStateChange event: ${event}, session exists: ${!!session}`);
    if (session && session.user) {
        currentUserId = session.user.id;
        console.log('onAuthStateChange: User authenticated on Trader page:', currentUserId);
        await updateUIForAuthStatus(true); 
    } else {
        currentUserId = null;
        console.log('onAuthStateChange: User not authenticated on Trader page.');
        await updateUIForAuthStatus(false);
    }
});

async function checkInitialAuthAndLoad() {
    console.log("checkInitialAuthAndLoad: Performing initial session check.");
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) {
        console.error("checkInitialAuthAndLoad: Error getting session:", error.message);
        await updateUIForAuthStatus(false);
        return;
    }

    if (session && session.user) {
        currentUserId = session.user.id;
        console.log('checkInitialAuthAndLoad: Initial session check: User authenticated:', currentUserId);
        await updateUIForAuthStatus(true);
    } else {
        console.log('checkInitialAuthAndLoad: Initial session check: User not authenticated.');
        await updateUIForAuthStatus(false);
    }
}

window.addEventListener('pageshow', async (event) => {
    if (event.persisted) {
        console.log("pageshow event: Page restored from BFCache. Re-checking auth and loading data.");
    } else {
        console.log("pageshow event: Page loaded normally. Checking auth and loading data.");
    }
    await checkInitialAuthAndLoad();
});
