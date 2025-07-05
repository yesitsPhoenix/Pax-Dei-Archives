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
    console.log('getOrCreateItemId called with:', { itemName, categoryId });
    if (!currentCharacterId) {
        console.warn("getOrCreateItemId: No character selected.");
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
        console.error('getOrCreateItemId: Failed to check for existing item.', selectError);
        await showCustomModal('Error', 'Failed to check for existing item.', [{
            text: 'OK',
            value: true
        }]);
        return null;
    }

    if (items && items.length > 0) {
        console.log('getOrCreateItemId: Existing item found, ID:', items[0].item_id);
        return items[0].item_id;
    }

    console.log('getOrCreateItemId: No existing item, attempting to create new item.');
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
        console.error('getOrCreateItemId: Failed to create new item record:', insertError.message, insertError);
        await showCustomModal('Error', 'Failed to create new item record: ' + insertError.message, [{
            text: 'OK',
            value: true
        }]);
        return null;
    }
    console.log('getOrCreateItemId: New item created, ID:', newItem.item_id);
    return newItem.item_id;
};


export const handleAddListing = async (e) => {
    console.log('handleAddListing called.');
    e.preventDefault(); // This should stop the address bar change.
    const form = e.target;
    const submitButton = form.querySelector('button[type="submit"]');

    if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = 'Adding Listing...';
        console.log('Submit button disabled and text changed.');
    }

    try {
        if (!currentCharacterId) {
            await showCustomModal('Validation Error', 'Please select a character first.', [{
                text: 'OK',
                value: true
            }]);
            console.error("Validation Error: No character selected. Aborting listing creation.");
            return;
        }
        console.log('Current Character ID:', currentCharacterId);


        const itemName = form.querySelector('[name="item-name"]').value.trim();
        const itemCategory = parseInt(form.querySelector('[name="item-category"]').value, 10);
        const itemStacks = parseInt(form.querySelector('[name="item-stacks"]').value, 10);
        const itemCountPerStack = parseInt(form.querySelector('[name="item-count-per-stack"]').value, 10);
        const itemPricePerStack = parseFloat(form.querySelector('[name="item-price-per-stack"]').value);
        const marketStallId = form.querySelector('[name="market-stall-location"]').value;

        console.log('Form values retrieved:', { itemName, itemCategory, itemStacks, itemCountPerStack, itemPricePerStack, marketStallId });


        if (!itemName || isNaN(itemStacks) || isNaN(itemCountPerStack) || isNaN(itemPricePerStack) || !marketStallId) {
            await showCustomModal('Validation Error', 'Please fill in all listing fields correctly.', [{
                text: 'OK',
                value: true
            }]);
            console.error("Validation Error: Missing or invalid form fields. Aborting.", { itemName, itemStacks, itemCountPerStack, itemPricePerStack, marketStallId });
            return;
        }

        // Validate itemCategory after parsing
        if (isNaN(itemCategory) || itemCategory <= 0) { // Assuming category IDs are positive integers
            await showCustomModal('Validation Error', 'Please select a valid item category.', [{
                text: 'OK',
                value: true
            }]);
            console.error("Validation Error: Invalid item category. Aborting.", { itemCategory });
            return;
        }

        const itemId = await getOrCreateItemId(itemName, itemCategory);
        if (!itemId) {
            console.error("Error: Could not get or create item ID. Aborting listing creation.");
            return;
        }
        console.log('Item ID obtained/created:', itemId);


        const quantityPerListing = itemCountPerStack;
        const totalListedPricePerListing = itemPricePerStack;
        const pricePerUnitPerListing = itemPricePerStack / itemCountPerStack;
        const marketFeePerListing = Math.ceil(totalListedPricePerListing * 0.05); // Fee calculation
        console.log('Listing calculations:', { quantityPerListing, totalListedPricePerListing, pricePerUnitPerListing, marketFeePerListing });


        let successCount = 0;
        let failedCount = 0;
        const errors = [];

        const { data: characterData, error: fetchCharacterError } = await supabase
            .from('characters')
            .select('gold')
            .eq('character_id', currentCharacterId)
            .single();

        if (fetchCharacterError) {
            await showCustomModal('Error', 'Failed to fetch character gold: ' + fetchCharacterError.message, [{
                text: 'OK',
                value: true
            }]);
            console.error("Supabase Error: Failed to fetch character gold. Aborting.", fetchCharacterError);
            return;
        }

        let currentGold = characterData.gold || 0;
        let totalFees = 0;
        for (let i = 0; i < itemStacks; i++) {
            totalFees += marketFeePerListing;
        }
        console.log('Character gold:', currentGold, 'Total fees for all stacks:', totalFees);


        if (currentGold < totalFees) {
            await showCustomModal('Validation Error', `Not enough gold! You need ${totalFees.toLocaleString()} gold for fees but only have ${currentGold.toLocaleString()}.`, [{
                text: 'OK',
                value: true
            }]);
            console.error(`Validation Error: Insufficient gold. Needed: ${totalFees}, Available: ${currentGold}. Aborting.`);
            return;
        }

        console.log(`Proceeding to insert ${itemStacks} listings.`);
        for (let i = 0; i < itemStacks; i++) {
            console.log(`Attempting to insert listing ${i + 1}/${itemStacks}`);
            const { error } = await supabase.from('market_listings').insert({
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
                console.error(`Supabase Insert Error for listing ${i + 1}:`, error);
            } else {
                successCount++;
                console.log(`Listing ${i + 1} successfully inserted.`);
            }
        }

        if (successCount > 0) {
            console.log(`Successfully added ${successCount} listings. Updating character gold.`);
            const newGold = currentGold - totalFees;
            const { error: updateGoldError } = await supabase
                .from('characters')
                .update({ gold: newGold })
                .eq('character_id', currentCharacterId);

            if (updateGoldError) {
                await showCustomModal('Error', 'Listing added but failed to update character gold: ' + updateGoldError.message, [{
                    text: 'OK',
                    value: true
                }]);
                console.error("Supabase Error: Failed to update character gold.", updateGoldError);
            } else {
                console.log(`Character gold updated from ${currentGold} to ${newGold}.`);
                let successMessage = `Successfully added ${successCount} listing(s)!`;
                if (failedCount > 0) {
                    successMessage += ` ${failedCount} listing(s) failed.`;
                }

                // *** MODIFICATION HERE to include fee in the success message ***
                const totalListedValue = successCount * totalListedPricePerListing;
                successMessage += `<br>Total Value Listed: ${totalListedValue.toLocaleString()}<br>Total Fees Deducted: ${totalFees.toLocaleString()}`;

                await showCustomModal('Success', successMessage, [{
                    text: 'OK',
                    value: true
                }]);
            }
        } else {
            console.error(`No listings were successfully added. Total failed: ${failedCount}.`);
            await showCustomModal('Error', `Failed to add any listings. Errors: ${errors.join('; ')}`, [{
                text: 'OK',
                value: true
            }]);
        }
        console.log('Calling loadActiveListings and loadTraderPageData.');
        await loadActiveListings();
        await loadTraderPageData();
        form.reset(); // Clear the form after successful submission
        console.log('Form reset.');

    } catch (e) {
        console.error("Unexpected error during handleAddListing:", e);
        await showCustomModal('Error', 'An unexpected error occurred while adding the listing. Please check the console for more details.', [{
            text: 'OK',
            value: true
        }]);
    } finally {
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = 'Add Listing';
            console.log('Submit button re-enabled and text reset.');
        }
    }
};

