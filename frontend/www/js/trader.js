// frontend/www/js/trader.js

import { supabase } from './supabaseClient.js';

// --- DOM Element References ---
const traderLoginContainer = document.getElementById('traderLoginContainer');
const traderDiscordLoginButton = document.getElementById('traderDiscordLoginButton');
const traderLoginError = document.getElementById('traderLoginError');
const traderDashboardAndForms = document.getElementById('traderDashboardAndForms');

// Listing elements
const addListingForm = document.getElementById('add-listing-form');
const listingsBody = document.getElementById('listings-body');
const listingsTable = document.getElementById('listings-table');
const loader = document.getElementById('loader'); // For active listings table
const itemCategorySelect = document.getElementById('item-category'); // For add listing form category

// Sales elements
const salesLoader = document.getElementById('sales-loader'); // For sales history table
const salesBody = document.getElementById('sales-body');
const salesTable = document.getElementById('sales-table');
const grossSalesChartCanvas = document.getElementById('grossSalesChart');

// Dashboard elements
const grossSalesEl = document.getElementById('dashboard-gross-sales');
const feesPaidEl = document.getElementById('dashboard-fees-paid');
const netProfitEl = document.getElementById('dashboard-net-profit');
const activeListingsEl = document.getElementById('dashboard-active-listings');

// New: Filter and Pagination elements
const filterListingItemNameInput = document.getElementById('filter-listing-item-name');
const filterListingCategorySelect = document.getElementById('filter-listing-category');
const filterListingStatusSelect = document.getElementById('filter-listing-status');
const listingsPaginationContainer = document.getElementById('listings-pagination');

const salesPaginationContainer = document.getElementById('sales-pagination');
const downloadSalesCsvButton = document.getElementById('download-sales-csv');

// --- Global State Variables ---
let currentUserId = null;
let grossSalesChartInstance;

// Pagination state
const LISTINGS_PER_PAGE = 10;
let currentListingsPage = 1;
const SALES_PER_PAGE = 10;
let currentSalesPage = 1;

// Filter state for listings
let listingsFilter = {
    itemName: '',
    categoryId: '',
    status: 'active' // Default to active listings
};

// --- Modals (retained from previous versions) ---
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

// Universal modal function
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

