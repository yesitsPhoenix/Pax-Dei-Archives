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

const getOrCreateItemId = async (itemName, categoryId) => {
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
        await showCustomModal('Error', 'Failed to create new item record: ' + insertError.message, [{
            text: 'OK',
            value: true
        }]);
        return null;
    }
    return newItem.item_id;
};


export const handleAddListing = async (e) => {
    e.preventDefault();
    const submitButton = e.target.querySelector('button[type="submit"]');
    if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = 'Adding Listing...';
    }
    try {
        if (!currentCharacterId) {
            await showCustomModal('Validation Error', 'Please select a character first.', [{
                text: 'OK',
                value: true
            }]);
            return;
        }

        const itemName = document.getElementById('item-name').value.trim();
        const itemCategory = document.getElementById('item-category').value;
        const itemStacks = parseInt(document.getElementById('item-stacks').value, 10);
        const itemCountPerStack = parseInt(document.getElementById('item-count-per-stack').value, 10);
        const itemPricePerStack = parseFloat(document.getElementById('item-price-per-stack').value);
        const marketStallId = document.getElementById('market-stall-location').value;

        if (!itemName || !itemCategory || isNaN(itemStacks) || isNaN(itemCountPerStack) || isNaN(itemPricePerStack) || !marketStallId) {
            await showCustomModal('Validation Error', 'Please fill in all listing fields correctly.', [{
                text: 'OK',
                value: true
            }]);
            return;
        }

        const itemId = await getOrCreateItemId(itemName, itemCategory);
        if (!itemId) return;

        const quantityPerListing = itemCountPerStack;
        const totalListedPricePerListing = itemPricePerStack;
        const pricePerUnitPerListing = itemPricePerStack / itemCountPerStack;
        const marketFeePerListing = Math.ceil(totalListedPricePerListing * 0.05);

        let successCount = 0;
        let failedCount = 0;
        const errors = [];

        const {
            data: characterData,
            error: fetchCharacterError
        } = await supabase
            .from('characters')
            .select('gold')
            .eq('character_id', currentCharacterId)
            .single();

        if (fetchCharacterError) {
            await showCustomModal('Error', 'Failed to fetch character gold: ' + fetchCharacterError.message, [{
                text: 'OK',
                value: true
            }]);
            console.error('Error fetching character gold:', fetchCharacterError.message);
            return;
        }

        let currentGold = characterData.gold || 0;
        let totalFees = 0;
        for (let i = 0; i < itemStacks; i++) {
            totalFees += marketFeePerListing;
        }

        if (currentGold < totalFees) {
            await showCustomModal('Validation Error', `Not enough gold! You need ${totalFees.toLocaleString()} gold for fees but only have ${currentGold.toLocaleString()}.`, [{
                text: 'OK',
                value: true
            }]);
            return;
        }

        for (let i = 0; i < itemStacks; i++) {
            const {
                error
            } = await supabase.from('market_listings').insert({
                item_id: itemId,
                character_id: currentCharacterId,
                quantity_listed: quantityPerListing,
                listed_price_per_unit: pricePerUnitPerListing,
                total_listed_price: totalListedPricePerListing,
                market_fee: marketFeePerListing,
                market_stall_id: marketStallId
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
            const {
                error: updateGoldError
            } = await supabase
                .from('characters')
                .update({
                    gold: newGold
                })
                .eq('character_id', currentCharacterId);

            if (updateGoldError) {
                await showCustomModal('Error', 'Successfully added listings, but failed to deduct gold: ' + updateGoldError.message, [{
                    text: 'OK',
                    value: true
                }]);
                console.error('Error deducting gold:', updateGoldError.message);
            } else {
                await showCustomModal('Success', `Successfully created ${successCount} new listing(s) and deducted ${totalFees.toLocaleString()} gold in fees!`, [{
                    text: 'OK',
                    value: true
                }]);
                e.target.reset();
                await loadTraderPageData();
            }
        } else {
            await showCustomModal('Error', 'Failed to add any listings. Errors: ' + errors.join(', '), [{
                text: 'OK',
                value: true
            }]);
        }
    } catch (e) {
        console.error('Error adding listing:', e);
        await showCustomModal('Error', 'An unexpected error occurred while adding the listing.', [{
            text: 'OK',
            value: true
        }]);
    } finally {
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = 'Add Listing';
        }
    }
};