export const handleMarkAsSold = async (listingId) => {
    console.log('handleMarkAsSold called for listing ID:', listingId);
    const confirmation = await showCustomModal('Confirm Sale', 'Are you sure you want to mark this listing as sold? This action cannot be undone.', [{
        text: 'Yes',
        value: true,
        class: 'bg-green-500 hover:bg-green-700'
    }, {
        text: 'No',
        value: false,
        class: 'bg-gray-500 hover:bg-gray-700'
    }]);

    if (!confirmation) {
        console.log('Mark as sold cancelled by user.');
        return;
    }
    console.log('Confirmation received for marking as sold.');

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
            console.error('handleMarkAsSold: Error fetching listing for sale record:', fetchError);
            await showCustomModal('Error', 'Could not retrieve listing details to record sale.', [{
                text: 'OK',
                value: true
            }]);
            return;
        }
        console.log('Listing fetched for marking as sold:', listing);


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
            console.error('handleMarkAsSold: Failed to mark listing as sold:', updateError);
            await showCustomModal('Error', 'Failed to mark listing as sold: ' + updateError.message, [{
                text: 'OK',
                value: true
            }]);
            return;
        }
        console.log('Listing successfully marked as sold in DB.');


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
            console.error('handleMarkAsSold: Error inserting sales record:', insertSaleError.message);
            await showCustomModal('Error', 'Listing marked as sold, but failed to record sale history: ' + insertSaleError.message, [{
                text: 'OK',
                value: true
            }]);
        } else {
            console.log('Sales record inserted successfully. Fetching character gold.');
            const {
                data: characterData,
                error: fetchGoldError
            } = await supabase
                .from('characters')
                .select('gold')
                .eq('character_id', currentCharacterId)
                .single();

            if (fetchGoldError) {
                console.error('handleMarkAsSold: Error fetching character gold for sale receipt:', fetchGoldError.message);
                await showCustomModal('Warning', 'Listing marked as sold, but failed to update character gold. Please manually adjust gold if needed.', [{
                    text: 'OK',
                    value: true
                }]);
            } else {
                const newGold = (characterData.gold || 0) + listing.total_listed_price;
                console.log(`Updating character gold from ${characterData.gold} to ${newGold}.`);
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
                    console.error('handleMarkAsSold: Error updating character gold:', updateGoldError.message);
                } else {
                    await showCustomModal('Success', 'Listing marked as sold and gold updated!', [{
                        text: 'OK',
                        value: true
                    }]);
                    console.log('Character gold updated successfully. Loading trader page data.');
                    await loadTraderPageData();
                }
            }
        }
    } catch (e) {
        console.error('handleMarkAsSold: An unexpected error occurred while marking the listing as sold.', e);
        await showCustomModal('Error', 'An unexpected error occurred while marking the listing as sold.', [{
            text: 'OK',
            value: true
        }]);
    } finally {
        console.log('handleMarkAsSold finished. Calling loadActiveListings.');
        loadActiveListings(); // This was missing in your original finally block for mark as sold
    }
};

