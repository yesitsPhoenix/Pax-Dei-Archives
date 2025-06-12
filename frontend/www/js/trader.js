import { supabase } from './supabaseClient.js';

document.addEventListener('DOMContentLoaded', async () => {
    const addListingForm = document.getElementById('add-listing-form');
    const listingsBody = document.getElementById('listings-body');
    const listingsTable = document.getElementById('listings-table');
    const loader = document.getElementById('loader');

    const grossSalesEl = document.getElementById('dashboard-gross-sales');
    const feesPaidEl = document.getElementById('dashboard-fees-paid');
    const netProfitEl = document.getElementById('dashboard-net-profit');
    const activeListingsEl = document.getElementById('dashboard-active-listings');

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
                        <label for="edit-item-category" class="block text-gray-700 text-sm font-bold mb-2">Item Category:</label>
                        <input type="text" id="edit-item-category" class="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline bg-gray-100" readonly>
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
            .select(`*, items(item_name, item_category)`)
            .eq('listing_id', listingId)
            .single();

        if (error || !listing) {
            console.error('Error fetching listing for edit:', error?.message);
            await showCustomModal('Error', 'Could not load listing details for editing.', [{ text: 'OK', value: true }]);
            return;
        }

        document.getElementById('edit-item-name').value = listing.items.item_name;
        document.getElementById('edit-item-category').value = listing.items.item_category || '';
        document.getElementById('edit-quantity-listed').value = listing.quantity_listed;
        document.getElementById('edit-price-per-unit').value = listing.listed_price_per_unit;

        document.getElementById('editListingModal').classList.remove('hidden');
    };

    const handleEditListingSave = async (e) => {
        e.preventDefault();
        if (!currentEditingListingId) return;

        const quantity_listed = parseInt(document.getElementById('edit-quantity-listed').value, 10);
        const listed_price_per_unit = parseFloat(document.getElementById('edit-price-per-unit').value);
        
        const total_listed_price = quantity_listed * listed_price_per_unit;

        const { error } = await supabase
            .from('market_listings')
            .update({
                quantity_listed: quantity_listed,
                listed_price_per_unit: listed_price_per_unit,
                total_listed_price: total_listed_price
            })
            .eq('listing_id', currentEditingListingId);

        if (error) {
            console.error('Error updating listing:', error.message);
            await showCustomModal('Error', 'Failed to update listing: ' + error.message, [{ text: 'OK', value: true }]);
        } else {
            document.getElementById('editListingModal').classList.add('hidden');
            await showCustomModal('Success', 'Listing updated successfully!', [{ text: 'OK', value: true }]);
            await loadPageData();
        }
    };

    const handleCancelListing = async (listingId) => {
        if (await showCustomModal('Confirmation', 'Are you sure you want to cancel this listing? This action cannot be undone.', [{ text: 'Yes', value: true, type: 'confirm' }, { text: 'No', value: false, type: 'cancel' }])) {
            const { error } = await supabase
                .from('market_listings')
                .delete()
                .eq('listing_id', listingId);

            if (error) {
                console.error('Error cancelling listing:', error.message);
                await showCustomModal('Error', 'Failed to cancel listing: ' + error.message, [{ text: 'OK', value: true }]);
            } else {
                await showCustomModal('Success', 'Listing cancelled successfully!', [{ text: 'OK', value: true }]);
                await loadPageData();
            }
        }
    };

    const loadPageData = async () => {
        showLoader(true);

        const { data: listings, error: listingsError } = await supabase
            .from('market_listings')
            .select(`
                listing_id,
                quantity_listed,
                listed_price_per_unit,
                total_listed_price,
                market_fee,
                listing_date,
                is_fully_sold,
                items (item_name, item_category)
            `)
            .order('listing_date', { ascending: false });

        if (listingsError) {
            console.error('Error fetching listings:', listingsError.message);
            await showCustomModal('Error', 'Could not fetch market data.', [{ text: 'OK', value: true }]);
            showLoader(false);
            return;
        }

        renderDashboard(listings);
        renderListingsTable(listings.filter(l => !l.is_fully_sold));
        showLoader(false);
    };

    const getOrCreateItemId = async (itemName, itemCategory) => {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) {
            console.error('User not authenticated or error fetching user:', userError?.message);
            await showCustomModal('Error', 'You must be logged in to add items.', [{ text: 'OK', value: true }]);
            return null;
        }
        const userId = user.id;

        let { data: item, error: selectError } = await supabase
            .from('items')
            .select('item_id')
            .eq('item_name', itemName)
            .single();

        if (item) return item.item_id;

        if (selectError && selectError.code === 'PGRST116') {
            const { data: newItem, error: insertError } = await supabase
                .from('items')
                .insert({
                    item_name: itemName,
                    item_category: itemCategory,
                    owner_id: userId
                })
                .select('item_id')
                .single();

            if (insertError) {
                console.error('Error creating item:', insertError.message);
                return null;
            }
            return newItem.item_id;
        }

        if (selectError) {
            console.error('Error selecting item:', selectError.message);
            return null;
        }
    };

    const renderDashboard = (listings) => {
        const soldListings = listings.filter(l => l.is_fully_sold);
        const allListings = listings;
        const activeListings = listings.filter(l => !l.is_fully_sold);

        const grossSales = soldListings.reduce((sum, l) => sum + l.total_listed_price, 0);
        const feesPaid = allListings.reduce((sum, l) => sum + l.market_fee, 0);
        const netProfit = grossSales - feesPaid;
        
        grossSalesEl.innerHTML = `${grossSales.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} <i class="fas fa-coins"></i>`;
        feesPaidEl.innerHTML = `${feesPaid.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} <i class="fas fa-coins"></i>`;
        netProfitEl.innerHTML = `${netProfit.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} <i class="fas fa-coins"></i>`;
        activeListingsEl.textContent = activeListings.length;
    };

    const renderListingsTable = (activeListings) => {
        listingsBody.innerHTML = '';
        if (activeListings.length === 0) {
            listingsBody.innerHTML = '<tr><td colspan="8" style="text-align:center;">No active listings.</td></tr>';
            return;
        }

        activeListings.forEach(listing => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${listing.items.item_name}</td>
                <td>${listing.items.item_category || 'N/A'}</td> 
                <td>${listing.quantity_listed.toLocaleString()}</td>
                <td>${listing.listed_price_per_unit.toFixed(2)}</td>
                <td>${listing.total_listed_price.toLocaleString()}</td>
                <td>${listing.market_fee.toLocaleString()}</td>
                <td>${new Date(listing.listing_date).toLocaleDateString()}</td>
                <td class="action-buttons flex flex-wrap gap-2">
                    <button class="sold-btn bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-3 rounded-full shadow-md transition duration-150 ease-in-out transform hover:scale-105">Sold</button>
                    <button class="edit-btn bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-3 rounded-full shadow-md transition duration-150 ease-in-out transform hover:scale-105">Edit</button>
                    <button class="cancel-btn bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-3 rounded-full shadow-md transition duration-150 ease-in-out transform hover:scale-105">Cancel</button>
                </td>
            `;
            listingsBody.appendChild(row);
        });
    };

    const showLoader = (isLoading) => {
        loader.style.display = isLoading ? 'block' : 'none';
        listingsTable.style.display = isLoading ? 'none' : 'table';
    };

    const handleAddListing = async (e) => {
        e.preventDefault();
        const button = e.target.querySelector('button');
        button.disabled = true;
        button.textContent = 'Adding...';

        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) {
            console.error('User not authenticated:', userError?.message);
            await showCustomModal('Error', 'You must be logged in to add a listing.', [{ text: 'OK', value: true }]);
            button.disabled = false;
            button.textContent = 'Add Listing';
            return;
        }
        const currentUserId = user.id;

        const itemName = document.getElementById('item-name').value;
        const itemCategory = document.getElementById('item-category').value;
        const stacks = parseInt(document.getElementById('item-stacks').value, 10);
        const countPerStack = parseInt(document.getElementById('item-count-per-stack').value, 10);
        const pricePerStack = parseFloat(document.getElementById('item-price-per-stack').value);
        const fee = parseFloat(document.getElementById('item-fee').value);

        const quantity_listed = stacks * countPerStack;
        const total_listed_price = stacks * pricePerStack;
        const listed_price_per_unit = total_listed_price / quantity_listed;

        const itemId = await getOrCreateItemId(itemName, itemCategory);
        if (!itemId) {
            await showCustomModal('Error', 'Error processing item name. Check console for details.', [{ text: 'OK', value: true }]);
            button.disabled = false;
            button.textContent = 'Add Listing';
            return;
        }

        const { error } = await supabase.from('market_listings').insert({
            item_id: itemId,
            quantity_listed,
            listed_price_per_unit,
            total_listed_price,
            market_fee: fee,
            listing_date: new Date().toISOString(),
            is_fully_sold: false,
            user_id: currentUserId
        });

        if (error) {
            console.error('Error adding listing:', error.message);
            await showCustomModal('Error', 'Failed to add the new listing.', [{ text: 'OK', value: true }]);
        } else {
            addListingForm.reset();
            await loadPageData();
            await showCustomModal('Success', 'Listing added successfully!', [{ text: 'OK', value: true }]);
        }

        button.disabled = false;
        button.textContent = 'Add Listing';
    };
    
    const handleTableClick = async (e) => {
        const listingId = e.target.dataset.id;
        if (!listingId) return;

        if (e.target.classList.contains('sold-btn')) {
            const button = e.target;
            button.disabled = true;
            
            if (await showCustomModal('Confirmation', 'Are you sure you want to mark this item as sold?', [{ text: 'Yes', value: true, type: 'confirm' }, { text: 'No', value: false, type: 'cancel' }])) {
                const { data: listing, error: fetchError } = await supabase
                    .from('market_listings')
                    .select('*')
                    .eq('listing_id', listingId)
                    .single();
                
                if (fetchError) {
                    console.error('Error fetching listing to sell:', fetchError.message);
                    await showCustomModal('Error', 'Could not find listing details to complete sale.', [{ text: 'OK', value: true }]);
                    button.disabled = false;
                    return;
                }

                const { error: saleError } = await supabase.from('sales').insert({
                    listing_id: listing.listing_id,
                    quantity_sold: listing.quantity_listed,
                    sale_price_per_unit: listing.listed_price_per_unit,
                    total_sale_price: listing.total_listed_price,
                    sale_date: new Date().toISOString()
                });

                if (saleError) {
                    console.error('Error creating sale record:', saleError.message);
                    await showCustomModal('Error', 'Failed to create the sale record.', [{ text: 'OK', value: true }]);
                    button.disabled = false;
                    return;
                }

                const { error: updateError } = await supabase
                    .from('market_listings')
                    .update({ is_fully_sold: true })
                    .eq('listing_id', listingId);

                if (updateError) {
                    console.error('Error updating listing status:', updateError.message);
                    await showCustomModal('Error', 'Sale was recorded, but the listing status could not be updated.', [{ text: 'OK', value: true }]);
                } else {
                    await showCustomModal('Success', 'Listing marked as sold successfully!', [{ text: 'OK', value: true }]);
                }

                await loadPageData();
            } else {
                button.disabled = false;
            }
        } else if (e.target.classList.contains('edit-btn')) {
            showEditListingModal(listingId);
        } else if (e.target.classList.contains('cancel-btn')) {
            handleCancelListing(listingId);
        }
    };

    document.getElementById('closeEditModal').addEventListener('click', () => {
        document.getElementById('editListingModal').classList.add('hidden');
    });

    document.getElementById('editListingModal').addEventListener('click', (e) => {
        if (e.target.id === 'editListingModal') {
            document.getElementById('editListingModal').classList.add('hidden');
        }
    });

    document.getElementById('editListingForm').addEventListener('submit', handleEditListingSave);

    addListingForm.addEventListener('submit', handleAddListing);
    listingsBody.addEventListener('click', handleTableClick);
    
    loadPageData();
});
