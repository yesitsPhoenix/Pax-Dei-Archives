import {
    supabase
} from '../supabaseClient.js';
import {
    showCustomModal,
    loadTraderPageData
} from '../trader.js';
import {
    currentCharacterId
} from './characters.js';
import {
    loadActiveListings,
    populateMarketStallDropdown,
    setupMarketStallTabs,
    getUserMarketStallLocations
} from './init.js';
import {
    getEditListingModalElements,
    setOriginalListingFee,
    setOriginalListingPrice,
    currentEditingListingId,
    setCurrentEditingListingId,
    originalListingPrice,
    originalListingFee,
    manageMarketStallsModal,
    newMarketStallNameInput,
    addMarketStallBtn,
    createStallError,
    marketStallsList,
    deleteStallError
} from './dom.js';

export const getOrCreateItemId = async (itemName, categoryId) => {
    if (!currentCharacterId) {
        await showCustomModal('Error', 'No character selected. Cannot create or retrieve item.', [{
            text: 'OK',
            value: true
        }]);
        return null;
    }

    const {
        data: items,
        error: selectError
    } = await supabase
        .from('items')
        .select('item_id')
        .eq('item_name', itemName)
        .eq('character_id', currentCharacterId)
        .limit(1);

    if (selectError) {
        await showCustomModal('Error', 'Failed to check for existing item.', [{
            text: 'OK',
            value: true
        }]);
        return null;
    }

    if (items && items.length > 0) return items[0].item_id;

    const {
        data: newItem,
        error: insertError
    } = await supabase
        .from('items')
        .insert({
            item_name: itemName,
            category_id: categoryId,
            character_id: currentCharacterId
        })
        .select('item_id')
        .single();

    if (insertError) {
        await showCustomModal('Error', 'Failed to create new item: ' + insertError.message, [{
            text: 'OK',
            value: true
        }]);
        return null;
    }

    return newItem.item_id;
};


export const handleAddListing = async (event) => {
    event.preventDefault();

    const addListingForm = document.getElementById('add-listing-form');
    const submitButton = addListingForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = 'Adding...';

    try {
        if (!currentCharacterId) {
            await showCustomModal('Error', 'No character selected. Please select a character before adding a listing.', [{
                text: 'OK',
                value: true
            }]);
            return;
        }

        const itemName = document.getElementById('item-name').value.trim();
        const categoryId = document.getElementById('item-category').value;
        const quantityListed = parseInt(document.getElementById('quantity-listed').value);
        const totalListedPrice = parseInt(document.getElementById('total-price').value);
        const marketStallId = document.getElementById('marketStallSelect').value;

        if (!itemName || !categoryId || isNaN(quantityListed) || quantityListed <= 0 || isNaN(totalListedPrice) || totalListedPrice <= 0 || !marketStallId) {
            await showCustomModal('Error', 'Please fill in all listing fields correctly.', [{
                text: 'OK',
                value: true
            }]);
            return;
        }

        const itemId = await getOrCreateItemId(itemName, categoryId);
        if (!itemId) return;

        const calculatedMarketFee = Math.ceil(totalListedPrice * 0.05);

        const {
            error
        } = await supabase
            .from('market_listings')
            .insert({
                item_id: itemId,
                market_stall_id: marketStallId,
                character_id: currentCharacterId,
                quantity_listed: quantityListed,
                total_listed_price: totalListedPrice,
                market_fee: calculatedMarketFee,
                is_fully_sold: false,
                is_cancelled: false
            });

        if (error) {
            throw error;
        }

        await showCustomModal('Success', 'Listing added successfully!', [{
            text: 'OK',
            value: true
        }]);
        addListingForm.reset();
        await loadTraderPageData();
    } catch (e) {
        console.error('Error adding listing:', e);
        await showCustomModal('Error', 'Failed to add listing: ' + e.message, [{
            text: 'OK',
            value: true
        }]);
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'Add Listing';
    }
};