export const handleCancelListing = async (listingId) => {
    console.log('handleCancelListing called for listing ID:', listingId);
    const confirmation = await showCustomModal('Confirm Cancel', 'Are you sure you want to cancel this listing? This action cannot be undone.', [{
        text: 'Yes',
        value: true,
        class: 'bg-red-500 hover:bg-red-700'
    }, {
        text: 'No',
        value: false,
        class: 'bg-gray-500 hover:bg-gray-700'
    }]);

    if (!confirmation) {
        console.log('Cancellation cancelled by user.');
        return;
    }
    console.log('Confirmation received for cancellation.');

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
            console.error('handleCancelListing: Error fetching listing for cancellation:', fetchError);
            await showCustomModal('Error', 'Could not retrieve listing details for cancellation.', [{
                text: 'OK',
                value: true
            }]);
            return;
        }
        console.log('Listing fetched for cancellation:', listing);


        const {
            error: updateError
        } = await supabase
            .from('market_listings')
            .update({
                is_cancelled: true,
                is_fully_sold: true // Marking as fully sold effectively hides it from active listings
            })
            .eq('listing_id', listingId)
            .eq('character_id', currentCharacterId);

        if (updateError) {
            console.error('handleCancelListing: Failed to cancel listing:', updateError);
            await showCustomModal('Error', 'Failed to cancel listing: ' + updateError.message, [{
                text: 'OK',
                value: true
            }]);
            return;
        }
        console.log('Listing successfully marked as cancelled in DB.');


        await showCustomModal('Success', 'Listing canceled successfully!', [{
            text: 'OK',
            value: true
        }]);
        console.log('Calling loadTraderPageData after cancellation.');
        await loadTraderPageData();
    } catch (e) {
        console.error('handleCancelListing: An unexpected error occurred while canceling the listing.', e);
        await showCustomModal('Error', 'An unexpected error occurred while canceling the listing.', [{
            text: 'OK',
            value: true
        }]);
    } finally {
        console.log('handleCancelListing finished. Calling loadActiveListings.');
        loadActiveListings();
    }
};