export const handleMarkAsSold = async (listingId) => {
    const confirmation = await showCustomModal('Confirm Sale', 'Are you sure you want to mark this listing as sold? This action cannot be undone.', [{
        text: 'Yes',
        value: true,
        class: 'bg-green-500 hover:bg-green-700'
    }, {
        text: 'No',
        value: false,
        class: 'bg-gray-500 hover:bg-gray-700'
    }]);

    if (!confirmation) return;

    try {
        const {
            data: listing,
            error: fetchError
        } = await supabase
            .from('market_listings')
            .select('listing_id, quantity_listed, total_listed_price, listed_price_per_unit, character_id')
            .eq('listing_id', listingId)
            .single();

        if (fetchError || !listing) {
            console.error('Error fetching listing for sale record:', fetchError);
            await showCustomModal('Error', 'Could not retrieve listing details to record sale.', [{
                text: 'OK',
                value: true
            }]);
            return;
        }

        const {
            error: updateError
        } = await supabase
            .from('market_listings')
            .update({
                is_fully_sold: true
            })
            .eq('listing_id', listingId)
            .eq('character_id', currentCharacterId);

        if (updateError) {
            await showCustomModal('Error', 'Failed to mark listing as sold: ' + updateError.message, [{
                text: 'OK',
                value: true
            }]);
            return;
        }

        const {
            error: insertSaleError
        } = await supabase
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
            await showCustomModal('Error', 'Listing marked as sold, but failed to record sale history: ' + insertSaleError.message, [{
                text: 'OK',
                value: true
            }]);
        } else {
            const {
                data: characterData,
                error: fetchGoldError
            } = await supabase
                .from('characters')
                .select('gold')
                .eq('character_id', currentCharacterId)
                .single();

            if (fetchGoldError) {
                console.error('Error fetching character gold for sale receipt:', fetchGoldError.message);
                await showCustomModal('Warning', 'Listing marked as sold, but failed to update character gold. Please manually adjust gold if needed.', [{
                    text: 'OK',
                    value: true
                }]);
            } else {
                const newGold = (characterData.gold || 0) + listing.total_listed_price;
                const {
                    error: updateGoldError
                } = await supabase
                    .from('characters')
                    .update({
                        gold: newGold
                    })
                    .eq('character_id', currentCharacterId);

                if (updateGoldError) {
                    await showCustomModal('Error', 'Listing marked as sold, but failed to update character gold: ' + updateGoldError.message, [{
                        text: 'OK',
                        value: true
                    }]);
                    console.error('Error updating character gold:', updateGoldError.message);
                } else {
                    await showCustomModal('Success', 'Listing marked as sold and gold updated!', [{
                        text: 'OK',
                        value: true
                    }]);
                    await loadTraderPageData();
                }
            }
        }
    } catch (e) {
        console.error('Error marking listing as sold:', e);
        await showCustomModal('Error', 'An unexpected error occurred while marking the listing as sold.', [{
            text: 'OK',
            value: true
        }]);
    } finally {
        loadActiveListings();
    }
};

export const handleCancelListing = async (listingId) => {
    const confirmation = await showCustomModal('Confirm Cancel', 'Are you sure you want to cancel this listing? This action cannot be undone.', [{
        text: 'Yes',
        value: true,
        class: 'bg-red-500 hover:bg-red-700'
    }, {
        text: 'No',
        value: false,
        class: 'bg-gray-500 hover:bg-gray-700'
    }]);

    if (!confirmation) return;

    try {
        const {
            data: listing,
            error: fetchError
        } = await supabase
            .from('market_listings')
            .select('listing_id, market_fee')
            .eq('listing_id', listingId)
            .single();

        if (fetchError || !listing) {
            console.error('Error fetching listing for cancellation:', fetchError);
            await showCustomModal('Error', 'Could not retrieve listing details for cancellation.', [{
                text: 'OK',
                value: true
            }]);
            return;
        }

        const {
            error: updateError
        } = await supabase
            .from('market_listings')
            .update({
                is_cancelled: true,
                is_fully_sold: true
            })
            .eq('listing_id', listingId)
            .eq('character_id', currentCharacterId);

        if (updateError) {
            await showCustomModal('Error', 'Failed to cancel listing: ' + updateError.message, [{
                text: 'OK',
                value: true
            }]);
            return;
        }

        await showCustomModal('Success', 'Listing canceled successfully!', [{
            text: 'OK',
            value: true
        }]);
        await loadTraderPageData();
    } catch (e) {
        console.error('Error canceling listing:', e);
        await showCustomModal('Error', 'An unexpected error occurred while canceling the listing.', [{
            text: 'OK',
            value: true
        }]);
    } finally {
        loadActiveListings();
    }
};

