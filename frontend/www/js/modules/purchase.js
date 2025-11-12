import {
    supabase
} from '../supabaseClient.js';
import {
    showCustomModal,
    loadTraderPageData
} from '../trader.js';
import {
    currentCharacterId,
    setCurrentCharacterGold
} from './characters.js';

// Helper function to round a number to exactly two decimal places
const roundToTwoDecimals = (num) => {
    return Math.round((num + Number.EPSILON) * 100) / 100;
};

const getOrCreateItemId = async (itemName) => {
    if (!currentCharacterId) {
        console.error('[getOrCreateItemId] No character selected.');
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
        .limit(1);

    if (selectError) {
        console.error('[getOrCreateItemId] Failed to check for existing item:', selectError);
        await showCustomModal('Error', 'Failed to check for existing item.', [{
            text: 'OK',
            value: true
        }]);
        return null;
    }

    if (items && items.length > 0) {
        return items[0].item_id;
    }

    const {
        data: newItem,
        error: insertError
    } = await supabase
        .from('items')
        .insert([{
            item_name: itemName,
        }])
        .select('item_id')
        .single();

    if (insertError) {
        console.error('[getOrCreateItemId] Supabase insert error for new item:', insertError);
        console.error('Details:', insertError.details);
        console.error('Hint:', insertError.hint);
        await showCustomModal('Error', 'Failed to create new item record: ' + insertError.message, [{
            text: 'OK',
            value: true
        }]);
        return null;
    }

    return newItem.item_id;
};

export const handleRecordPurchase = async (e) => {
    e.preventDefault();

    if (!currentCharacterId) {
        console.error('[handleRecordPurchase] No character selected.');
        await showCustomModal('Error', 'Please select a character first.', [{
            text: 'OK',
            value: true
        }]);
        return;
    }

    const submitButton = e.submitter;
    if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = 'Recording...';
    }

    const itemName = document.getElementById('modal-purchase-item-name').value;
    const numStacks = parseInt(document.getElementById('modal-purchase-item-stacks').value, 10) || 1;
    const countPerStack = parseInt(document.getElementById('modal-purchase-item-count-per-stack').value, 10);
    const totalPrice = parseFloat(document.getElementById('modal-purchase-item-total-price').value);
    const date = new Date().toISOString();
    // const notes is unused

    const totalCostOfAllStacks = totalPrice;
    
    // Calculate total quantity purchased
    const totalQuantity = numStacks * countPerStack;


    if (!itemName || isNaN(numStacks) || isNaN(countPerStack) || isNaN(totalPrice) || numStacks <= 0 || countPerStack <= 0) {
        console.error('[handleRecordPurchase] Validation failed: Missing or invalid required fields.');
        await showCustomModal('Error', 'Please fill in all required fields: Item Name, Stacks, Count per Stack, and Total Price. Stacks and Count must be greater than zero.', [{
            text: 'OK',
            value: true
        }]);
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = 'Record Purchase';
        }
        return;
    }
    
    if (totalPrice < 0) {
        await showCustomModal('Error', 'Total Price cannot be negative.', [{
            text: 'OK',
            value: true
        }]);
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = 'Record Purchase';
        }
        return;
    }


    try {
        const itemId = await getOrCreateItemId(itemName);
        if (!itemId) {
            console.warn('[handleRecordPurchase] Item ID could not be obtained. Aborting purchase record.');
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.textContent = 'Record Purchase';
            }
            return;
        }

        const {
            data: existingGoldData,
            error: goldError
        } = await supabase
            .from('characters')
            .select('gold')
            .eq('character_id', currentCharacterId)
            .single();

        if (goldError) {
            console.error('[handleRecordPurchase] Error fetching character gold:', goldError);
            throw goldError;
        }

        const currentGold = existingGoldData.gold || 0;

        if (currentGold < totalCostOfAllStacks) {
            console.warn('[handleRecordPurchase] Not enough gold for purchase.');
            await showCustomModal('Error', `Not enough gold. Current gold: ${currentGold.toLocaleString()}. Purchase cost: ${totalCostOfAllStacks.toLocaleString()}.`, [{
                text: 'OK',
                value: true
            }]);
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.textContent = 'Record Purchase';
            }
            return;
        }

        // Calculate Price Per Unit based on total cost and total quantity
        let pricePerUnit = 0;
        if (totalQuantity > 0) {
            pricePerUnit = totalCostOfAllStacks / totalQuantity;
            pricePerUnit = roundToTwoDecimals(pricePerUnit); // Round for display consistency
        }

        // Only one record to insert for the entire purchase
        const recordToInsert = {
            item_id: itemId,
            character_id: currentCharacterId,
            quantity_purchased: totalQuantity, // Total Quantity
            purchase_price_per_unit: pricePerUnit,
            total_purchase_price: totalCostOfAllStacks, // Total Price (84.00 gold)
            purchase_date: date,
        };

        const {
            data: insertedData,
            error: insertPurchaseError,
        } = await supabase
            .from('purchases')
            .insert([recordToInsert]) // Insert single record
            .select('*');

        const actualSuccessCount = insertedData ? insertedData.length : 0;


        if (insertPurchaseError) {
            console.error('[handleRecordPurchase] Supabase insert error:', insertPurchaseError);
            throw insertPurchaseError;
        }

        if (actualSuccessCount > 0) {
            const newGold = currentGold - totalCostOfAllStacks;

            const {
                error: updateGoldError
            } = await supabase
                .from('characters')
                .update({
                    gold: newGold
                })
                .eq('character_id', currentCharacterId);

            if (updateGoldError) {
                console.error('[handleRecordPurchase] SUCCESS BLOCK: Error deducting gold:', updateGoldError.message);
                await showCustomModal('Error', 'Successfully recorded purchase(s), but failed to deduct gold: ' + updateGoldError.message, [{
                    text: 'OK',
                    value: true
                }]);
            } else {
                await showCustomModal('Success', `Successfully recorded 1 new purchase for ${totalQuantity.toLocaleString()} items and deducted ${totalCostOfAllStacks.toLocaleString()} gold!`, [{
                    text: 'OK',
                    value: true
                }]);
                e.target.reset();
                setCurrentCharacterGold(newGold);
                await loadTraderPageData(false);
            }
        } else {
            console.warn('[handleRecordPurchase] FALLBACK BLOCK: Insert operation reported no error but 0 actual inserts (returned data array was empty).');
            await showCustomModal('Error', 'Failed to record any purchases. The database reported no error but inserted 0 rows. Please check console logs for details, especially the "Records to Insert" content and Supabase Database Logs for hidden constraints.', [{
                text: 'OK',
                value: true
            }]);
        }
    } catch (e) {
        console.error('[handleRecordPurchase] An unhandled error occurred during purchase recording:', e);
        await showCustomModal('Error', 'An unexpected error occurred while recording the purchase: ' + e.message, [{
            text: 'OK',
            value: true
        }]);
    } finally {
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = 'Record Purchase';
        }
    }
};