export const showEditListingModal = async (listingId) => {
    console.log('showEditListingModal called for listing ID:', listingId);
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
            console.error('showEditListingModal: Error fetching listing for edit:', error);
            await showCustomModal('Error', 'Could not retrieve listing details for editing.', [{
                text: 'OK',
                value: true
            }]);
            return;
        }
        console.log('Listing data fetched for edit modal:', listing);


        setOriginalListingPrice(listing.total_listed_price || 0);
        setOriginalListingFee(listing.market_fee || 0);
        editItemNameInput.value = listing.items.item_name;
        editQuantityListedInput.value = Math.round(listing.quantity_listed || 0);
        editTotalPriceInput.value = Math.round(listing.total_listed_price || 0);
        updateEditFeeInfo();
        editModal.classList.remove('hidden');
        console.log('Edit modal displayed.');
    } catch (e) {
        console.error('showEditListingModal: An unexpected error occurred while preparing the edit form.', e);
        await showCustomModal('Error', 'An unexpected error occurred while preparing the edit form.', [{
            text: 'OK',
            value: true
        }]);
    }
};

export const updateEditFeeInfo = () => {
    console.log('updateEditFeeInfo called.');
    const {
        editTotalPriceInput,
        editFeeInfo
    } = getEditListingModalElements();
    const newPrice = parseFloat(editTotalPriceInput.value) || 0;
    const estimatedNewFee = Math.ceil(newPrice * 0.05);
    console.log('New price:', newPrice, 'Estimated new fee:', estimatedNewFee);


    if (newPrice > originalListingPrice) {
        let additionalFee = estimatedNewFee - originalListingFee;
        if (additionalFee < 0) additionalFee = 0; // Ensure additionalFee is not negative
        editFeeInfo.textContent = `Estimated additional fee: ${additionalFee.toLocaleString()} (Total estimated fee: ${estimatedNewFee.toLocaleString()})`;
        console.log('Price increased. Additional fee:', additionalFee);
    } else {
        editFeeInfo.textContent = `Current fee: ${originalListingFee.toLocaleString()}`;
        console.log('Price not increased. Current fee:', originalListingFee);
    }
};

