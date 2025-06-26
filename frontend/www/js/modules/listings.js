import { supabase } from '../supabaseClient.js';
import { showCustomModal, loadTraderPageData, invalidateTransactionHistoryCache } from '../trader.js';
import { currentCharacterId } from './characters.js';

const addListingForm = document.getElementById('add-listing-form');
const listingsBody = document.getElementById('listings-body');
const listingsTable = document.getElementById('listings-table');
const loader = document.getElementById('loader');
const itemCategorySelect = document.getElementById('item-category');
const filterListingItemNameInput = document.getElementById('filter-listing-item-name');
const filterListingCategorySelect = document.getElementById('filter-listing-category');
const filterListingStatusSelect = document.getElementById('filter-listing-status');
const listingsPaginationContainer = document.getElementById('listings-pagination');
const sortBySelect = document.getElementById('sort-by');
const sortDirectionSelect = document.getElementById('sort-direction');

const addPurchaseForm = document.getElementById('add-purchase-form');
const purchaseItemNameInput = document.getElementById('purchase-item-name');
const purchaseItemCategorySelect = document.getElementById('purchase-item-category');
const purchaseItemStacksInput = document.getElementById('purchase-item-stacks');
const purchaseItemCountPerStackInput = document.getElementById('purchase-item-count-per-stack');
const purchaseItemPricePerStackInput = document.getElementById('purchase-item-price-per-stack');


const LISTINGS_PER_PAGE = 15;
let currentListingsPage = 1;
let currentUserId = null;
let currentEditingListingId = null;
let listingsFilter = {
    itemName: '',
    categoryId: '',
    status: 'active'
};
let currentSort = { column: 'item_name', direction: 'asc' };

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
                    <label for="edit-quantity-listed" class="block text-gray-700 text-sm font-bold mb-2">Quantity Listed:</label>
                    <input type="number" id="edit-quantity-listed" class="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" required>
                </div>
                <div class="mb-4">
                    <label for="edit-total-price" class="block text-gray-700 text-sm font-bold mb-2">Total Price of Stack:</label>
                    <input type="number" step="0.01" id="edit-total-price" class="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" required>
                    <p id="edit-fee-info" class="text-xs text-gray-600 mt-1"></p>
                </div>
                <div class="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-0">
                    <button type="submit" class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-full">Save Changes</button>
                    <button type="button" id="closeEditModal" class="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-full">Cancel</button>
                </div>
            </form>
        </div>
    </div>