export const showEditListingModal = async (listingId) => {
    setCurrentEditingListingId(listingId);
    const {
        editModal,
        editItemNameInput,
        editQuantityListedInput,
        editTotalPriceInput
    } = getEditListingModalElements();
    try {
        const {
            data: listing,
            error
        } = await supabase
            .from('market_listings')
            .select('item_id, quantity_listed, total_listed_price, market_fee, items(item_name)')
            .eq('listing_id', listingId)
            .eq('character_id', currentCharacterId)
            .single();

        if (error || !listing) {
            console.error('Error fetching listing for edit:', error);
            await showCustomModal('Error', 'Could not retrieve listing details for editing.', [{
                text: 'OK',
                value: true
            }]);
            return;
        }

        setOriginalListingPrice(listing.total_listed_price || 0);
        setOriginalListingFee(listing.market_fee || 0);
        editItemNameInput.value = listing.items.item_name;
        editQuantityListedInput.value = Math.round(listing.quantity_listed || 0);
        editTotalPriceInput.value = Math.round(listing.total_listed_price || 0);
        updateEditFeeInfo();
        editModal.classList.remove('hidden');
    } catch (e) {
        console.error('Error showing edit modal:', e);
        await showCustomModal('Error', 'An unexpected error occurred while preparing the edit form.', [{
            text: 'OK',
            value: true
        }]);
    }
};

export const updateEditFeeInfo = () => {
    const {
        editTotalPriceInput,
        editFeeInfo
    } = getEditListingModalElements();
    const newPrice = parseFloat(editTotalPriceInput.value) || 0;
    const estimatedNewFee = Math.ceil(newPrice * 0.05);

    if (newPrice > originalListingPrice) {
        let additionalFee = estimatedNewFee - originalListingFee;
        if (additionalFee < 0) additionalFee = 0;
        editFeeInfo.textContent = `Estimated additional fee: ${additionalFee.toLocaleString()} (Total estimated fee: ${estimatedNewFee.toLocaleString()})`;
    } else {
        editFeeInfo.textContent = `Current fee: ${originalListingFee.toLocaleString()}`;
    }
};

export const handleEditListingSave = async (e) => {
    e.preventDefault();
    const {
        editModal,
        editQuantityListedInput,
        editTotalPriceInput
    } = getEditListingModalElements();
    const submitButton = editModal.querySelector('button[type="submit"]');
    if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = 'Saving...';
    }

    try {
        if (!currentEditingListingId) {
            await showCustomModal('Error', 'No listing selected for editing.', [{
                text: 'OK',
                value: true
            }]);
            return;
        }

        const quantity_listed = parseInt(editQuantityListedInput.value, 10);
        const total_listed_price = parseFloat(editTotalPriceInput.value);

        if (isNaN(quantity_listed) || isNaN(total_listed_price) || quantity_listed <= 0 || total_listed_price <= 0) {
            await showCustomModal('Validation Error', 'Please enter valid quantity and price.', [{
                text: 'OK',
                value: true
            }]);
            return;
        }

        const {
            data: oldListing,
            error: fetchOldListingError
        } = await supabase
            .from('market_listings')
            .select('total_listed_price, market_fee')
            .eq('listing_id', currentEditingListingId)
            .eq('character_id', currentCharacterId)
            .single();

        if (fetchOldListingError || !oldListing) {
            await showCustomModal('Error', 'Could not retrieve original listing details for fee calculation.', [{
                text: 'OK',
                value: true
            }]);
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

        const {
            data: characterData,
            error: fetchCharacterError
        } = await supabase
            .from('characters')
            .select('gold')
            .eq('character_id', currentCharacterId)
            .single();

        if (fetchCharacterError) {
            await showCustomModal('Error', 'Failed to fetch character gold: ' + fetchCharacterError.message, [{
                text: 'OK',
                value: true
            }]);
            console.error('Error fetching character gold:', fetchCharacterError.message);
            return;
        }

        let currentGold = characterData.gold || 0;

        if (additionalFeeToDeduct > 0 && currentGold < additionalFeeToDeduct) {
            await showCustomModal('Validation Error', `Not enough gold! You need ${additionalFeeToDeduct.toLocaleString()} gold for the additional fee but only have ${currentGold.toLocaleString()}.`, [{
                text: 'OK',
                value: true
            }]);
            return;
        }

        const listed_price_per_unit = total_listed_price / quantity_listed;

        const {
            error: updateListingError
        } = await supabase
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
            await showCustomModal('Error', 'Failed to update listing: ' + updateListingError.message, [{
                text: 'OK',
                value: true
            }]);
            return;
        }

        if (additionalFeeToDeduct > 0) {
            const newGold = currentGold - additionalFeeToDeduct;
            const {
                error: updateGoldError
            } = await supabase
                .from('characters')
                .update({
                    gold: newGold
                })
                .eq('character_id', currentCharacterId);

            if (updateGoldError) {
                await showCustomModal('Warning', 'Listing updated, but failed to deduct additional gold for fee increase: ' + updateGoldError.message, [{
                    text: 'OK',
                    value: true
                }]);
                console.error('Error deducting additional gold:', updateGoldError.message);
            } else {
                await showCustomModal('Success', `Listing updated and additional fee of ${additionalFeeToDeduct.toLocaleString()} gold deducted!`, [{
                    text: 'OK',
                    value: true
                }]);
            }
        } else {
            await showCustomModal('Success', 'Listing updated successfully!', [{
                text: 'OK',
                value: true
            }]);
        }
        editModal.classList.add('hidden');
        await loadTraderPageData();
    } catch (e) {
        console.error('Error saving listing edit:', e);
        await showCustomModal('Error', 'An unexpected error occurred while saving changes.', [{
            text: 'OK',
            value: true
        }]);
    } finally {
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = 'Save Changes';
        }
    }
};