export const handleEditListingSave = async (e) => {
    console.log('handleEditListingSave called.');
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
        console.log('Edit save button disabled and text changed.');
    }

    try {
        if (!currentEditingListingId) {
            await showCustomModal('Error', 'No listing selected for editing.', [{
                text: 'OK',
                value: true
            }]);
            console.error('handleEditListingSave: No current editing listing ID. Aborting.');
            return;
        }
        console.log('Current editing listing ID:', currentEditingListingId);


        const quantity_listed = parseInt(editQuantityListedInput.value, 10);
        const total_listed_price = parseFloat(editTotalPriceInput.value);
        console.log('New quantity:', quantity_listed, 'New total price:', total_listed_price);


        if (isNaN(quantity_listed) || isNaN(total_listed_price) || quantity_listed <= 0 || total_listed_price <= 0) {
            await showCustomModal('Validation Error', 'Please enter valid quantity and price.', [{
                text: 'OK',
                value: true
            }]);
            console.error('handleEditListingSave: Invalid quantity or total price. Aborting.');
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
            console.error('handleEditListingSave: Could not retrieve original listing details for fee calculation.', fetchOldListingError);
            await showCustomModal('Error', 'Could not retrieve original listing details for fee calculation.', [{
                text: 'OK',
                value: true
            }]);
            return;
        }
        console.log('Old listing details:', oldListing);


        const oldPrice = oldListing.total_listed_price;
        const currentStoredFee = oldListing.market_fee;
        const priceIncrease = total_listed_price - oldPrice;
        console.log('Old price:', oldPrice, 'Current stored fee:', currentStoredFee, 'Price increase:', priceIncrease);


        let additionalFeeToDeduct = 0;
        let newCalculatedFee = currentStoredFee;

        if (priceIncrease > 0) {
            newCalculatedFee = Math.ceil(total_listed_price * 0.05);
            if (newCalculatedFee < currentStoredFee) {
                newCalculatedFee = currentStoredFee; // Fee should not decrease on price increase
            }
            additionalFeeToDeduct = newCalculatedFee - currentStoredFee;
            console.log('Price increased. New calculated fee:', newCalculatedFee, 'Additional fee to deduct:', additionalFeeToDeduct);
        } else {
            additionalFeeToDeduct = 0;
            newCalculatedFee = currentStoredFee;
            console.log('Price not increased or decreased. No additional fee.');
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
            console.error('handleEditListingSave: Failed to fetch character gold for fee deduction:', fetchCharacterError);
            await showCustomModal('Error', 'Failed to fetch character gold: ' + fetchCharacterError.message, [{
                text: 'OK',
                value: true
            }]);
            return;
        }

        let currentGold = characterData.gold || 0;
        console.log('Character gold before fee deduction:', currentGold);


        if (additionalFeeToDeduct > 0 && currentGold < additionalFeeToDeduct) {
            await showCustomModal('Validation Error', `Not enough gold! You need ${additionalFeeToDeduct.toLocaleString()} gold for the additional fee but only have ${currentGold.toLocaleString()}.`, [{
                text: 'OK',
                value: true
            }]);
            console.error(`handleEditListingSave: Insufficient gold for additional fee. Needed: ${additionalFeeToDeduct}, Available: ${currentGold}. Aborting.`);
            return;
        }

        const listed_price_per_unit = total_listed_price / quantity_listed;
        console.log('New price per unit:', listed_price_per_unit);


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
            console.error('handleEditListingSave: Failed to update listing:', updateListingError);
            await showCustomModal('Error', 'Failed to update listing: ' + updateListingError.message, [{
                text: 'OK',
                value: true
            }]);
            return;
        }
        console.log('Listing successfully updated in DB.');


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
                console.error('handleEditListingSave: Error updating character gold for fee deduction:', updateGoldError.message);
            } else {
                await showCustomModal('Success', `Listing updated and additional fee of ${additionalFeeToDeduct.toLocaleString()} gold deducted!`, [{
                    text: 'OK',
                    value: true
                }]);
                console.log(`Character gold updated from ${currentGold} to ${newGold} after fee deduction.`);
            }
        } else {
            await showCustomModal('Success', 'Listing updated successfully!', [{
                text: 'OK',
                value: true
            }]);
            console.log('Listing updated, no additional fee to deduct.');
        }
        editModal.classList.add('hidden');
        console.log('Edit modal hidden. Calling loadTraderPageData.');
        await loadTraderPageData();
    } catch (e) {
        console.error('handleEditListingSave: An unexpected error occurred while saving changes.', e);
        await showCustomModal('Error', 'An unexpected error occurred while saving changes.', [{
            text: 'OK',
            value: true
        }]);
    } finally {
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = 'Save Changes';
            console.log('Edit save button re-enabled and text reset.');
        }
        console.log('Calling loadActiveListings after edit save.');
        loadActiveListings(); // Ensure listings are refreshed after edit
    }
};


