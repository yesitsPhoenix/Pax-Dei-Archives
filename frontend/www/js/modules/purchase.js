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
    purchaseItemNameInput,
    purchaseItemCategorySelect,
    purchaseItemStacksInput,
    purchaseItemCountPerStackInput,
    purchaseItemPricePerStackInput
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

export const handleRecordPurchase = async (e) => {
    e.preventDefault();
    const submitButton = e.target.querySelector('button[type="submit"]');
    if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = 'Recording Purchase...';
    }
    try {
        if (!currentCharacterId) {
            await showCustomModal('Validation Error', 'Please select a character first.', [{
                text: 'OK',
                value: true
            }]);
            return;
        }

        const itemName = purchaseItemNameInput.value.trim();
        const itemCategory = purchaseItemCategorySelect.value;
        const itemStacks = parseInt(purchaseItemStacksInput.value, 10);
        const itemCountPerStack = parseInt(purchaseItemCountPerStackInput.value, 10);
        const itemPricePerStack = parseFloat(purchaseItemPricePerStackInput.value);

        if (!itemName || !itemCategory || isNaN(itemStacks) || isNaN(itemCountPerStack) || isNaN(itemPricePerStack)) {
            await showCustomModal('Validation Error', 'Please fill in all purchase fields correctly.', [{
                text: 'OK',
                value: true
            }]);
            return;
        }

        const itemId = await getOrCreateItemId(itemName, itemCategory);
        if (!itemId) return;

        const quantityPerPurchase = itemCountPerStack;
        const totalPurchasePricePerPurchase = itemPricePerStack;
        const purchasePricePerUnitPerPurchase = totalPurchasePricePerPurchase / quantityPerPurchase;

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
        let totalCost = 0;
        for (let i = 0; i < itemStacks; i++) {
            totalCost += totalPurchasePricePerPurchase;
        }

        if (currentGold < totalCost) {
            await showCustomModal('Validation Error', `Not enough gold! You need ${totalCost.toLocaleString()} gold but only have ${currentGold.toLocaleString()}.`, [{
                text: 'OK',
                value: true
            }]);
            return;
        }

        for (let i = 0; i < itemStacks; i++) {
            const {
                error
            } = await supabase.from('purchases').insert({
                item_id: itemId,
                character_id: currentCharacterId,
                quantity_purchased: quantityPerPurchase,
                purchase_price_per_unit: purchasePricePerUnitPerPurchase,
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