// --- CRUD Operations for Listings ---
const showEditListingModal = async (listingId) => {
    currentEditingListingId = listingId;
    const { data: listing, error } = await supabase
        .from('market_listings')
        .select(`*, items(item_name, item_categories(category_name))`)
        .eq('listing_id', listingId)
        .eq('user_id', currentUserId) // Ensure only owner can edit
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

    // Basic validation
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
            total_listed_price: total_listed_price // Update total price as well
        })
        .eq('listing_id', currentEditingListingId)
        .eq('user_id', currentUserId); // Ensure only owner can update

    if (error) {
        console.error('Error updating listing:', error.message);
        await showCustomModal('Error', 'Failed to update listing: ' + error.message, [{ text: 'OK', value: true }]);
    } else {
        document.getElementById('editListingModal').classList.add('hidden');
        await showCustomModal('Success', 'Listing updated successfully!', [{ text: 'OK', value: true }]);
        await loadTraderPageData(); // Reload all data after successful update
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
        .eq('user_id', currentUserId) // Crucial: ensure the logged-in user owns this listing
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
            .eq('user_id', currentUserId); // Double-check ownership on update

        if (error) {
            console.error('Error cancelling listing:', error.message);
            await showCustomModal('Error', 'Failed to cancel listing: ' + error.message, [{ text: 'OK', value: true }]);
        } else {
            await showCustomModal('Success', 'Listing cancelled successfully!', [{ text: 'OK', value: true }]);
            await loadTraderPageData(); // Reload all data after successful cancellation
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

    // Populate for add listing form
    itemCategorySelect.innerHTML = '<option value="">Select a category</option>';
    data.forEach(category => {
        const option = document.createElement('option');
        option.value = category.category_id;
        option.textContent = category.category_name;
        itemCategorySelect.appendChild(option);
    });

    // Populate for filter select
    filterListingCategorySelect.innerHTML = '<option value="">All Categories</option>';
    data.forEach(category => {
        const option = document.createElement('option');
        option.value = category.category_id;
        option.textContent = category.category_name;
        filterListingCategorySelect.appendChild(option);
    });
    // Set filter select to current filter state if exists
    filterListingCategorySelect.value = listingsFilter.categoryId;
};

const getOrCreateItemId = async (itemName, categoryId) => {
    const { data: items, error: selectError } = await supabase
        .from('items')
        .select('item_id')
        .eq('item_name', itemName)
        .eq('user_id', currentUserId) // Ensure uniqueness per user for item names
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
            user_id: currentUserId // Assign item to the current user
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

// --- Main Data Loading Function ---
const loadTraderPageData = async () => {
    // Show loaders initially
    if (loader) loader.style.display = 'block';
    if (salesLoader) salesLoader.style.display = 'block';
    if (listingsTable) listingsTable.style.display = 'none'; // Hide table while loading
    if (salesTable) salesTable.style.display = 'none'; // Hide table while loading

    // --- Fetch Listings with Pagination and Filters ---
    let listingsQuery = supabase
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
        `, { count: 'exact' }) // Request total count
        .eq('user_id', currentUserId); // Filter by current user

    // Apply filters
    if (listingsFilter.itemName) {
        listingsQuery = listingsQuery.ilike('items.item_name', `%${listingsFilter.itemName}%`);
    }
    if (listingsFilter.categoryId) {
        listingsQuery = listingsQuery.eq('items.category_id', listingsFilter.categoryId);
    }
    if (listingsFilter.status === 'active') {
        listingsQuery = listingsQuery.eq('is_fully_sold', false).eq('is_cancelled', false);
    } else if (listingsFilter.status === 'sold') {
        listingsQuery = listingsQuery.eq('is_fully_sold', true);
    } else if (listingsFilter.status === 'cancelled') {
        listingsQuery = listingsQuery.eq('is_cancelled', true);
    }
    // 'all' status doesn't add any specific filters for is_fully_sold or is_cancelled

    // Apply pagination for listings
    const listingsOffset = (currentListingsPage - 1) * LISTINGS_PER_PAGE;
    listingsQuery = listingsQuery.range(listingsOffset, listingsOffset + LISTINGS_PER_PAGE - 1);

    const { data: listings, error: listingsError, count: totalListingsCount } = await listingsQuery
        .order('listing_date', { ascending: false });

    if (listingsError) {
        console.error('Error fetching listings:', listingsError.message);
        if (listingsError.code !== 'PGRST116') {
             await showCustomModal('Error', 'Could not fetch your market data. Please try logging in again.', [{ text: 'OK', value: true }]);
        }
        if (loader) loader.style.display = 'none';
        return;
    }

    // --- Fetch Sales with Pagination ---
    let salesQuery = supabase
        .from('sales')
        .select(`
            sale_id,
            quantity_sold,
            sale_price_per_unit,
            total_sale_price,
            sale_date,
            market_listings (listing_id, items(item_name, item_categories(category_name), user_id))
        `, { count: 'exact' }) // Request total count for sales
        .eq('user_id', currentUserId); // Filter by current user

    // Apply pagination for sales
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
    }

    // --- Render UI ---
    renderDashboard(listings); // Pass all listings to calculate totals (dashboard is not paginated)
    renderListingsTable(listings); // Render the currently paginated listings
    renderListingsPagination(totalListingsCount);

    renderSalesTable(sales);
    renderSalesPagination(totalSalesCount);

    // Hide loaders and show tables
    if (loader) loader.style.display = 'none';
    if (salesLoader) salesLoader.style.display = 'none';
    if (listingsTable) listingsTable.style.display = 'table';
    if (salesTable) salesTable.style.display = 'table';
};

// --- Dashboard Rendering ---
const renderDashboard = (allListings) => {
    // Add null checks for dashboard elements
    if (!grossSalesEl || !feesPaidEl || !netProfitEl || !activeListingsEl) {
        console.error("One or more dashboard elements not found.");
        return;
    }

    const soldListings = allListings.filter(l => l.is_fully_sold);
    // Note: Fees paid are typically market fees incurred on all listings, not just sold ones,
    // unless your business logic dictates otherwise. Keeping it as sum of all market_fee for simplicity.
    const feesPaid = allListings.reduce((sum, l) => sum + l.market_fee, 0);

    const grossSales = soldListings.reduce((sum, l) => sum + l.total_listed_price, 0);
    const netProfit = grossSales - feesPaid;
    const activeListings = allListings.filter(l => !l.is_fully_sold && !l.is_cancelled);

    grossSalesEl.innerHTML = `${grossSales.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} <i class="fas fa-coins"></i>`;
    feesPaidEl.innerHTML = `${feesPaid.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} <i class="fas fa-coins"></i>`;
    netProfitEl.innerHTML = `${netProfit.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} <i class="fas fa-coins"></i>`;

    activeListingsEl.textContent = activeListings.length;
};

// --- Listings Table Rendering and Pagination ---
const renderListingsTable = (listings) => {
    if (!listingsBody) {
        console.error("Listings table body element not found.");
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
            <td class="py-3 px-6 text-left">${listing.items.item_name}</td>
            <td class="py-3 px-6 text-left">${listing.items.item_categories?.category_name || 'N/A'}</td>
            <td class="py-3 px-6 text-left">${listing.quantity_listed.toLocaleString()}</td>
            <td class="py-3 px-6 text-left">${listing.listed_price_per_unit.toFixed(2)}</td>
            <td class="py-3 px-6 text-left">${listing.total_listed_price.toLocaleString()}</td>
            <td class="py-3 px-6 text-left">${listing.market_fee.toLocaleString()}</td>
            <td class="py-3 px-6 text-left">${new Date(listing.listing_date).toLocaleDateString()}</td>
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
};

const renderListingsPagination = (totalCount) => {
    if (!listingsPaginationContainer) return;

    const totalPages = Math.ceil(totalCount / LISTINGS_PER_PAGE);
    listingsPaginationContainer.innerHTML = '';

    if (totalPages <= 1) return; // No pagination needed for 1 or fewer pages

    // Previous button
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

    // Page numbers
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

    // Next button
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


// --- Sales Table Rendering and Pagination ---
const renderSalesTable = (sales) => {
    if (!salesBody || !salesTable) {
        console.error("Sales table elements not found.");
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
            <td class="py-3 px-6 text-left whitespace-nowrap">${sale.market_listings.items.item_name}</td>
            <td class="py-3 px-6 text-left">${sale.market_listings.items.item_categories?.category_name || 'N/A'}</td>
            <td class="py-3 px-6 text-left">${sale.quantity_sold.toLocaleString()}</td>
            <td class="py-3 px-6 text-left">${sale.sale_price_per_unit.toFixed(2)}</td>
            <td class="py-3 px-6 text-left">${sale.total_sale_price.toLocaleString()}</td>
            <td class="py-3 px-6 text-left">${new Date(sale.sale_date).toLocaleDateString()}</td>
        `;
        salesBody.appendChild(row);
    });
    salesTable.style.display = 'table';
};