`;
document.body.insertAdjacentHTML('beforeend', editListingModalHtml);

export const initializeListings = (userId) => {
    currentUserId = userId;
    addListingsEventListeners();
    fetchAndPopulateCategories();
    if (sortBySelect) {
        sortBySelect.value = currentSort.column;
    }
    if (sortDirectionSelect) {
        sortDirectionSelect.value = currentSort.direction;
    }
};

export const loadActiveListings = async () => {
    if (!currentCharacterId) {
        loader.style.display = 'none';
        listingsTable.style.display = 'table';
        listingsBody.innerHTML = '<tr><td colspan="8" class="text-center py-4">Please select a character or create one to view listings.</td></tr>';
        return;
    }
    
    loader.style.display = 'block';
    listingsTable.style.display = 'none';

    try {
        const { data, error } = await supabase.rpc('search_trader_listings', {
            p_character_id: currentCharacterId, 
            p_item_name: listingsFilter.itemName || null,
            p_category_id: listingsFilter.categoryId ? parseInt(listingsFilter.categoryId) : null,
            p_status: listingsFilter.status,
            p_limit: LISTINGS_PER_PAGE,
            p_offset: (currentListingsPage - 1) * LISTINGS_PER_PAGE,
            p_sort_by: currentSort.column,
            p_sort_direction: currentSort.direction
        });

        if (error) throw error;

        const listings = data || [];
        const totalCount = listings.length > 0 ? listings[0].total_count : 0;

        renderListingsTable(listings);
        renderListingsPagination(totalCount);

    } catch (err) {
        console.error('Error loading listings:', err.message);
        await showCustomModal('Error', 'Failed to load listings. ' + err.message, [{ text: 'OK', value: true }]);
    } finally {
        loader.style.display = 'none';
        listingsTable.style.display = 'table';
    }
};

const renderListingsTable = (listings) => {
    listingsBody.innerHTML = '';
    if (listings.length === 0) {
        listingsBody.innerHTML = '<tr><td colspan="8" class="text-center py-4">No listings found for the current filters.</td></tr>';
        return;
    }

    listings.forEach(listing => {
        const paxDeiSlug = listing.pax_dei_slug ||
                               (listing.items && listing.items.pax_dei_slug);

        const paxDeiUrl = paxDeiSlug ? `https://paxdei.gaming.tools/${paxDeiSlug}` : '#';
        
        const isLinkEnabled = !!paxDeiSlug; 
        const linkClasses = isLinkEnabled ? 'text-blue-600 hover:underline' : 'text-gray-700 cursor-default';
        const linkTarget = isLinkEnabled ? 'target="_blank"' : '';

        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="py-3 px-6 text-left">
                <a href="${paxDeiUrl}" ${linkTarget} class="${linkClasses}">
                    ${listing.item_name || 'N/A'}
                </a>
            </td>
            <td class="py-3 px-6 text-left">${listing.category_name || 'N/A'}</td>
            <td class="py-3 px-6 text-left">${Math.round(listing.quantity_listed || 0).toLocaleString()}</td>
            <td class="py-3 px-6 text-left">${(parseFloat(listing.listed_price_per_unit) || 0).toFixed(2)}</td>
            <td class="py-3 px-6 text-left">${Math.round(listing.total_listed_price || 0).toLocaleString()}</td>
            <td class="py-3 px-6 text-left">${Math.round(listing.market_fee || 0).toLocaleString()}</td>
            <td class="py-3 px-6 text-left">${new Date(listing.listing_date).toISOString().substring(0, 10)}</td>
            <td class="py-3 px-6 text-left">
                <div class="flex gap-2 whitespace-nowrap">
                    ${!listing.is_cancelled && !listing.is_fully_sold ? `
                        <button class="edit-btn bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-3 rounded-full" data-id="${listing.listing_id}">Edit</button>
                        <button class="sold-btn bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-3 rounded-full" data-id="${listing.listing_id}">Sold</button>
                        <button class="cancel-btn bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-3 rounded-full" data-id="${listing.listing_id}">Cancel</button>
                    ` : ''}
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
    if (totalPages <= 1) return;
    
    const MAX_VISIBLE_PAGES = 7; 
    const halfVisiblePages = Math.floor(MAX_VISIBLE_PAGES / 2);

    const createButton = (text, page, disabled = false, isCurrent = false) => {
        const button = document.createElement('button');
        button.textContent = text;
        let classes = 'px-4 py-2 rounded-full font-bold transition duration-150 ease-in-out ';
        if (disabled) {
            classes += 'bg-gray-700 text-gray-500 cursor-not-allowed';
        } else if (isCurrent) {
            classes += 'bg-yellow-500 text-gray-900';
        } else {
            classes += 'bg-blue-500 hover:bg-blue-700 text-white';
        }
        button.className = classes;
        button.disabled = disabled;
        if (!disabled) {
            button.addEventListener('click', () => {
                currentListingsPage = page;
                loadActiveListings();
            });
        }
        return button;
    };
    
    listingsPaginationContainer.appendChild(createButton('Previous', currentListingsPage - 1, currentListingsPage === 1));

    let startPage = Math.max(1, currentListingsPage - halfVisiblePages);
    let endPage = Math.min(totalPages, currentListingsPage + halfVisiblePages);

    if (endPage - startPage + 1 < MAX_VISIBLE_PAGES) {
        if (currentListingsPage <= halfVisiblePages) {
            endPage = Math.min(totalPages, MAX_VISIBLE_PAGES);
            startPage = 1;
        } else if (currentListingsPage > totalPages - halfVisiblePages) {
            startPage = Math.max(1, totalPages - MAX_VISIBLE_PAGES + 1);
            endPage = totalPages;
        }
    }

    if (startPage > 1) {
        listingsPaginationContainer.appendChild(createButton('1', 1));
        if (startPage > 2) {
            const ellipsis = document.createElement('span');
            ellipsis.textContent = '...';
            ellipsis.className = 'px-2 py-2 text-gray-400';
            listingsPaginationContainer.appendChild(ellipsis);
        }
    }

    for (let i = startPage; i <= endPage; i++) {
        listingsPaginationContainer.appendChild(createButton(i, i, false, i === currentListingsPage));
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            const ellipsis = document.createElement('span');
            ellipsis.textContent = '...';
            ellipsis.className = 'px-2 py-2 text-gray-400';
            listingsPaginationContainer.appendChild(ellipsis);
        }
        listingsPaginationContainer.appendChild(createButton(totalPages, totalPages));
    }
    
    listingsPaginationContainer.appendChild(createButton('Next', currentListingsPage + 1, currentListingsPage === totalPages));
};