export const handleMarkAsSold = async (listingId) => {
    try {
        const {
            error
        } = await supabase
            .from('market_listings')
            .update({
                is_fully_sold: true,
                is_cancelled: false
            })
            .eq('listing_id', listingId)
            .eq('character_id', currentCharacterId);

        if (error) {
            throw error;
        }

        await showCustomModal('Success', 'Listing marked as sold!', [{
            text: 'OK',
            value: true
        }]);
        await loadTraderPageData();
    } catch (e) {
        console.error('Error marking as sold:', e);
        await showCustomModal('Error', 'Failed to mark listing as sold: ' + e.message, [{
            text: 'OK',
            value: true
        }]);
    }
};

export const handleCancelListing = async (listingId) => {
    try {
        const {
            error
        } = await supabase
            .from('market_listings')
            .update({
                is_cancelled: true,
                is_fully_sold: false
            })
            .eq('listing_id', listingId)
            .eq('character_id', currentCharacterId);

        if (error) {
            throw error;
        }

        await showCustomModal('Success', 'Listing cancelled successfully!', [{
            text: 'OK',
            value: true
        }]);
        await loadTraderPageData();
    } catch (e) {
        console.error('Error cancelling listing:', e);
        await showCustomModal('Error', 'Failed to cancel listing: ' + e.message, [{
            text: 'OK',
            value: true
        }]);
    }
};

export const showEditListingModal = async (listingId) => {
    setCurrentEditingListingId(listingId);
    const {
        editModal,
        editItemNameInput,
        editQuantityListedInput,
        editTotalPriceInput,
        editFeeInfo
    } = getEditListingModalElements();

    try {
        const {
            data: listing,
            error
        } = await supabase
            .from('market_listings')
            .select('*, items(item_name)')
            .eq('listing_id', listingId)
            .eq('character_id', currentCharacterId)
            .single();

        if (error) {
            throw error;
        }

        editItemNameInput.value = listing.items.item_name;
        editQuantityListedInput.value = listing.quantity_listed;
        editTotalPriceInput.value = listing.total_listed_price;
        setOriginalListingPrice(listing.total_listed_price);
        setOriginalListingFee(listing.market_fee);
        updateEditFeeInfo();

        editModal.classList.remove('hidden');
    } catch (e) {
        console.error('Error loading listing for edit:', e);
        await showCustomModal('Error', 'Failed to load listing for editing: ' + e.message, [{
            text: 'OK',
            value: true
        }]);
    }
};

export const handleEditListingSave = async (event) => {
    event.preventDefault();
    const {
        editModal,
        editItemNameInput,
        editQuantityListedInput,
        editTotalPriceInput,
        editListingForm
    } = getEditListingModalElements();
    const submitButton = editListingForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = 'Saving...';

    try {
        const newQuantityListed = parseInt(editQuantityListedInput.value);
        const newTotalListedPrice = parseInt(editTotalPriceInput.value);

        if (isNaN(newQuantityListed) || newQuantityListed <= 0 || isNaN(newTotalListedPrice) || newTotalListedPrice <= 0) {
            await showCustomModal('Error', 'Please enter valid quantity and total price.', [{
                text: 'OK',
                value: true
            }]);
            return;
        }

        const newFeeCalculated = Math.ceil(newTotalListedPrice * 0.05);
        const feeToUpdate = Math.max(newFeeCalculated, originalListingFee);

        const {
            error
        } = await supabase
            .from('market_listings')
            .update({
                quantity_listed: newQuantityListed,
                total_listed_price: newTotalListedPrice,
                market_fee: feeToUpdate
            })
            .eq('listing_id', currentEditingListingId)
            .eq('character_id', currentCharacterId);

        if (error) {
            throw error;
        }

        await showCustomModal('Success', 'Listing updated successfully!', [{
            text: 'OK',
            value: true
        }]);
        editModal.classList.add('hidden');
        await loadTraderPageData();
    } catch (e) {
        console.error('Error saving listing edit:', e);
        await showCustomModal('Error', 'Failed to update listing: ' + e.message, [{
            text: 'OK',
            value: true
        }]);
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'Save Changes';
    }
};

