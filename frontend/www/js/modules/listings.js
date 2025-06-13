import { supabase } from '../supabaseClient.js';
import { showCustomModal, loadTraderPageData } from '../trader.js';
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

const LISTINGS_PER_PAGE = 10;
let currentListingsPage = 1;
let currentUserId = null;
let currentEditingListingId = null;
let listingsFilter = {
    itemName: '',
    categoryId: '',
    status: 'active'
};

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
            p_offset: (currentListingsPage - 1) * LISTINGS_PER_PAGE
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
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="py-3 px-6 text-left">${listing.item_name || 'N/A'}</td>
            <td class="py-3 px-6 text-left">${listing.category_name || 'N/A'}</td>
            <td class="py-3 px-6 text-left">${listing.quantity_listed?.toLocaleString() || 'N/A'}</td>
            <td class="py-3 px-6 text-left">${listing.listed_price_per_unit?.toFixed(2) || 'N/A'}</td>
            <td class="py-3 px-6 text-left">${listing.total_listed_price?.toLocaleString() || 'N/A'}</td>
            <td class="py-3 px-6 text-left">${listing.market_fee?.toLocaleString() || 'N/A'}</td>
            <td class="py-3 px-6 text-left">${new Date(listing.listing_date).toLocaleDateString()}</td>
            <td class="py-3 px-6 text-left">
                <div class="flex gap-2 whitespace-nowrap">
                    ${!listing.is_cancelled && !listing.is_fully_sold ? `
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
        button.addEventListener('click', () => {
            currentListingsPage = page;
            loadActiveListings();
        });
        return button;
    };
    
    listingsPaginationContainer.appendChild(createButton('Previous', currentListingsPage - 1, currentListingsPage === 1));

    for (let i = 1; i <= totalPages; i++) {
        listingsPaginationContainer.appendChild(createButton(i, i, false, i === currentListingsPage));
    }
    
    listingsPaginationContainer.appendChild(createButton('Next', currentListingsPage + 1, currentListingsPage === totalPages));
};

const addListingsEventListeners = () => {
    addListingForm.addEventListener('submit', handleAddListing);
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

    document.getElementById('editListingForm').addEventListener('submit', handleEditListingSave);
    document.getElementById('closeEditModal').addEventListener('click', () => {
        document.getElementById('editListingModal').classList.add('hidden');
    });
};

const handleFilterChange = (key, value) => {
    listingsFilter[key] = value;
    currentListingsPage = 1;
    loadActiveListings();
};

const fetchAndPopulateCategories = async () => {
    if (!itemCategorySelect || !filterListingCategorySelect) return;

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

    if (!currentCharacterId) {
        await showCustomModal('Validation Error', 'Please select a character before creating a listing.', [{ text: 'OK', value: true }]);
        return;
    }

    const formData = new FormData(e.target);
    const itemName = formData.get('item-name').trim();
    const categoryId = formData.get('item-category');
    const quantity = parseInt(formData.get('quantity-listed'), 10);
    const totalListedPrice = parseFloat(formData.get('total-listed-price'));

    if (!itemName || !categoryId || !quantity || !totalListedPrice || quantity <= 0 || totalListedPrice <= 0) {
        await showCustomModal('Validation Error', 'Please fill all fields with valid, positive numbers.', [{ text: 'OK', value: true }]);
        return;
    }

    const itemId = await getOrCreateItemId(itemName, categoryId);
    if (!itemId) return; 

    const marketFee = totalListedPrice * 0.05;
    const pricePerUnit = totalListedPrice / quantity;

    const { error } = await supabase.from('market_listings').insert({
        item_id: itemId,
        character_id: currentCharacterId, 
        quantity_listed: quantity,
        listed_price_per_unit: pricePerUnit,
        total_listed_price: totalListedPrice,
        market_fee: marketFee
    });

    if (error) {
        await showCustomModal('Error', 'Failed to create listing: ' + error.message, [{ text: 'OK', value: true }]);
    } else {
        await showCustomModal('Success', 'New listing created successfully!', [{ text: 'OK', value: true }]);
        e.target.reset();
        await loadTraderPageData();
    }
};

const handleCancelListing = async (listingId) => {
    const confirmed = await showCustomModal(
        'Confirmation', 
        'Are you sure you want to cancel this listing? Fees are non-refundable.', 
        [{ text: 'Yes, Cancel', value: true, type: 'confirm' }, { text: 'No', value: false, type: 'cancel' }]
    );

    if (confirmed) {
        const { error } = await supabase
            .from('market_listings')
            .update({ is_cancelled: true })
            .eq('listing_id', listingId)
            .eq('character_id', currentCharacterId); 

        if (error) {
            await showCustomModal('Error', 'Failed to cancel listing: ' + error.message, [{ text: 'OK', value: true }]);
        } else {
            await showCustomModal('Success', 'Listing cancelled successfully!', [{ text: 'OK', value: true }]);
            await loadTraderPageData();
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
                total_sale_price: listing.total_listed_price
            });

        if (insertSaleError) {
            console.error('Error inserting sales record:', insertSaleError.message);
            await showCustomModal('Error', 'Listing marked as sold, but failed to record sale history: ' + insertSaleError.message, [{ text: 'OK', value: true }]);
        } else {
            await showCustomModal('Success', 'Listing marked as sold and sales record created!', [{ text: 'OK', value: true }]);
            await loadTraderPageData(); 
        }
    }
};


const handleEditListingSave = async (e) => {
    e.preventDefault();
    if (!currentEditingListingId) return;

    const quantity_listed = parseInt(document.getElementById('edit-quantity-listed').value, 10);
    const total_listed_price = parseFloat(document.getElementById('edit-total-price').value);

    if (isNaN(quantity_listed) || quantity_listed <= 0 || isNaN(total_listed_price) || total_listed_price <= 0) {
        return await showCustomModal('Validation Error', 'Quantity and total price must be positive numbers.', [{ text: 'OK', value: true }]);
    }

    const listed_price_per_unit = total_listed_price / quantity_listed;
    const market_fee = total_listed_price * 0.05;

    const { error } = await supabase
        .from('market_listings')
        .update({
            quantity_listed,
            listed_price_per_unit,
            total_listed_price,
            market_fee
        })
        .eq('listing_id', currentEditingListingId)
        .eq('character_id', currentCharacterId); 

    if (error) {
        await showCustomModal('Error', 'Failed to update listing: ' + error.message, [{ text: 'OK', value: true }]);
    } else {
            document.getElementById('editListingModal').classList.add('hidden');
            await showCustomModal('Success', 'Listing updated successfully!', [{ text: 'OK', value: true }]);
            await loadTraderPageData();
    }
};