const addListingsEventListeners = () => {
    addListingForm.addEventListener('submit', handleAddListing);
    addPurchaseForm.addEventListener('submit', handleRecordPurchase);

    filterListingItemNameInput.addEventListener('input', (e) => handleFilterChange('itemName', e.target.value));
    filterListingCategorySelect.addEventListener('change', (e) => handleFilterChange('categoryId', e.target.value));
    filterListingStatusSelect.addEventListener('change', (e) => handleFilterChange('status', e.target.value));

    listingsBody.addEventListener('click', (e) => {
        const target = e.target;
        if (target.classList.contains('edit-btn')) {
            showEditListingModal(target.dataset.id);
        } else if (target.classList.contains('cancel-btn')) {
            handleCancelListing(target.dataset.id);
        } else if (target.classList.contains('sold-btn')) { 
            handleMarkAsSold(target.dataset.id);
        }
    });

    if (sortBySelect) {
        sortBySelect.addEventListener('change', (e) => {
            currentSort.column = e.target.value;
            currentListingsPage = 1;
            loadActiveListings();
        });
    }

    if (sortDirectionSelect) {
        sortDirectionSelect.addEventListener('change', (e) => {
            currentSort.direction = e.target.value;
            currentListingsPage = 1;
            loadActiveListings();
        });
    }

    document.getElementById('editListingForm').addEventListener('submit', handleEditListingSave);
    document.getElementById('closeEditModal').addEventListener('click', () => {
        document.getElementById('editListingModal').classList.add('hidden');
    });

    const editTotalPriceInput = document.getElementById('edit-total-price');
    if (editTotalPriceInput) {
        editTotalPriceInput.addEventListener('input', updateEditFeeInfo);
    }
};

const handleFilterChange = (key, value) => {
    listingsFilter[key] = value;
    currentListingsPage = 1;
    loadActiveListings();
};

const fetchAndPopulateCategories = async () => {
    if (!itemCategorySelect || !filterListingCategorySelect || !purchaseItemCategorySelect) return;

    try {
        const { data, error } = await supabase
            .from('item_categories')
            .select('category_id, category_name')
            .order('category_name', { ascending: true });

        if (error) throw error;

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

        purchaseItemCategorySelect.innerHTML = '<option value="">Select a category</option>';
        data.forEach(category => {
            const option = document.createElement('option');
            option.value = category.category_id;
            option.textContent = category.category_name;
            purchaseItemCategorySelect.appendChild(option);
        });

    } catch (e) {
        console.error("Error fetching categories:", e);
        await showCustomModal('Error', 'An unexpected error occurred while loading categories.', [{ text: 'OK', value: true }]);
    }
};