export const updateEditFeeInfo = () => {
    const {
        editTotalPriceInput,
        editFeeInfo
    } = getEditListingModalElements();
    const currentPrice = parseInt(editTotalPriceInput.value);
    const newFeeCalculated = isNaN(currentPrice) ? 0 : Math.ceil(currentPrice * 0.05);

    const feeToDisplay = Math.max(newFeeCalculated, originalListingFee);

    let feeDifference = feeToDisplay - originalListingFee;
    let priceDifference = currentPrice - originalListingPrice;

    let feeText = `Current Fee: ${feeToDisplay.toLocaleString()} gold (5%)`;

    if (feeDifference > 0) {
        feeText += ` (+${feeDifference.toLocaleString()} gold)`;
    } else if (feeDifference < 0) {
        feeText += ` (${feeDifference.toLocaleString()} gold)`;
    }

    if (priceDifference !== 0) {
        feeText += priceDifference > 0 ?
            ` <span class="text-green-600">(+${priceDifference.toLocaleString()} profit)</span>` :
            ` <span class="text-red-600">(${priceDifference.toLocaleString()} loss)</span>`;
    }

    editFeeInfo.innerHTML = feeText;
};

export const showManageMarketStallsModal = async () => {
    if (!manageMarketStallsModal) return;
    manageMarketStallsModal.classList.remove('hidden');
    await renderMarketStallsInModal();
};

export const handleAddMarketStall = async (event) => {
    event.preventDefault();
    createStallError.classList.add('hidden');

    try {
        if (!currentCharacterId) {
            await showCustomModal('Error', 'No character selected. Cannot add market stall.', [{
                text: 'OK',
                value: true
            }]);
            return;
        }

        const stallName = newMarketStallNameInput.value.trim();
        if (!stallName) {
            createStallError.textContent = 'Market stall name cannot be empty.';
            createStallError.classList.remove('hidden');
            return;
        }

        const {
            error
        } = await supabase
            .from('market_stalls')
            .insert({
                stall_name: stallName,
                character_id: currentCharacterId
            });

        if (error) {
            if (error.code === '23505') {
                createStallError.textContent = 'A market stall with this name already exists for your character.';
            } else {
                createStallError.textContent = 'Error adding market stall: ' + error.message;
            }
            createStallError.classList.remove('hidden');
            return;
        }

        newMarketStallNameInput.value = '';
        await showCustomModal('Success', 'Market Stall added successfully!', [{
            text: 'OK',
            value: true
        }]);
        await populateMarketStallDropdown();
        await setupMarketStallTabs();
        await renderMarketStallsInModal();

    } catch (e) {
        console.error('Error adding market stall:', e);
        createStallError.textContent = 'Failed to add market stall: ' + e.message;
        createStallError.classList.remove('hidden');
    }
};

export const renderMarketStallsInModal = async () => {
    if (!marketStallsList) return;

    try {
        const {
            data: stalls,
            error
        } = await supabase
            .from('market_stalls')
            .select('*')
            .eq('character_id', currentCharacterId)
            .order('created_at', {
                ascending: true
            });

        if (error) {
            throw error;
        }

        marketStallsList.innerHTML = '';
        if (stalls && stalls.length > 0) {
            stalls.forEach(stall => {
                const li = document.createElement('li');
                li.className = 'flex justify-between items-center bg-gray-50 p-3 rounded-md mb-2 shadow-sm';
                li.innerHTML = `
                    <span class="text-gray-800 font-medium">${stall.stall_name}</span>
                    <button class="delete-stall-btn bg-red-500 text-white px-3 py-1 rounded-md text-sm hover:bg-red-600 transition-colors" data-stall-id="${stall.id}">Delete</button>
                `;
                marketStallsList.appendChild(li);
            });
            document.querySelectorAll('.delete-stall-btn').forEach(button => {
                button.addEventListener('click', (e) => handleDeleteMarketStall(e.target.dataset.stallId));
            });
        } else {
            marketStallsList.innerHTML = '<li class="text-gray-600">No market stalls found for this character.</li>';
        }
    } catch (e) {
        console.error('Error rendering market stalls in modal:', e);
        marketStallsList.innerHTML = `<li class="text-red-500">Failed to load market stalls: ${e.message}</li>`;
    }
};