const renderSalesPagination = (totalCount) => {
    if (!salesPaginationContainer) return;

    const totalPages = Math.ceil(totalCount / SALES_PER_PAGE);
    salesPaginationContainer.innerHTML = '';

    if (totalPages <= 1) return; // No pagination needed for 1 or fewer pages

    // Previous button
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

    // Page numbers
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

    // Next button
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

// --- Chart Rendering (retained) ---
const renderGrossSalesChart = (sales) => {
    // Only render if chart canvas exists
    if (!grossSalesChartCanvas) {
        console.warn("Gross sales chart canvas not found.");
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

    // Ensure Chart.js is loaded before trying to create a chart instance
    if (typeof Chart === 'undefined') {
        console.error("Chart.js is not loaded. Please ensure the Chart.js script is included in your HTML.");
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
};

// --- Utility Functions ---
const showLoader = (isLoading) => {
    if (loader) loader.style.display = isLoading ? 'block' : 'none';
    if (listingsTable) listingsTable.style.display = isLoading ? 'none' : 'table';
};

// --- Event Handlers ---
const handleAddListing = async (e) => {
    e.preventDefault();

    const button = addListingForm ? addListingForm.querySelector('button[type="submit"]') : null;
    if (button) {
        button.disabled = true;
        button.textContent = 'Adding...';
    }

    if (!currentUserId) {
        console.error('User not authenticated or user ID not available for adding listing.');
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
        console.error("One or more form input elements are missing.");
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

        // The fee calculation remains Math.ceil(pricePerStack * 0.05) as per current logic
        // If you want standard rounding (0.5 up, else down), change to Math.round()
        // If you want to always round down, change to Math.floor()
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
            console.error('Error adding stack listing:', error.message);
            allListingsSuccessful = false;
            break;
        }
    }

    if (allListingsSuccessful) {
        if (addListingForm) addListingForm.reset();
        currentListingsPage = 1; // Reset to first page after adding new listing
        listingsFilter.status = 'active'; // Filter to active listings after adding
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
                .eq('user_id', currentUserId) // Only owner can mark as sold
                .single();

            if (fetchError || !listing || listing.user_id !== currentUserId) {
                console.error('Error fetching listing to sell or not authorized:', fetchError?.message || 'User not authorized.');
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
                user_id: listing.user_id // Record sale under the listing owner's user_id
            });

            if (saleError) {
                console.error('Error creating sale record:', saleError.message);
                await showCustomModal('Error', 'Failed to create the sale record: ' + saleError.message, [{ text: 'OK', value: true }]);
                button.disabled = false;
                return;
            }

            const { error: updateError } = await supabase
                .from('market_listings')
                .update({ is_fully_sold: true })
                .eq('listing_id', listingId)
                .eq('user_id', currentUserId); // Double-check ownership on update

            if (updateError) {
                console.error('Error updating listing status:', updateError.message);
                await showCustomModal('Error', 'Sale was recorded, but the listing status could not be updated.', [{ text: 'OK', value: true }]);
            } else {
                await showCustomModal('Success', 'Listing marked as sold successfully!', [{ text: 'OK', value: true }]);
            }

            await loadTraderPageData(); // Reload all data
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

// --- CSV Download Function ---
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
        console.error('Error fetching all sales for CSV:', error.message);
        await showCustomModal('Error', 'Failed to fetch sales data for download: ' + error.message, [{ text: 'OK', value: true }]);
        return;
    }

    if (!allSales || allSales.length === 0) {
        await showCustomModal('Info', 'No sales history to download.', [{ text: 'OK', value: true }]);
        return;
    }

    // Prepare CSV header
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

    // Add rows
    allSales.forEach(sale => {
        const item_name = sale.market_listings?.items?.item_name || 'N/A';
        const category_name = sale.market_listings?.items?.item_categories?.category_name || 'N/A';
        const quantity_sold = sale.quantity_sold;
        const sale_price_per_unit = sale.sale_price_per_unit;
        const total_sale_price = sale.total_sale_price;
        const sale_date = new Date(sale.sale_date).toLocaleDateString();

        const row = [
            `"${sale.sale_id}"`, // Wrap in quotes to handle commas if any
            `"${item_name}"`,
            `"${category_name}"`,
            quantity_sold,
            sale_price_per_unit,
            total_sale_price,
            `"${sale_date}"`
        ].join(",");
        csvContent += row + "\n";
    });

    // Create and trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) { // Feature detection
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', 'sales_history.csv');
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url); // Clean up
    } else {
        await showCustomModal('Error', 'Your browser does not support downloading files directly.', [{ text: 'OK', value: true }]);
    }
};