const getOrCreateItemId = async (itemName, categoryId) => {
    if (!currentCharacterId) {
        await showCustomModal('Error', 'No character selected. Cannot create or retrieve item.', [{ text: 'OK', value: true }]);
        return null;
    }

    const { data: items, error: selectError } = await supabase
        .from('items')
        .select('item_id')
        .eq('item_name', itemName)
        .eq('character_id', currentCharacterId) 
        .limit(1);

    if (selectError) {
        await showCustomModal('Error', 'Failed to check for existing item.', [{ text: 'OK', value: true }]);
        return null;
    }

    if (items && items.length > 0) return items[0].item_id;

    const { data: newItem, error: insertError } = await supabase
        .from('items')
        .insert({ item_name: itemName, category_id: categoryId, character_id: currentCharacterId }) 
        .select('item_id')
        .single();

    if (insertError) {
        await showCustomModal('Error', 'Failed to create new item record: ' + insertError.message, [{ text: 'OK', value: true }]);
        return null;
    }
    return newItem.item_id;
};

const handleAddListing = async (e) => {
    e.preventDefault();

    const submitButton = addListingForm.querySelector('button[type="submit"]');
    if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = 'Adding Listing...';
    }

    try {
        if (!currentCharacterId) {
            await showCustomModal('Validation Error', 'Please select a character before creating a listing.', [{ text: 'OK', value: true }]);
            return;
        }

        const formData = new FormData(e.target);
        const itemName = formData.get('item-name').trim();
        const categoryId = formData.get('item-category');
        const itemStacks = parseInt(formData.get('item-stacks'), 10);
        const itemCountPerStack = parseInt(formData.get('item-count-per-stack'), 10);
        const itemPricePerStack = parseFloat(formData.get('item-price-per-stack'));

        if (!itemName || !categoryId || isNaN(itemStacks) || isNaN(itemCountPerStack) || isNaN(itemPricePerStack) || itemStacks <= 0 || itemCountPerStack <= 0 || itemPricePerStack <= 0) {
            await showCustomModal('Validation Error', 'Please fill all fields with valid, positive numbers.', [{ text: 'OK', value: true }]);
            return;
        }

        const itemId = await getOrCreateItemId(itemName, categoryId);
        if (!itemId) return;

        const quantityPerListing = itemCountPerStack;
        const totalListedPricePerListing = itemPricePerStack;
        const rawMarketFeePerListing = totalListedPricePerListing * 0.05; 
        const marketFeePerListing = Math.ceil(rawMarketFeePerListing);

        let successCount = 0;
        let failedCount = 0;
        const errors = [];

        const { data: characterData, error: fetchCharacterError } = await supabase
            .from('characters')
            .select('gold')
            .eq('character_id', currentCharacterId)
            .single();

        if (fetchCharacterError) {
            await showCustomModal('Error', 'Failed to fetch character gold: ' + fetchCharacterError.message, [{ text: 'OK', value: true }]);
            console.error('Error fetching character gold:', fetchCharacterError.message);
            return;
        }

        let currentGold = characterData.gold || 0;
        let totalFees = 0;

        for (let i = 0; i < itemStacks; i++) {
            totalFees += marketFeePerListing;
        }

        if (currentGold < totalFees) {
            await showCustomModal('Validation Error', `Not enough gold! You need ${totalFees.toLocaleString()} gold for fees but only have ${currentGold.toLocaleString()}.`, [{ text: 'OK', value: true }]);
            return;
        }

        for (let i = 0; i < itemStacks; i++) {
            const { error } = await supabase.from('market_listings').insert({
                item_id: itemId,
                character_id: currentCharacterId,
                quantity_listed: quantityPerListing,
                listed_price_per_unit: totalListedPricePerListing / quantityPerListing, // Calculated here
                total_listed_price: totalListedPricePerListing,
                market_fee: marketFeePerListing
            });

            if (error) {
                errors.push(error.message);
                failedCount++;
            } else {
                successCount++;
            }
        }

        if (successCount > 0) {
            const newGold = currentGold - totalFees;

            const { error: updateGoldError } = await supabase
                .from('characters')
                .update({ gold: newGold })
                .eq('character_id', currentCharacterId);

            if (updateGoldError) {
                await showCustomModal('Error', 'Successfully added listings, but failed to deduct gold: ' + updateGoldError.message, [{ text: 'OK', value: true }]);
                console.error('Error deducting gold:', updateGoldError.message);
            } else {
                await showCustomModal('Success', `Successfully created ${successCount} new listing(s) and deducted ${totalFees.toLocaleString()} gold in fees!`, [{ text: 'OK', value: true }]);
                e.target.reset();
                // Invalidate character gold and transaction history cache after listing
                await invalidateTransactionHistoryCache(currentCharacterId);
                await loadTraderPageData();
            }
        } else {
            await showCustomModal('Error', `Failed to create any listings. Errors: ${errors.join('; ')}`, [{ text: 'OK', value: true }]);
        }
    } catch (error) {
        console.error('Error during handleAddListing:', error);
        await showCustomModal('Error', 'An unexpected error occurred while adding the listing.', [{ text: 'OK', value: true }]);
    } finally {
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = 'Add Listing';
        }
    }
};