export const handleDeleteMarketStall = async (stallId) => {
    const deleteStallError = document.getElementById('deleteStallError');
    if (deleteStallError) {
        deleteStallError.classList.add('hidden');
    }

    try {
        if (!currentCharacterId) {
            await showCustomModal('Error', 'No character selected. Cannot delete market stall.', [{
                text: 'OK',
                value: true
            }]);
            return;
        }

        const {
            data: listings,
            error: listingsError
        } = await supabase
            .from('market_listings')
            .select('listing_id')
            .eq('market_stall_id', stallId)
            .eq('character_id', currentCharacterId)
            .eq('is_fully_sold', false)
            .eq('is_cancelled', false);

        if (listingsError) {
            throw listingsError;
        }

        if (listings && listings.length > 0) {
            await showCustomModal('Deletion Failed', 'This market stall cannot be deleted because it still has active listings. Please cancel or mark all listings as sold first.', [{
                text: 'OK',
                value: true
            }]);
            return;
        }

        const {
            error: deleteError
        } = await supabase
            .from('market_stalls')
            .delete()
            .eq('id', stallId)
            .eq('character_id', currentCharacterId);

        if (deleteError) {
            throw deleteError;
        }

        await showCustomModal('Success', 'Market Stall deleted successfully!', [{
            text: 'OK',
            value: true
        }]);

        await populateMarketStallDropdown();
        await setupMarketStallTabs();
        await renderMarketStallsInModal();

    } catch (e) {
        console.error('Error deleting market stall:', e.message);
        deleteStallError.textContent = 'Failed to delete market stall: ' + e.message;
        deleteStallError.classList.remove('hidden');
    }
};

export const getOrCreateDefaultMarketStall = async (characterId) => {
    try {
        const {
            data: characterData,
            error: charError
        } = await supabase
            .from('characters')
            .select('character_name')
            .eq('character_id', characterId)
            .single();

        if (charError) {
            console.error('Error fetching character name for default stall:', charError);
            return null;
        }

        const dynamicDefaultStallName = `${characterData.character_name} - Default Stall`;

        const {
            data: existingDynamicStall,
            error: selectDynamicError
        } = await supabase
            .from('market_stalls')
            .select('id')
            .eq('character_id', characterId)
            .eq('stall_name', dynamicDefaultStallName)
            .limit(1);

        if (selectDynamicError) {
            console.error('Error checking for existing dynamic default stall:', selectDynamicError);
            return null;
        }

        if (existingDynamicStall && existingDynamicStall.length > 0) {
            return existingDynamicStall[0].id;
        }

        const {
            data: existingOldDefaultStall,
            error: selectOldError
        } = await supabase
            .from('market_stalls')
            .select('id')
            .eq('character_id', characterId)
            .eq('stall_name', 'Default Stall')
            .limit(1);

        if (selectOldError) {
            console.error('Error checking for existing old default stall:', selectOldError);
            return null;
        }

        if (existingOldDefaultStall && existingOldDefaultStall.length > 0) {
            return existingOldDefaultStall[0].id;
        }

        const {
            data: newStall,
            error: insertError
        } = await supabase
            .from('market_stalls')
            .insert({
                stall_name: dynamicDefaultStallName,
                character_id: characterId
            })
            .select('id')
            .single();

        if (insertError) {
            console.error('Error creating default market stall:', insertError);
            return null;
        }

        return newStall.id;

    } catch (e) {
        console.error('Unexpected error in getOrCreateDefaultMarketStall:', e);
        return null;
    }
};