export const showManageMarketStallsModal = async () => {
    if (!manageMarketStallsModal) return;

    if (!currentCharacterId) {
        await showCustomModal('Error', 'Please select a character first to manage market stalls.', [{
            text: 'OK',
            value: true
        }]);
        return;
    }

    createStallError.classList.add('hidden');
    deleteStallError.classList.add('hidden');
    newMarketStallNameInput.value = '';

    await renderMarketStallsInModal();
    manageMarketStallsModal.classList.remove('hidden');
};


const renderMarketStallsInModal = async () => {
    if (!marketStallsList) return;

    marketStallsList.innerHTML = '<p class="text-gray-600">Loading stalls...</p>';

    try {
        const stalls = await getUserMarketStallLocations(currentCharacterId);

        if (stalls.length === 0) {
            marketStallsList.innerHTML = '<p class="text-gray-600">No market stalls found for this character. Create one below!</p>';
            return;
        }

        marketStallsList.innerHTML = '';
        stalls.forEach(stall => {
            const stallDiv = document.createElement('div');
            stallDiv.classList.add('flex', 'items-center', 'justify-between', 'bg-gray-100', 'p-3', 'rounded-lg', 'shadow-sm', 'mb-2');
            stallDiv.innerHTML = `
                <span class="text-gray-800 font-medium">${stall.stall_name}</span>
                <button type="button" class="delete-stall-btn bg-red-500 hover:bg-red-600 text-white font-bold py-1 px-3 rounded-full text-sm" data-stall-id="${stall.id}">
                    Delete
                </button>
            `;
            marketStallsList.appendChild(stallDiv);
        });

        marketStallsList.querySelectorAll('.delete-stall-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                handleDeleteMarketStall(e.target.dataset.stallId);
            });
        });

    } catch (e) {
        console.error('Error rendering market stalls in modal:', e);
        marketStallsList.innerHTML = '<p class="text-red-500">Failed to load stalls.</p>';
    }
};

/**
 * Handles the form submission for creating a new market stall.
 * @param {Event} e - The form submission event.
 */
export const handleAddMarketStall = async (e) => {
    e.preventDefault();
    createStallError.classList.add('hidden');

    if (!currentCharacterId) {
        createStallError.textContent = 'Please select a character first.';
        createStallError.classList.remove('hidden');
        return;
    }

    const stallName = newMarketStallNameInput.value.trim();
    if (!stallName) {
        createStallError.textContent = 'Market Stall Name cannot be empty.';
        createStallError.classList.remove('hidden');
        return;
    }

    addMarketStallBtn.disabled = true;
    addMarketStallBtn.textContent = 'Creating Stall...';

    try {
        const {
            error
        } = await supabase
            .from('market_stalls')
            .insert({
                stall_name: stallName,
                character_id: currentCharacterId
            });

        if (error) {
            throw error;
        }

        await showCustomModal('Success', 'Market Stall created successfully!', [{
            text: 'OK',
            value: true
        }]);
        newMarketStallNameInput.value = '';

        await populateMarketStallDropdown();
        await setupMarketStallTabs();
        await renderMarketStallsInModal();

    } catch (e) {
        console.error('Error creating market stall:', e.message);
        createStallError.textContent = 'Failed to create market stall: ' + e.message;
        createStallError.classList.remove('hidden');
    } finally {
        addMarketStallBtn.disabled = false;
        addMarketStallBtn.textContent = 'Create Market Stall';
    }
};

/**
 * Handles the deletion of a market stall.
 * @param {string} stallId - The ID of the stall to delete.
 */
export const handleDeleteMarketStall = async (stallId) => {
    deleteStallError.classList.add('hidden');

    if (!currentCharacterId) {
        deleteStallError.textContent = 'No character selected.';
        deleteStallError.classList.remove('hidden');
        return;
    }

    const confirmation = await showCustomModal(
        'Confirm Deletion',
        'Are you sure you want to delete this market stall? This action cannot be undone and can only be performed if the stall has no active listings.', [{
            text: 'Yes',
            value: true,
            class: 'bg-red-500 hover:bg-red-700'
        }, {
            text: 'No',
            value: false,
            class: 'bg-gray-500 hover:bg-gray-700'
        }]
    );

    if (!confirmation) {
        return;
    }

    try {
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