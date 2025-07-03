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
        .insert([{
            item_name: itemName,
            category_id: categoryId,
            character_id: currentCharacterId
        }])
        .select('item_id')
        .single();

    if (insertError) {
        console.error('Supabase insert error:', insertError);
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

    const itemName = document.getElementById('purchase-item-name').value;
    const categoryId = document.getElementById('purchase-item-category').value;
    const quantity = parseInt(document.getElementById('purchase-quantity').value, 10);
    const costPerItem = parseInt(document.getElementById('purchase-cost-per-item').value, 10);
    const date = document.getElementById('purchase-date').value;
    const notes = document.getElementById('purchase-notes').value;
    const marketStallId = document.getElementById('purchase-market-stall-location').value;

    if (!itemName || !categoryId || isNaN(quantity) || isNaN(costPerItem) || !date || !marketStallId) {
        await showCustomModal('Error', 'Please fill in all required fields: Item Name, Category, Quantity, Cost Per Item, Date, and Market Stall.', [{
            text: 'OK',
            value: true
        }]);
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = 'Record Purchase';
        }
        return;
    }

    const integerCategoryId = parseInt(categoryId, 10);
    if (isNaN(integerCategoryId)) {
        await showCustomModal('Error', 'Invalid category selected. Please ensure a valid category is chosen.', [{
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
        const itemId = await getOrCreateItemId(itemName, integerCategoryId);
        if (!itemId) {
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.textContent = 'Record Purchase';
            }
            return;
        }

        const totalCost = quantity * costPerItem;

        const {
            data: existingGoldData,
            error: goldError
        } = await supabase
            .from('characters')
            .select('gold')
            .eq('character_id', currentCharacterId)
            .single();

        if (goldError) {
            throw goldError;
        }

        const currentGold = existingGoldData.gold || 0;

        if (currentGold < totalCost) {
            await showCustomModal('Error', `Not enough gold. Current gold: ${currentGold.toLocaleString()}. Purchase cost: ${totalCost.toLocaleString()}.`, [{
                text: 'OK',
                value: true
            }]);
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.textContent = 'Record Purchase';
            }
            return;
        }

        // Handle multiple stacks if inputs are provided
        const numStacks = parseInt(document.getElementById('purchase-item-stacks').value, 10) || 1;
        const countPerStack = parseInt(document.getElementById('purchase-item-count-per-stack').value, 10) || quantity;

        const recordsToInsert = [];
        for (let i = 0; i < numStacks; i++) {
            recordsToInsert.push({
                item_id: itemId,
                character_id: currentCharacterId,
                market_stall_id: marketStallId,
                purchase_quantity: (numStacks > 1) ? countPerStack : quantity, // Use countPerStack if multiple stacks, else use total quantity
                cost_per_item: costPerItem,
                total_cost: (numStacks > 1) ? (countPerStack * costPerItem) : totalCost,
                purchase_date: date,
                notes: notes,
            });
        }


        const {
            error: insertPurchaseError,
            count: successCount
        } = await supabase
            .from('purchases')
            .insert(recordsToInsert)
            .select('*', {
                count: 'exact'
            });


        if (insertPurchaseError) {
            throw insertPurchaseError;
        }

        if (successCount > 0) {
            const newGold = currentGold - totalCost;
            const {
                error: updateGoldError
            } = await supabase
                .from('characters')
                .update({
                    gold: newGold
                })
                .eq('character_id', currentCharacterId);

            if (updateGoldError) {
                await showCustomModal('Error', 'Successfully recorded purchase(s), but failed to deduct gold: ' + updateGoldError.message, [{
                    text: 'OK',
                    value: true
                }]);
                console.error('Error deducting gold:', updateGoldError.message);
            } else {
                await showCustomModal('Success', `Successfully recorded ${successCount} new purchase(s) and deducted ${totalCost.toLocaleString()} gold!`, [{
                    text: 'OK',
                    value: true
                }]);
                e.target.reset();
                await loadTraderPageData();
            }
        } else {
            await showCustomModal('Error', 'Failed to record any purchases. Errors: ' + errors.join(', '), [{
                text: 'OK',
                value: true
            }]);
        }
    } catch (e) {
        console.error('Error recording purchase:', e);
        await showCustomModal('Error', 'An unexpected error occurred while recording the purchase.', [{
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