const handleRecordPurchase = async (e) => {
    e.preventDefault();

    const submitButton = addPurchaseForm.querySelector('button[type="submit"]');
    if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = 'Recording Purchase...';
    }

    try {
        if (!currentCharacterId) {
            await showCustomModal('Validation Error', 'Please select a character before recording a purchase.', [{ text: 'OK', value: true }]);
            return;
        }

        const formData = new FormData(e.target);
        const itemName = formData.get('purchase-item-name').trim();
        const categoryId = formData.get('purchase-item-category');
        const itemStacks = parseInt(formData.get('purchase-item-stacks'), 10);
        const itemCountPerStack = parseInt(formData.get('purchase-item-count-per-stack'), 10);
        const itemPricePerStack = parseFloat(formData.get('purchase-item-price-per-stack'));

        if (!itemName || !categoryId || isNaN(itemStacks) || isNaN(itemCountPerStack) || isNaN(itemPricePerStack) || itemStacks <= 0 || itemCountPerStack <= 0 || itemPricePerStack <= 0) {
            await showCustomModal('Validation Error', 'Please fill all fields with valid, positive numbers.', [{ text: 'OK', value: true }]);
            return;
        }

        const itemId = await getOrCreateItemId(itemName, categoryId);
        if (!itemId) return;

        const quantityPerPurchase = itemCountPerStack;
        const totalPurchasePricePerPurchase = itemPricePerStack;

        let successCount = 0;
        let failedCount = 0;
        const errors = [];

        const { data: characterData, error: fetchCharacterError } = await supabase
            .from('characters')
            .select('gold')
            .eq('character_id', currentCharacterId)
            .single();

        if (fetchCharacterError) {
            await showCustomModal('Error', 'Failed to fetch character gold: ' + fetchCharacterError.message, [{ text: 'OK', value: true }]);
            console.error('Error fetching character gold:', fetchCharacterError.message);
            return;
        }

        let currentGold = characterData.gold || 0;
        let totalCost = 0;

        for (let i = 0; i < itemStacks; i++) {
            totalCost += totalPurchasePricePerPurchase;
        }

        if (currentGold < totalCost) {
            await showCustomModal('Validation Error', `Not enough gold! You need ${totalCost.toLocaleString()} gold but only have ${currentGold.toLocaleString()}.`, [{ text: 'OK', value: true }]);
            return;
        }
        
        for (let i = 0; i < itemStacks; i++) {
            const { error } = await supabase.from('purchases').insert({
                item_id: itemId,
                character_id: currentCharacterId,
                quantity_purchased: quantityPerPurchase,
                purchase_price_per_unit: totalPurchasePricePerPurchase / quantityPerPurchase, // Calculated here
                total_purchase_price: totalPurchasePricePerPurchase
            });

            if (error) {
                errors.push(error.message);
                failedCount++;
            } else {
                successCount++;
            }
        }

        if (successCount > 0) {
            const newGold = currentGold - totalCost;

            const { error: updateGoldError } = await supabase
                .from('characters')
                .update({ gold: newGold })
                .eq('character_id', currentCharacterId);

            if (updateGoldError) {
                await showCustomModal('Error', 'Successfully recorded purchases, but failed to deduct gold: ' + updateGoldError.message, [{ text: 'OK', value: true }]);
                console.error('Error deducting gold for purchase:', updateGoldError.message);
            } else {
                await showCustomModal('Success', `Successfully recorded ${successCount} new purchase(s) and deducted ${totalCost.toLocaleString()} gold!`, [{ text: 'OK', value: true }]);
                e.target.reset();
                // Invalidate character gold and transaction history cache after purchase
                await invalidateTransactionHistoryCache(currentCharacterId);
                await loadTraderPageData();
            }
        } else {
            await showCustomModal('Error', `Failed to record any purchases. Errors: ${errors.join('; ')}`, [{ text: 'OK', value: true }]);
        }
    } catch (error) {
        console.error('Error during handleRecordPurchase:', error);
        await showCustomModal('Error', 'An unexpected error occurred while recording the purchase.', [{ text: 'OK', value: true }]);
    } finally {
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = 'Record Purchase';
        }
    }
};