export const showManageMarketStallsModal = async () => {
    console.log('showManageMarketStallsModal called.');
    if (!manageMarketStallsModal) {
        console.error('showManageMarketStallsModal: manageMarketStallsModal element not found.');
        return;
    }

    if (!currentCharacterId) {
        await showCustomModal('Error', 'Please select a character first to manage market stalls.', [{
            text: 'OK',
            value: true
        }]);
        console.error('showManageMarketStallsModal: No character selected. Aborting.');
        return;
    }
    console.log('Character ID present. Preparing manage market stalls modal.');

    createStallError.classList.add('hidden');
    deleteStallError.classList.add('hidden');
    newMarketStallNameInput.value = '';
    console.log('Cleared previous errors and input for new stall.');

    await renderMarketStallsInModal();
    manageMarketStallsModal.classList.remove('hidden');
    console.log('Manage Market Stalls modal displayed.');
};

export const handleEditMarketStallName = async (stallId, newStallName, editInput, saveButton, cancelButton, stallNameSpan, editButton, deleteButton) => {
    console.log('handleEditMarketStallName called for stall ID:', stallId, 'New name:', newStallName);
    saveButton.disabled = true;
    saveButton.textContent = 'Saving...';

    if (!newStallName.trim()) {
        await showCustomModal('Validation Error', 'Stall name cannot be empty.', [{
            text: 'OK',
            value: true
        }]);
        saveButton.disabled = false;
        saveButton.textContent = 'Save';
        console.error('handleEditMarketStallName: Stall name is empty. Aborting.');
        return;
    }

    try {
        const {
            error
        } = await supabase
            .from('market_stalls')
            .update({
                stall_name: newStallName.trim()
            })
            .eq('id', stallId)
            .eq('character_id', currentCharacterId);

        if (error) {
            throw error;
        }
        console.log('Market stall name updated in DB successfully.');

        await showCustomModal('Success', 'Market Stall name updated successfully!', [{
            text: 'OK',
            value: true
        }]);

        stallNameSpan.textContent = newStallName.trim();
        stallNameSpan.classList.remove('hidden');
        editInput.classList.add('hidden');
        saveButton.classList.add('hidden');
        cancelButton.classList.add('hidden');
        editButton.classList.remove('hidden');
        deleteButton.classList.remove('hidden');
        console.log('UI updated after stall name save.');

        console.log('Calling populateMarketStallDropdown and setupMarketStallTabs after stall name edit.');
        await populateMarketStallDropdown();
        await setupMarketStallTabs();

    } catch (e) {
        console.error('handleEditMarketStallName: Error updating market stall name:', e.message, e);
        await showCustomModal('Error', 'Failed to update market stall name: ' + e.message, [{
            text: 'OK',
            value: true
        }]);
    } finally {
        saveButton.disabled = false;
        saveButton.textContent = 'Save';
        console.log('Edit stall name save button re-enabled.');
    }
};