// --- Event Listeners Initialization ---
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

// New: Filter Event Listeners
if (filterListingItemNameInput) {
    filterListingItemNameInput.addEventListener('input', () => {
        listingsFilter.itemName = filterListingItemNameInput.value;
        currentListingsPage = 1; // Reset to first page on filter change
        loadTraderPageData();
    });
}

if (filterListingCategorySelect) {
    filterListingCategorySelect.addEventListener('change', () => {
        listingsFilter.categoryId = filterListingCategorySelect.value;
        currentListingsPage = 1; // Reset to first page on filter change
        loadTraderPageData();
    });
}

if (filterListingStatusSelect) {
    filterListingStatusSelect.addEventListener('change', () => {
        listingsFilter.status = filterListingStatusSelect.value;
        currentListingsPage = 1; // Reset to first page on filter change
        loadTraderPageData();
    });
}

// New: Download Sales CSV Event Listener
if (downloadSalesCsvButton) {
    downloadSalesCsvButton.addEventListener('click', downloadSalesHistoryCSV);
}


// --- Authentication State Change Listener (Main Entry Point) ---
supabase.auth.onAuthStateChange(async (event, session) => {
    if (session && session.user) {
        currentUserId = session.user.id;
        console.log('User authenticated on Trader page:', currentUserId);
        if (traderLoginContainer) traderLoginContainer.style.display = 'none';
        if (traderDashboardAndForms) traderDashboardAndForms.style.display = 'block';
        if (addListingForm) addListingForm.querySelector('button[type="submit"]').disabled = false;
        
        // Initial data load and category fetch
        await fetchAndPopulateCategories();
        await loadTraderPageData(); // Load data with initial pagination and filters

    } else {
        currentUserId = null;
        console.log('User not authenticated on Trader page.');
        if (traderLoginContainer) traderLoginContainer.style.display = 'block';
        if (traderDashboardAndForms) traderDashboardAndForms.style.display = 'none';
        if (loader) loader.style.display = 'none';
        if (salesLoader) salesLoader.style.display = 'none';
        if (listingsBody) listingsBody.innerHTML = '<tr><td colspan="8" class="text-center">Please log in to view and add listings.</td></tr>';
        if (salesBody) salesBody.innerHTML = '<tr><td colspan="6" class="text-center py-4">Please log in to view sales history.</td></tr>';
        if (salesTable) salesTable.style.display = 'table'; // Show table with message
        if (addListingForm) addListingForm.querySelector('button[type="submit"]').disabled = true; // Disable add listing button
        if (traderLoginError) { // Clear any previous error message
            traderLoginError.style.display = 'none';
            traderLoginError.textContent = '';
        }
        // Clear pagination and filter controls if not logged in
        if (listingsPaginationContainer) listingsPaginationContainer.innerHTML = '';
        if (salesPaginationContainer) salesPaginationContainer.innerHTML = '';
        if (filterListingItemNameInput) filterListingItemNameInput.value = '';
        if (filterListingCategorySelect) filterListingCategorySelect.innerHTML = '<option value="">All Categories</option>'; // Reset categories
        if (filterListingStatusSelect) filterListingStatusSelect.value = 'active'; // Reset status filter
    }
});