const handleMarkAsSold = async (listingId) => {
    const confirmed = await showCustomModal(
        'Confirmation',
        'Are you sure you want to mark this listing as fully sold? This action cannot be undone.',
        [{ text: 'Yes, Mark as Sold', value: true, type: 'confirm' }, { text: 'No', value: false, type: 'cancel' }]
    );

    if (confirmed) {
        const { data: listing, error: fetchError } = await supabase
            .from('market_listings')
            .select('listing_id, item_id, quantity_listed, total_listed_price, listed_price_per_unit, character_id')
            .eq('listing_id', listingId)
            .single();

        if (fetchError || !listing) {
            console.error('Error fetching listing for sale record:', fetchError);
            await showCustomModal('Error', 'Could not retrieve listing details to record sale.', [{ text: 'OK', value: true }]);
            return;
        }

        const { error: updateError } = await supabase
            .from('market_listings')
            .update({ is_fully_sold: true })
            .eq('listing_id', listingId)
            .eq('character_id', currentCharacterId); 

        if (updateError) {
            await showCustomModal('Error', 'Failed to mark listing as sold: ' + updateError.message, [{ text: 'OK', value: true }]);
            return;
        }

        const { error: insertSaleError } = await supabase
            .from('sales')
            .insert({
                listing_id: listing.listing_id,
                quantity_sold: listing.quantity_listed,
                sale_price_per_unit: listing.listed_price_per_unit,
                total_sale_price: listing.total_listed_price,
                character_id: listing.character_id 
            });

        if (insertSaleError) {
            console.error('Error inserting sales record:', insertSaleError.message);
            await showCustomModal('Error', 'Listing marked as sold, but failed to record sale history: ' + insertSaleError.message, [{ text: 'OK', value: true }]);
        } else {
            const { data: characterData, error: fetchGoldError } = await supabase
                .from('characters')
                .select('gold')
                .eq('character_id', currentCharacterId)
                .single();

            if (fetchGoldError) {
                console.error('Error fetching character gold for sale receipt:', fetchGoldError.message);
                await showCustomModal('Warning', 'Listing marked as sold, but failed to update character gold. Please manually adjust gold if needed.', [{ text: 'OK', value: true }]);
            } else {
                const newGold = (characterData.gold || 0) + listing.total_listed_price;
                const { error: updateGoldError } = await supabase
                    .from('characters')
                    .update({ gold: newGold })
                    .eq('character_id', currentCharacterId);

                if (updateGoldError) {
                    console.error('Error updating character gold after sale:', updateGoldError.message);
                    await showCustomModal('Warning', 'Listing marked as sold, but failed to update character gold. Please manually adjust gold if needed.', [{ text: 'OK', value: true }]);
                } else {
                    await showCustomModal('Success', `Listing marked as sold and character gold updated by ${listing.total_listed_price.toLocaleString()}!`, [{ text: 'OK', value: true }]);
                    // Invalidate character gold and transaction history cache after sale
                    await invalidateTransactionHistoryCache(currentCharacterId);
                    await loadTraderPageData(); 
                }
            }
        }
    }
};