const renderMarketStallsInModal = async () => {
    console.log('renderMarketStallsInModal called.');
    if (!marketStallsList) {
        console.error('renderMarketStallsInModal: marketStallsList element not found.');
        return;
    }

    marketStallsList.innerHTML = '<p class="text-gray-600">Loading stalls...</p>';

    try {
        const stalls = await getUserMarketStallLocations(currentCharacterId);
        console.log('Market stalls fetched for modal rendering:', stalls);

        if (stalls.length === 0) {
            marketStallsList.innerHTML = '<p class="text-gray-600">No market stalls found for this character. Create one below!</p>';
            console.log('No market stalls found to render.');
            return;
        }

        marketStallsList.innerHTML = ''; // Clear loading message
        stalls.forEach(stall => {
            // ... (rest of your stall rendering logic remains the same)
            const stallDiv = document.createElement('div');
            stallDiv.classList.add('flex', 'flex-wrap', 'items-center', 'justify-between', 'bg-gray-100', 'p-3', 'rounded-lg', 'shadow-sm', 'mb-2');
            stallDiv.dataset.stallId = stall.id;

            const stallNameSpan = document.createElement('span');
            stallNameSpan.classList.add('text-gray-800', 'font-medium', 'flex-grow');
            stallNameSpan.textContent = stall.stall_name;

            const editInput = document.createElement('input');
            editInput.type = 'text';
            editInput.classList.add('hidden', 'flex-grow', 'p-1', 'border', 'rounded', 'mr-2');
            editInput.value = stall.stall_name;

            const buttonsDiv = document.createElement('div');
            buttonsDiv.classList.add('flex', 'space-x-2', 'mt-2', 'md:mt-0');

            const editButton = document.createElement('button');
            editButton.type = 'button';
            editButton.classList.add('edit-stall-btn', 'bg-blue-500', 'hover:bg-blue-600', 'text-white', 'font-bold', 'py-1', 'px-3', 'rounded-full', 'text-sm');
            editButton.textContent = 'Edit';
            editButton.dataset.stallId = stall.id;

            const saveButton = document.createElement('button');
            saveButton.type = 'button';
            saveButton.classList.add('save-stall-btn', 'bg-green-500', 'hover:bg-green-600', 'text-white', 'font-bold', 'py-1', 'px-3', 'rounded-full', 'text-sm', 'hidden');
            saveButton.textContent = 'Save';
            saveButton.dataset.stallId = stall.id;

            const cancelButton = document.createElement('button');
            cancelButton.type = 'button';
            cancelButton.classList.add('cancel-stall-btn', 'bg-gray-500', 'hover:bg-gray-600', 'text-white', 'font-bold', 'py-1', 'px-3', 'rounded-full', 'text-sm', 'hidden');
            cancelButton.textContent = 'Cancel';
            cancelButton.dataset.stallId = stall.id;

            const deleteButton = document.createElement('button');
            deleteButton.type = 'button';
            deleteButton.classList.add('delete-stall-btn', 'bg-red-500', 'hover:bg-red-600', 'text-white', 'font-bold', 'py-1', 'px-3', 'rounded-full', 'text-sm');
            deleteButton.textContent = 'Delete';
            deleteButton.dataset.stallId = stall.id;

            buttonsDiv.appendChild(editButton);
            buttonsDiv.appendChild(saveButton);
            buttonsDiv.appendChild(cancelButton);
            buttonsDiv.appendChild(deleteButton);

            stallDiv.appendChild(stallNameSpan);
            stallDiv.appendChild(editInput);
            stallDiv.appendChild(buttonsDiv);
            marketStallsList.appendChild(stallDiv);

            editButton.addEventListener('click', () => {
                console.log('Edit button clicked for stall:', stall.id);
                stallNameSpan.classList.add('hidden');
                editInput.classList.remove('hidden');
                saveButton.classList.remove('hidden');
                cancelButton.classList.remove('hidden');
                editButton.classList.add('hidden');
                deleteButton.classList.add('hidden');
                editInput.focus();
            });

            cancelButton.addEventListener('click', () => {
                console.log('Cancel button clicked for stall:', stall.id);
                editInput.value = stall.stall_name;
                stallNameSpan.classList.remove('hidden');
                editInput.classList.add('hidden');
                saveButton.classList.add('hidden');
                cancelButton.classList.add('hidden');
                editButton.classList.remove('hidden');
                deleteButton.classList.remove('hidden');
            });

            saveButton.addEventListener('click', () => {
                console.log('Save button clicked for stall:', stall.id);
                handleEditMarketStallName(
                    stall.id,
                    editInput.value,
                    editInput,
                    saveButton,
                    cancelButton,
                    stallNameSpan,
                    editButton,
                    deleteButton
                );
            });

            deleteButton.addEventListener('click', () => {
                console.log('Delete button clicked for stall:', stall.id);
                handleDeleteMarketStall(stall.id);
            });
        });

    } catch (e) {
        console.error('renderMarketStallsInModal: Error rendering market stalls in modal:', e);
        marketStallsList.innerHTML = '<p class="text-red-500">Failed to load stalls.</p>';
    }
};

export const handleAddMarketStall = async (e) => {
    console.log('handleAddMarketStall called.');
    e.preventDefault();
    createStallError.classList.add('hidden');

    if (!currentCharacterId) {
        createStallError.textContent = 'Please select a character first.';
        createStallError.classList.remove('hidden');
        console.error('handleAddMarketStall: No character selected. Aborting.');
        return;
    }
    console.log('Character ID present.');

    const stallName = newMarketStallNameInput.value.trim();
    if (!stallName) {
        createStallError.textContent = 'Market Stall Name cannot be empty.';
        createStallError.classList.remove('hidden');
        console.error('handleAddMarketStall: Stall name is empty. Aborting.');
        return;
    }
    console.log('New stall name:', stallName);

    addMarketStallBtn.disabled = true;
    addMarketStallBtn.textContent = 'Creating Stall...';
    console.log('Add market stall button disabled.');


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
        console.log('Market stall inserted into DB successfully.');

        await showCustomModal('Success', 'Market Stall created successfully!', [{
            text: 'OK',
            value: true
        }]);
        newMarketStallNameInput.value = '';
        console.log('Modal shown, input cleared. Calling updates.');

        await populateMarketStallDropdown();
        await setupMarketStallTabs();
        await renderMarketStallsInModal();
        console.log('Market stall UI elements updated.');

    } catch (e) {
        console.error('handleAddMarketStall: Error creating market stall:', e.message, e);
        createStallError.textContent = 'Failed to create market stall: ' + e.message;
        createStallError.classList.remove('hidden');
    } finally {
        addMarketStallBtn.disabled = false;
        addMarketStallBtn.textContent = 'Create Market Stall';
        console.log('Add market stall button re-enabled.');
    }
};

export const createDefaultMarketStall = async (characterId, characterName) => {
    console.log('createDefaultMarketStall called for character:', { characterId, characterName });
    if (!characterId) {
        console.error('createDefaultMarketStall: No character ID provided for creating default market stall.');
        return null;
    }

    if (!characterName) {
        console.error('createDefaultMarketStall: No character name provided for creating default market stall.');
        return null;
    }

    const defaultStallName = `${characterName} - Default Stall`;
    console.log('Default stall name:', defaultStallName);

    try {
        const {
            data,
            error
        } = await supabase
            .from('market_stalls')
            .insert({
                stall_name: defaultStallName,
                character_id: characterId
            })
            .select('id')
            .single();

        if (error) {
            throw error;
        }

        console.log('Default market stall created with ID:', data.id);
        return data.id;
    } catch (e) {
        console.error('createDefaultMarketStall: Error creating default market stall:', e.message, e);
        return null;
    }
};

export const handleDeleteMarketStall = async (stallId) => {
    console.log('handleDeleteMarketStall called for stall ID:', stallId);
    deleteStallError.classList.add('hidden');

    if (!currentCharacterId) {
        deleteStallError.textContent = 'No character selected.';
        deleteStallError.classList.remove('hidden');
        console.error('handleDeleteMarketStall: No character selected. Aborting.');
        return;
    }
    console.log('Character ID present.');


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
        console.log('Stall deletion cancelled by user.');
        return;
    }
    console.log('Confirmation received for stall deletion.');


    try {
        console.log('Checking for active listings in stall:', stallId);
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
            console.warn('Stall has active listings. Cannot delete.');
            await showCustomModal('Deletion Failed', 'This market stall cannot be deleted because it still has active listings. Please cancel or mark all listings as sold first.', [{
                text: 'OK',
                value: true
            }]);
            return;
        }
        console.log('No active listings found for this stall.');


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
        console.log('Market stall successfully deleted from DB.');


        await showCustomModal('Success', 'Market Stall deleted successfully!', [{
            text: 'OK',
            value: true
        }]);
        console.log('Modal shown. Calling UI updates after stall deletion.');


        await populateMarketStallDropdown();
        await setupMarketStallTabs();
        await renderMarketStallsInModal();
        console.log('Market stall UI elements updated after deletion.');

    } catch (e) {
        console.error('handleDeleteMarketStall: Error deleting market stall:', e.message, e);
        deleteStallError.textContent = 'Failed to delete market stall: ' + e.message;
        deleteStallError.classList.remove('hidden');
    }
};