const handleCancelListing = async (listingId) => {
    const confirmed = await showCustomModal(
        'Confirmation',
        'Are you sure you want to cancel this listing? This will remove it from your active listings.',
        [{ text: 'Yes, Cancel', value: true, type: 'confirm' }, { text: 'No', value: false, type: 'cancel' }]
    );

    if (confirmed) {
        const { error } = await supabase
            .from('market_listings')
            .update({ is_cancelled: true })
            .eq('listing_id', listingId)
            .eq('character_id', currentCharacterId);

        if (error) {
            console.error('Error canceling listing:', error.message);
            await showCustomModal('Error', 'Failed to cancel listing: ' + error.message, [{ text: 'OK', value: true }]);
        } else {
            await showCustomModal('Success', 'Listing canceled successfully!', [{ text: 'OK', value: true }]);
            // Invalidate transaction history cache after cancellation
            await invalidateTransactionHistoryCache(currentCharacterId);
            await loadTraderPageData();
        }
    }
};

let originalListingPrice = 0;
let originalListingFee = 0;

const showEditListingModal = async (listingId) => {
    currentEditingListingId = listingId;
    const editModal = document.getElementById('editListingModal');
    const editItemNameInput = document.getElementById('edit-item-name');
    const editQuantityListedInput = document.getElementById('edit-quantity-listed');
    const editTotalPriceInput = document.getElementById('edit-total-price');
    const editFeeInfo = document.getElementById('edit-fee-info');


    try {
        const { data: listing, error } = await supabase
            .from('market_listings')
            .select('item_id, quantity_listed, total_listed_price, market_fee, items(item_name)')
            .eq('listing_id', listingId)
            .eq('character_id', currentCharacterId)
            .single();

        if (error || !listing) {
            console.error('Error fetching listing for edit:', error);
            await showCustomModal('Error', 'Could not retrieve listing details for editing.', [{ text: 'OK', value: true }]);
            return;
        }

        originalListingPrice = listing.total_listed_price || 0;
        originalListingFee = listing.market_fee || 0;

        editItemNameInput.value = listing.items.item_name;
        editQuantityListedInput.value = Math.round(listing.quantity_listed || 0);
        editTotalPriceInput.value = Math.round(listing.total_listed_price || 0);

        updateEditFeeInfo();

        editModal.classList.remove('hidden');
    } catch (e) {
        console.error('Error showing edit modal:', e);
        await showCustomModal('Error', 'An unexpected error occurred while preparing the edit form.', [{ text: 'OK', value: true }]);
    }
};

const updateEditFeeInfo = () => {
    const editTotalPriceInput = document.getElementById('edit-total-price');
    const editFeeInfo = document.getElementById('edit-fee-info');
    
    const newPrice = parseFloat(editTotalPriceInput.value);
    
    if (isNaN(newPrice) || newPrice <= 0) {
        editFeeInfo.textContent = 'Enter a positive price to see potential fee.';
        return;
    }

    const priceIncrease = newPrice - originalListingPrice;
    let estimatedAdditionalFee = 0;

    if (priceIncrease > 0) {
        estimatedAdditionalFee = Math.ceil(priceIncrease * 0.05);
        editFeeInfo.textContent = `Increasing price by ${priceIncrease.toLocaleString()} will incur an additional fee of ${estimatedAdditionalFee.toLocaleString()} gold.`;
    } else if (priceIncrease < 0) {
        editFeeInfo.textContent = 'No additional fee for reducing the price (original fee will not be refunded).';
    } else {
        editFeeInfo.textContent = 'No change in price, no additional fee.';
    }
};

const handleEditListingSave = async (e) => {
    e.preventDefault();
    if (!currentEditingListingId) return;

    const saveButton = document.getElementById('editListingForm').querySelector('button[type="submit"]');
    if (saveButton) {
        saveButton.disabled = true;
        saveButton.textContent = 'Saving...';
    }

    try {
        const quantity_listed = parseInt(document.getElementById('edit-quantity-listed').value, 10);
        const total_listed_price = parseFloat(document.getElementById('edit-total-price').value);

        if (isNaN(quantity_listed) || quantity_listed <= 0 || isNaN(total_listed_price) || total_listed_price <= 0) {
            await showCustomModal('Validation Error', 'Quantity and total price must be positive numbers.', [{ text: 'OK', value: true }]);
            return;
        }
        const { data: oldListing, error: fetchOldListingError } = await supabase
            .from('market_listings')
            .select('total_listed_price, market_fee')
            .eq('listing_id', currentEditingListingId)
            .eq('character_id', currentCharacterId)
            .single();

        if (fetchOldListingError || !oldListing) {
            console.error('Error fetching old listing details:', fetchOldListingError);
            await showCustomModal('Error', 'Could not retrieve original listing details for fee calculation.', [{ text: 'OK', value: true }]);
            return;
        }

        const oldPrice = oldListing.total_listed_price;
        const currentStoredFee = oldListing.market_fee;
        const priceIncrease = total_listed_price - oldPrice;
        let additionalFeeToDeduct = 0;
        let newCalculatedFee = currentStoredFee;

        if (priceIncrease > 0) {
            newCalculatedFee = Math.ceil(total_listed_price * 0.05); 
            if (newCalculatedFee < currentStoredFee) {
                newCalculatedFee = currentStoredFee;
            }
            additionalFeeToDeduct = newCalculatedFee - currentStoredFee;
        } else {
            additionalFeeToDeduct = 0;
            newCalculatedFee = currentStoredFee;
        }


        const { data: characterData, error: fetchCharacterError } = await supabase
            .from('characters')
            .select('gold')
            .eq('character_id', currentCharacterId)
            .single();

        if (fetchCharacterError) {
            await showCustomModal('Error', 'Failed to fetch character gold: ' + fetchCharacterError.message, [{ text: 'OK', value: true }]);
            console.error('Error fetching character gold:', fetchCharacterError.message);
            return;
        }

        let currentGold = characterData.gold || 0;

        if (additionalFeeToDeduct > 0 && currentGold < additionalFeeToDeduct) {
            await showCustomModal('Validation Error', `Not enough gold! You need ${additionalFeeToDeduct.toLocaleString()} gold for the additional fee but only have ${currentGold.toLocaleString()}.`, [{ text: 'OK', value: true }]);
            return;
        }

        const listed_price_per_unit = total_listed_price / quantity_listed;
        
        const { error: updateListingError } = await supabase
            .from('market_listings')
            .update({
                quantity_listed: quantity_listed,
                listed_price_per_unit: listed_price_per_unit,
                total_listed_price: total_listed_price,
                market_fee: newCalculatedFee
            })
            .eq('listing_id', currentEditingListingId)
            .eq('character_id', currentCharacterId); 

        if (updateListingError) {
            await showCustomModal('Error', 'Failed to update listing: ' + updateListingError.message, [{ text: 'OK', value: true }]);
            return;
        }

        if (additionalFeeToDeduct > 0) {
            const newGold = currentGold - additionalFeeToDeduct;
            const { error: updateGoldError } = await supabase
                .from('characters')
                .update({ gold: newGold })
                .eq('character_id', currentCharacterId);

            if (updateGoldError) {
                await showCustomModal('Error', 'Listing updated successfully, but failed to deduct additional gold fee: ' + updateGoldError.message, [{ text: 'OK', value: true }]);
                console.error('Error deducting additional gold fee:', updateGoldError.message);
            } else {
                await showCustomModal('Success', `Listing updated successfully! Additional fee of ${additionalFeeToDeduct.toLocaleString()} gold deducted.`, [{ text: 'OK', value: true }]);
            }
        } else {
            await showCustomModal('Success', 'Listing updated successfully!', [{ text: 'OK', value: true }]);
        }

        document.getElementById('editListingModal').classList.add('hidden');
        await invalidateTransactionHistoryCache(currentCharacterId);
        await loadTraderPageData();

    } catch (error) {
        console.error('Error during handleEditListingSave:', error);
        await showCustomModal('Error', 'An unexpected error occurred while saving the listing changes.', [{ text: 'OK', value: true }]);
    } finally {
        if (saveButton) {
            saveButton.disabled = false;
            saveButton.textContent = 'Save Changes';
        }
    }
};
